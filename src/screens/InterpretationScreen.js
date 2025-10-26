// File: src/screens/InterpretationScreen.jsx
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import imgCiganka from '../assets/images/ciganka.webp';
import imgNaucnik from '../assets/images/naucnik.webp';
import MicTranscriber from '../components/MicTranscriber';
import { supabase } from '../lib/supabaseClient';
import { useAds } from '../providers/AdsProvider';
import { useAuth } from '../providers/AuthProvider';
import { useSound } from '../providers/SoundProvider';
import { shouldShowAds } from '../utils/planRules';

// Lightweight UUIDv4
function genClientReqId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40; // v4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variant
      const hex = [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const COLORS = {
  bg: '#000000',
  card: '#0a0a0a',
  border: '#222222',
  text: '#ffffff',
  ph: '#888888',
  green: '#00C853',
  greenText: '#002315',
  danger: '#E53935',
  dangerText: '#2b0000',
};

export default function InterpretationScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { plan } = useAuth(); // treba nam da uslovimo prikaz obaveštenja
  const insets = useSafeAreaInsets();
  const { playClick } = useSound();

  const [dreamText, setDreamText] = useState('');
  const [feelings, setFeelings] = useState('');
  const [recentEvents, setRecentEvents] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(null); // 'scientific' | 'traditional'
  const [submitting, setSubmitting] = useState(false);
  const { preload } = useAds();

 useEffect(() => {
   if (shouldShowAds(plan)) {
     
     preload();
   }
 }, [plan, preload]);
  useFocusEffect(
  useCallback(() => {
     if (shouldShowAds(plan)) preload();
   }, [plan, preload])
 );

  // Prefill iz dnevnika
  const draftId = route?.params?.draftId || null;
  useEffect(() => {
    const p = route?.params || {};
    if (typeof p.dreamText === 'string' && !dreamText) setDreamText(p.dreamText);
    if (typeof p.feelings === 'string' && !feelings) setFeelings(p.feelings);
    if (typeof p.recentEvents === 'string' && !recentEvents) setRecentEvents(p.recentEvents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params]);

  const canSubmit = useMemo(
    () => !!selectedMethod && dreamText.trim().length > 0,
    [selectedMethod, dreamText]
  );

  const onSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    Keyboard.dismiss();
    const clientReqId = genClientReqId();

    try {
      const lang = i18n.language?.startsWith('sr') ? 'sr' : 'en';
      const { data, error } = await supabase.functions.invoke('usage_hold_start', {
        body: {
          client_req_id: clientReqId,
          reason: 'interpretation',
          meta: { method: selectedMethod, lang },
          ttl_sec: 280,
          lang,
        },
      });

      if (error) {
        const code = (data?.error || error?.message || '').toString();
        const notEnoughTitle = t('billing.notEnoughTokensTitle', { defaultValue: 'No interpretations left' });
        const notEnoughBody  = t('billing.notEnoughTokensBody', { defaultValue: 'Please upgrade or top up to try another method.' });

        if (code.includes('INSUFFICIENT_AVAILABLE')) {
          Toast.show({ type: 'error', text1: notEnoughTitle, text2: notEnoughBody, position: 'bottom' });
          return;
        }
        if (code.includes('ALREADY_FINALIZED')) {
          Toast.show({ type: 'error', text1: t('common.errors.genericTitle', { defaultValue: 'Error' }), text2: t('common.errors.tryAgain', { defaultValue: 'Please try again.' }), position: 'bottom' });
          return;
        }
        if (code.includes('CLIENT_REQ_ID_REQUIRED')) {
          Toast.show({
            type: 'error',
            text1: t('common.errors.genericTitle', { defaultValue: 'Error' }),
            text2: t('common.errors.clientReqIdMissing', { defaultValue: 'Client request id missing.' }),
            position: 'bottom',
          });
          return;
        }
        Toast.show({ type: 'error', text1: t('common.errors.genericTitle', { defaultValue: 'Error' }), text2: t('common.errors.tryAgain', { defaultValue: 'Please try again.' }), position: 'bottom' });
        return;
      }

      navigation.navigate('Result', {
        dreamText,
        feelings,
        recentEvents,
        method: selectedMethod,
        clientReqId,
        draftId,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.errors.genericTitle', { defaultValue: 'Error' }),
        text2: t('common.errors.tryAgain', { defaultValue: 'Please try again.' }),
        position: 'bottom',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sttLang = i18n.language?.startsWith('sr') ? 'sr' : 'en';

  // KeyboardAware + auto-scroll
  const kaRef = useRef(null);
  const dreamRef = useRef(null);
  const feelingsRef = useRef(null);
  const eventsRef = useRef(null);

  const EXTRA = Platform.select({ ios: 200, android: 140, default: 160 });

  const focusScroll = (ref, bump = 0) => {
    const node = ref?.current ? findNodeHandle(ref.current) : null;
    if (!node) return;
    const base = Platform.OS === 'ios' ? 160 : 120;
    kaRef.current?.scrollToFocusedInput?.(node, base + bump);
    setTimeout(() => kaRef.current?.scrollToFocusedInput?.(node, base + bump), 100);
  };

  // Mic kontrole
  const micRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const handleStartRec = () => { playClick(); micRef.current?.start?.(); setIsRecording(true); };
  const handleStopRec  = () => { playClick(); micRef.current?.stop?.();  setIsRecording(false); };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <KeyboardAwareScrollView
          innerRef={(ref) => { kaRef.current = ref; }}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={EXTRA}
          extraHeight={EXTRA}
          enableResetScrollToCoords={false}
          keyboardOpeningTime={0}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + EXTRA }]}
        >
          {/* CHOICE ROW */}
          <View style={styles.methodsRow}>
            <TouchableOpacity
              style={[styles.choice, selectedMethod === 'scientific' && styles.choiceSelected]}
              onPress={() => { playClick(); setSelectedMethod('scientific'); }}
              activeOpacity={0.85}
            >
              <ExpoImage source={imgNaucnik} style={styles.choiceImg} contentFit="contain" />
              <Text style={styles.choiceLabel}>
                {t('interpretation.scientific', { defaultValue: 'Scientific (Jung/Freud/Szondi)' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choice, selectedMethod === 'traditional' && styles.choiceSelected]}
              onPress={() => { playClick(); setSelectedMethod('traditional'); }}
              activeOpacity={0.85}
            >
              <ExpoImage source={imgCiganka} style={styles.choiceImg} contentFit="contain" />
              <Text style={styles.choiceLabel}>
                {t('interpretation.traditionalShort', { defaultValue: 'Traditional' })}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            {t('interpretation.dream', { defaultValue: 'Your dream' })}
          </Text>
          <TextInput
            ref={dreamRef}
            placeholder={t('interpretation.dreamPH', { defaultValue: 'Type your dream here...' })}
            placeholderTextColor={COLORS.ph}
            multiline
            value={dreamText}
            onChangeText={setDreamText}
            style={styles.input}
            onFocus={() => focusScroll(dreamRef)}
            textAlignVertical="top"
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect={false}
          />

          {/* Mic external controls */}
          <View style={styles.micRow}>
            <TouchableOpacity
              onPress={handleStartRec}
              disabled={isRecording}
              style={[styles.micBtn, styles.micStart, isRecording && { opacity: 0.6 }]}
            >
              <Feather name="mic" size={18} color="#00170b" />
              <Text style={styles.micBtnText}>{t('stt.start')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleStopRec}
              disabled={!isRecording}
              style={[styles.micBtn, styles.micStop, !isRecording && { opacity: 0.4 }]}
            >
              <MaterialCommunityIcons name="stop-circle" size={20} color="#2b0000" />
              <Text style={styles.micBtnText}>{t('stt.stop')}</Text>
            </TouchableOpacity>
          </View>

          {/* MicTranscriber (hidden; controlled by buttons above) */}
          <MicTranscriber
            controlRef={micRef}
            lang={sttLang}
            labelSpeak={t('stt.speak')}
            labelListening={t('stt.listening')}
            onInsert={(text) => setDreamText((prev) => (prev ? prev + ' ' : '') + text)}
            onError={(msg) =>
              Toast.show({
                type: 'error',
                text1: t('common.errors.genericTitle', { defaultValue: 'Error' }),
                text2: msg || t('common.errors.tryAgain', { defaultValue: 'Please try again.' }),
              })
            }
            onStateChange={(listening) => setIsRecording(!!listening)}
            variant="invisible"
          />

          <Text style={styles.label}>
            {t('interpretation.feelings', { defaultValue: 'How did you feel after waking?' })}
          </Text>
          <TextInput
            ref={feelingsRef}
            placeholder={t('interpretation.feelingsPH', { defaultValue: 'e.g., calm, anxious, hopeful...' })}
            placeholderTextColor={COLORS.ph}
            value={feelings}
            onChangeText={setFeelings}
            style={styles.single}
            onFocus={() => focusScroll(feelingsRef)}
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect
          />

          <Text style={styles.label}>
            {t('interpretation.events', { defaultValue: 'Recent important events' })}
          </Text>
          <TextInput
            ref={eventsRef}
            placeholder={t('interpretation.eventsPH', { defaultValue: 'Work, relationships, health, travel...' })}
            placeholderTextColor={COLORS.ph}
            value={recentEvents}
            onChangeText={setRecentEvents}
            style={styles.single}
            onFocus={() => focusScroll(eventsRef, 60)}
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect
          />

          <TouchableOpacity
            style={[styles.answerBtn, (!canSubmit || submitting) && styles.answerBtnDisabled]}
            disabled={!canSubmit || submitting}
            onPress={() => { playClick(); onSubmit(); }}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator size="small" />
            ) : (
              <View style={styles.answerContent}>
                <Feather name="send" size={18} color={COLORS.greenText} />
                <Text style={styles.answerText}>
                  {t('common.answer', { defaultValue: 'Answer' })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
           {shouldShowAds(plan) && (
            <Text style={styles.adNotice}>
            {t('interpretation.adNoticePreAnswer', { defaultValue: 'A short ad may appear before the answer.' })}
          </Text>
           )}
          <View style={{ height: Platform.OS === 'ios' ? 180 : 120 }} />
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex1: { flex: 1 },
  wrap: { padding: 16 },

  methodsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  choice: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', padding: 10,
  },
  choiceSelected: { borderColor: COLORS.green },
  choiceImg: { width: '100%', height: 120, marginBottom: 6 },
  choiceLabel: { color: '#cccccc', fontSize: 14 },

  label: { color: '#aaaaaa', marginBottom: 6, marginTop: 6 },

  input: {
    minHeight: 120, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card,
    color: COLORS.text, padding: 12, borderRadius: 10, marginBottom: 12,
  },
  single: {
    height: 44, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card,
    color: COLORS.text, paddingHorizontal: 12, borderRadius: 10, marginBottom: 14,
  },

  micRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6, marginBottom: 2 },
  micBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  micStart: { backgroundColor: COLORS.green },
  micStop: { backgroundColor: COLORS.danger },
  micBtnText: { color: '#ffffff', fontWeight: '700' },

  answerBtn: { backgroundColor: COLORS.green, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  answerBtnDisabled: { opacity: 0.5 },
  answerContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerText: { color: COLORS.greenText, fontWeight: '800', letterSpacing: 0.2 },
  adNotice: {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 16,
  textAlign: 'center',
  color: '#9ca3af',
},

});
