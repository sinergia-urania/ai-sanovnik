// File: src/auth/socialAuth.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_REDIRECT = Linking.createURL('auth/callback');
const PENDING_OAUTH_KEY = 'auth:pending_oauth_url';

const SCOPE_MAP = {
  facebook: 'email,public_profile',
  google: 'openid email profile',
  apple: 'name email',
};

function getParams(url) {
  if (!url) return {};
  const u = String(url);
  const query = u.includes('?') ? u.split('?')[1].split('#')[0] : '';
  const hash  = u.includes('#') ? u.split('#')[1] : '';
  const q = new URLSearchParams(query);
  const h = new URLSearchParams(hash);
  h.forEach((v, k) => q.set(k, v));
  const out = {}; q.forEach((v, k) => (out[k] = v));
  return out;
}

async function waitForSession(maxMs = 60000, stepMs = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) return session;
    } catch {}
    await new Promise(r => setTimeout(r, stepMs));
  }
  return null;
}

function withTimeout(promise, ms, reason) {
  let t;
  const timeout = new Promise((_, r) => (t = setTimeout(() => r(new Error(reason || `timeout:${ms}`)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

export async function signInWithProvider(provider) {
  // ⬅️ Ako si već ulogovan, ne otvaraj OAuth uopšte (sprečava večno “busy”)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return { ok: true, via: 'already-signed-in' };
  } catch {}

  let subAuth = null;
  let subLink = null;
  try {
    const scopes = SCOPE_MAP[provider] ?? 'openid email profile';
    const queryParams = provider === 'google' ? { prompt: 'select_account' } : undefined;

    const { data, error } = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: OAUTH_REDIRECT,
          scopes,
          flowType: 'implicit',
          skipBrowserRedirect: true,
          queryParams,
        },
      }),
      15000,
      'signInWithOAuth_timeout'
    );

    if (error) return { ok: false, reason: `Supabase: ${error.message || 'error'}` };
    if (!data?.url) return { ok: false, reason: 'Nema auth URL-a (provider/redirect?)' };

    console.log('[oauth] start url=', data.url, 'redirect=', OAUTH_REDIRECT);

    const pAuth = new Promise((resolve) => {
      subAuth = supabase.auth.onAuthStateChange(async (event, s) => {
        if (event === 'SIGNED_IN' && s?.user?.id) {
          try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
          try { WebBrowser.dismissBrowser(); } catch {}
          resolve({ ok: true, via: 'auth-event' });
        }
      });
    });

    let capturedUrl = null;
    const handleUrl = async (url) => {
      if (!url) return false;
      try { await AsyncStorage.setItem(PENDING_OAUTH_KEY, url); } catch {}
      const p = getParams(url);
      const access = p.access_token;
      const refresh = p.refresh_token;
      const code = p.code || p.auth_code;

      if (access && refresh) {
        try { await supabase.auth.setSession({ access_token: access, refresh_token: refresh }); } catch {}
        await waitForSession(10000);
        try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
        return true;
      }
      if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
        try { await supabase.auth.exchangeCodeForSession({ authCode: code }); }
        catch { await supabase.auth.exchangeCodeForSession(code); }
        await waitForSession(10000);
        try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
        return true;
      }
      return false;
    };

    const pLink = new Promise((resolve) => {
      subLink = Linking.addEventListener('url', async ({ url }) => {
        capturedUrl = url;
        try { WebBrowser.dismissBrowser(); } catch {}
        const ok = await handleUrl(url);
        resolve(ok ? { ok: true, via: 'deeplink' } : { ok: false, reason: 'deeplink_invalid' });
      });
    });

    const pOpen = (async () => {
      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
      if (result?.type === 'success' && result?.url) {
        const ok = await handleUrl(result.url);
        return ok ? { ok: true, via: 'auth-session' } : { ok: false, reason: 'callback_invalid' };
      }
      if (capturedUrl) {
        const ok = await handleUrl(capturedUrl);
        return ok ? { ok: true, via: 'captured' } : { ok: false, reason: 'captured_invalid' };
      }
      const s = await waitForSession(4000);
      return s?.user?.id ? { ok: true, via: 'poll' } : { ok: false, reason: 'no_callback' };
    })();

    const result = await withTimeout(Promise.race([pAuth, pLink, pOpen]), 45000, 'auth_session_timeout');
    console.log('[oauth] result=', result);
    return result?.ok ? { ok: true } : { ok: false, reason: result?.reason || 'unknown' };
  } catch (e) {
    console.log('[oauth:error]', e);
    return { ok: false, reason: String(e?.message || e) };
  } finally {
    try { subAuth?.data?.subscription?.unsubscribe?.(); } catch {}
    try { subLink?.remove?.(); } catch {}
    try { WebBrowser.dismissBrowser(); } catch {}
  }
}
