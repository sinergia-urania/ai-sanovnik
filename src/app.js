// File: src/App.js
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { setAudioModeAsync } from 'expo-audio';
import React, { Suspense, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import AppHeader from './components/AppHeader';
import i18n from './i18n';
import { navigationRef } from './navigation/navigationRef';
import { AdsProvider } from './providers/AdsProvider';
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

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#000000', card: '#0a0a0a', text: '#ffffff', border: '#111', primary: '#9b87f5' },
};

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
      screenOptions={{ header: () => <AppHeader />, contentStyle: { backgroundColor: '#000' } }}
    >
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
  const { authEpoch } = useAuth();
  const navKey = String(authEpoch); // ⬅️ više ne koristimo isAuthenticated u key-u

  // (opciono) potpuno ukloni welcome overlay:
  // const [showWelcome, setShowWelcome] = useState(false);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} key={navKey}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <Gate />
        <Toast />
        {/* uklonjeno: showWelcome overlay */}
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
          <AdsProvider>
            <SoundProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                  <NavShell />
                </SafeAreaProvider>
              </GestureHandlerRootView>
            </SoundProvider>
          </AdsProvider>
        </AuthProvider>
      </Suspense>
    </I18nextProvider>
  );
}
