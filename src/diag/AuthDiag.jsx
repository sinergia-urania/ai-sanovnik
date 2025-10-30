// src/diag/AuthDiag.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const MOBILE_REDIRECT = 'com.mare82.aisanovnik://auth/callback';

const Btn = ({ title, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor: '#222',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#555',
    }}
  >
    <Text style={{ color: '#fff', fontWeight: '600' }}>{title}</Text>
  </TouchableOpacity>
);

export default function AuthDiag() {
  const [logs, setLogs] = useState([]);
  const appStateRef = useRef(AppState.currentState);

  const log = useCallback((m, extra) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${m}${extra ? `  ${extra}` : ''}`;
    setLogs((prev) => [line, ...prev].slice(0, 200));
    // eslint-disable-next-line no-console
    console.log('[AuthDiag]', line);
  }, []);

  const clearSupabaseAuthKeys = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const toRemove = keys.filter(
        (k) =>
          k.includes('supabase') ||
          k.includes('sb-') ||
          k.includes('auth') ||
          k.includes('expo-auth-session')
      );
      if (toRemove.length) {
        await AsyncStorage.multiRemove(toRemove);
        log(`AsyncStorage: removed ${toRemove.length} supabase/auth keys`);
      } else {
        log('AsyncStorage: no supabase/auth keys to remove');
      }
    } catch (e) {
      log('AsyncStorage cleanup error', String(e));
    }
  }, [log]);

  const preOAuthReset = useCallback(async () => {
    try {
      await WebBrowser.dismissBrowser();
      log('WebBrowser.dismissBrowser()');
    } catch {}
    try {
      await WebBrowser.clearBrowserCookiesAsync();
      log('WebBrowser.clearBrowserCookiesAsync()');
    } catch {}
    try {
      await WebBrowser.coolDownAsync();
      log('WebBrowser.coolDownAsync()');
    } catch {}
    try {
      await WebBrowser.warmUpAsync();
      log('WebBrowser.warmUpAsync()');
    } catch {}
    try {
      await AsyncStorage.removeItem('auth:pending_oauth_url');
      log("Removed 'auth:pending_oauth_url'");
    } catch {}
  }, [log]);

  const onGetSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return log('getSession error', String(error.message || error));
    log(`getSession ok: ${data?.session ? 'SESSION_PRESENT' : 'NO_SESSION'}`);
  }, [log]);

  const onSignInGoogleSDK = useCallback(async () => {
    log('SignIn SDK ENTER');
    await preOAuthReset();
    await clearSupabaseAuthKeys();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: MOBILE_REDIRECT,
          skipBrowserRedirect: false,
          flowType: 'implicit',
        },
      });
      if (error) log('signInWithOAuth(SDK) error', String(error.message || error));
      else log('signInWithOAuth(SDK) returned', JSON.stringify(data || {}, null, 0));
    } catch (e) {
      log('signInWithOAuth(SDK) threw', String(e));
    }
  }, [log, preOAuthReset, clearSupabaseAuthKeys]);

  const onSignInGoogleManual = useCallback(async () => {
    log('SignIn Manual ENTER');
    await preOAuthReset();
    await clearSupabaseAuthKeys();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: MOBILE_REDIRECT,
          skipBrowserRedirect: true,
          flowType: 'implicit',
        },
      });
      if (error) return log('signInWithOAuth(Manual) error', String(error.message || error));
      if (!data?.url) return log('signInWithOAuth(Manual) no URL returned');

      log('openAuthSessionAsync opening…', data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, MOBILE_REDIRECT);
      log('openAuthSessionAsync result', JSON.stringify(result));
    } catch (e) {
      log('Manual sign-in threw', String(e));
    }
  }, [log, preOAuthReset, clearSupabaseAuthKeys]);

  const onSignOutGlobal = useCallback(async () => {
    try {
      log('signOut(global) ENTER');
      await supabase.auth.signOut({ scope: 'global' });
      log('signOut(global) OK');
    } catch (e) {
      log('signOut(global) error', String(e));
    }
    await preOAuthReset();
    await clearSupabaseAuthKeys();
    const { data } = await supabase.auth.getSession();
    log(`post-signOut session: ${data?.session ? 'STILL_PRESENT' : 'cleared'}`);
  }, [log, preOAuthReset, clearSupabaseAuthKeys]);

  const onClearBrowserState = useCallback(async () => {
    await preOAuthReset();
    await clearSupabaseAuthKeys();
    log(`REDIRECT (mobile): ${MOBILE_REDIRECT}`);
    log(`Linking.createURL('auth/callback'): ${Linking.createURL('auth/callback')}`);
  }, [preOAuthReset, clearSupabaseAuthKeys, log]);

  useEffect(() => {
    const appSub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      log(`AppState ${prev} -> ${next}`);
    });

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      log('Linking url event', url);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      log(`onAuthStateChange: ${event}  ${session ? 'SESSION' : 'NO_SESSION'}`);
    });

    (async () => {
      try {
        await WebBrowser.warmUpAsync();
        log('warmUp on mount');
      } catch {}
    })();

    return () => {
      try {
        appSub.remove();
      } catch {}
      try {
        linkSub.remove();
      } catch {}
      try {
        authSub.subscription.unsubscribe();
      } catch {}
      (async () => {
        try {
          await WebBrowser.coolDownAsync();
          log('coolDown on unmount');
        } catch {}
      })();
    };
  }, [log]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black', padding: 16, paddingTop: 40 }}>
      <Text style={{ color: '#0f0', fontWeight: '800', fontSize: 18, marginBottom: 12 }}>
        AuthDiag (minimal)
      </Text>

      <Btn title="Clear browser + clear supa keys" onPress={onClearBrowserState} />
      <Btn title="GetSession()" onPress={onGetSession} />
      <Btn title="SignIn Google (SDK naive)" onPress={onSignInGoogleSDK} />
      <Btn title="SignIn Google (Manual openAuthSession)" onPress={onSignInGoogleManual} />
      <Btn title="SignOut (global + double clear)" onPress={onSignOutGlobal} />

      <Text style={{ color: '#aaa', marginTop: 16, marginBottom: 6, fontWeight: '700' }}>
        Logs
      </Text>
      <ScrollView style={{ flex: 1, borderTopWidth: 1, borderColor: '#333' }}>
        {logs.map((l, i) => (
          <Text key={i} style={{ color: '#9fd', fontSize: 12, lineHeight: 16, marginBottom: 2 }}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
