// File: src/screens/JournalListScreen.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listEntries } from '../lib/journalApi';
import { useSound } from '../providers/SoundProvider';

const COLORS = {
  bg: '#000',
  text: '#fff',
  sub: '#777',
  border: '#111',
  filterBg: '#111',
  filterActive: '#201a3a',

  green: '#00C853',
  greenText: '#002315',
};

export default function JournalListScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { playClick } = useSound();

  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all'); // 'all' | 'notes' | 'interpreted'
  const [items, setItems] = React.useState([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await listEntries(filter);
    if (!error) setItems(data || []);
    setLoading(false);
  }, [filter]);

  React.useEffect(() => { reload(); }, [reload]);
  React.useEffect(() => {
    const unsub = navigation.addListener('focus', reload);
    return unsub;
  }, [navigation, reload]);

  const Row = ({ item }) => {
    const title = item.title?.trim() || t('journal.untitled', { defaultValue: 'Untitled' });
    const when = new Date(item.created_at).toLocaleString();

    const openItem = () => {
      if (item.analysis_at) navigation.navigate('JournalDetail', { id: item.id });
      else navigation.navigate('JournalEdit', { id: item.id });
    };
    const sendToInterpretation = () =>
      navigation.navigate('Interpretation', {
        draftId: item.id,
        dreamText: item.content,
        feelings: item.feelings || '',
        recentEvents: item.recent_events || '',
      });

    return (
      <View style={styles.row}>
        <TouchableOpacity onPress={() => { playClick(); openItem(); }} style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{when}</Text>
          {item.analysis_at ? (
            <Text style={styles.badge}>
              {item.analysis_method === 'scientific'
                ? t('interpretation.scientific', { defaultValue: 'Scientific' })
                : t('interpretation.traditionalShort', { defaultValue: 'Traditional' })}
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallBtn} onPress={() => { playClick(); sendToInterpretation(); }}>
          <Text style={styles.smallBtnText}>
            {t('journal.sendToInterpretation', { defaultValue: 'Interpret' })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const Header = (
    <View>
      {/* Add new (zeleno) */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => { playClick(); navigation.navigate('JournalEdit'); }}
      >
        <Text style={styles.addText}>
          {t('journal.newEntry', { defaultValue: 'New entry' })}
        </Text>
      </TouchableOpacity>

      {/* Filters */}
      <View style={styles.filters}>
        {[
          { key: 'all', label: t('journal.filter.all', { defaultValue: 'All' }) },
          { key: 'notes', label: t('journal.filter.notes', { defaultValue: 'Notes only' }) },
          { key: 'interpreted', label: t('journal.filter.interpreted', { defaultValue: 'Interpreted' }) },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => { playClick(); setFilter(f.key); }}
          >
            <Text style={styles.filterText}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={Row}
        ListHeaderComponent={Header}
        ListHeaderComponentStyle={{ marginBottom: 6 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t('journal.empty', { defaultValue: 'No entries yet.' })}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshing={loading}
        onRefresh={reload}
        // malo bolje ponašanje na slabijim telefonima
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingTop: 16 },

  // Header
  addBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  addText: { color: COLORS.greenText, fontWeight: '800', letterSpacing: 0.2 },

  filters: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.filterBg,
  },
  filterBtnActive: { backgroundColor: COLORS.filterActive },
  filterText: { color: COLORS.text, fontSize: 13 },

  // Loading
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  // Rows
  sep: { height: 1, backgroundColor: COLORS.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  title: { color: COLORS.text, fontSize: 16 },
  meta: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  badge: { color: '#a78bfa', fontSize: 12, marginTop: 4 },

  smallBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  smallBtnText: { color: COLORS.greenText, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  empty: { color: '#666', textAlign: 'center', marginTop: 30 },
});
