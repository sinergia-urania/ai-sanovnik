// File: src/App.js
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { setAudioModeAsync } from 'expo-audio';
import React, { Suspense, useEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from './lib/push/registerPushToken';

import AppHeader from './components/AppHeader';
import i18n from './i18n';
import { navigationRef } from './navigation/navigationRef';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { SoundProvider } from './providers/SoundProvider';

import HomeScreen from './screens/HomeScreen';
import InterpretationScreen from './screens/InterpretationScreen';
import JournalDetailScreen from './screens/JournalDetailScreen';
import JournalEditScreen from './screens/JournalEditScreen';
import JournalListScreen from './screens/JournalListScreen';
import LessonDetailScreen from './screens/LessonDetailScreen';
import LoginScreen from './screens/LoginScreen';
import LucidLessonsScreen from './screens/LucidLessonsScreen';
import MediaScreen from './screens/MediaScreen';
import PlansScreen from './screens/PlansScreen';
import ResultScreen from './screens/ResultScreen';
import StaticDocScreen from './screens/StaticDocScreen';
import SupaDiagScreen from './screens/SupaDiagScreen';

// ✅ NEW: respect user notif pref + DB sync
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabaseClient';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#000000', card: '#0a0a0a', text: '#ffffff', border: '#111', primary: '#9b87f5' },
};

// 🔔 prikaži notifikacije i u foreground-u
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function I18nFallback() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

// Auth stack = samo Login
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ header: () => <AppHeader />, contentStyle: { backgroundColor: '#000' }
    }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SupaDiag" component={SupaDiagScreen} />
      <Stack.Screen name="Interpretation" component={InterpretationScreen} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="JournalList" component={JournalListScreen} />
      <Stack.Screen name="JournalEdit" component={JournalEditScreen} />
      <Stack.Screen name="LucidLessons" component={LucidLessonsScreen} />
      <Stack.Screen name="LessonDetail" component={LessonDetailScreen} />
      <Stack.Screen name="Media" component={MediaScreen} />
      <Stack.Screen name="Plans" component={PlansScreen} />
      <Stack.Screen name="JournalDetail" component={JournalDetailScreen} />
      <Stack.Screen name="Doc" component={StaticDocScreen} />
    </Stack.Navigator>
  );
}

function Gate() {
  const { loading, isAuthenticated, session } = useAuth();

  if (loading) {
    console.log('[gate] loading=', loading, 'uid=', session?.user?.id || null);
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  console.log('[gate] loading=false isAuthenticated=', isAuthenticated, 'uid=', session?.user?.id || null);
  return isAuthenticated ? <AppStack /> : <AuthStack />;
}

function NavShell() {
  const { authEpoch, isAuthenticated, session, processAuthUrl } = useAuth();
  const navKey = String(authEpoch);

  // 🧭 Pending i dedupe za deeplinkove
  const pendingUrlRef = useRef(null);
  const seenUrlsRef = useRef(new Set());

  // helper: da li je ovo Supabase OAuth callback?
  const isAuthCallback = (url) =>
    /^com\.mare82\.aisanovnik:\/\/auth(\/callback)?\b/i.test(String(url));

  // 🧭 Rutiranje iz deeplinka (sa prosleđivanjem auth callbacka u AuthProvider)
  const handleDeeplink = (url) => {
    try {
      if (!url) return;

      // dedupe: spreči duplo procesiranje istog URL-a
      if (seenUrlsRef.current.has(url)) return;
      seenUrlsRef.current.add(url);

      // ✅ PROSLEDI AUTH CALLBACK AuthProvider-u da setuje session
      if (isAuthCallback(url)) {
        processAuthUrl?.(url);
        return;
      }

      // ako navigator još nije spreman — sačuvaj i obradi kad postane spreman
      if (!navigationRef.current) {
        pendingUrlRef.current = url;
        return;
      }

      const parsed = Linking.parse(url);
      const raw = (parsed?.path || parsed?.hostname || '').replace(/^\//, '');
      const p = (raw || '').toLowerCase();

      if (!p || p === 'home') {
        navigationRef.current?.navigate('Home');
      } else if (p === 'interpretation') {
        navigationRef.current?.navigate('Interpretation', parsed?.queryParams || {});
      } else if (p === 'result') {
        navigationRef.current?.navigate('Result', parsed?.queryParams || {});
      } else if (p === 'plans') {
        navigationRef.current?.navigate('Plans', parsed?.queryParams || {});
      } else {
        navigationRef.current?.navigate('Home');
      }
    } catch (e) {
      console.warn('[deeplink] parse error:', e);
    }
  };

  // 🔗 Tap na notifikaciju dok je app u memoriji
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const url = resp?.notification?.request?.content?.data?.url;
      if (url) handleDeeplink(String(url));
    });
    return () => sub.remove();
  }, []);

  // ⬇️ 1) Cold start iz deeplinka (prvo proveri da li je auth callback)
  useEffect(() => {
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) return;
        if (isAuthCallback(url)) {
          processAuthUrl?.(url);
          return;
        }
        handleDeeplink(String(url));
      } catch {}
    })();
  }, []);

  // ⬇️ 2) Dok je app u memoriji: slušaj globalne 'url' evente
  useEffect(() => {
    const sub = Linking.addEventListener('url', (e) => {
      if (!e?.url) return;
      // auth callback ide direktno u AuthProvider
      if (isAuthCallback(e.url)) {
        processAuthUrl?.(e.url);
        return;
      }
      handleDeeplink(String(e.url));
    });
    return () => { try { sub.remove(); } catch {} };
  }, []);

  // ❄️ Cold start: otvori deeplink ako je app pokrenut iz notifikacije
  useEffect(() => {
    (async () => {
      const resp = await Notifications.getLastNotificationResponseAsync();
      const url = resp?.notification?.request?.content?.data?.url;
      if (!url) return;
      if (isAuthCallback(url)) {
        processAuthUrl?.(url);
        return;
      }
      handleDeeplink(String(url));
    })();
  }, []);

  // ✅ Respectuj korisnički izbor notifikacija (default ON), i sinhronizuj sa DB
  useEffect(() => {
    (async () => {
      if (!(isAuthenticated && session?.user?.id)) return;

      const pref = await AsyncStorage.getItem('settings:notifications');
      const enabled = (pref === null || pref === '1'); // default ON

      if (enabled) {
        registerPushToken(session.user.id, i18n.language).catch(() => {});
      } else {
        try {
          await supabase
            .from('push_devices')
            .update({ disabled: true })
            .eq('user_id', session.user.id);
        } catch {}
      }
    })();
  }, [isAuthenticated, session?.user?.id, i18n.language]);

  // 🚦 Obradi pending URL kad navigator postane spreman
  const onNavReady = () => {
    if (pendingUrlRef.current) {
      const url = pendingUrlRef.current;
      pendingUrlRef.current = null;
      if (isAuthCallback(url)) {
        processAuthUrl?.(url);
        return;
      }
      handleDeeplink(url);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} key={navKey} onReady={onNavReady}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <Gate />
        <Toast />
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }, []);
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<I18nFallback />}>
        <AuthProvider>
          {/* <AdsProvider>  // TEMP OFF */}
            <SoundProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                  <NavShell />
                </SafeAreaProvider>
              </GestureHandlerRootView>
            </SoundProvider>
          {/* </AdsProvider> */}
        </AuthProvider>
      </Suspense>
    </I18nextProvider>
  );
}
