import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useJournalStore } from '../store/journalStore';
import { useTranslation } from 'react-i18next';

export default function JournalListScreen({ navigation }) {
  const { t } = useTranslation();
  const entries = useJournalStore(s => s.entries);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('JournalEdit')}>
        <Text style={styles.addText}>{t('journal.newEntry')}</Text>
      </TouchableOpacity>

      <FlatList
        data={entries}
        keyExtractor={(it) => String(it.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('JournalEdit', { id: item.id })}
            style={styles.row}
          >
            <Text style={styles.title}>{item.title || t('journal.untitled')}</Text>
            <Text style={styles.meta}>{new Date(item.date).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('journal.empty')}</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16 },
  addBtn: { backgroundColor: '#1f1b3a', padding: 14, borderRadius: 12, marginBottom: 10, alignItems: 'center' },
  addText: { color: '#fff', fontWeight: '700' },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  title: { color: '#fff', fontSize: 16 },
  meta: { color: '#777', fontSize: 12, marginTop: 2 },
  empty: { color: '#666', textAlign: 'center', marginTop: 30 },
});
