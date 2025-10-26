// File: src/screens/LoginScreen.jsx
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { signInWithProvider } from '../auth/socialAuth';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../providers/AuthProvider';

// Magic link landing (hostovana strana koja radi deep link nazad u app)
const REDIRECT_URL = 'https://infohelm.org/auth-aisanovnik.html';

const isEmail = (s) => typeof s === 'string' && /\S+@\S+\.\S+/.test(s);

export default function LoginScreen() {
  const { t } = useTranslation();
  const { loading } = useAuth();

  const [busy, setBusy] = useState(null); // 'google' | 'facebook' | 'apple' | 'magic' | null
  const [email, setEmail] = useState('');

  const disabled = !!busy || loading;

  const doOAuth = async (provider) => {
    if (disabled) return;
    setBusy(provider);
    try {
      const r = await signInWithProvider(provider);
      if (!r?.ok) {
        Toast.show({
          type: 'error',
          text1: t('login.error', { defaultValue: 'Greška pri prijavi' }),
          text2: String(r?.reason || t('login.tryAgain', { defaultValue: 'Pokušaj ponovo.' })),
        });
      }
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: t('login.error', { defaultValue: 'Greška pri prijavi' }),
        text2: t('login.oauthFailed', { defaultValue: 'OAuth tok nije uspeo.' }),
      });
    } finally {
      setBusy(null);
    }
  };

  const sendMagicLink = async () => {
    if (disabled) return;
    const e = email.trim();
    if (!isEmail(e)) {
      Toast.show({
        type: 'info',
        text1: t('login.error', { defaultValue: 'Greška' }),
        text2: t('login.enterEmail', { defaultValue: 'Unesi ispravnu email adresu.' }),
      });
      return;
    }
    setBusy('magic');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: REDIRECT_URL, shouldCreateUser: true },
      });
      if (error) throw error;
      Toast.show({
        type: 'success',
        text1: t('login.title', { defaultValue: 'Prijava' }),
        text2: t('login.checkInbox', { defaultValue: 'Proveri email i otvori link na ovom uređaju.' }),
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: t('login.error', { defaultValue: 'Greška pri prijavi' }),
        text2: err?.message ?? t('login.tryAgain', { defaultValue: 'Pokušaj ponovo.' }),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Image
            source={require('../assets/images/logo.jpg')}
            style={{ width: 110, height: 110, marginBottom: 12 }}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            {t('login.title', { defaultValue: 'Dobrodošao!' })}
          </Text>
          <Text style={styles.subtitle}>
            {t('login.subtitle', { defaultValue: 'Prijavi se da nastaviš' })}
          </Text>

          <View style={{ height: 20 }} />

          {/* Google */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#ffffff' }]}
            disabled={disabled}
            onPress={() => doOAuth('google')}
          >
            {busy === 'google'
              ? <ActivityIndicator color="#111" />
              : (
                <View style={styles.btnInner}>
                  <FontAwesome name="google" size={18} color="#111" style={{ marginRight: 8 }} />
                  <Text style={[styles.btnText, { color: '#111' }]}>
                    {t('login.continueGoogle', { defaultValue: 'Nastavi sa Google' })}
                  </Text>
                </View>
              )}
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#1877f2' }]}
            disabled={disabled}
            onPress={() => doOAuth('facebook')}
          >
            {busy === 'facebook'
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={styles.btnInner}>
                  <FontAwesome name="facebook" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    {t('login.continueFacebook', { defaultValue: 'Nastavi sa Facebook' })}
                  </Text>
                </View>
              )}
          </TouchableOpacity>

          {/* Apple (samo iOS) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#000000' }]}
              disabled={disabled}
              onPress={() => doOAuth('apple')}
            >
              {busy === 'apple'
                ? <ActivityIndicator color="#fff" />
                : (
                  <View style={styles.btnInner}>
                    <FontAwesome name="apple" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={[styles.btnText, { color: '#fff' }]}>
                      {t('login.continueApple', { defaultValue: 'Nastavi sa Apple' })}
                    </Text>
                  </View>
                )}
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={{ height: 28 }} />
          <Text style={styles.mlTitle}>
            {t('login.magicTitle', { defaultValue: 'Ili se prijavi Magic Link-om' })}
          </Text>

          {/* Email + Magic link */}
          <TextInput
            placeholder={t('login.emailPH', { defaultValue: 'tvoj@email.com' })}
            placeholderTextColor="#8a8a8a"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            editable={!disabled}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#ffd700' }]}
            disabled={disabled}
            onPress={sendMagicLink}
          >
            {busy === 'magic'
              ? <ActivityIndicator color="#1f2937" />
              : (
                <View style={styles.btnInner}>
                  <Text style={[styles.btnText, { color: '#1f2937' }]}>
                    {t('login.sendMagic', { defaultValue: 'Pošalji Magic Link' })}
                  </Text>
                </View>
              )}
          </TouchableOpacity>

          {/* Hint */}
          <View style={{ height: 14 }} />
          <Text style={styles.hint}>
            {t('login.hint', {
              defaultValue: 'Ako te ne vrati automatski, otvori link iz mejla na ovom uređaju.',
            })}
          </Text>

          {/* Dno padding da input ne “nalegne” uz ivicu */}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingBottom: 24,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#ccc', fontSize: 14, marginTop: 6, textAlign: 'center' },

  btn: {
    width: 280,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 15 },

  mlTitle: { color: '#fff', fontWeight: '700', marginBottom: 8, marginTop: 8, alignSelf: 'center' },
  input: {
    width: 280,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    paddingHorizontal: 12,
    backgroundColor: '#0a0a0a',
  },
  hint: { color: '#aaa', fontSize: 12, textAlign: 'center', opacity: 0.9, maxWidth: 320 },
});
