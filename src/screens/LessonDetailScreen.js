// File: src/screens/LessonDetailScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LessonDetailScreen() {
  const { t } = useTranslation();
  // TODO: fetch lesson content from Supabase
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('lucid.lesson')}</Text>
      <Text style={styles.body}>{t('lucid.lessonBody')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16 },
  title: { color: '#fff', fontSize: 18, marginBottom: 8 },
  body: { color: '#bbb', lineHeight: 20 },
});
