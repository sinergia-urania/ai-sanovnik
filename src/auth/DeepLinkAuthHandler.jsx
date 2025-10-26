// File: src/auth/DeepLinkAuthHandler.jsx
import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabaseClient';

function getParams(url) {
  if (!url) return {};
  const u = String(url);
  const query = u.includes('?') ? u.split('?')[1].split('#')[0] : '';
  const hash  = u.includes('#') ? u.split('#')[1] : '';
  const q = new URLSearchParams(query);
  const h = new URLSearchParams(hash);
  h.forEach((v, k) => q.set(k, v)); // hash > query
  const out = {};
  q.forEach((v, k) => (out[k] = v));
  return out;
}

async function confirmSessionWritten(tries = 10, delay = 150) {
  for (let i = 0; i < tries; i++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) return true;
    } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

export default function DeepLinkAuthHandler() {
  const handledRef = useRef(new Set());
  const processingRef = useRef(false);

  const applySessionFromUrl = async (url) => {
    if (!url) return false;

    const params = getParams(url);
    const signature = params.access_token || params.refresh_token || params.code || params.auth_code || url;

    if (handledRef.current.has(signature)) return false;
    if (processingRef.current) return false;
    processingRef.current = true;

    try {
      // Provider error?
      if (params.error || params.error_description) {
        Alert.alert('Login', params.error_description || params.error || 'OAuth error');
        return false;
      }

      // 1) IMPLICIT (hash/query tokens)
      if (params.access_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) throw error;
        const ok = await confirmSessionWritten();
        if (!ok) return false;
        handledRef.current.add(signature);
        return true;
      }

      // 2) PKCE code (fallback)
      const code = params.code || params.auth_code;
      if (code) {
        let data, error;
        try { ({ data, error } = await supabase.auth.exchangeCodeForSession(code)); }
        catch { ({ data, error } = await supabase.auth.exchangeCodeForSession({ authCode: code })); }
        if (error) throw error;
        handledRef.current.add(signature);
        return !!data?.session;
      }
    } catch (e) {
      console.log('[deeplink] setSession/exchange error:', e?.message || e);
      return false;
    } finally {
      processingRef.current = false;
    }
    return false;
  };

  useEffect(() => {
    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        await applySessionFromUrl(initial);
      } catch {}
    })();

    const sub = Linking.addEventListener('url', ({ url }) => {
      applySessionFromUrl(url).catch(() => {});
    });

    return () => sub?.remove?.();
  }, []);

  return null;
}
