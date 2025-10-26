// File: src/components/AppHeader.jsx
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../providers/AuthProvider';
import { useSound } from '../providers/SoundProvider';

import { onQuotaRefresh, triggerQuotaRefresh } from '../utils/quotaBus';

import ProfileModal from './ProfileModal';
import SidebarMenu from './SidebarMenu';

const GOLD  = '#F2C94C';
const GREEN = '#00C853';

// SHEMA PO EKRANIMA
// - Home: zadržavamo meni + jezik + zvuk
// - JournalList: back, BEZ menija/jezika/zvuka
// - JournalEdit: home, BEZ menija/jezika/zvuka
// - Interpretation: back, BEZ jezika/zvuka
// - Result: home, BEZ jezika/zvuka
const SCHEMES = {
  Home:           { left: 'menu',  showTitle: false, right: ['user','counter','plan','lang','sound'] },
  JournalList:    { left: 'back',  showTitle: false, right: ['user','counter','plan'] },
  JournalEdit:    { left: 'home',  showTitle: false, right: ['user','counter','plan'] },
  Interpretation: { left: 'back',  showTitle: false, right: ['user','counter','plan'] },
  Result:         { left: 'home',  showTitle: false, right: ['user','counter','plan'] },
  JournalDetail:  { left: 'back',  showTitle: false, right: ['user','counter','plan'] },
  LessonDetail:   { left: 'back',  showTitle: false, right: ['user','counter','plan'] },
  LucidLessons:   { left: 'home',  showTitle: false, right: ['user','counter','plan'] },
  Media:          { left: 'home',  showTitle: false, right: ['user','counter','plan'] },
};

const PLAN_LABEL = { free: 'Free', premium: 'Premium', pro: 'PRO', proplus: 'PRO+' };

function ellipsize(s, max = 9) {
  const str = String(s || '');
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

export default function AppHeader() {
  const nav = useNavigation();
  const route = useRoute();
  const { t, i18n } = useTranslation(['common']);
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const { muted, setMuted, playClick } = useSound();

  const [displayName, setDisplayName] = useState('');
  const [credits, setCredits] = useState(0);
  const [planKey, setPlanKey] = useState('free');

  const [availableTotal, setAvailableTotal] = useState(0);
  const [proplusExpiresAt, setProplusExpiresAt] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Compact mode (npr. iPhone SE / veoma uski Androidi)
  const { width } = useWindowDimensions();
  const isCompact = width <= 360;
  const ICON_SIZE = isCompact ? 20 : 22;

  const scheme = SCHEMES[route.name] || SCHEMES.Home;

  // U compact-u na Home sakrij samo "sound"
  const rightKeys = useMemo(() => {
    const base = scheme.right || [];
    if (isCompact && route.name === 'Home') return base.filter(k => k !== 'sound');
    return base;
  }, [scheme.right, isCompact, route.name]);

  const emailFallback = useMemo(() => {
    const email = session?.user?.email || '';
    return email ? email.split('@')[0] : 'User';
  }, [session?.user?.email]);
  const uiName = ellipsize(displayName || emailFallback, 9);

  const toggleLang = useCallback(() => {
    i18n.changeLanguage(i18n.language?.startsWith('sr') ? 'en' : 'sr');
  }, [i18n]);

  // API calls
  const fetchQuota = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('quota_get', { body: {} });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.plan) setPlanKey(String(row.plan).toLowerCase());
      if (row) {
        const total = Number(row?.available_total ?? row?.balance ?? 0);
        setAvailableTotal(total);
        setCredits(total);
      }
    } catch {}
  }, []);

  const fetchProfileName = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData?.user?.id;
      if (!id) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', id)
        .single();
      setDisplayName(data?.display_name || '');
    } catch {}
  }, []);

  // refresh on focus
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        if (!live) return;
        await Promise.all([fetchQuota(), fetchProfileName()]);
      })();
      return () => { live = false; };
    }, [fetchQuota, fetchProfileName])
  );

  // refresh on quota bus
  useEffect(() => {
    const off = onQuotaRefresh(() => {
      fetchQuota();
      fetchProfileName();
    });
    return off;
  }, [fetchQuota, fetchProfileName]);

  // Close sidebar on Android back
  useEffect(() => {
    if (!menuOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [menuOpen]);

  // Close sidebar when route changes
  useEffect(() => {
    if (menuOpen) setMenuOpen(false);
  }, [route?.name]); // eslint-disable-line

  const Left = () => {
    if (scheme.left === 'menu') {
      return (
        <TouchableOpacity
          style={[styles.btn, isCompact && styles.btnCompact]}
          onPress={() => { try { playClick?.(); } catch {} setMenuOpen(true); }}
        >
          <Feather name="menu" size={ICON_SIZE} color="#ddd" />
        </TouchableOpacity>
      );
    }
    if (scheme.left === 'back' && nav.canGoBack()) {
      return (
        <TouchableOpacity style={[styles.btn, isCompact && styles.btnCompact]} onPress={() => nav.goBack()}>
          <Feather name="arrow-left" size={ICON_SIZE} color={GOLD} />
        </TouchableOpacity>
      );
    }
    // default: HOME
    return (
      <TouchableOpacity
        style={[styles.btn, isCompact && styles.btnCompact]}
        onPress={() => nav.reset({ index: 0, routes: [{ name: 'Home' }] })}
      >
        <Feather name="home" size={ICON_SIZE} color={GOLD} />
      </TouchableOpacity>
    );
  };

  const Right = () => (
    <View style={[styles.rightRow, isCompact && styles.rightRowCompact]}>
      {rightKeys?.includes('user') && (
        <TouchableOpacity onPress={() => setShowProfile(true)} activeOpacity={0.8}>
          <View style={[styles.pill, styles.userPill, isCompact && styles.pillCompact]}>
            <Text style={styles.pillTxt} numberOfLines={1}>{uiName}</Text>
          </View>
        </TouchableOpacity>
      )}
      {rightKeys?.includes('counter') && (
        <View style={[styles.pill, isCompact && styles.pillCompact]}>
          <Text style={[styles.pillTxt, styles.counterTxt]}>{credits}</Text>
        </View>
      )}
      {rightKeys?.includes('plan') && (
        <View style={[styles.pill, styles.planPill, isCompact && styles.pillCompact]}>
          <Text style={styles.pillTxt}>
            {PLAN_LABEL[planKey] ?? PLAN_LABEL.free}
          </Text>
        </View>
      )}
      {/* Jezik i zvuk se prikazuju SAMO po shemi (u compact-u na Home sakriven 'sound') */}
      {rightKeys?.includes('lang') && (
        <TouchableOpacity onPress={toggleLang} style={[styles.pillMini, isCompact && styles.pillMiniCompact]}>
          <Text style={styles.pillMiniTxt}>{(i18n.language || 'en').toUpperCase()}</Text>
        </TouchableOpacity>
      )}
      {rightKeys?.includes('sound') && (
        <TouchableOpacity onPress={() => setMuted(!muted)} style={[styles.pillMini, isCompact && styles.pillMiniCompact]}>
          <Text style={styles.pillMiniTxt}>{!muted ? '🔊' : '🔈'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const topPad = (insets.top || 0);

  return (
    <View style={[styles.wrap, { paddingTop: topPad }]}>
      <View style={[styles.inner, isCompact && styles.innerCompact]}>
        <View style={[styles.leftSide, isCompact && styles.leftSideCompact]}><Left /></View>
        <View style={styles.center} />
        <View style={styles.rightSide}><Right /></View>
      </View>

      {/* Profile modal */}
      <ProfileModal
        visible={showProfile}
        onClose={() => {
          setShowProfile(false);
          triggerQuotaRefresh();
        }}
        navigation={nav}
      />

      {/* Sidebar menu */}
      <SidebarMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );
}

const BASE_HEIGHT = Platform.select({ ios: 52, android: 56, default: 56 });
const HEADER_HEIGHT = Math.round((BASE_HEIGHT || 56) * 1.3);

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#111' },
  inner: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  innerCompact: { paddingHorizontal: 8 },

  leftSide: { width: 64, alignItems: 'flex-start' },
  leftSideCompact: { width: 56 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rightSide: { alignItems: 'flex-end', flexShrink: 0 },

  btn: { paddingVertical: 8, paddingHorizontal: 10 },
  btnCompact: { paddingVertical: 6, paddingHorizontal: 6 },

  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rightRowCompact: { gap: 6 },

  pill: {
    backgroundColor: '#1f1b3a',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#333',
    maxWidth: 140,
  },
  pillCompact: { paddingVertical: 4, paddingHorizontal: 8 },

  userPill: { maxWidth: 120 },
  planPill: { backgroundColor: 'rgba(155,135,245,0.15)' },

  pillTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  counterTxt: { color: GREEN }, // ⇐ brojčanik ZELENO

  // mini prekidači
  pillMini: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pillMiniCompact: { paddingVertical: 3, paddingHorizontal: 8 },

  pillMiniTxt: { color: '#ddd', fontWeight: '700', fontSize: 12 },
});
