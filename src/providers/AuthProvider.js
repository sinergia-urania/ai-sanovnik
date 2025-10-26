// File: src/providers/AuthProvider.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
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

// Ne blokiramo deeplink ni tokom odjave
const applySessionFromUrlFactory = () => async function applySessionFromUrl(url, handledRef, processingRef) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (!(lower.includes('/auth') || lower.includes('auth/callback'))) return false;
  const p = getParams(url);
  const sig = p.access_token || p.refresh_token || p.code || p.auth_code || url;

  if (!handledRef.current) handledRef.current = new Set();
  if (handledRef.current.has(sig) || processingRef.current) return false;
  processingRef.current = true;

  try {
    const access = p.access_token;
    const refresh = p.refresh_token;
    if (access && refresh) {
      const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
      if (error) return false;
      handledRef.current.add(sig);
      return true;
    }
    const code = p.code || p.auth_code;
    if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
      try { await supabase.auth.exchangeCodeForSession({ authCode: code }); }
      catch { await supabase.auth.exchangeCodeForSession(code); }
      handledRef.current.add(sig);
      return true;
    }
  } finally {
    processingRef.current = false;
  }
  return false;
};

// whoami (storage-first)
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
      headers: {
        apikey: ANON_KEY || '',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });
    const js = await r.json().catch(() => null);
    return (r.ok && js && typeof js.balance === 'number') ? js.balance : null;
  } catch { return null; }
}

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

  // 🚦 kapija — false = AuthStack, true = AppStack
  const gateWasOpenRef    = useRef(false);

  const applySessionFromUrl = applySessionFromUrlFactory();

  const presencePing = async () => {
    const token = await getAccessTokenFromStorage();
    if (!token) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/presence_ping`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY || '',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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

      // zatvaramo kapiju samo ako je bila otvorena
      if (gateWasOpenRef.current) {
        setAuthEpoch(e => e + 1);
        gateWasOpenRef.current = false;
      }
      return false;
    }

    const s = localSessionMaybe?.user?.id ? localSessionMaybe : { user: { id: v.uid } };
    setSession(s);
    setValidated(true);
    setLoading(false);
    startPresence();

    // ✅ bump samo na prelazu Auth->App
    if (!gateWasOpenRef.current) {
      setAuthEpoch(e => e + 1);
      gateWasOpenRef.current = true;
    }

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

  // lokalno čišćenje
  const localClear = async (purgeTokens = false) => {
    try { whoamiAbortRef.current?.abort(); } catch {}
    try { supabase.removeAllChannels?.(); } catch {}

    setSession(null);
    setPlan('free');
    setCoins(null);
    setValidated(false);
    stopPresence();
    setLoading(false);

    // ✅ bump samo na prelazu App->Auth
    if (gateWasOpenRef.current) {
      setAuthEpoch(e => e + 1);
      gateWasOpenRef.current = false;
    }

    if (purgeTokens) {
      try { await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS); } catch {}
      try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {}
      try { supabase.functions.setAuth?.(''); } catch {}
    }
  };

  // korisnički triggerovana odjava
  const signOut = async () => {
    signingOutRef.current = true;
    setForceLogoutGate(true);

    await localClear(false);
    try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
    await localClear(true);

    setForceLogoutGate(false);
    signingOutRef.current = false;
  };

  // Deep link (OAuth)
  useEffect(() => {
    (async () => {
      try { const initial = await Linking.getInitialURL(); await applySessionFromUrl(initial, handledLinksRef, processingLinkRef); } catch {}
      try {
        const pending = await AsyncStorage.getItem(PENDING_OAUTH_KEY);
        if (pending) {
          const ok = await applySessionFromUrl(pending, handledLinksRef, processingLinkRef);
          if (ok) { try { await AsyncStorage.removeItem(PENDING_OAUTH_KEY); } catch {} }
        }
      } catch {}
    })();
    const sub = Linking.addEventListener('url', async ({ url }) => { try { await applySessionFromUrl(url, handledLinksRef, processingLinkRef); } catch {} });
    return () => sub?.remove?.();
  }, []);

  // ⬅️ bitno: NE spuštamo loading ovde rano — čekamo auth event
  useEffect(() => {
    let mounted = true;
    (async () => {
      await hydrateAuth();
      // čekamo onAuthStateChange ispod da pozove openAfterServerCheck
      // (bez setLoading(false) ovde — to je uzrok ranog mount-a AuthStack-a)
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('[auth] event=', event);
      if (event === 'SIGNED_OUT') {
        if (!signingOutRef.current) {
          setForceLogoutGate(true);
          await localClear(true);
          setForceLogoutGate(false);
        }
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await openAfterServerCheck(s ?? null);
      }
    });

    return () => { sub?.subscription?.unsubscribe?.(); mounted = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && validated) presencePing(); });
    return () => sub.remove();
  }, [validated]);

  // (opciono) watchdog — ostavi ako baš želiš fallback; povećao sam timeout da ne pretekne auth event
  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) {
        console.log('[watchdog] force loading=false');
        setLoading(false);
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [loading]);

  const isAuthenticated = !!validated && !forceLogoutGate;

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    plan,
    coins,
    refreshQuota: async () => { const v = await fetchCoinsLazy(); if (typeof v === 'number') setCoins(v); },
    loading,
    isAuthenticated,
    authEpoch,
    isFree: plan === 'free',
    isPremium: plan === 'premium',
    isPro: plan === 'pro',
    has: (need) => need==='free' || (need==='premium' && (plan==='premium'||plan==='pro')) || (need==='pro' && plan==='pro'),
    requirePlan: (need, navigation) => {
      const ok = need==='free' || (need==='premium' && (plan==='premium'||plan==='pro')) || (need==='pro' && plan==='pro');
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
  }), [session, plan, coins, loading, validated, authEpoch, forceLogoutGate]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
