// File: src/screens/JournalEditScreen.js
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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

import MicTranscriber from '../components/MicTranscriber';
import { createEntry, deleteEntry, getEntry, updateEntry } from '../lib/journalApi';
import { useAuth } from '../providers/AuthProvider';
import { useSound } from '../providers/SoundProvider';

export default function JournalEditScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { id } = route.params || {};
  const userId = session?.user?.id;

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { playClick } = useSound();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  const [entryId, setEntryId] = useState(id || null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [feelings, setFeelings] = useState('');
  const [recentEvents, setRecentEvents] = useState('');

  // Refs
  const kaRef = useRef(null);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const feelingsRef = useRef(null);
  const eventsRef = useRef(null);

  const micRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: entryId ? t('journal.edit') : t('journal.newEntry') });
  }, [entryId, navigation, t]);

  useEffect(() => {
    (async () => {
      if (!entryId) return;
      setLoading(true);
      const { data } = await getEntry(entryId);
      if (data) {
        setTitle(data.title || '');
        setContent(data.content || '');
        setFeelings(data.feelings || '');
        setRecentEvents(data.recent_events || '');
      }
      setLoading(false);
    })();
  }, [entryId]);

  const deriveTitle = (txt) => {
    if (txt?.trim()) return txt.trim().split(/\s+/).slice(0, 12).join(' ').slice(0, 60);
    return '';
  };

  const onSave = async () => {
    if (!userId) return;
    if (!content.trim()) {
      Toast.show({ type: 'error', text1: t('common.errors.genericTitle'), text2: t('journal.contentRequired') });
      return;
    }
    setSaving(true);
    try {
      const lang = i18n.language?.startsWith('sr') ? 'sr' : 'en';
      const payload = {
        user_id: userId,
        content: content.trim(),
        title: title?.trim() || deriveTitle(content),
        feelings: feelings?.trim() || null,
        recent_events: recentEvents?.trim() || null,
        lang,
      };
      if (entryId) {
        const { error } = await updateEntry(entryId, payload);
        if (error) throw error;
      } else {
        const { data, error } = await createEntry(payload);
        if (error) throw error;
        setEntryId(data.id);
      }
      Toast.show({ type: 'success', text1: t('common.saved') });
      navigation.goBack();
    } catch {
      Toast.show({ type: 'error', text1: t('common.errors.genericTitle'), text2: t('common.errors.tryAgain') });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!entryId) return;
    const { error } = await deleteEntry(entryId);
    if (error) {
      Toast.show({ type: 'error', text1: t('common.errors.genericTitle'), text2: t('common.errors.tryAgain') });
      return;
    }
    Toast.show({ type: 'success', text1: t('common.deleted') });
    navigation.goBack();
  };

  const onSendToInterpretation = async () => {
    if (!userId) return;
    if (!content.trim()) {
      Toast.show({ type: 'error', text1: t('common.errors.genericTitle'), text2: t('journal.contentRequired') });
      return;
    }
    let draftId = entryId;
    if (!draftId) {
      const lang = i18n.language?.startsWith('sr') ? 'sr' : 'en';
      const { data, error } = await createEntry({
        user_id: userId,
        content: content.trim(),
        title: title?.trim() || deriveTitle(content),
        feelings: feelings?.trim() || null,
        recent_events: recentEvents?.trim() || null,
        lang,
      });
      if (error) {
        Toast.show({ type: 'error', text1: t('common.errors.genericTitle'), text2: t('common.errors.tryAgain') });
        return;
      }
      draftId = data.id;
      setEntryId(draftId);
    }
    navigation.navigate('Interpretation', {
      draftId,
      dreamText: content.trim(),
      feelings: feelings?.trim() || '',
      recentEvents: recentEvents?.trim() || '',
    });
  };

  const sttLang = i18n.language?.startsWith('sr') ? 'sr' : 'en';

  // KeyboardAware: veći offset zbog accessory bara + dupli skok
  const EXTRA = Platform.select({ ios: 200, android: 140, default: 160 });
  const BOTTOM_PAD = insets.bottom + Math.max(EXTRA, 210); // 210 ≈ visina sticky footera

  const focusScroll = (ref, bump = 0) => {
    const node = ref?.current ? findNodeHandle(ref.current) : null;
    if (!node) return;
    const base = Platform.OS === 'ios' ? 160 : 120;
    kaRef.current?.scrollToFocusedInput?.(node, base + bump);
    setTimeout(() => kaRef.current?.scrollToFocusedInput?.(node, base + bump), 100);
  };

  // Mic kontrole (sa klik-zvukom)
  const handleStartRec = () => { playClick(); micRef.current?.start?.(); setIsRecording(true); };
  const handleStopRec  = () => { playClick(); micRef.current?.stop?.();  setIsRecording(false); };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <KeyboardAwareScrollView
          innerRef={(ref) => (kaRef.current = ref)}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={EXTRA}
          extraHeight={EXTRA}
          enableResetScrollToCoords={false}
          keyboardOpeningTime={0}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.contentWrap, { paddingBottom: BOTTOM_PAD }]}
        >
          <TextInput
            ref={titleRef}
            placeholder={t('journal.titlePH')}
            placeholderTextColor="#888"
            value={title}
            onChangeText={setTitle}
            style={styles.title}
            editable={!loading}
            returnKeyType="next"
            onFocus={() => focusScroll(titleRef)}
            onSubmitEditing={() => contentRef.current?.focus?.()}
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect
          />

          <TextInput
            ref={contentRef}
            placeholder={t('journal.contentPH')}
            placeholderTextColor="#888"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            style={styles.contentInput}
            editable={!loading}
            onFocus={() => focusScroll(contentRef)}
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect={false}
          />

          {/* 🎤 Speech-to-Text – spoljne kontrole */}
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

          {/* MicTranscriber (nevidljiv; kontrolišu ga dugmići iznad) */}
          <MicTranscriber
            controlRef={micRef}
            lang={sttLang}
            labelSpeak={t('stt.speak')}
            labelListening={t('stt.listening')}
            onInsert={(text) => setContent((prev) => (prev ? prev + ' ' : '') + text)}
            onError={(msg) =>
              Toast.show({ type: 'error', text1: t('common.errors.genericTitle'), text2: msg || t('common.errors.tryAgain') })
            }
            onStateChange={(listening) => setIsRecording(!!listening)}
            variant="invisible"
          />

          {/* (opciono) osećanja / događaji */}
          <TextInput
            ref={feelingsRef}
            placeholder={t('interpretation.feelings')}
            placeholderTextColor="#888"
            value={feelings}
            onChangeText={setFeelings}
            style={styles.single}
            editable={!loading}
            returnKeyType="next"
            onFocus={() => focusScroll(feelingsRef)}
            onSubmitEditing={() => eventsRef.current?.focus?.()}
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect
          />

          <TextInput
            ref={eventsRef}
            placeholder={t('interpretation.events')}
            placeholderTextColor="#888"
            value={recentEvents}
            onChangeText={setRecentEvents}
            style={styles.single}
            editable={!loading}
            returnKeyType="done"
            onFocus={() => focusScroll(eventsRef, 60)}  // extra bump zbog accessory bara
            keyboardAppearance="dark"
            autoCapitalize="sentences"
            autoCorrect
          />
        </KeyboardAwareScrollView>

        {/* Sticky footer sa akcijama */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.saveRow}>
            <TouchableOpacity
              onPress={() => { playClick(); onSave(); }}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              disabled={saving || loading}
            >
              <Feather name="lock" size={18} color="#1a1400" />
              <Text style={styles.saveText}>{t('common.save')}</Text>
            </TouchableOpacity>

            {!!entryId && (
              <TouchableOpacity onPress={() => { playClick(); onDelete(); }} style={styles.deleteBtn}>
                <Feather name="trash-2" size={18} color="#f8d7da" />
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => { playClick(); onSendToInterpretation(); }} style={styles.sendBtn}>
            <Feather name="send" size={18} color="#002315" />
            <Text style={styles.sendText}>{t('journal.sendToInterpretation')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const COLORS = {
  bg: '#000',
  card: '#0a0a0a',
  border: '#222',
  text: '#fff',
  ph: '#888',
  gold: '#D4AF37',
  goldText: '#1a1400',
  green: '#00C853',
  greenText: '#002315',
  danger: '#E53935',
  dangerText: '#2b0000',
  ghostBg: 'rgba(255,255,255,0.06)',
  ghostBorder: 'rgba(255,255,255,0.15)',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  contentWrap: { padding: 16 },

  title: {
    height: 44, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card,
    color: COLORS.text, paddingHorizontal: 12, borderRadius: 10, marginBottom: 12,
  },
  contentInput: {
    minHeight: 180, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card,
    color: COLORS.text, padding: 12, borderRadius: 10,
  },

  micRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12, marginBottom: 2 },
  micBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  micStart: { backgroundColor: COLORS.green },
  micStop: { backgroundColor: COLORS.danger },
  micBtnText: { color: '#fff', fontWeight: '700' },

  single: {
    height: 44, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card,
    color: COLORS.text, paddingHorizontal: 12, borderRadius: 10, marginTop: 12,
  },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)',
  },

  saveRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },

  saveBtn: {
    flex: 1, backgroundColor: COLORS.gold, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  saveText: { color: COLORS.goldText, fontWeight: '800', letterSpacing: 0.2 },

  deleteBtn: {
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: COLORS.ghostBg, borderWidth: 1, borderColor: COLORS.ghostBorder,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  deleteText: { color: '#f8d7da', fontWeight: '700' },

  sendBtn: {
    backgroundColor: COLORS.green, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 6,
  },
  sendText: { color: COLORS.greenText, fontWeight: '800', letterSpacing: 0.2 },
});
