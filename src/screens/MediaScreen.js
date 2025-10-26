// File: src/screens/MediaScreen.js
import { useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import AudioItem from '../components/AudioItem';
import BgImage from '../components/BgImage';
// ⬇️ KORISTI BEZBEDAN KATALOG
import { MEDIA } from '../media/catalogSafe';
import { useSupabaseAudioPlayer } from '../media/useSupabaseAudioPlayer';

export default function MediaScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const listRef = useRef(null);

  const { playById, nowPlaying, pause, stop, error } = useSupabaseAudioPlayer();

  // Defenzivno: očisti ulazne stavke (nikad null/bez id/group)
  const safeMedia = useMemo(() => {
    return (Array.isArray(MEDIA) ? MEDIA : [])
      .filter(Boolean)
      .filter((m) => typeof m === 'object' && m.id && m.group);
  }, []);

  // Grupisanje po sekcijama — defenzivno
  const sections = useMemo(() => {
    const groups = { binaural: [], short: [], long: [] };
    safeMedia.forEach((m) => {
      if (groups[m.group]) groups[m.group].push(m);
    });

    return [
      {
        key: 'binaural',
        title: t('media.sections.binaural', { defaultValue: 'Binaural' }),
        data: groups.binaural,
      },
      {
        key: 'short',
        title: t('media.sections.shortRelax', { defaultValue: 'Short relax (≤15m)' }),
        data: groups.short,
      },
      {
        key: 'long',
        title: t('media.sections.longRelax', { defaultValue: 'Long relax & meditation' }),
        data: groups.long,
      },
    ].filter((sec) => Array.isArray(sec.data) && sec.data.length > 0);
  }, [safeMedia, t]);

  // id -> { sectionIndex, itemIndex } (za auto-scroll)
  const indexMap = useMemo(() => {
    const map = {};
    sections.forEach((sec, si) => {
      sec.data.forEach((it, ii) => {
        if (it?.id) map[it.id] = { si, ii };
      });
    });
    return map;
  }, [sections]);

  // Auto-scroll ako dođemo sa LessonDetail (nav.navigate('Media', { play: id }))
  const playId = route?.params?.play;
  useEffect(() => {
    if (!playId || !indexMap[playId] || !listRef.current) return;
    const { si, ii } = indexMap[playId];
    const to = setTimeout(() => {
      try {
        listRef.current.scrollToLocation({
          sectionIndex: si,
          itemIndex: ii,
          animated: true,
          viewPosition: 0.2,
        });
      } catch {}
    }, 60);
    return () => clearTimeout(to);
  }, [playId, indexMap]);

  return (
    <View style={styles.wrap}>
      <BgImage
        source={require('../assets/images/parchment.webp')}
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.15 }}
        contentFit="cover"
      />

      <Text style={styles.header}>{t('media.header', { defaultValue: 'Multimedija i meditacije' })}</Text>

      {!!error && (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{String(error)}</Text>
        </View>
      )}

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item, idx) => (item?.id ? String(item.id) : `idx-${idx}`)}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (!item) return null;
          return (
            <View style={styles.itemWrap}>
              <AudioItem
                title={item.title}
                isPlaying={item?.id ? nowPlaying === item.id : false}
                onPlay={() => item?.id && playById(item.id)}
                onPause={pause}
                onStop={stop}
              />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        initialNumToRender={20}
        windowSize={10}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16 },
  header: { color: '#fff', fontSize: 18, marginBottom: 10, fontWeight: '700' },
  errBox: {
    backgroundColor: 'rgba(150,0,0,0.3)',
    borderColor: '#802',
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  errText: { color: '#fff' },
  sectionHeader: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: '#1e1e22',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, marginTop: 10, marginBottom: 8,
  },
  sectionTitle: { color: '#fff', fontWeight: '800' },
  itemWrap: {
    backgroundColor: '#0e0e10',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e22',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
});
