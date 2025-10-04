// File: src/screens/HomeScreen.js
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import IconCard from '../components/IconCard';

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();

  const items = [
    { key: 'interpret', title: t('home.interpret'), onPress: () => navigation.navigate('Interpretation') },
    { key: 'journal', title: t('home.journal'), onPress: () => navigation.navigate('JournalList') },
    { key: 'lucid', title: t('home.lucid'), onPress: () => navigation.navigate('LucidLessons') },
    { key: 'media', title: t('home.media'), onPress: () => navigation.navigate('Media') },
    { key: 'plans', title: t('home.plans'), onPress: () => navigation.navigate('Plans') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {items.map(it => (
        <IconCard key={it.key} title={it.title} onPress={it.onPress} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16, gap: 12 },
});
