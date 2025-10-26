// File: src/components/AudioItem.js
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Controlled-only:
 * - title: string
 * - isPlaying: boolean
 * - onPlay: () => void
 * - onPause: () => void
 * - onStop?: () => void
 */
export default function AudioItem({ title, isPlaying, onPlay, onPause, onStop }) {
  const { t } = useTranslation();
  const toggle = () => (isPlaying ? onPause?.() : onPlay?.());

  return (
    <View style={styles.row}>
      {/* Play/Pause */}
      <TouchableOpacity
        onPress={toggle}
        style={styles.circle}
        accessibilityRole="button"
        accessibilityLabel={isPlaying
          ? t('media.controls.pause', { defaultValue: 'Pause' })
          : t('media.controls.play',  { defaultValue: 'Play' })
        }
        activeOpacity={0.85}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <MaterialCommunityIcons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color="#0b132b"
        />
      </TouchableOpacity>

      {/* Title + small playing badge */}
      <TouchableOpacity
        onPress={toggle}
        style={styles.titleWrap}
        accessibilityRole="button"
        accessibilityLabel={title}
        activeOpacity={0.85}
      >
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        {isPlaying ? (
          <View style={styles.badge}>
            <MaterialCommunityIcons name="waveform" size={14} color="#0b132b" />
            {/* ako ne želiš tekst, obriši sledeći red */}
            <Text style={styles.badgeTxt}>
              {t('media.badge.playing', { defaultValue: 'Playing' })}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* STOP — crveni kvadrat sa jasnim ramom */}
      {onStop ? (
        <TouchableOpacity
          onPress={onStop}
          style={styles.stopBtn}
          accessibilityRole="button"
          accessibilityLabel={t('media.controls.stop', { defaultValue: 'Stop' })}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MaterialCommunityIcons
            name="stop"
            size={18}
            color="#e11d2e"   // kvadratić (ikonica) je crven
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },

  circle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffd700',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
    borderWidth: 2, borderColor: '#cda800',
  },

  titleWrap: { flex: 1, justifyContent: 'center' },

  title: { color: '#fff', fontSize: 15, fontWeight: '700' },

  badge: {
    marginTop: 6, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffe58a', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeTxt: { color: '#0b132b', fontWeight: '800', marginLeft: 6, fontSize: 12 },

  // Vidljivo uokviren STOP dugmić; kvadrat ikone je crven (color iznad)
  stopBtn: {
    marginLeft: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,               // jači ram
    borderColor: '#ff4d4d',       // jasan crveni ram
    backgroundColor: 'rgba(225,29,46,0.08)', // blaga crvena pozadina radi kontrasta
  },
});
