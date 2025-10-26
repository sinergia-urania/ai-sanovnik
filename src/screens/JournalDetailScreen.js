// File: src/screens/JournalDetailScreen.js
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getEntry } from '../lib/journalApi';
import { useSound } from '../providers/SoundProvider';

const COLORS = {
  bg: '#000',
  card: '#0a0a0a',
  border: '#222',
  text: '#fff',
  sub: '#aaa',
  green: '#00C853',
  greenText: '#002315',
  gold: '#D4AF37',
  goldText: '#1a1400',
};

export default function JournalDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = route.params || {};
  const { playClick } = useSound();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);

  useEffect(() => {
    navigation.setOptions({ title: t('journal.details', { defaultValue: 'Dream' }) });
  }, [navigation, t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await getEntry(id);
      if (error) {
        Toast.show({
          type: 'error',
          text1: t('common.errors.genericTitle', { defaultValue: 'Error' }),
          text2: t('common.errors.tryAgain', { defaultValue: 'Please try again.' }),
        });
      }
      setItem(data || null);
      setLoading(false);
    })();
  }, [id, t]);

  const methodLabel =
    item?.analysis_method === 'scientific'
      ? t('interpretation.scientificShort', { defaultValue: 'Scientific' })
      : item?.analysis_method === 'traditional'
      ? t('interpretation.traditionalShort', { defaultValue: 'Traditional' })
      : t('common.unknown', { defaultValue: 'Unknown' });

  const onEdit = () => { playClick(); navigation.navigate('JournalEdit', { id }); };
  const onReinterpret = () => {
    playClick();
    navigation.navigate('Interpretation', {
      draftId: id,
      dreamText: item?.content || '',
      feelings: item?.feelings || '',
      recentEvents: item?.recent_events || '',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: COLORS.sub }}>
          {t('common.errors.notFound', { defaultValue: 'Not found.' })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta */}
        <Text style={styles.title}>{item.title || t('journal.untitled', { defaultValue: 'Untitled' })}</Text>
        <Text style={styles.meta}>
          {new Date(item.created_at).toLocaleString()}
        </Text>

        {/* Sadržaj sna */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('interpretation.dream', { defaultValue: 'Your dream' })}
          </Text>
          <Text style={styles.body}>{item.content || '-'}</Text>

          {!!item.feelings && (
            <>
              <Text style={styles.sectionTitle}>
                {t('interpretation.feelings', { defaultValue: 'Feelings' })}
              </Text>
              <Text style={styles.body}>{item.feelings}</Text>
            </>
          )}

          {!!item.recent_events && (
            <>
              <Text style={styles.sectionTitle}>
                {t('interpretation.events', { defaultValue: 'Recent events' })}
              </Text>
              <Text style={styles.body}>{item.recent_events}</Text>
            </>
          )}
        </View>

        {/* Tumačenje */}
        {!!item.analysis_text && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('result.interpretation', { defaultValue: 'Interpretation' })}
            </Text>
            <Text style={styles.meta}>
              {t('result.method', { defaultValue: 'Method' })}: {methodLabel}
              {item.analysis_at ? ` · ${new Date(item.analysis_at).toLocaleString()}` : ''}
            </Text>
            <Text style={styles.body}>{item.analysis_text}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky akcije */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity onPress={onReinterpret} style={[styles.btn, styles.btnGreen]}>
          <Feather name="send" size={18} color={COLORS.greenText} />
          <Text style={[styles.btnTxt, { color: COLORS.greenText }]}>
            {t('journal.sendToInterpretation', { defaultValue: 'Interpret again' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={[styles.btn, styles.btnGold]}>
          <Feather name="edit-2" size={18} color={COLORS.goldText} />
          <Text style={[styles.btnTxt, { color: COLORS.goldText }]}>
            {t('journal.edit', { defaultValue: 'Edit note' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  meta: { color: COLORS.sub, fontSize: 12, marginTop: 4, marginBottom: 8 },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  sectionTitle: { color: '#a78bfa', fontWeight: '700', marginBottom: 6 },
  body: { color: COLORS.text, lineHeight: 20, fontSize: 14 },

  footer: {
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
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  btnGreen: { backgroundColor: COLORS.green },
  btnGold: { backgroundColor: COLORS.gold },
  btnTxt: { fontWeight: '800', letterSpacing: 0.2 },
});
