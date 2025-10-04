import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
// TODO: support image prop (require/uri). Using emoji box as placeholder.

export default function IconCard({ title, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, style]}>
      <View style={styles.thumb}><Text style={{ fontSize: 22 }}>🌙</Text></View>
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#141414',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1b1b1b',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
