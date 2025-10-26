// File: src/components/ProfileModal.jsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native'; // fallback ako prop navigation ne stigne
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../providers/AuthProvider'; // ⬅️ DODATO

// Deep-link redirect (slaže se sa app.json intent filterom)
const OAUTH_REDIRECT = Linking.createURL('auth/callback');

// Fallback plan meta (CAP/allowance/model)
const PLANS = {
  free:    { allowance: 10,  cap: 10,  model: 'small',  name: 'Free',    color: '#facc15' },
  premium: { allowance: 30,  cap: 90,  model: 'large',  name: 'Premium', color: '#a8ff76' },
  pro:     { allowance: 50,  cap: 150, model: 'large',  name: 'Pro',     color: '#ae7ffb' },
  proplus: { allowance: null, cap: null, model: 'large', name: 'ProPlus', color: '#7dd3fc' },
};

function addMonths(date, months = 1) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

export default function ProfileModal({ visible, onClose, navigation }) {
  const { t, i18n } = useTranslation(['common']);
  const navFallback = useNavigation();
  const nav = navigation || navFallback;

  const { signOut } = useAuth(); // ⬅️ DODATO

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [uid, setUid] = React.useState(null);
  const [displayName, setDisplayName] = React.useState('');
  const [plan, setPlan] = React.useState('free');
  const [planStartedAt, setPlanStartedAt] = React.useState(null);
  const [balance, setBalance] = React.useState(0);
  const [lastTopupAt, setLastTopupAt] = React.useState(null);

  // ProPlus & total state
  const [proplusRemaining, setProplusRemaining] = React.useState(0);
  const [proplusExpiresAt, setProplusExpiresAt] = React.useState(null);
  const [availableTotal, setAvailableTotal] = React.useState(0);

  // Cancelation state
  const [planCancelAt, setPlanCancelAt] = React.useState(null);
  const [planCancelTo, setPlanCancelTo] = React.useState(null);
  const [cancelBusy, setCancelBusy] = React.useState(false);

  // Auth status
  const [isAuthed, setIsAuthed] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState('');

  // 🔗 Provider link status
  const [hasApple, setHasApple] = React.useState(false);
  const [linkBusy, setLinkBusy] = React.useState(false);

  const proplusActive = !!proplusExpiresAt && new Date(proplusExpiresAt) > new Date();
  const showMonthly = plan !== 'proplus';
  const isCancelable = (plan === 'premium' || plan === 'pro') && !proplusActive;
  const hasScheduledCancel = !!planCancelAt;

  const planMeta = PLANS[plan] || PLANS.free;

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString(
        i18n.language?.startsWith('sr') ? 'sr-RS' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' },
      );
    } catch {
      return String(d);
    }
  };

  const nextTopupAt = React.useMemo(() => {
    const base = lastTopupAt || planStartedAt;
    return base ? addMonths(base, 1) : null;
  }, [lastTopupAt, planStartedAt]);

  // Lazy fetch (quota_get radi i top-up ako je prošla godišnjica)
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user || null;
      const id = user?.id || null;
      setUid(id);
      setIsAuthed(!!id);
      setUserEmail(user?.email || user?.user_metadata?.email || '');

      // 🔎 ažuriraj status povezivanja Apple identiteta
      const linkedApple = !!user?.identities?.some(i => i.provider === 'apple');
      setHasApple(linkedApple);

      if (!id) { setLoading(false); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, plan, plan_started_at, plan_cancel_at, plan_cancel_to')
        .eq('id', id)
        .single();

      setDisplayName(prof?.display_name || '');
      setPlan(prof?.plan || 'free');
      setPlanStartedAt(prof?.plan_started_at || null);
      setPlanCancelAt(prof?.plan_cancel_at || null);
      setPlanCancelTo(prof?.plan_cancel_to || null);

      try {
        const { data: qd } = await supabase.functions.invoke('quota_get', { body: {} });
        const row = Array.isArray(qd) ? qd[0] : qd;
        if (row?.plan) setPlan(String(row.plan));
        if (row?.balance != null) setBalance(Number(row.balance) || 0);
        setProplusRemaining(Number(row?.proplus_remaining || 0));
        setProplusExpiresAt(row?.proplus_expires_at || null);
        setAvailableTotal(Number(row?.available_total ?? row?.balance ?? 0));
      } catch {}

      const { data: bal } = await supabase
        .from('balances')
        .select('balance, last_topup_at')
        .eq('user_id', id)
        .single();
      if (bal?.balance != null) setBalance(Number(bal.balance) || 0);
      setLastTopupAt(bal?.last_topup_at || null);
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  }, [t, i18n.language]);

  React.useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const onSaveName = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName?.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', uid);
      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: t('common:messages.successTitle', { defaultValue: 'Uspeh!' }),
        text2: t('common:messages.saved', { defaultValue: 'Sačuvano.' }),
        position: 'bottom',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: err?.message || t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    } finally {
      setSaving(false);
    }
  };

  // Alert helper
  const confirmAsync = (title, message, okLabel) =>
    new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: t('common:misc.cancel', { defaultValue: 'Otkaži' }), style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel || t('common:ok', { defaultValue: 'OK' }), style: 'destructive', onPress: () => resolve(true) },
      ]);
    });

  // ✅ Odjava (bez ručne navigacije; Gate u App.js menja stack na osnovu session-a)
  const handleSignOut = async () => {
    const ok = await confirmAsync(
      t('common:logoutConfirm.title', { defaultValue: 'Log out?' }),
      t('common:logoutConfirm.body',  { defaultValue: 'You will be logged out on this device.' }),
      t('common:logoutConfirm.cta',   { defaultValue: 'Log me out' }),
    );
    if (!ok) return;
    try {
      await signOut();     // ⬅️ ovo čisti SB tokene + setSession(null)
      onClose?.();         // zatvori modal; Gate će prikazati Login
      // ⛔️ bez nav.reset/navigate — Gate odlučuje između Auth/App
    } catch (e) {
      Alert.alert(
        t('common:errors.genericTitle', { defaultValue: 'Error' }),
        e?.message || t('common:errors.tryAgain', { defaultValue: 'Please try again.' })
      );
    }
  };

  // Zakazivanje otkazivanja na kraj ciklusa
  const handleScheduleCancel = async () => {
    const ok = await confirmAsync(
      t('common:membership.cancel.confirmTitle', { defaultValue: 'Da li sigurno želiš da otkažeš?' }),
      t('common:membership.cancel.confirmBody',  { defaultValue: 'Prelazak na FREE biće na kraju tekućeg ciklusa.' }),
      t('common:membership.cancel.confirmCta',   { defaultValue: 'Otkaži' }),
    );
    if (!ok) return;

    try {
      setCancelBusy(true);
      const { error } = await supabase.functions.invoke('subscription_cancel', { body: {} });
      if (error) throw error;
      Toast.show({
        type: 'success',
        text1: t('common:messages.successTitle', { defaultValue: 'Uspeh!' }),
        text2: t('common:membership.cancel.scheduled', { defaultValue: 'Otkazivanje zakazano za kraj ciklusa.' }),
        position: 'bottom',
      });
      await load();
    } catch (e) {
      const msg = String(e?.message || '');
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: msg || t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    } finally {
      setCancelBusy(false);
    }
  };

  // Poništavanje zakazanog otkazivanja
  const handleUndoCancel = async () => {
    const ok = await confirmAsync(
      t('common:membership.cancel.undoTitle', { defaultValue: 'Ukloniti otkazivanje?' }),
      t('common:membership.cancel.undoBody',  { defaultValue: 'Zadržaćeš trenutni plan i posle obnove.' }),
      t('common:membership.cancel.undoCta',   { defaultValue: 'Poništi' }),
    );
    if (!ok) return;

    try {
      setCancelBusy(true);
      const { error } = await supabase.functions.invoke('subscription_uncancel', { body: {} });
      if (error) throw error;
      Toast.show({
        type: 'success',
        text1: t('common:messages.successTitle', { defaultValue: 'Uspeh!' }),
        text2: t('common:membership.cancel.reverted', { defaultValue: 'Otkazivanje uklonjeno.' }),
        position: 'bottom',
      });
      await load();
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    } finally {
      setCancelBusy(false);
    }
  };

  // 🔗 Link Apple nalog (ispod "Odjavi se")
  const linkApple = async () => {
    if (!isAuthed) return;
    setLinkBusy(true);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'apple',
        options: {
          redirectTo: OAUTH_REDIRECT,
          scopes: 'name email',
          flowType: 'pkce',
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT);
      }

      // Osveži user i proveri da li je Apple dodat
      const { data: fresh } = await supabase.auth.getUser();
      const linked = !!fresh?.user?.identities?.some(i => i.provider === 'apple');
      setHasApple(linked);

      Toast.show({
        type: linked ? 'success' : 'info',
        text1: linked
          ? t('common:profile.appleLinkedOk', { defaultValue: 'Apple nalog je povezan.' })
          : t('common:profile.appleLinkedMissing', { defaultValue: 'Ne vidim povezan Apple nalog. Pokušaj ponovo.' }),
        position: 'bottom',
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: e?.message || t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('common:profile.title', { defaultValue: 'Profil' })}</Text>
            <TouchableOpacity onPress={onClose} style={styles.xbtn}>
              <MaterialCommunityIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" />
              <Text style={{ color: '#ccc', marginTop: 10 }}>
                {t('common:misc.loading', { defaultValue: 'Učitavanje…' })}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: '100%' }}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Auth status + Sign in/out */}
              <View style={styles.block}>
                <Text style={styles.label}>
                  {isAuthed
                    ? (t('common:profile.signedInAs', { defaultValue: 'Prijavljen kao' }) + ': ' + (userEmail || '—'))
                    : t('common:profile.signedOut', { defaultValue: 'Nisi prijavljen' })}
                </Text>

                {isAuthed ? (
                  <>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnDanger, { alignSelf: 'flex-start' }]}
                      onPress={handleSignOut}
                    >
                      <Text style={[styles.btnTxt, { color: '#fff' }]}>
                        {t('common:logout', { defaultValue: 'Odjavi se' })}
                      </Text>
                    </TouchableOpacity>

                    {/* Apple link status */}
                    {hasApple ? (
                      <View style={{ paddingTop: 8 }}>
                        <Text style={{ color: '#9ca3af' }}>
                          {t('common:profile.appleLinked', { defaultValue: 'Apple nalog je povezan ✔' })}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={linkApple}
                        disabled={linkBusy}
                        style={{
                          backgroundColor: '#000',
                          borderRadius: 10,
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: '#111',
                          alignSelf: 'flex-start',
                          opacity: linkBusy ? 0.7 : 1,
                        }}
                      >
                        {linkBusy ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {t('common:profile.linkApple', { defaultValue: 'Poveži Apple nalog' })}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.btn, { alignSelf: 'flex-start' }]}
                    onPress={() => {
                      onClose?.();
                      setTimeout(() => {
                        try { nav?.navigate?.('Login'); } catch {}
                      }, 120);
                    }}
                  >
                    <Text style={styles.btnTxt}>{t('common:login', { defaultValue: 'Prijavi se' })}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Display name */}
              <View style={styles.block}>
                <Text style={styles.label}>{t('common:profile.displayName', { defaultValue: 'Ime (prikazno)' })}</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('common:profile.displayNamePH', { defaultValue: 'npr. Mira' })}
                  placeholderTextColor="#777"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={[styles.btn, { alignSelf: 'flex-start' }]}
                  onPress={onSaveName}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#222" />
                  ) : (
                    <Text style={styles.btnTxt}>{t('common:save', { defaultValue: 'Sačuvaj' })}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Plan info */}
              <View style={styles.block}>
                <Text style={styles.label}>{t('common:profile.plan', { defaultValue: 'Plan' })}</Text>
                <View style={[styles.pill, { borderColor: planMeta.color }]}>
                  <Text style={[styles.pillTxt, { color: planMeta.color }]}>
                    {(PLANS[plan]?.name || plan).toUpperCase()}
                  </Text>
                </View>

                {/* Saldo / ukupno */}
                <View style={styles.row}>
                  <Text style={styles.kvLabel}>{t('common:profile.available', { defaultValue: 'Dostupno (ukupno)' })}</Text>
                  <Text style={styles.kvVal}>🪙 {availableTotal}</Text>
                </View>

                {proplusActive ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.proplus', { defaultValue: 'ProPlus saldo' })}</Text>
                      <Text style={styles.kvVal}>🪙 {proplusRemaining}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.proplusExpiry', { defaultValue: 'ProPlus ističe' })}</Text>
                      <Text style={styles.kvVal}>{fmtDate(proplusExpiresAt)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.wallet', { defaultValue: 'Wallet' })}</Text>
                      <Text style={styles.kvVal}>🪙 {balance}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.row}>
                    <Text style={styles.kvLabel}>{t('common:profile.wallet', { defaultValue: 'Wallet' })}</Text>
                    <Text style={styles.kvVal}>🪙 {balance}</Text>
                  </View>
                )}

                {/* Mesečne stvari (nije ProPlus) */}
                {showMonthly && (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.allowance', { defaultValue: 'Mesečno' })}</Text>
                      <Text style={styles.kvVal}>+{(PLANS[plan]?.allowance ?? 0)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.cap', { defaultValue: 'CAP' })}</Text>
                      <Text style={styles.kvVal}>{(PLANS[plan]?.cap ?? 0)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.started', { defaultValue: 'Ciklus od' })}</Text>
                      <Text style={styles.kvVal}>{fmtDate(planStartedAt)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.kvLabel}>{t('common:profile.nextTopup', { defaultValue: 'Sledeći top-up' })}</Text>
                      <Text style={styles.kvVal}>{nextTopupAt ? fmtDate(nextTopupAt) : '—'}</Text>
                    </View>

                    {/* Cancel/Undo */}
                    {isCancelable && (
                      <>
                        {hasScheduledCancel ? (
                          <>
                            <View style={styles.row}>
                              <Text style={styles.kvLabel}>
                                {t('common:membership.cancel.scheduledAt', { defaultValue: 'Zakazan prelazak na FREE' })}
                              </Text>
                              <Text style={styles.kvVal}>{fmtDate(planCancelAt)}</Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnUndo]}
                              onPress={handleUndoCancel}
                              disabled={cancelBusy}
                            >
                              {cancelBusy ? (
                                <ActivityIndicator color="#222" />
                              ) : (
                                <Text style={[styles.btnTxt, { color: '#111' }]}>
                                  {t('common:membership.cancel.undo', { defaultValue: 'Poništi otkazivanje' })}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={[styles.btn, styles.btnDanger]}
                            onPress={handleScheduleCancel}
                            disabled={cancelBusy}
                          >
                            {cancelBusy ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={[styles.btnTxt, { color: '#fff' }]}>
                                {t('common:membership.cancel.schedule', { defaultValue: 'Otkaži na kraju ciklusa' })}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={[styles.btn, styles.manageBtn, { backgroundColor: planMeta.color }]}
                  onPress={() => {
                    onClose?.();
                    setTimeout(() => {
                      try { nav?.navigate?.('Plans'); } catch {}
                    }, 120);
                  }}
                >
                  <Text style={[styles.btnTxt, { color: '#111' }]}>
                    {t('common:profile.managePlan', { defaultValue: 'Upravljaj planom' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  modal: {
    backgroundColor: '#18181b',
    borderRadius: 18,
    borderWidth: 1, borderColor: '#2a2a2e',
    width: '92%', maxWidth: 420,
    maxHeight: '90%',
    padding: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  xbtn: { position: 'absolute', right: 6, top: 2, padding: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },

  block: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a2a2e' },
  label: { color: '#aaa', marginBottom: 6 },

  input: {
    height: 44, borderWidth: 1, borderColor: '#333', backgroundColor: '#0a0a0a',
    color: '#fff', paddingHorizontal: 12, borderRadius: 10, marginBottom: 10,
  },
  btn: {
    backgroundColor: '#ffd700',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnTxt: { color: '#222', fontWeight: '700' },

  btnDanger: {
    backgroundColor: '#ef4444',
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 8,
  },
  btnUndo: {
    backgroundColor: '#e5e7eb',
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 8,
  },
  manageBtn: { marginTop: 16 },

  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  pillTxt: { fontWeight: '800' },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  kvLabel: { color: '#ddd' },
  kvVal: { color: '#ffd700', fontWeight: '700' },
});
