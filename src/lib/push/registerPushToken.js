// File: src/lib/push/registerPushToken.js
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../supabaseClient';

export async function registerPushToken(userId, lang) {
  try {
    if (!userId) return null;

    // 1) Dozvole
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req?.status;
    }
    if (status !== 'granted') return null;

    // 2) Android kanal (minimalan; bezbedno)
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
        });
      } catch {}
    }

    // 3) Expo push token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn('[push] Missing extra.eas.projectId in app.json');
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken =
      typeof tokenRes === 'string' ? tokenRes :
      typeof tokenRes?.data === 'string' ? tokenRes.data :
      null;

    if (!expoToken) return null;

    // 4) Upsert u Supabase (unikat po expo_token)
    const payload = {
      user_id: userId,
      expo_token: String(expoToken),
      platform: Platform.OS,
      lang: (lang || 'en').slice(0, 2),
      disabled: false,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('push_devices')
      .upsert(payload, { onConflict: 'expo_token' });

    if (error) {
      // Ako je token već vezan za drugi nalog i RLS blokira update, samo loguj.
      console.warn('[push] upsert error:', error.message || String(error));
    }

    return String(expoToken);
  } catch (e) {
    console.warn('[push] registerPushToken failed:', e);
    return null;
  }
}
