import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
// TODO: Wire real AI logic using aiClient and dreamRules
// import { interpretDream } from '../utils/aiClient';

export default function InterpretationScreen() {
  const { t } = useTranslation();
  const [dreamText, setDreamText] = useState('');
  const [feelings, setFeelings] = useState('');
  const [recentEvents, setRecentEvents] = useState('');

  const chooseMethod = (method) => {
    if (!dreamText.trim()) {
      Alert.alert('⚠️', t('interpretation.enterDream'));
      return;
    }
    // TODO: send to AI with method: 'scientific' | 'traditional'
    Alert.alert('ℹ️', `${t('interpretation.chosen')}: ${method}`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('interpretation.dream')}</Text>
      <TextInput
        placeholder={t('interpretation.dreamPH')}
        placeholderTextColor="#666"
        multiline
        value={dreamText}
        onChangeText={setDreamText}
        style={styles.input}
      />
      <Text style={styles.label}>{t('interpretation.feelings')}</Text>
      <TextInput
        placeholder={t('interpretation.feelingsPH')}
        placeholderTextColor="#666"
        value={feelings}
        onChangeText={setFeelings}
        style={styles.single}
      />
      <Text style={styles.label}>{t('interpretation.events')}</Text>
      <TextInput
        placeholder={t('interpretation.eventsPH')}
        placeholderTextColor="#666"
        value={recentEvents}
        onChangeText={setRecentEvents}
        style={styles.single}
      />

      <View style={styles.methods}>
        <TouchableOpacity style={styles.btn} onPress={() => chooseMethod('Scientific (Jung/Freud/Szondi)')}>
          <Text style={styles.btnText}>{t('interpretation.scientific')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => chooseMethod('Traditional')}>
          <Text style={styles.btnText}>{t('interpretation.traditional')}</Text>
        </TouchableOpacity>
      </View>

      {/* TODO: speech-to-text button (Expo Speech/Voice) */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#000' },
  label: { color: '#aaa', marginBottom: 6 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  single: {
    height: 44,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  methods: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, backgroundColor: '#1f1b3a', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
