// File: src/screens/LucidLessonsScreen.js
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const MOCK_LESSONS = [
  { id: '1', title: 'Osnove lucidnog sna' },
  { id: '2', title: 'Dnevnik i reality checks' },
  { id: '3', title: 'WILD/MILD tehnike' },
];

export default function LucidLessonsScreen({ navigation }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <FlatList
        data={MOCK_LESSONS}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('LessonDetail', { id: item.id })}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{t('lucid.tapToOpen')}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  title: { color: '#fff', fontSize: 16 },
  meta: { color: '#777', fontSize: 12, marginTop: 4 },
});
