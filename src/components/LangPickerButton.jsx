// File: src/components/LangPickerButton.jsx
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { setAppLanguage } from '../i18n';
import { LANGS } from '../lib/i18nLangs';

export default function LangPickerButton({ compact = true }) {
  const { i18n } = useTranslation();
  const current = useMemo(() => (i18n?.language || 'en').slice(0, 2), [i18n?.language]);
  const [open, setOpen] = useState(false);
  const active = LANGS.find(l => l.code === current) || LANGS[0];

  const choose = async (code) => {
    await setAppLanguage(code); // čuva u storage + i18n.changeLanguage
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.btn, compact && styles.btnCompact]}
        accessibilityRole="button"
        accessibilityLabel="Change language"
      >
        <Text style={styles.icon}>🌐</Text>
        {!compact && <Text style={styles.txt}>{active?.label}</Text>}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.card}>
          <Text style={styles.title}>Choose language</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {LANGS.map(L => {
              const isActive = L.code === active.code;
              return (
                <TouchableOpacity
                  key={L.code}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => choose(L.code)}
                >
                  <Text style={styles.flag}>{L.flag}</Text>
                  <Text style={[styles.rowTxt, isActive && styles.rowTxtActive]}>{L.label}</Text>
                  {isActive && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}>
            <Text style={styles.cancelTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161616', borderColor: '#2a2a2a', borderWidth: 1,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
  },
  btnCompact: { paddingVertical: 6, paddingHorizontal: 8 },
  icon: { fontSize: 16, color: '#ddd' },
  txt: { color: '#ddd', marginLeft: 6, fontWeight: '600' },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  card: {
    position: 'absolute', left: 24, right: 24, top: '25%',
    backgroundColor: '#121212', borderRadius: 14, padding: 14,
    borderColor: '#2a2a2a', borderWidth: 1,
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
  },
  rowActive: { backgroundColor: 'rgba(155,135,245,0.12)' },
  rowTxt: { color: '#ddd', fontSize: 14 },
  rowTxtActive: { color: '#fff', fontWeight: '700' },
  flag: { fontSize: 16 },
  check: { color: '#9b87f5', marginLeft: 'auto', fontWeight: '900' },
  cancel: {
    alignSelf: 'flex-end', marginTop: 8, paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: '#2a2a2a',
  },
  cancelTxt: { color: '#facc15', fontWeight: '700' },
});
