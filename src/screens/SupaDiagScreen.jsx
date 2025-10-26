// File: src/screens/SupaDiagScreen.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabaseClient';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function Box({ title, children }) {
  return (
    <View style={{ borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 12, marginVertical: 10 }}>
      <Text style={{ color: '#bda6ff', fontWeight: '800', marginBottom: 6 }}>{title}</Text>
      <Text style={{ color: '#fff', fontFamily: 'monospace' }}>{children}</Text>
    </View>
  );
}

const pretty = (v) => { try { return JSON.stringify(v, null, 2); } catch { return String(v); } };

function b64urlDecode(str) {
  try {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
    const json = atob(s + pad);
    return JSON.parse(json);
  } catch { return null; }
}

async function withTimeout(promise, ms, label) {
  const ctrl = new AbortController();
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => {
    try { ctrl.abort(); } catch {}
    rej(new Error(label || `timeout:${ms}`));
  }, ms);});
  try {
    const res = await Promise.race([promise(ctrl.signal), timeout]);
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

export default function SupaDiagScreen() {
  const [log, setLog] = useState([]);
  const runningRef = useRef(false);

  const projectRef = useMemo(() => {
    try { return new URL(SUPABASE_URL).host.split('.')[0]; } catch { return 'n/a'; }
  }, []);

  const add = (title, value) => setLog((prev) => [...prev, { title, value }]);

  const purgeStoredTokens = useCallback(async () => {
    try {
      const ref = projectRef;
      const keys = [
        `sb-${ref}-auth-token`,
        `sb-${ref}-auth-token.0`,
        `sb-${ref}-auth-token.1`,
        `sb-${ref}-auth-token.2`,
        'supabase.auth.token',
      ];
      await AsyncStorage.multiRemove(keys);
      add('storage.purge', { removed: keys });
    } catch (e) {
      add('storage.purge.error', String(e?.message || e));
    }
  }, [projectRef]);

  const getAccessTokenFromStorage = useCallback(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((k) => k.includes(`sb-${projectRef}-auth-token`) || k === 'supabase.auth.token');
    for (const k of authKeys) {
      try {
        const raw = await AsyncStorage.getItem(k);
        if (!raw) continue;
        let parsed = null; try { parsed = JSON.parse(raw); } catch {}
        const s = parsed?.currentSession || parsed || null;
        const t = s?.access_token || s?.accessToken || null;
        if (t) return t;
      } catch {}
    }
    return null;
  }, [projectRef]);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setLog([]);

    add('env', { SUPABASE_URL, PROJECT_REF: projectRef });

    // 1) RAW pingi PRE SDK-a (da ne “zamrznemo” UI)
    try {
      const r = await withTimeout((signal) => fetch(`${SUPABASE_URL}/auth/v1/health`, { signal }), 6000, 'health_timeout');
      add('raw.auth.health', { ok: r.ok, status: r.status, text: await r.text().catch(()=>'') });
    } catch (e) { add('raw.auth.health.error', String(e?.message || e)); }

    try {
      const r = await withTimeout((signal) => fetch(`${SUPABASE_URL}/rest/v1/`, { signal }), 6000, 'rest_root_timeout');
      add('raw.rest.root', { ok: r.ok, status: r.status, text: await r.text().catch(()=>'') });
    } catch (e) { add('raw.rest.root.error', String(e?.message || e)); }

    // 2) Pročitaj token (SDK → storage fallback)
    let token = null;
    try {
      const s = await withTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        return data?.session || null;
      }, 3000, 'getSession_timeout');
      token = s?.access_token || null;
      add('getSession', { uid: s?.user?.id || null, hasToken: !!token });
    } catch (e) {
      add('getSession.error', String(e?.message || e));
      try {
        token = await withTimeout(async () => await getAccessTokenFromStorage(), 1500, 'storage_token_timeout');
      } catch {}
    }

    // 3) JWT dekod (user claims) – bez mreže
    if (token) {
      const parts = token.split('.');
      const hdr = parts[0] ? b64urlDecode(parts[0]) : null;
      const pay = parts[1] ? b64urlDecode(parts[1]) : null;
      add('jwt.claims', {
        header: hdr || null,
        payload: pay ? {
          ...pay,
          // lepo prikaži vremena
          iat_iso: pay.iat ? new Date(pay.iat * 1000).toISOString() : null,
          exp_iso: pay.exp ? new Date(pay.exp * 1000).toISOString() : null
        } : null
      });
    } else {
      add('jwt.claims', { error: 'no-access-token' });
    }

    // 4) Edge echo_auth (da li Authorization STIŽE)
    try {
      const r = await withTimeout(async () => await supabase.functions.invoke('echo_auth', { body: {} }), 8000, 'echo_auth_timeout');
      add('edge.echo_auth', { status: r?.status, data: r?.data, error: r?.error || null });
    } catch (e) {
      add('edge.echo_auth.error', String(e?.message || e));
    }

    // 5) whoami (ako token postoji) – čisto REST
    if (token) {
      try {
        const r = await withTimeout((signal) => fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
          signal,
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON || '',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({}),
        }), 8000, 'whoami_timeout');
        const txt = await r.text().catch(()=> '');
        add('raw.rpc.whoami', { ok: r.ok, status: r.status, body: txt.slice(0, 500) });
      } catch (e) {
        add('raw.rpc.whoami.error', String(e?.message || e));
      }
    } else {
      add('raw.rpc.whoami.skip', 'no-token');
    }

    // 6) RLS probe: profiles & balances (REST) – sa timeout-om
    if (token) {
      try {
        const { data } = await supabase.auth.getUser().catch(()=>({data:null}));
        const uid = data?.user?.id || null;

        if (!uid) {
          add('rest.profiles.error', 'no-uid');
          add('rest.balances.error', 'no-uid');
        } else {
          try {
            const r = await withTimeout((signal) => fetch(
              `${SUPABASE_URL}/rest/v1/profiles?select=id,plan,updated_at&id=eq.${encodeURIComponent(uid)}`,
              { signal, headers: { apikey: SUPABASE_ANON || '', Authorization: `Bearer ${token}` } }
            ), 8000, 'profiles_timeout');
            const txt = await r.text().catch(()=> '');
            add('rest.profiles', { ok: r.ok, status: r.status, body: txt.slice(0, 500) });
          } catch (e) { add('rest.profiles.error', String(e?.message || e)); }

          try {
            const r = await withTimeout((signal) => fetch(
              `${SUPABASE_URL}/rest/v1/balances?select=user_id,balance,last_topup_at&user_id=eq.${encodeURIComponent(uid)}&limit=1`,
              { signal, headers: { apikey: SUPABASE_ANON || '', Authorization: `Bearer ${token}` } }
            ), 8000, 'balances_timeout');
            const txt = await r.text().catch(()=> '');
            add('rest.balances', { ok: r.ok, status: r.status, body: txt.slice(0, 500) });
          } catch (e) { add('rest.balances.error', String(e?.message || e)); }
        }
      } catch (e) {
        add('rest.uid.error', String(e?.message || e));
      }
    }

    // 7) RPC quota_get_lazy (REST)
    if (token) {
      try {
        const r = await withTimeout((signal) => fetch(`${SUPABASE_URL}/rest/v1/rpc/quota_get_lazy`, {
          signal,
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON || '',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({}),
        }), 8000, 'quota_timeout');
        const txt = await r.text().catch(()=> '');
        add('rpc.quota_get_lazy (REST)', { ok: r.ok, status: r.status, body: txt.slice(0, 500) });
      } catch (e) { add('rpc.quota_get_lazy.error', String(e?.message || e)); }
    }

    runningRef.current = false;
  }, [projectRef, getAccessTokenFromStorage]);

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch {}
    await purgeStoredTokens();
  }, [purgeStoredTokens]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-start', marginBottom: 12 }}>
        <TouchableOpacity onPress={run} style={{ backgroundColor: '#5b21b6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Re-run (no-hang)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={purgeStoredTokens} style={{ backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Purge tokens</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut} style={{ backgroundColor: '#b91c1c', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Box title="env">
          {pretty({ SUPABASE_URL, PROJECT_REF: projectRef })}
        </Box>

        {log.map((row, idx) => (
          <Box key={idx} title={row.title}>
            {pretty(row.value)}
          </Box>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
