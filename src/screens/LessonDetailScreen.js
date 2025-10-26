// File: src/screens/LessonDetailScreen.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BgImage from '../components/BgImage';
import { MEDIA } from '../media/catalog'; // koristi postojeći katalog

const SUGGESTED_MEDIA = {
  'ld-05-breathing-suggestion': ['alpha_relax_10m'],
  'ld-08-wild': ['focus_pre_wild_12m'],
  'ld-09-audio-relax': ['alpha_relax_10m', 'alpha_relax_15m'],
};

/** ---------- Smart render helpers (bez novih i18n ključeva) ---------- */
const LABEL_RULES = [
  { type: 'goal',     re: [/^Cilj:\s*/i, /^Goal:\s*/i],                      icon: 'bullseye-arrow',         tint: '#eaf3ff', border: '#cfe5ff' },
  { type: 'exercise', re: [/^Vežba:\s*/i, /^Vezba:\s*/i, /^Exercise:\s*/i], icon: 'clipboard-check-outline', tint: '#e8f6ec', border: '#cdebd6' },
  { type: 'note',     re: [/^Napomena:\s*/i, /^Note:\s*/i],                  icon: 'lightbulb-on-outline',   tint: '#fff7e8', border: '#ffe3b6' },
];

function splitBold(text) {
  const parts = String(text).split('**');
  return parts.map((chunk, i) =>
    i % 2 === 1 ? (
      <Text key={`b-${i}`} style={{ fontWeight: '800' }}>
        {chunk}
      </Text>
    ) : (
      <Text key={`t-${i}`}>{chunk}</Text>
    )
  );
}

function detectLabel(s) {
  for (const rule of LABEL_RULES) {
    for (const re of rule.re) {
      if (re.test(s)) {
        const m = s.match(re);
        const label = (m && m[0] ? m[0] : '').trim().replace(/:$/, '');
        const rest = s.replace(re, '');
        return { ...rule, label, rest };
      }
    }
  }
  return null;
}

function renderParagraph(raw, i) {
  const s = String(raw || '').trim();

  if (s.startsWith('## ')) {
    return (
      <Text key={`h2-${i}`} style={styles.h2}>
        {s.replace(/^##\s*/, '')}
      </Text>
    );
  }
  if (s.startsWith('# ')) {
    return (
      <Text key={`h1-${i}`} style={styles.h1}>
        {s.replace(/^#\s*/, '')}
      </Text>
    );
  }

  if (/^(\-|\u2022|\u2013)\s+/.test(s)) {
    return (
      <View key={`li-${i}`} style={styles.bulletRow}>
        <MaterialCommunityIcons name="circle-small" size={20} color="#5b4636" style={styles.bulletIcon} />
        <Text style={styles.p}>{splitBold(s.replace(/^(\-|\u2022|\u2013)\s+/, ''))}</Text>
      </View>
    );
  }

  const lab = detectLabel(s);
  if (lab) {
    return (
      <View key={`lab-${i}`} style={[styles.labelRow, { backgroundColor: lab.tint, borderColor: lab.border }]}>
        <View style={styles.labelChip}>
          <MaterialCommunityIcons name={lab.icon} size={14} color="#3a2b1b" style={{ marginRight: 6 }} />
          <Text style={styles.labelTxt}>{lab.label}</Text>
        </View>
        <Text style={styles.p}>{splitBold(lab.rest)}</Text>
      </View>
    );
  }

  return (
    <Text key={`p-${i}`} style={styles.p}>
      {splitBold(s)}
    </Text>
  );
}
/** ---------- /helpers ---------- */

export default function LessonDetailScreen() {
  const { t } = useTranslation(['lessons', 'common']);
  const route = useRoute();
  const nav = useNavigation();
  const id = String(route.params?.id || '');

  const title = t(`lessons:lucid.${id}.title`, { defaultValue: 'Lesson' });
  const summary = t(`lessons:lucid.${id}.summary`, { defaultValue: '' });
  const content = t(`lessons:lucid.${id}.content`, { returnObjects: true, defaultValue: [] });
  const tonight = t(`lessons:lucid.${id}.tonight`, { defaultValue: '' });

  // Resolve-uj predložene ID-jeve u meta objekte iz kataloga (bezbedno)
  const tracks = useMemo(() => {
    const raw = SUGGESTED_MEDIA[id] || [];
    const list = Array.isArray(raw) ? raw : [];
    const media = Array.isArray(MEDIA) ? MEDIA : [];
    return list.map((tid) => {
      const meta = media.find((m) => m && m.id === tid) || null;
      return { id: tid, meta };
    });
  }, [id]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={{ padding: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <BgImage
          source={require('../assets/images/parchment.webp')}
          style={styles.paper}
          imageStyle={{ borderRadius: 14, opacity: 0.95 }}
          contentFit="cover"
        >
          <Text style={styles.title}>{title}</Text>
          {!!summary && <Text style={styles.summary}>{summary}</Text>}

          {Array.isArray(content)
            ? content.map((p, i) => renderParagraph(p, i))
            : typeof content === 'object' && content !== null
            ? Object.values(content).map((p, i) => renderParagraph(p, i))
            : renderParagraph(content, 0)}

          {!!tonight && (
            <View style={styles.callout}>
              <MaterialCommunityIcons
                name="moon-waning-crescent"
                size={18}
                color="#5b4636"
                style={styles.calloutIcon}
              />
              <Text style={styles.calloutTxt}>
                {t('lessons:tonight', { defaultValue: 'Tonight:' })} {tonight}
              </Text>
            </View>
          )}

          {tracks.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionLabel}>{t('lessons:playNow', { defaultValue: 'Play now (relax):' })}</Text>
              <View style={styles.mediaWrap}>
                {tracks.map(({ id: tid, meta }) => {
                  const disabled = !meta || !meta.id;
                  const label = meta?.title || tid;
                  return (
                    <TouchableOpacity
                      key={tid}
                      style={[styles.mediaBtn, disabled && { opacity: 0.5 }]}
                      onPress={() => !disabled && nav.navigate('Media', { play: tid })}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${label}`}
                      disabled={disabled}
                    >
                      <MaterialCommunityIcons name="play" size={16} color="#0b132b" style={{ marginRight: 6 }} />
                      <Text style={styles.mediaBtnTxt}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </BgImage>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#18181b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2e',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  paper: {
    backgroundColor: '#f7efe2',
    borderWidth: 1,
    borderColor: '#d9c8a8',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },

  title: { color: '#3a2b1b', fontSize: 18, fontWeight: '800', marginBottom: 6, letterSpacing: 0.3 },
  summary: { color: '#5b4636', marginBottom: 10, fontStyle: 'italic' },
  p: { color: '#3a2b1b', marginBottom: 8, lineHeight: 20 },

  h1: { color: '#3a2b1b', fontSize: 20, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  h2: { color: '#3a2b1b', fontSize: 17, fontWeight: '800', marginTop: 10, marginBottom: 4 },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletIcon: { marginTop: -2, marginRight: 2 },

  labelRow: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 6, marginBottom: 6 },
  labelChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  labelTxt: { color: '#3a2b1b', fontWeight: '800', letterSpacing: 0.2, marginLeft: 0 },

  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    backgroundColor: '#efe3cf',
    borderWidth: 1,
    borderColor: '#d7c5a6',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  calloutTxt: {
    color: '#5b4636',
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  calloutIcon: { marginTop: 2, marginRight: 8 },

  sectionLabel: { color: '#5b4636', fontWeight: '700', marginTop: 8 },

  mediaWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffd700',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  mediaBtnTxt: { color: '#0b132b', fontWeight: '800' },
});
