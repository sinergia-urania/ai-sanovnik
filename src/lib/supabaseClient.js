// File: src/lib/supabaseClient.js
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// Projekat/ref (koristi se za pogođanje ključa u AsyncStorage-u)
export const SUPABASE_REF = new URL(SUPABASE_URL).host.split('.')[0];
const AUTH_KEY_MAIN = `sb-${SUPABASE_REF}-auth-token`;
const AUTH_KEY_VARIANTS = [
  AUTH_KEY_MAIN,
  `${AUTH_KEY_MAIN}.0`,
  `${AUTH_KEY_MAIN}.1`,
  `${AUTH_KEY_MAIN}.2`,
];

// Jedan (globalni) Supabase klijent
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // RN: sami parsiramo deep-link
    flowType: 'implicit',      // koristimo implicit za RN OAuth
  },
});

// Ručna “hidratacija” sesije iz AsyncStorage-a (štiti od race-ova na cold startu)
export async function hydrateAuth() {
  try {
    let raw = null;
    for (const k of AUTH_KEY_VARIANTS) {
      raw = await AsyncStorage.getItem(k);
      if (raw) break;
    }
    if (!raw) return;

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch {}
    const s = parsed?.currentSession || parsed || null;

    const access_token  = s?.access_token  || s?.accessToken  || null;
    const refresh_token = s?.refresh_token || s?.refreshToken || null;

    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  } catch {
    /* no-op */
  }
}

/**
 * Patch za Edge Functions:
 * - presreće client.functions.invoke i dodaje Authorization: Bearer <JWT>
 * - održava client.functions.setAuth pri svakoj auth promeni
 */
(function patchEdgeInvoke(client) {
  const originalInvoke = client.functions.invoke.bind(client.functions);

  async function initFunctionsAuth() {
    try {
      const { data } = await client.auth.getSession();
      client.functions.setAuth(data?.session?.access_token || '');
    } catch {
      client.functions.setAuth('');
    }
  }

  client.functions.invoke = async (fnName, options = {}) => {
    try {
      const { data } = await client.auth.getSession();
      const jwt = data?.session?.access_token || null;

      const headers = { ...(options.headers || {}) };
      if (jwt) headers.Authorization = `Bearer ${jwt}`;

      // Edge defaultno voli POST — ako nije zadato, koristi POST.
      const method = options.method || 'POST';
      return await originalInvoke(fnName, { ...options, headers, method });
    } catch {
      // Fallback bez intervencije (ne bi trebalo da se dešava)
      return await originalInvoke(fnName, options);
    }
  };

  // Inicijalni token za functions (cold start)
  initFunctionsAuth();

  // Održavanje functions tokena pri promeni auth state-a
  client.auth.onAuthStateChange(async (_event, session) => {
    const token =
      session?.access_token ||
      (await client.auth.getSession()).data?.session?.access_token ||
      '';
    try { client.functions.setAuth(token || ''); } catch { /* ignore */ }
  });
})(supabase);

export default supabase;
