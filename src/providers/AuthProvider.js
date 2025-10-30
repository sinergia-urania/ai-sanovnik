// File: src/providers/AuthProvider.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { hydrateAuth, supabase, SUPABASE_REF } from '../lib/supabaseClient';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const AuthCtx = createContext(null);
const PENDING_OAUTH_KEY = 'auth:pending_oauth_url';

const AUTH_STORAGE_KEYS = [
  `sb-${SUPABASE_REF}-auth-token`,
  `sb-${SUPABASE_REF}-auth-token.0`,
  `sb-${SUPABASE_REF}-auth-token.1`,
  `sb-${SUPABASE_REF}-auth-token.2`,
  'supabase.auth.token',
];

function getParams(url) {
  if (!url) return {};
  const u = String(url);
  const q = u.includes('?') ? u.split('?')[1].split('#')[0] : '';
  const h = u.includes('#') ? u.split('#')[1] : '';
  const qs = new URLSearchParams(q);
  const hs = new URLSearchParams(h);
  hs.forEach((v, k) => qs.set(k, v));
  const out = {}; qs.forEach((v, k) => (out[k] = v));
  return out;
}

async function getAccessTokenFromStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((k) => k.includes(`sb-${SUPABASE_REF}-auth-token`) || k === 'supabase.auth.token');
    for (const k of authKeys) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      let parsed = null; try { parsed = JSON.parse(raw); } catch {}
      const s = parsed?.currentSession || parsed || null;
      const t = s?.access_token || s?.accessToken || null;
      if (t) return t;
    }
  } catch {}
  return null;
}

const applySessionFromUrlFactory = () => async function applySessionFromUrl(url, handledRef, processingRef, justSetSessionRef) {
  if (!url) return false;
  const p = getParams(url);
  const hasAuthParams = !!(p.access_token || p.refresh_token || p.code || p.auth_code);
  if (!hasAuthParams) return false;

  const sig = p.access_token || p.refresh_token || p.code || p.auth_code || url;
  if (!handledRef.current) handledRef.current = new Set();
  if (handledRef.current.has(sig) || processingRef.current) return false;
  processingRef.current = true;

  console.log('[auth:url] incoming (hasAuthParams=', hasAuthParams, ')');

  try {
    const access = p.access_token;
    const refresh = p.refresh_token;

    if (access && refresh) {
      const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
      if (error) { console.warn('[auth:url] setSession error:', error.message || error); return false; }
      handledRef.current.add(sig);
      justSetSessionRef.current = Date.now();
      console.log('[auth:url] setSession OK');
      return true;
    }

    const code = p.code || p.auth_code;
    if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
      try { await supabase.auth.exchangeCodeForSession({ authCode: code }); }
      catch { await supabase.auth.exchangeCodeForSession(code); }
      handledRef.current.add(sig);
      justSetSessionRef.current = Date.now();
      console.log('[auth:url] exchangeCodeForSession OK');
      return true;
    }
  } catch (e) {
    console.warn('[auth:url] apply error:', e?.message || e);
  } finally {
    processingRef.current = false;
  }
  return false;
};

async function serverValidateWhoAmI(signal) {
  const token = await getAccessTokenFromStorage();
  if (!token) return { ok: false, reason: 'no-token' };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY || '',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
      signal,
    });
    if (!r.ok) return { ok: false, status: r.status, reason: 'whoami-failed' };
    const data = await r.json().catch(() => null);
    const uid = data?.uid || null;
    return uid ? { ok: true, uid, token } : { ok: false, reason: 'no-uid' };
  } catch (e) {
    if (String(e?.name) === 'AbortError') return { ok: false, reason: 'aborted' };
    return { ok: false, reason: String(e?.message || e) };
  }
}

async function fetchCoinsLazy() {
  const token = await getAccessTokenFromStorage();
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/quota_get_lazy`, {
      method: 'POST',
      headers: { apikey: ANON_KEY || '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({}),
    });
    const js = await r.json().catch(() => null);
    return (r.ok && js && typeof js.balance === 'number') ? js.balance : null;
  } catch { return null; }
}

const isProPlus = (p) => ['proplus','pro_plus','proplus_annual','proplus_yearly'].includes(String(p).toLowerCase());

export function AuthProvider({ children }) {
  const [session, setSession]       = useState(null);
  const [plan, setPlan]             = useState('free');
  const [coins, setCoins]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [validated, setValidated]   = useState(false);
  const [authEpoch, setAuthEpoch]   = useState(0);
  const [forceLogoutGate, setForceLogoutGate] = useState(false);

  const handledLinksRef   = useRef(new Set());
  const processingLinkRef = useRef(false);
  const presenceTimerRef  = useRef(null);
  const signingOutRef     = useRef(false);
  const whoamiAbortRef    = useRef(null);
  const justSetSessionRef = useRef(0);
  const recentSignInAtRef = useRef(0);
  const LOGIN_DEBOUNCE_MS = 2000;
  const gateWasOpenRef    = useRef(false);

  const applySessionFromUrl = applySessionFromUrlFactory();

  const presencePing = async () => {
    const token = await getAccessTokenFromStorage();
    if (!token) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/presence_ping`, {
        method: 'POST',
        headers: { apikey: ANON_KEY || '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ttl_sec: 180 }),
      });
    } catch {}
  };
  const startPresence = () => { if (!presenceTimerRef.current) { presencePing(); presenceTimerRef.current = setInterval(presencePing, 60_000); } };
  const stopPresence  = () => { if (presenceTimerRef.current) { clearInterval(presenceTimerRef.current); presenceTimerRef.current = null; } };

  async function openAfterServerCheck(localSessionMaybe) {
    if (signingOutRef.current) return false;

    try { whoamiAbortRef.current?.abort(); } catch {}
    const ctrl = new AbortController();
    whoamiAbortRef.current = ctrl;

    const v = await serverValidateWhoAmI(ctrl.signal);
    console.log('[gate] whoami=', v);

    if (!v.ok || !v.uid) {
      setValidated(false);
      setLoading(false);
      if (gateWasOpenRef.current) { setAuthEpoch(e => e + 1); gateWasOpenRef.current = false; }
      return false;
    }

    const s = localSessionMaybe?.user?.id ? localSessionMaybe : { user: { id: v.uid } };
    setSession(s);
    setValidated(true);
    setLoading(false);
    startPresence();

    if (!gateWasOpenRef.current) { setAuthEpoch(e => e + 1); gateWasOpenRef.current = true; }

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=plan&id=eq.${encodeURIComponent(v.uid)}&limit=1`, {
        headers: { apikey: ANON_KEY || '', Authorization: `Bearer ${v.token}` },
      });
      const arr = await r.json().catch(() => []);
      if (Array.isArray(arr) && arr[0]?.plan) setPlan(arr[0].plan);
    } catch {}
    fetchCoinsLazy().then(c => { if (typeof c === 'number') setCoins(c); }).catch(()=>{});
    return true;
  }

  const localClear = async (purgeTokens = false) => {
    console.log('[auth] localClear purge=', purgeTokens);
    try { whoamiAbortRef.current?.abort(); } catch {}
    try { supabase.removeAllChannels?.(); } catch {}

    setSession(null);
    setPlan('free');
    setCoins(null);
    setValidated(false);
    stopPresence();
    setLoading(false);

    if (gateWasOpenRef.current) { setAuthEpoch(e => e + 1); gateWasOpenRef.current = false; }

    if (purgeTokens) {
      try { await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS); } catch {}
      try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
      try { supabase.functions.setAuth?.(''); } catch {}
    }
  };

  const signOut = async () => {
    console.log('[auth] signOut ENTER');
    signingOutRef.current = true;
    setForceLogoutGate(true);

    await localClear(false);
    try { await supabase.auth.signOut({ scope: 'global' }); console.log('[auth] supabase.auth.signOut OK'); }
    catch (e) { console.warn('[auth] supabase.auth.signOut error:', e?.message || e); }

    try { await WebBrowser.dismissBrowser?.(); console.log('[auth] WebBrowser.dismissBrowser()'); } catch {}
    try { await WebBrowser.coolDownAsync?.(); await WebBrowser.warmUpAsync?.(); console.log('[auth] WebBrowser coolDown+warmUp'); } catch {}

    // 👇 dodatni hard-reset dedupe mehanizama za sledeći login
    try { handledLinksRef.current?.clear?.(); } catch {}
    processingLinkRef.current = false;
    justSetSessionRef.current = 0;

    await localClear(true);

    setForceLogoutGate(false);
    signingOutRef.current = false;
    console.log('[auth] signOut EXIT');
  };

  useEffect(() => {
    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (initial) {
          console.log('[auth:url] getInitialURL (present, redacted)');
          const ok = await applySessionFromUrl(initial, handledLinksRef, processingLinkRef, justSetSessionRef);
          if (ok) console.log('[auth:url] initial handled'); else console.log('[auth:url] initial has no auth params → ignore');
        } else {
          console.log('[auth:url] getInitialURL = null');
        }
      } catch {}
      try {
        const pending = await AsyncStorage.getItem(PENDING_OAUTH_KEY);
        if (pending) {
          console.log('[auth:url] found pending oauth url (redacted)');
          const p = getParams(pending);
          const hasAuth = !!(p.access_token || p.refresh_token || p.code || p.auth_code);
          if (!hasAuth) {
            console.log('[auth:url] pending WITHOUT auth params → clearing');
            try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
          } else {
            const ok = await applySessionFromUrl(pending, handledLinksRef, processingLinkRef, justSetSessionRef);
            if (ok) { try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {} }
          }
        }
      } catch {}
    })();
    const sub = Linking.addEventListener('url', async ({ url }) => {
      try {
        const ok = await applySessionFromUrl(url, handledLinksRef, processingLinkRef, justSetSessionRef);
        if (ok) console.log('[auth:url] event handled');
      } catch {}
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => { await hydrateAuth(); })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('[auth] event=', event);

      if (event === 'SIGNED_OUT') {
        const sinceLogin = Date.now() - (recentSignInAtRef.current || 0);
        if (!signingOutRef.current && sinceLogin < LOGIN_DEBOUNCE_MS) {
          console.log('[auth] IGNORE SIGNED_OUT (', sinceLogin, 'ms after SIGNED_IN)');
          return;
        }
        const since = Date.now() - (justSetSessionRef.current || 0);
        let stillHasToken = null;
        try { stillHasToken = await getAccessTokenFromStorage(); } catch {}
        if (since < 3000 || !!stillHasToken) {
          console.log('[auth] IGNORE transient SIGNED_OUT (since=', since, 'ms, hasToken=', !!stillHasToken, ')');
          return;
        }
        if (!signingOutRef.current) {
          setForceLogoutGate(true);
          await localClear(true);
          setForceLogoutGate(false);
        }
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_IN' && s?.user?.id) recentSignInAtRef.current = Date.now();
        await openAfterServerCheck(s ?? null);
      }
    });

    return () => { sub?.subscription?.unsubscribe?.(); mounted = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && validated) presencePing(); });
    return () => sub.remove();
  }, [validated]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) { console.log('[watchdog] force loading=false'); setLoading(false); }
    }, 6000);
    return () => clearTimeout(t);
  }, [loading]);

  const isAuthenticated = !!validated && !forceLogoutGate;

  const processAuthUrl = async (url) => {
    try {
      const ok = await applySessionFromUrl(url, handledLinksRef, processingLinkRef, justSetSessionRef);
      if (ok) console.log('[auth:url] processed via context'); else console.log('[auth:url] ignored via context');
    } catch (e) {
      console.warn('[auth:url] process error:', e?.message || e);
    }
  };

  const value = useMemo(() => {
    const planLower = String(plan).toLowerCase();
    const proPlus = isProPlus(planLower);
    const proLike = planLower === 'pro' || proPlus;

    return {
      session,
      user: session?.user ?? null,
      plan,
      coins,
      refreshQuota: async () => { const v = await fetchCoinsLazy(); if (typeof v === 'number') setCoins(v); },
      loading,
      isAuthenticated,
      authEpoch,
      isFree: planLower === 'free',
      isPremium: planLower === 'premium' || proLike,
      isPro: proLike,
      has: (need) =>
        need === 'free' ||
        (need === 'premium' && (planLower === 'premium' || proLike)) ||
        (need === 'pro' && proLike),
      requirePlan: (need, navigation) => {
        const ok =
          need === 'free' ||
          (need === 'premium' && (planLower === 'premium' || proLike)) ||
          (need === 'pro' && proLike);
        if (!ok) navigation?.navigate?.('Plans');
        return ok;
      },
      refreshProfile: async () => {
        const v = await serverValidateWhoAmI();
        if (!v.ok || !v.uid) return;
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=plan&id=eq.${encodeURIComponent(v.uid)}&limit=1`, {
            headers: { apikey: ANON_KEY || '', Authorization: `Bearer ${v.token}` },
          });
          const arr = await r.json().catch(() => []);
          if (Array.isArray(arr) && arr[0]?.plan) setPlan(arr[0].plan);
        } catch {}
        const c = await fetchCoinsLazy(); if (typeof c === 'number') setCoins(c);
      },
      signOut,
      processAuthUrl,
    };
  }, [session, plan, coins, loading, isAuthenticated, authEpoch]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
