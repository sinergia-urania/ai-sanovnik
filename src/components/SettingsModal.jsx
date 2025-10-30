// File: src/components/SettingsModal.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSound } from '../providers/SoundProvider';

// ⬇️ PATCH: dodatni importi
import { registerPushToken } from '../lib/push/registerPushToken';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../providers/AuthProvider';

// ⬇️ NOVO: centralizovana lista jezika + i18n helper
import i18n, { setAppLanguage } from '../i18n';
import { LANGS } from '../lib/i18nLangs';

const STORE_KEYS = {
  // lang više ne čuvamo ovde; koristi i18n.setAppLanguage
  notif: 'settings:notifications',
};

export default function SettingsModal({ visible, onClose }) {
  const { t } = useTranslation(['common']);
  const { muted, setMuted, volume, setVolume } = useSound(); // global source of truth
  const { user } = useAuth();

  // language + notifications local state (persisted only notif here)
  const initialLang = useMemo(() => (i18n?.language || 'en').slice(0, 2), [i18n?.language]);
  const [lang, setLang] = useState(initialLang);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  // Load notif on open; lang čitamo iz i18n
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const n = await AsyncStorage.getItem(STORE_KEYS.notif);
        setLang((i18n?.language || initialLang).slice(0, 2));
        setNotifEnabled(n === null ? true : n === '1');
      } catch {}
    })();
  }, [visible, initialLang]);

  // UI helpers for volume (provider is 0..1; show 0..100)
  const volPct = Math.round((muted ? 0 : volume) * 100);
  const barWidth = `${volPct}%`;

  const stepVolume = async (delta01) => {
    const next = Math.max(0, Math.min(1, volume + delta01));
    if (muted && next > 0) await setMuted(false);
    await setVolume(next);
  };

  const changeLanguage = async (code) => {
    await setAppLanguage(code); // persist + i18n.changeLanguage
    setLang((i18n?.language || code).slice(0, 2));
  };

  // iOS/Android-safe notifications permission
  const ensureNotifPermission = async () => {
    let Notifications;
    try { Notifications = require('expo-notifications'); } catch { return true; }
    try {
      const { status: cur } = await Notifications.getPermissionsAsync();
      if (cur === 'granted') return true;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return false;

      if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
        });
      }
      return true;
    } catch { return false; }
  };

  // ⬇️ toggleNotifications sada sinhronizuje i sa DB (push_devices)
  const toggleNotifications = async (next) => {
    if (next) {
      const ok = await ensureNotifPermission();
      if (!ok) {
        setNotifEnabled(false);
        await AsyncStorage.setItem(STORE_KEYS.notif, '0');
        return;
      }
      // enable locally
      setNotifEnabled(true);
      await AsyncStorage.setItem(STORE_KEYS.notif, '1');
      // registruj/reaktiviraj token u bazi
      try {
        await registerPushToken(user?.id, i18n?.resolvedLanguage || i18n?.language);
        if (user?.id) {
          await supabase
            .from('push_devices')
            .update({ disabled: false })
            .eq('user_id', user.id);
        }
      } catch {}
    } else {
      // disable locally
      setNotifEnabled(false);
      await AsyncStorage.setItem(STORE_KEYS.notif, '0');
      // globalno ugasi sve uređaje za ovog korisnika
      try {
        if (user?.id) {
          await supabase
            .from('push_devices')
            .update({ disabled: true })
            .eq('user_id', user.id);
        }
      } catch {}
    }
  };

  const selectedLang = LANGS.find(l => l.code === lang) || LANGS[0];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay} onTouchEnd={onClose} />
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('common:settings.title', { defaultValue: 'Settings' })}</Text>

        {/* Mute (global) */}
        <View style={styles.row}>
          <Text style={styles.label}>{t('common:settings.mute', { defaultValue: 'Mute' })}</Text>
          <Switch
            value={!!muted}
            onValueChange={(val) => setMuted(val)}
            trackColor={{ false: '#333', true: '#f87171' }}
            thumbColor={'#fff'}
          />
        </View>

        {/* Volume (global) */}
        <View style={styles.row}>
          <Text style={styles.label}>{t('common:settings.volume', { defaultValue: 'Volume' })}</Text>
          <View style={styles.volumeControls}>
            <TouchableOpacity style={styles.volBtn} onPress={() => stepVolume(-0.05)}>
              <Text style={styles.volBtnTxt}>–</Text>
            </TouchableOpacity>
            <View style={[styles.bar, muted && styles.barMuted]}>
              <View style={[styles.barFill, { width: barWidth }]} />
            </View>
            <TouchableOpacity style={styles.volBtn} onPress={() => stepVolume(+0.05)}>
              <Text style={styles.volBtnTxt}>+</Text>
            </TouchableOpacity>
            <Text style={[styles.percent, muted && styles.dimmed]}>{volPct}%</Text>
          </View>
        </View>

        {/* Language (dropdown) */}
        <View style={styles.row}>
          <Text style={styles.label}>{t('common:settings.language', { defaultValue: 'Language' })}</Text>
          <TouchableOpacity
            style={styles.langDropdown}
            onPress={() => setLangPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('common:settings.chooseLanguage', { defaultValue: 'Choose language' })}
          >
            <Text style={styles.flag}>{selectedLang.flag}</Text>
            <Text style={styles.langDropdownTxt}>{selectedLang.label}</Text>
            <Text style={styles.caret}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.row}>
          <Text style={styles.label}>{t('common:settings.notifications', { defaultValue: 'Notifications' })}</Text>
          <Switch
            value={notifEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#333', true: '#4ade80' }}
            thumbColor={'#fff'}
          />
        </View>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeTxt}>{t('common:buttons.close', { defaultValue: 'Close' })}</Text>
        </TouchableOpacity>
      </View>

      {/* Language picker modal */}
      <Modal visible={langPickerOpen} transparent animationType="fade" onRequestClose={() => setLangPickerOpen(false)}>
        <TouchableOpacity style={styles.fullOverlay} activeOpacity={1} onPress={() => setLangPickerOpen(false)} />
        <View style={styles.langCard}>
          <Text style={styles.langTitle}>{t('common:settings.chooseLanguage', { defaultValue: 'Choose language' })}</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {LANGS.map(L => {
              const active = L.code === lang;
              return (
                <TouchableOpacity
                  key={L.code}
                  style={[styles.langRow, active && styles.langRowActive]}
                  onPress={async () => {
                    await changeLanguage(L.code);
                    setLangPickerOpen(false);
                  }}
                >
                  <Text style={styles.flag}>{L.flag}</Text>
                  <Text style={[styles.langRowTxt, active && styles.langRowTxtActive]}>{L.label}</Text>
                  {active && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.langCancel} onPress={() => setLangPickerOpen(false)}>
            <Text style={styles.langCancelTxt}>{t('common:buttons.cancel', { defaultValue: 'Cancel' })}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  wrap: {
    position: 'absolute', top: 64, left: 28, right: 28,
    backgroundColor: '#101010', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  title: { color: '#F2C94C', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  row: { marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#ddd', fontSize: 14, marginRight: 16, flexShrink: 0 },

  // volume
  volumeControls: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  volBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  volBtnTxt: { color: '#fff', fontSize: 18, marginTop: -2 },
  bar: { flex: 1, height: 10, backgroundColor: '#1f1f1f', borderRadius: 8, overflow: 'hidden' },
  barMuted: { opacity: 0.4 },
  barFill: { height: '100%', backgroundColor: '#9b87f5' },
  percent: { color: '#aaa', marginLeft: 10, width: 48, textAlign: 'right' },
  dimmed: { opacity: 0.6 },

  // language dropdown button
  langDropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#161616', borderColor: '#2a2a2a', borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
  },
  flag: { fontSize: 16 },
  langDropdownTxt: { color: '#ddd', fontSize: 13, fontWeight: '600' },
  caret: { color: '#777', marginLeft: 6 },

  // language modal
  fullOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  langCard: {
    position: 'absolute', left: 24, right: 24, top: '25%',
    backgroundColor: '#121212', borderRadius: 14, padding: 14,
    borderColor: '#2a2a2a', borderWidth: 1,
  },
  langTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
  },
  langRowActive: { backgroundColor: 'rgba(155,135,245,0.12)' },
  langRowTxt: { color: '#ddd', fontSize: 14 },
  langRowTxtActive: { color: '#fff', fontWeight: '700' },
  check: { color: '#9b87f5', marginLeft: 'auto', fontWeight: '900' },
  langCancel: {
    alignSelf: 'flex-end', marginTop: 8, paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: '#2a2a2a',
  },
  langCancelTxt: { color: '#facc15', fontWeight: '700' },

  // bottom
  closeBtn: {
    alignSelf: 'center', marginTop: 6, paddingVertical: 8, paddingHorizontal: 18,
    borderRadius: 12, backgroundColor: '#2a2a2a',
  },
  closeTxt: { color: '#facc15', fontWeight: '700' },
});
