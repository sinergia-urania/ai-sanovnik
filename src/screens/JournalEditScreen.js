// File: src/screens/JournalEditScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useJournalStore } from '../store/journalStore';
import { useTranslation } from 'react-i18next';

export default function JournalEditScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { id } = route.params || {};
  const { entries, addEntry, updateEntry, removeEntry } = useJournalStore();
  const existing = entries.find(e => e.id === id);

  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');

  useEffect(() => {
    navigation.setOptions({ title: existing ? t('journal.edit') : t('journal.newEntry') });
  }, [existing, navigation, t]);

  const onSave = () => {
    if (existing) {
      updateEntry({ ...existing, title, content });
    } else {
      addEntry({ title, content });
    }
    navigation.goBack();
  };

  const onSendToInterpretation = () => {
    // TODO: Navigate to Interpretation with prefilled text
    navigation.navigate('Interpretation');
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        placeholder={t('journal.titlePH')}
        placeholderTextColor="#666"
        value={title}
        onChangeText={setTitle}
        style={styles.title}
      />
      <TextInput
        placeholder={t('journal.contentPH')}
        placeholderTextColor="#666"
        value={content}
        onChangeText={setContent}
        multiline
        style={styles.content}
      />

      <View style={styles.row}>
        <TouchableOpacity onPress={onSave} style={styles.btn}>
          <Text style={styles.btnText}>{t('common.save')}</Text>
        </TouchableOpacity>
        {existing && (
          <TouchableOpacity onPress={() => { removeEntry(existing.id); navigation.goBack(); }} style={[styles.btn, { backgroundColor: '#3a1b1b' }]}>
            <Text style={styles.btnText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={onSendToInterpretation} style={[styles.btn, { marginTop: 10 }]}>
        <Text style={styles.btnText}>{t('journal.sendToInterpretation')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16 },
  title: { height: 44, borderWidth: 1, borderColor: '#222', backgroundColor: '#0a0a0a', color: '#fff', paddingHorizontal: 12, borderRadius: 10, marginBottom: 12 },
  content: { minHeight: 160, borderWidth: 1, borderColor: '#222', backgroundColor: '#0a0a0a', color: '#fff', padding: 12, borderRadius: 10 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, backgroundColor: '#1f1b3a', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});

