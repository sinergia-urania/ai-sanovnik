import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../supabaseClient';

export async function registerPushToken(userId, lang) {
  if (!userId) return null;

  // 1) Dozvole (ako već nisu date)
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  // Android kanal (ako zatreba)
  if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
    });
  }

  // 2) Expo push token (treba projectId iz app.json → extra.eas.projectId)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoToken = data?.data || data; // (API varira po verzijama)

  if (!expoToken) return null;

  // 3) Upsert u Supabase
  await supabase.from('push_devices').upsert({
    user_id: userId,
    expo_token: String(expoToken),
    platform: Platform.OS,
    lang: (lang || 'en').slice(0,2),
    disabled: false,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'expo_token' });

  return expoToken;
}
