// File: src/screens/HomeScreen.jsx
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import IconCard from '../components/IconCard';
import { useAuth } from '../providers/AuthProvider';
import { useSound } from '../providers/SoundProvider';
import { guardFeature } from '../utils/featureGuard';
import { FeaturePlan } from '../utils/planRules'; // ⬅️ hasAccess više ne koristimo ovde

const IMG = {
  interpret:  require('../assets/images/sova.webp'),
  journal:    require('../assets/images/dnevnik.webp'),
  lucid:      require('../assets/images/lucidno.webp'),
  media:      require('../assets/images/audio.webp'),
  plans:      require('../assets/images/access.webp'),
  background: require('../assets/images/homebackground.webp'),
};

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { playClick } = useSound();

  // ⬇️ uzmi i refreshProfile iz AuthProvider-a
  const { plan, has, refreshProfile } = useAuth(); // plan: 'free' | 'premium' | 'pro' | 'proplus'

  // ⚡️ na svaki fokus Home ekrana, povuci najnoviji plan/coins (bez reloga)
  useFocusEffect(
    React.useCallback(() => {
      refreshProfile?.().catch(() => {});
    }, [refreshProfile])
  );

  // stabilne dimenzije
  const CIRCLE_RATIO = Math.min(Math.max(0.33, 0.35), 0.5);
  const CIRCLE_SIZE  = Math.round(width * CIRCLE_RATIO);
  const IMAGE_SCALE  = 0.68;

  // helper: navigate + klik zvuk
  const go = (routeName) => () => {
    try { playClick?.(); } catch {}
    navigation.navigate(routeName);
  };

  // Ako korisnik IMA pravo → navigiraj; ako ne → guardFeature (toast + Plans)
  const goGuarded = (routeName, need, toastKey) => () => {
    try { playClick?.(); } catch {}
    if (has(need)) {
      navigation.navigate(routeName);
    } else {
      guardFeature({ plan, need, t, navigation, toastKey });
    }
  };

  // locked stanje direktno iz has(need) → odmah reaguje na promenu plana
  const items = useMemo(() => ([
    {
      key: 'interpret',
      title: t('home.interpret'),
      onPress: go('Interpretation'),
      image: IMG.interpret,
      locked: false,
    },
    {
      key: 'journal',
      title: t('home.journal'),
      onPress: goGuarded('JournalList', FeaturePlan.journalAccess, 'journal'),
      image: IMG.journal,
      locked: !has(FeaturePlan.journalAccess),
    },
    {
      key: 'lucid',
      title: t('home.lucid'),
      onPress: goGuarded('LucidLessons', FeaturePlan.lucidAccess, 'lucid'),
      image: IMG.lucid,
      locked: !has(FeaturePlan.lucidAccess),
    },
    {
      key: 'media',
      title: t('home.media'),
      onPress: goGuarded('Media', FeaturePlan.mediaAccess, 'media'),
      image: IMG.media,
      locked: !has(FeaturePlan.mediaAccess),
    },
    {
      key: 'plans',
      title: t('home.plans'),
      onPress: go('Plans'),
      image: IMG.plans,
      locked: false,
    },
  ]), [t, navigation, playClick, has, plan]); // deps uključuju "has" i "plan"

  return (
    <View style={styles.container}>
      <Image
        source={IMG.background}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={250}
        cachePolicy="disk"
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: (insets.bottom || 0) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {items.map(it => (
          <IconCard
            key={it.key}
            title={it.title}
            image={it.image}
            onPress={it.onPress}
            locked={it.locked}            // 🔒 vizuelni overlay po planu
            size={CIRCLE_SIZE}
            imageScale={IMAGE_SCALE}
            ringWidth={1}
            style={styles.item}
            testID={`home-${it.key}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 26,
  },
  item: {},
});
