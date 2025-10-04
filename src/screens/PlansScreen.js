import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function PlansScreen() {
  const { t } = useTranslation();
  // TODO: fetch real limits/prices from backend (Supabase or edge function)
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('plans.header')}</Text>
      <View style={styles.card}>
        <Text style={styles.planTitle}>Free</Text>
        <Text style={styles.planLine}>{t('plans.freeLimits')}</Text>
        <Text style={styles.price}>{t('plans.freePrice')}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.planTitle}>Premium</Text>
        <Text style={styles.planLine}>{t('plans.premiumLimits')}</Text>
        <Text style={styles.price}>{t('plans.premiumPrice')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', padding: 16, gap: 12 },
  title: { color: '#fff', fontSize: 18, marginBottom: 6 },
  card: { backgroundColor: '#0a0a0a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#111' },
  planTitle: { color: '#fff', fontSize: 16, marginBottom: 6 },
  planLine: { color: '#bbb' },
  price: { color: '#9b87f5', marginTop: 6, fontWeight: '700' },
});