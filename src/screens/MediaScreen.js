// File: src/screens/MediaScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import AudioItem from '../components/AudioItem';
import { useTranslation } from 'react-i18next';

const MOCK_MEDIA = [
  { id: '1', title: 'Binaural – Theta 40 min' },
  { id: '2', title: 'Meditacija – Disanje 10 min' },
  { id: '3', title: 'Relax – Kiša 30 min' },
];

export default function MediaScreen() {
  const { t } = useTranslation();
  const [items] = useState(MOCK_MEDIA);

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>{t('media.header')}</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <AudioItem title={item.title} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
      {/* TODO: preview/play via expo-av */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16 },
  header: { color: '#fff', fontSize: 18, marginBottom: 10 },
});
