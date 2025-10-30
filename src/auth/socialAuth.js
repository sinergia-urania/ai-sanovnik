// File: src/auth/socialAuth.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates'; // ✅ PRODUCTION reload
import * as WebBrowser from 'expo-web-browser';
import { DevSettings } from 'react-native';
import { supabase } from '../lib/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_REDIRECT = Linking.createURL('auth/callback');
const PENDING_OAUTH_KEY = 'auth:pending_oauth_url';

const SCOPE_MAP = {
  facebook: 'email,public_profile',
  google:   'openid email profile',
  apple:    'name email',
};

const now = () => new Date().toISOString().split('T')[1].replace('Z', '');
const log = (...a) => console.log('[oauth]', now(), ...a);

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

function withTimeout(promise, ms, label = 'timeout') {
  let t;
  const killer = new Promise((_, reject) =>
    (t = setTimeout(() => reject(new Error(`${label}:${ms}`)), ms))
  );
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(t)), killer]);
}

// 🔁 Hard reload: u dev-u DevSettings.reload(), u produkciji Updates.reloadAsync()
async function hardReload(reason = 'auth_handoff') {
  try { log('HARD RELOAD →', reason); } catch {}
  if (__DEV__) {
    try { DevSettings?.reload?.(); return; } catch (e) { log('DevSettings.reload err:', String(e?.message || e)); }
  }
  try { await Updates.reloadAsync(); } catch (e) { log('Updates.reloadAsync err:', String(e?.message || e)); }
}

async function waitForSession(maxMs = 6000, stepMs = 150) {
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

async function handleCallbackUrl(url) {
  if (!url) return false;
  log('callback url =', url);
  const params = getParams(url);
  const access  = params.access_token;
  const refresh = params.refresh_token;
  const code    = params.code || params.auth_code;

  const hasAuth = !!(access && refresh) || !!code;
  if (!hasAuth) {
    log('callback WITHOUT auth params → ignore');
    return false;
  }

  // Handoff za cold-start
  try { await AsyncStorage.setItem(PENDING_OAUTH_KEY, url); } catch {}

  try {
    if (access && refresh) {
      log('setSession(implicit)…');
      await withTimeout(
        supabase.auth.setSession({ access_token: access, refresh_token: refresh }),
        2000,
        'setSession'
      );
      const s = await waitForSession(4000);
      if (!s?.user?.id) {
        log('no session after setSession → cold-start handoff');
        await hardReload('no_session_after_setSession');
        return false;
      }
      try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
      log('setSession OK');
      return true;
    }

    if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
      log('exchangeCodeForSession (pkce)…');
      try { await withTimeout(supabase.auth.exchangeCodeForSession({ authCode: code }), 7000, 'exchangeCode'); }
      catch { await withTimeout(supabase.auth.exchangeCodeForSession(code), 7000, 'exchangeCode'); }
      const s = await waitForSession(4000);
      if (!s?.user?.id) {
        log('no session after exchange → cold-start handoff');
        await hardReload('no_session_after_exchange');
        return false;
      }
      try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
      log('exchangeCodeForSession OK');
      return true;
    }
  } catch (e) {
    const msg = String(e?.message || e);
    log('set/exchange error or timeout →', msg, ' → cold-start handoff');
    await hardReload('auth_set_or_exchange_error');
    return false;
  }

  return false;
}

async function tryWithTimeout(fn, ms, name) {
  try {
    await withTimeout(Promise.resolve(fn?.()), ms, name);
    log(`${name} OK`);
  } catch (e) {
    log(`${name} SKIP`, String(e?.message || e));
  }
}

// Bezbedno dismiss pre novog otvaranja
async function tryWithRollbackDismiss() {
  try { await withTimeout(WebBrowser.dismissBrowser?.(), 1000, 'dismissBrowser'); log('WebBrowser.dismissBrowser OK'); }
  catch (e) { log('WebBrowser.dismissBrowser SKIP', String(e?.message || e)); }
}

export async function signInWithProvider(provider) {
  log('CALL signInWithProvider(', provider, ')');

  // 0) već ulogovan?
  try {
    const s = await withTimeout(supabase.auth.getSession(), 1500, 'getSession_sanity');
    const sid = s?.data?.session?.user?.id;
    log('pre-check session=', !!sid);
    if (sid) return { ok: true, via: 'already-signed-in' };
  } catch (e) {
    log('pre-check session skip:', String(e?.message || e));
  }

  // 1) očisti repove
  try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); log("Removed 'auth:pending_oauth_url'"); } catch {}
  await Promise.allSettled([
    tryWithRollbackDismiss(),
    tryWithTimeout(() => WebBrowser.coolDownAsync?.(), 1200, 'WebBrowser.coolDownAsync'),
    tryWithTimeout(() => WebBrowser.warmUpAsync?.(), 1200, 'WebBrowser.warmUpAsync'),
    tryWithTimeout(() => (typeof WebBrowser.clearBrowserCookiesAsync === 'function'
      ? WebBrowser.clearBrowserCookiesAsync()
      : undefined), 1500, 'WebBrowser.clearBrowserCookiesAsync'),
  ]);

  let resolved = false;
  let lastSig = null;
  const seen = new Set();

  const subLink = Linking.addEventListener('url', async ({ url }) => {
    if (resolved || !url) return;
    const p = getParams(url);
    const sig = p.access_token || p.code || p.refresh_token || url;
    if (seen.has(sig)) return;
    seen.add(sig);
    log('(backup) Linking url event', url);
    const ok = await handleCallbackUrl(url); // po potrebi radi hardReload
    if (ok) {
      resolved = true;
      try { WebBrowser.dismissBrowser?.(); } catch {}
    }
  });

  let subAuth = null;

  try {
    const scopes = SCOPE_MAP[provider] ?? 'openid email profile';
    const queryParams = provider === 'google' ? { prompt: 'select_account' } : undefined;

    log('ENTER provider=', provider, ' redirect=', OAUTH_REDIRECT);

    // 2) izvuci auth URL
    const { data, error } = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: OAUTH_REDIRECT, scopes, skipBrowserRedirect: true, queryParams },
      }),
      12000,
      'signInWithOAuth'
    );
    if (error) return { ok: false, reason: `Supabase:${error.message || 'error'}` };
    if (!data?.url) return { ok: false, reason: 'Nema auth URL-a (provider/redirect?)' };
    log('auth start url =', data.url);

    // 3) slušaj AUTH event
    const pAuth = new Promise((resolve) => {
      const h = supabase.auth.onAuthStateChange(async (event, s) => {
        log('onAuthStateChange:', event, s?.user?.id ? 'HAS_SESSION' : 'NO_SESSION');
        if (event === 'SIGNED_IN' && s?.user?.id) {
          resolved = true;
          try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
          try { WebBrowser.dismissBrowser?.(); } catch {}
          resolve({ ok: true, via: 'auth-event' });
          h?.data?.subscription?.unsubscribe?.();
        }
      });
      subAuth = h;
    });

    // 4) otvori browser + fallbackovi
    const pOpen = (async () => {
      log('openAuthSessionAsync opening…', data.url);

      let fallbackFired = false;
      const fallbackTimer = setTimeout(async () => {
        if (resolved || fallbackFired) return;
        fallbackFired = true;
        log('openAuthSessionAsync slow → F1 Linking.openURL');
        try { await Linking.openURL(data.url); } catch (e) { log('F1 openURL error:', String(e?.message || e)); }

        setTimeout(async () => {
          if (resolved) return;
          log('openAuthSessionAsync slow → F2 signInWithOAuth (skipBrowserRedirect=false)');
          try {
            await supabase.auth.signInWithOAuth({
              provider,
              options: { redirectTo: OAUTH_REDIRECT, scopes, skipBrowserRedirect: false, queryParams },
            });
          } catch (e) { log('F2 signInWithOAuth error:', String(e?.message || e)); }
        }, 900);
      }, 1200);

      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT).catch((e) => {
        log('openAuthSessionAsync threw:', String(e?.message || e));
        return { type: 'error' };
      });

      clearTimeout(fallbackTimer);
      log('openAuthSessionAsync result ', result);
      if (resolved) return { ok: true, via: 'race-resolved' };

      if (result?.type === 'success' && result?.url) {
        const p = getParams(result.url);
        const sig = p.access_token || p.code || p.refresh_token || result.url;
        if (sig !== lastSig) {
          lastSig = sig;
          const ok = await handleCallbackUrl(result.url); // po potrebi radi hardReload
          if (ok) return { ok: true, via: 'auth-session' };
        }
        return { ok: false, reason: 'callback_invalid' };
      }

      const s = await waitForSession(5000);
      if (s?.user?.id) return { ok: true, via: 'poll' };

      log('no callback/no session → final cold-start handoff');
      await hardReload('no_callback_final');
      return { ok: false, reason: result?.type || 'no_callback' };
    })();

    const result = await withTimeout(Promise.race([pAuth, pOpen]), 32000, 'auth_session_timeout');
    log('result =', result);
    return result?.ok ? { ok: true } : { ok: false, reason: result?.reason || 'unknown' };
  } catch (e) {
    log('ERROR', String(e?.message || e));
    return { ok: false, reason: String(e?.message || e) };
  } finally {
    try { subAuth?.data?.subscription?.unsubscribe?.(); } catch {}
    try { subLink?.remove?.(); } catch {}
    try { WebBrowser.dismissBrowser?.(); } catch {}
  }
}
