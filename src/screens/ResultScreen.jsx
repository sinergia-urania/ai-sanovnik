// File: src/screens/ResultScreen.js
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import bgSpace from '../assets/images/background-space.webp';
import imgCiganka from '../assets/images/ciganka.webp';
import imgNaucnik from '../assets/images/naucnik.webp';
import { attachInterpretation, createEntry } from '../lib/journalApi';
import { supabase } from '../lib/supabaseClient';
import { useAds } from '../providers/AdsProvider';
import { useAuth } from '../providers/AuthProvider';
import { useSound } from '../providers/SoundProvider'; // 🔊
import { shouldShowAds } from '../utils/planRules';
import { triggerQuotaRefresh } from '../utils/quotaBus';

const withTimeout = (p, ms = 25000) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('EDGE_TIMEOUT')), ms)),
  ]);

function mockInterpret({ dreamText, feelings, recentEvents, method }) {
  const head =
    method === 'scientific'
      ? 'Scientific analysis (Jung/Freud/Szondi):'
      : 'Traditional / Symbolic reading:';
  return (
    `${head}\n\n` +
    `Dream: ${dreamText}\n` +
    (feelings ? `Feelings: ${feelings}\n` : '') +
    (recentEvents ? `Recent events: ${recentEvents}\n` : '') +
    (method === 'scientific'
      ? `Focus: archetypes, complexes, compensations, latent wishes, and personal/collective unconscious.\n`
      : `Focus: cultural symbols, folk motifs, omens, and classical dream-book correspondences.\n`) +
    `\n(Placeholder text until AI backend is connected.)`
  );
}

function formatAnswer(payload, t) {
  if (!payload) return '';
  if (typeof payload === 'object' && typeof payload.text === 'string') return payload.text;
  if (typeof payload === 'string') return payload;

  if (typeof payload === 'object') {
    const titleMethod     = t('result.method', { defaultValue: 'Method' });
    const titleRationale  = t('result.rationale', { defaultValue: 'Why this method' });
    const titleSummary    = t('result.summary', { defaultValue: 'Summary' });
    const titleSymbols    = t('result.keySymbols', { defaultValue: 'Key symbols' });
    const titleMeanings   = t('result.meanings', { defaultValue: 'Possible meanings' });
    const titleAdvice     = t('result.advice', { defaultValue: 'Gentle advice' });

    const methodLabelMap = {
      JUNG:   t('result.methods.jung',   { defaultValue: 'Jung' }),
      FREUD:  t('result.methods.freud',  { defaultValue: 'Freud' }),
      SZONDI: t('result.methods.szondi', { defaultValue: 'Szondi' }),
    };
    const asMethodLabel = (m) => methodLabelMap[String(m || '').toUpperCase()] || String(m || '');

    const parts = [];
    if (payload.method) parts.push(`🧭 ${titleMethod}: ${asMethodLabel(payload.method)}`);
    if (payload.rationale) parts.push(`💡 ${titleRationale}:\n${payload.rationale}`);
    if (payload.summary) parts.push(`${titleSummary}:\n${payload.summary}`);
    if (Array.isArray(payload.keySymbols) && payload.keySymbols.length) parts.push(`${titleSymbols}:\n- ${payload.keySymbols.join('\n- ')}`);
    if (Array.isArray(payload.meanings) && payload.meanings.length) parts.push(`${titleMeanings}:\n- ${payload.meanings.join('\n- ')}`);
    if (payload.advice) parts.push(`${titleAdvice}:\n${payload.advice}`);
    const joined = parts.join('\n\n');
    if (joined) return joined;
  }
  try { return JSON.stringify(payload, null, 2); } catch { return String(payload); }
}

const COLORS = {
  bg: '#000',
  overlay: 'rgba(0,0,0,0.35)',
  cardBg: 'rgba(10,10,10,0.9)',
  border: '#222',
  text: '#fff',
  sub: '#ddd',

  green: '#00C853',
  greenText: '#002315',
  gold: '#D4AF37',
  goldText: '#1a1400',
};

export default function ResultScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { t, i18n } = useTranslation();
  const { plan, session } = useAuth();
  const { showPreAnswerIfEligible } = useAds();
  const insets = useSafeAreaInsets();
  const { playClick } = useSound(); // 🔊

  const {
    dreamText = '',
    feelings = '',
    recentEvents = '',
    method = 'scientific',
    clientReqId = null,
    draftId = null,
  } = params || {};

  const hero = method === 'scientific' ? imgNaucnik : imgCiganka;

  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(draftId || null);

  const finalizedRef = useRef(false);
  const successRef = useRef(false); // odgovor uspeo
  const clientReqIdRef = useRef(clientReqId || null);
  // 🔧 BUGFIX: nedostajao ref → ReferenceError na free planu
  const adTriedRef = useRef(false);

  // ✅ finalize helper (poziva usage_consume, sa retry)
  const finalizeUsage = React.useCallback(async () => {
    if (!clientReqIdRef.current) return false;
    const delays = [0, 500, 1500];
    for (const d of delays) {
      if (d) await new Promise(r => setTimeout(r, d));
      try {
        const { error } = await supabase.functions.invoke('usage_consume', {
          body: { client_req_id: clientReqIdRef.current },
        });
        if (error) throw error;
        finalizedRef.current = true;
        triggerQuotaRefresh(); // osveži tek kada je zaista finalizovano
        return true;
      } catch {
        // probaj ponovo
      }
    }
    return false;
  }, []);

  // Global back zaštita
  useEffect(() => {
    const onBack = () => {
      if (loading) return true;
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [loading, navigation]);

  // Presretni strelicu/gest
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      const type = e?.data?.action?.type;
      if (loading) {
        e.preventDefault();
        return;
      }
      if (type === 'GO_BACK' || type === 'POP') {
        e.preventDefault();
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    });
    return unsub;
  }, [navigation, loading]);

  // Cleanup: release samo ako smo otišli pre nego što je odgovor stigao
  useEffect(() => {
    return () => {
      if (!finalizedRef.current && clientReqIdRef.current) {
        if (!successRef.current) {
          supabase.functions.invoke('usage_release', {
            body: { client_req_id: clientReqIdRef.current },
          }).catch(() => {});
        }
      }
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setAnswer('');
      if (shouldShowAds(plan) && !adTriedRef.current) {
        adTriedRef.current = true;
        // Fire-and-forget; ne blokiraj AI pipeline
        const tryShowAdNonBlocking = async () => {
       let r = await showPreAnswerIfEligible();
       if (r?.shown) return;
       // Ako nije učitano – probaj još par puta (do ~4s), ali ne blokiraš AI
       const steps = [400, 700, 1200, 1800];
       for (const delay of steps) {
         await new Promise(res => setTimeout(res, delay));
         r = await showPreAnswerIfEligible();
         if (r?.shown) return;
         if (r?.reason && r.reason !== 'not_loaded') return; // npr. cooldown/daily_cap/hard_off
       }
     };
     setTimeout(() => { tryShowAdNonBlocking().catch(() => {}); }, 150);
    }
      try {
        const lang = i18n.language?.startsWith('sr') ? 'sr' : 'en';
        const { data, error } = await withTimeout(
          supabase.functions.invoke('interpret', {
            body: { dreamText, feelings, recentEvents, method, lang, client_req_id: clientReqIdRef.current }, // ⬅️ bez tier/plan
          }),
          25000
        );

        if (!alive) return;

        if (error) {
          if (clientReqIdRef.current) {
            try {
              await supabase.functions.invoke('usage_release', { body: { client_req_id: clientReqIdRef.current } });
              finalizedRef.current = true;
            } catch {}
          }
          const aiText = mockInterpret({ dreamText, feelings, recentEvents, method });
          setAnswer(aiText);
          setLoading(false);
          return;
        }

        const formatted = formatAnswer(data, t) || '(no response)';
        setAnswer(formatted);
        setLoading(false);

        successRef.current = true;            // odgovor je stigao
        const ok = await finalizeUsage();     // pokušaj finalize
        if (!ok) {
          // po želji: tih logger/toast u DEV
        }
      } catch {
        if (clientReqIdRef.current) {
          try {
            await supabase.functions.invoke('usage_release', { body: { client_req_id: clientReqIdRef.current } });
            finalizedRef.current = true;
          } catch {}
        }
        if (!alive) return;
        const aiText = mockInterpret({ dreamText, feelings, recentEvents, method });
        setAnswer(aiText);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [dreamText, feelings, recentEvents, method, i18n.language, t, finalizeUsage]); // ⬅️ nema plan u deps-ima

  const methodLabel =
    method === 'scientific'
      ? t('interpretation.scientificShort', { defaultValue: 'Scientific' })
      : t('interpretation.traditionalShort', { defaultValue: 'Traditional' });

  const deriveTitle = (txt) => (txt ? txt.trim().split(/\s+/).slice(0, 12).join(' ').slice(0, 60) : '');

  const handleSaveToJournal = async () => {
    if (plan === 'free' || !answer) return;
    setSaving(true);
    try {
      const lang = i18n.language?.startsWith('sr') ? 'sr' : 'en';
      let id = savedEntryId;

      // 1) Kreiraj zapis ako ne postoji
      if (!id) {
        const user_id = session?.user?.id;
        if (!user_id) throw new Error('no-user');
        const { data, error } = await createEntry({
          user_id,
          title: deriveTitle(dreamText),
          content: dreamText,
          feelings: feelings || null,
          recent_events: recentEvents || null,
          lang,
        });
        if (error) throw error;
        id = data.id;
        setSavedEntryId(id);
      }

      // 2) Zakači interpretaciju
      const { error: e2 } = await attachInterpretation({
        id,
        method,
        analysis_text: String(answer),
        analysis_json: null,
        client_req_id: clientReqIdRef.current ?? null,
      });
      if (e2) throw e2;

      Toast.show({ type: 'success', text1: t('common.saved', { defaultValue: 'Saved' }) });
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.errors.genericTitle', { defaultValue: 'Error' }),
        text2: t('common.errors.tryAgain', { defaultValue: 'Please try again.' }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenJournal = () => {
    if (plan === 'free') return;
    if (savedEntryId) navigation.navigate('JournalEdit', { id: savedEntryId });
    else if (draftId) navigation.navigate('JournalEdit', { id: draftId });
    else navigation.navigate('JournalList');
  };

  const showJournalActions = plan !== 'free';

  return (
    <View style={styles.container}>
      {/* Pozadina */}
      <Image source={bgSpace} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={250} cachePolicy="disk" />
      <View style={styles.overlay} />

      {/* Hero + caption + mali spinner dok čeka */}
      <View style={styles.heroWrap}>
        <Image source={hero} style={styles.hero} contentFit="contain" transition={250} cachePolicy="disk" />
        <View style={styles.captionRow}>
          <Text style={styles.heroCaption}>{methodLabel}</Text>
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>
      </View>

      {/* Prozor sa odgovorom */}
      <View style={styles.card}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>
              {t('result.waiting', { defaultValue: 'Waiting for the answer…' })}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }} // prostor za sticky footer
          >
            <Text style={styles.answer}>{answer}</Text>
          </ScrollView>
        )}
      </View>

      {/* Sticky footer */}
      {showJournalActions && !loading && (
        <View style={[styles.actionsRow, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity
            onPress={() => { playClick(); handleSaveToJournal(); }} // 🔊
            style={[styles.actionBtn, styles.actionBtnGreen, saving && { opacity: 0.6 }]}
            disabled={saving}
          >
            <Text style={[styles.actionText, styles.actionTextGreen]}>
              {t('journal.saveToJournal', { defaultValue: 'Save to journal' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { playClick(); handleOpenJournal(); }} // 🔊
            style={[styles.actionBtn, styles.actionBtnGold]}
          >
            <Text style={[styles.actionText, styles.actionTextGold]}>
              {t('journal.openJournal', { defaultValue: 'Open journal' })}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay },

  heroWrap: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
  hero: { width: 140, height: 140 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  heroCaption: { color: '#a78bfa', fontSize: 13 },

  card: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingBox: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { color: COLORS.sub },

  answer: { color: '#eee', lineHeight: 20, fontSize: 14 },

  // Sticky footer
  actionsRow: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnGreen: { backgroundColor: COLORS.green },
  actionBtnGold: { backgroundColor: COLORS.gold },

  actionText: { fontWeight: '800', letterSpacing: 0.2 },
  actionTextGreen: { color: COLORS.greenText },
  actionTextGold: { color: COLORS.goldText },
});
