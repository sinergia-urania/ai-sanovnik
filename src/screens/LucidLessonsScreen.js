import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../providers/AuthProvider';
import { FeaturePlan, hasAccess } from '../utils/planRules';

const LESSONS = [
  { id:'ld-00-intro', order:0 },
  { id:'ld-01-sleep-rem', order:1 },
  { id:'ld-02-dream-journal', order:2 },
  { id:'ld-03-dream-signs', order:3 },
  { id:'ld-04-reality-checks', order:4 },
  { id:'ld-05-breathing-suggestion', order:5 },
  { id:'ld-06-mild', order:6 },
  { id:'ld-07-wbtb', order:7 },
  { id:'ld-08-wild', order:8 },
  { id:'ld-09-audio-relax', order:9 },
  { id:'ld-10-night-plan', order:10 },
  { id:'ld-11-first-actions', order:11 },
  { id:'ld-12-stabilization', order:12 },
  { id:'ld-13-gentle-control', order:13 },
  { id:'ld-14-nightmares-ethics', order:14 },
  { id:'ld-15-troubleshooting', order:15 },
];

export default function LucidLessonsScreen({ navigation }) {
  const { t } = useTranslation(['common', 'lucid', 'lessons']);
  const { plan } = useAuth();

  // PRO/PROPLUS guard
  useEffect(() => {
    if (!hasAccess(plan, FeaturePlan.lucidAccess)) {
      Toast.show({
        type: 'info',
        text1: t('common:membership.title', { defaultValue: 'Planovi i pretplate' }),
        text2: t('lucid:lockedBody', { defaultValue: 'Trening lucidnog je dostupan na PRO planu.' }),
        position: 'bottom',
      });
      navigation.replace('Plans');
    }
  }, [plan, navigation, t]);

  return (
    <View style={styles.wrap}>
      <FlatList
        data={LESSONS}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('LessonDetail', { id: item.id })}
          >
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={styles.badge}><Text style={styles.badgeTxt}>{item.order}</Text></View>
              <Text style={styles.title}>
                {t(`lessons:lucid.${item.id}.title`, { defaultValue: `Lesson ${item.order}` })}
              </Text>
            </View>
            <Text style={styles.meta}>
              {t(`lessons:lucid.${item.id}.summary`, { defaultValue: 'Short overview.' })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#18181b', padding: 16 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2e' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  meta: { color: '#c7c7d1', fontSize: 12, marginTop: 6, maxWidth: '90%' },
  badge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffd700',
    alignItems: 'center', justifyContent: 'center'
  },
  badgeTxt: { color: '#222', fontWeight: '800' },
});
