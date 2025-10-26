// src/screens/PlansScreen.jsx — DreamCodex AI
// Plans (Free / Premium / Pro) + ProPlus godišnji i dopuna +20 — screen verzija, bez modala

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabaseClient';
import { triggerQuotaRefresh } from '../utils/quotaBus';

// === Fallback planovi ===
const PLANS = {
  free:   { key: 'free',    name: 'Free',    color: '#facc15', allowance: 10, cap: 10,  model: 'small', features: { journal:false, lucid:false, media:false, ads:true,  bank:false } },
  premium:{ key: 'premium', name: 'Premium', color: '#a8ff76', allowance: 30, cap: 90,  model: 'large', features: { journal:true,  lucid:false, media:false, ads:false, bank:true  } },
  pro:    { key: 'pro',     name: 'Pro',     color: '#ae7ffb', allowance: 50, cap: 150, model: 'large', features: { journal:true,  lucid:true,  media:true,  ads:false, bank:true  } },
};

// Edge funkcije
const EDGE = {
  CONFIG: 'membership_config',
  QUOTA_GET: 'quota_get',
  APPLY_PLAN_CHANGE: 'apply_plan_change',
  PURCHASE_PROPLUS: 'purchase_proplus_annual',
  PURCHASE_PACK20: 'purchase_pack_20',
  CANCEL: 'subscription_cancel', // ⬅️ dodato
};

// FIKSNE DIMENZIJE — iste na svim telefonima (karusel se skroluje; nema deformacije teksta)
const CARD_WIDTH = 260;           // širina za Free, Premium, Pro
const CARD_HEIGHT = 388;          // visina glavnih (dovoljno za CTA)
const PROPLUS_CARD_WIDTH = CARD_WIDTH; // ProPlus iste širine kao ostali
const PROPLUS_CARD_HEIGHT = 190;       // niži da dopuna lepo stane ispod

// helperi za čitanje cene
const extractPriceValue = (node) => {
  if (!node || typeof node !== 'object') return null;
  for (const k of ['price', 'amount', 'price_eur', 'eur', 'value']) {
    const v = node[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};
const currencyOf = (node, fallback, pricing) =>
  (node?.currency || fallback || pricing?.currency || 'EUR');

const priceObj = (amount, currency, period) =>
  amount != null ? { amount, currency, period } : null;

export default function PlansScreen() {
  const { t } = useTranslation(['common']);
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const [pricing, setPricing] = React.useState(null);
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const [userPlan, setUserPlan] = React.useState('free');
  const [balance, setBalance] = React.useState(0);
  const [loadingPlanKey, setLoadingPlanKey] = React.useState(null);

  const [proplusRemaining, setProplusRemaining] = React.useState(0);
  const [proplusExpiresAt, setProplusExpiresAt] = React.useState(null);
  const [availableTotal, setAvailableTotal] = React.useState(0);
  const proplusActive = !!proplusExpiresAt && new Date(proplusExpiresAt) > new Date();

  // === učitavanje config + quota (POST → GET fallback za membership_config) ===
  const fetchConfigAndQuota = React.useCallback(async () => {
    try {
      // 1) pokušaj POST invoke
      let configData = null;
      try {
        const { data, error } = await supabase.functions.invoke(EDGE.CONFIG);
        if (!error && data) configData = data;
      } catch {}
      // 2) fallback GET direktno
      if (!configData) {
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess?.session?.access_token || '';
          const base = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
          const resp = await fetch(`${base}/${EDGE.CONFIG}`, {
            method: 'GET',
            headers: { Authorization: token ? `Bearer ${token}` : '' },
          });
          if (resp.ok) {
            configData = await resp.json();
          }
        } catch {}
      }
      if (configData) setPricing(configData);

      // Quota
      const { data: qd, error: qe } = await supabase.functions.invoke(EDGE.QUOTA_GET, { body: {} });
      if (qe) throw qe;
      const row = Array.isArray(qd) ? qd[0] : qd;
      setUserPlan(String(row?.plan || 'free'));
      setBalance(Number(row?.balance || 0));
      setProplusRemaining(Number(row?.proplus_remaining || 0));
      setProplusExpiresAt(row?.proplus_expires_at || null);
      setAvailableTotal(Number(row?.available_total ?? row?.balance ?? 0));
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    } finally {
      setLoadingInitial(false);
    }
  }, [t]);

  useFocusEffect(
    React.useCallback(() => {
      setLoadingInitial(true);
      fetchConfigAndQuota();
    }, [fetchConfigAndQuota])
  );

  // === Derivat plan kartica sa server overrides ===
  const cards = React.useMemo(() => {
    const applyOverrides = (base) => {
      const server = pricing?.plans?.[base.key] || {};
      return {
        ...base,
        allowance: server.allowance ?? base.allowance,
        cap: server.cap ?? base.cap,
        model: server.model ?? base.model,
        price: server.price_monthly
          ? { amount: server.price_monthly, currency: pricing?.currency || 'EUR', period: 'monthly' }
          : base.price ?? null,
        features: server.features ? { ...base.features, ...server.features } : base.features,
      };
    };
    return [applyOverrides(PLANS.free), applyOverrides(PLANS.premium), applyOverrides(PLANS.pro)];
  }, [pricing]);

  // === pack20 kao "price object" — identično kao planovi ===
  const pack20 = React.useMemo(() => {
    const node =
      pricing?.addons?.pack20 ??
      pricing?.addons?.pack_20 ??
      pricing?.addons?.['+20'] ??
      null;

    const amount =
      node?.price ??
      node?.amount ??
      node?.price_eur ??
      pricing?.prices?.pack20 ??
      null;

    const currency = node?.currency || pricing?.currency || 'EUR';

    return {
      key: 'pack20',
      name: '+20',
      price: priceObj(amount, currency, 'one_time'),
    };
  }, [pricing]);

  // === actions ===
  const applyPlan = React.useCallback(
    async (newPlan) => {
      setLoadingPlanKey(newPlan);
      try {
        const { error } = await supabase.functions.invoke(EDGE.APPLY_PLAN_CHANGE, { body: { new_plan: newPlan } });
        if (error) throw error;
        await fetchConfigAndQuota();
        triggerQuotaRefresh();
        Toast.show({
          type: 'success',
          text1: t('common:messages.successTitle', { defaultValue: 'Uspeh!' }),
          text2: t('common:membership.toast.planChanged', { defaultValue: 'Plan je uspešno promenjen.' }),
          position: 'bottom',
        });
      } catch (err) {
        const msg = String(err?.message || '');
        if (msg.includes('PROPLUS_ACTIVE')) {
          Toast.show({
            type: 'info',
            text1: t('common:membership.proplus.lockTitle', { defaultValue: 'ProPlus je aktivan' }),
            text2: t('common:membership.proplus.lockBody',  { defaultValue: 'Promena plana je onemogućena dok traje ProPlus.' }),
            position: 'bottom',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
            text2: t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
            position: 'bottom',
          });
        }
      } finally {
        setLoadingPlanKey(null);
      }
    },
    [fetchConfigAndQuota, t]
  );

  const purchaseProPlus = React.useCallback(async () => {
    try {
      setLoadingPlanKey('proplus');
      const payment_id = `proplus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.functions.invoke(EDGE.PURCHASE_PROPLUS, { body: { payment_id } });
      if (error) throw error;
      await fetchConfigAndQuota();
      triggerQuotaRefresh();
      Toast.show({
        type: 'success',
        text1: t('common:membership.proplus.successTitle', { defaultValue: 'ProPlus aktiviran!' }),
        text2: t('common:membership.proplus.successBody', { defaultValue: '600 je dodato i plan je zaključan do isteka.' }),
        position: 'bottom',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: String(err?.message || t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' })),
        position: 'bottom',
      });
    } finally {
      setLoadingPlanKey(null);
    }
  }, [fetchConfigAndQuota, t]);

  const confirmAsync = (title, message, okLabel) =>
    new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: t('common:misc.cancel', { defaultValue: 'Otkaži' }), style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, onPress: () => resolve(true) },
      ]);
    });

  const purchasePack20 = React.useCallback(async () => {
    try {
      if (userPlan === 'free' && !proplusActive) {
        Toast.show({
          type: 'info',
          text1: t('common:membership.addons.blockedFreeTitle', { defaultValue: 'Nije dostupno na Free planu' }),
          text2: t('common:membership.addons.blockedFreeBody',  { defaultValue: 'Dopune nisu dostupne na Free planu.' }),
          position: 'bottom',
        });
        return;
      }
      if (!proplusActive && (userPlan === 'premium' || userPlan === 'pro')) {
        const currentCard = cards.find((c) => c.key === userPlan);
        const headroom = Math.max(0, Number(currentCard?.cap || 0) - Number(balance || 0));
        if (headroom <= 0) {
          Toast.show({
            type: 'info',
            text1: t('common:membership.addons.limitReachedTitle', { defaultValue: 'Limit dostignut' }),
            text2: t('common:membership.addons.limitReachedBody',  { defaultValue: 'Ne možeš dodati više kredita na ovom planu.' }),
            position: 'bottom',
          });
          return;
        }
        if (headroom < 20) {
          const ok = await confirmAsync(
            t('common:membership.addons.partialTitle', { defaultValue: 'Delimična dopuna' }),
            t('common:membership.addons.partialBody',  { count: headroom, defaultValue: `Zbog limita paketa može da se doda samo ${headroom} od 20.` }),
            t('common:membership.addons.partialCta',   { count: headroom, defaultValue: `Dodaj ${headroom}` }),
          );
          if (!ok) return;
        }
      }
      const payment_id = `pack20-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { data, error } = await supabase.functions.invoke(EDGE.PURCHASE_PACK20, { body: { payment_id } });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;

      await fetchConfigAndQuota();
      triggerQuotaRefresh();

      if (proplusActive || row?.mode === 'proplus') {
        Toast.show({
          type: 'success',
          text1: t('common:membership.addons.okProPlus', { defaultValue: 'Dodato u ProPlus saldo!' }),
          text2: t('common:membership.addons.added',     { added: row?.added ?? 20, defaultValue: `Dodato: ${row?.added ?? 20}` }),
          position: 'bottom',
        });
      } else {
        const added = Number(row?.added || 0);
        Toast.show({
          type: added > 0 ? 'success' : 'info',
          text1: added > 0 ? t('common:membership.addons.okWallet', { defaultValue: 'Dopuna uspešna' })
                           : t('common:membership.addons.nothing',  { defaultValue: 'Nije dodato (limit dostignut)' }),
          text2: t('common:membership.addons.added', { added, defaultValue: `Dodato: ${added}` }),
          position: 'bottom',
        });
      }
    } catch (err) {
      const msg = String(err?.message || '');
      Toast.show({
        type: 'error',
        text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
        text2: msg.includes('FREE_ADDONS_DISABLED')
          ? t('common:membership.addons.blockedFreeBody', { defaultValue: 'Dopune nisu dostupne na Free planu.' })
          : t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
        position: 'bottom',
      });
    }
  }, [userPlan, proplusActive, cards, balance, fetchConfigAndQuota, t]);

  // === jedinstvena kartica plana ===
  const PlanCard = ({ plan }) => {
    const isCurrent = String(userPlan) === plan.key;
    const disabled = loadingPlanKey === plan.key || isCurrent || proplusActive;

    let ctaLabel = '';
    if (isCurrent) {
      ctaLabel = t('common:membership.cta.currentPlan', { defaultValue: 'Trenutni plan' });
    } else if (plan.key === 'premium') {
      ctaLabel = t('common:membership.cta.buyPremium', {
        price: plan.price?.amount, currency: plan.price?.currency,
        defaultValue: plan.price ? 'Kupi Premium ({{price}} {{currency}}/mesec)' : 'Kupi Premium',
      });
    } else if (plan.key === 'pro') {
      ctaLabel = t('common:membership.cta.buyPro', {
        price: plan.price?.amount, currency: plan.price?.currency,
        defaultValue: plan.price ? 'Kupi PRO ({{price}} {{currency}}/mesec)' : 'Kupi PRO',
      });
    } else {
      // ⬅️ IZMENJENO: kada korisnik NIJE na free, Free kartica prikazuje "Otkaži na kraju ciklusa"
      ctaLabel = t('common:membership.cancel.schedule', { defaultValue: 'Otkaži na kraju ciklusa' });
    }

    const modelValue = t('common:membership.values.aiModel', {
      model: plan.model === 'large' ? 'Large' : 'Small',
      defaultValue: `AI model: ${plan.model === 'large' ? 'Large' : 'Small'}`,
    });

    return (
      <View style={{ alignItems: 'center' }}>
        <View
          style={[
            styles.card,
            { borderColor: plan.color, width: CARD_WIDTH, height: CARD_HEIGHT, minHeight: CARD_HEIGHT },
            plan.key === 'pro' && styles.cardBest,
          ]}
        >
          <Text style={[styles.cardTitle, { color: plan.color }]}>{t(`common:membership.packages.${plan.key}`, { defaultValue: plan.name })}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 20, marginRight: 5 }}>🪙</Text>
            <Text style={{ color: '#ffd700', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 }}>{plan.allowance}</Text>
            <Text style={{ color: '#aaa', marginLeft: 6 }}>/ {t('common:membership.labels.perMonth', { defaultValue: 'mesečno' })}</Text>
          </View>

          <FeatureValue text={modelValue} color={plan.color} />
          <FeatureValue
            text={plan.features.bank
              ? t('common:membership.values.capWithBank', { cap: plan.cap, defaultValue: `CAP banka: ${plan.cap}` })
              : t('common:membership.values.capNoBank',   { defaultValue: 'Banka: nema' })}
            color={plan.color}
          />

          <FeatureRow label={t('common:membership.features.journal', { defaultValue: 'Dnevnik snova' })} include={!!plan.features.journal} />
          <FeatureRow label={t('common:membership.features.lucid',   { defaultValue: 'Trening lucidnog' })} include={!!plan.features.lucid} />
          <FeatureRow label={t('common:membership.features.media',   { defaultValue: 'Multimedija' })} include={!!plan.features.media} />
          <FeatureRow label={t('common:membership.features.ads',     { defaultValue: 'Reklame' })} include={!!plan.features.ads} inverseColor />

          <TouchableOpacity
            disabled={disabled}
            onPress={async () => {
              if (proplusActive) {
                Toast.show({ type: 'info',
                  text1: t('common:membership.proplus.lockTitle', { defaultValue: 'ProPlus je aktivan' }),
                  text2: t('common:membership.proplus.lockBody',  { defaultValue: 'Promena plana je onemogućena dok traje ProPlus.' }),
                  position: 'bottom',
                });
                return;
              }
              // ⬅️ IZMENJENO: Free sada zakazuje otkazivanje (osim ako je korisnik već na free)
              if (plan.key === 'free') {
                 const ok = await confirmAsync(
                   t('common:membership.cancel.confirmTitle', { defaultValue: 'Da li sigurno želiš da otkažeš?' }),
                   t('common:membership.cancel.confirmBody',  { defaultValue: 'Prelazak na FREE biće na kraju tekućeg ciklusa.' }),
                   t('common:membership.cancel.confirmCta',   { defaultValue: 'Otkaži' }),
               );
                if (!ok) return;
                if (userPlan === 'free') return; // ništa
                if (proplusActive) {
                  Toast.show({ type: 'info',
                    text1: t('common:membership.proplus.lockTitle', { defaultValue: 'ProPlus je aktivan' }),
                    text2: t('common:membership.proplus.lockBody',  { defaultValue: 'Promena plana je onemogućena dok traje ProPlus.' }),
                    position: 'bottom',
                  });
                  return;
                }
                try {
                  setLoadingPlanKey('free');
                  const { data, error } = await supabase.functions.invoke(EDGE.CANCEL, { body: {} });
                  if (error) throw error;
                  await fetchConfigAndQuota();
                  triggerQuotaRefresh?.();
                  Toast.show({
                    type: 'success',
                    text1: t('common:messages.successTitle', { defaultValue: 'Uspeh!' }),
                    text2: t('common:membership.cancel.scheduled', { defaultValue: 'Otkazivanje zakazano za kraj ciklusa.' }),
                    position: 'bottom',
                  });
                } catch (e) {
                  Toast.show({
                    type: 'error',
                    text1: t('common:errors.genericTitle', { defaultValue: 'Greška' }),
                    text2: t('common:errors.tryAgain', { defaultValue: 'Pokušajte ponovo.' }),
                    position: 'bottom',
                  });
                } finally {
                  setLoadingPlanKey(null);
                }
                return;
              }
              return applyPlan(plan.key);
            }}
            style={[styles.ctaBtn, { backgroundColor: plan.color, opacity: disabled ? 0.5 : 1 }]}
          >
            {loadingPlanKey === plan.key
              ? <ActivityIndicator color="#222" size="small" />
              : <Text style={[styles.ctaText, { color: plan.key === 'pro' ? '#291a42' : plan.key === 'premium' ? '#1a2b0a' : '#222' }]}>{ctaLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header red: naslov + X (X je u nivou naslova, ne preklapa brojčanik) */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.screenTitle}>{t('common:membership.title', { defaultValue: 'Planovi i pretplate' })}</Text>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeInHeader}
        >
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="account-badge" size={20} color="#ffd700" />
          <Text style={styles.statusText}>
            {t('common:membership.labels.currentPlan', { defaultValue: 'Plan:' })} {String(userPlan).toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🪙</Text>
          <Text style={[styles.statusText, { color: '#ffd700' }]}>{availableTotal}</Text>
        </View>
      </View>

      {/* Vertikalni scroll ispod statusa */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 20 : 12) }}
        keyboardShouldPersistTaps="handled"
      >
        {proplusActive ? (
          <Text style={[styles.note, { marginBottom: 8 }]}>
            {t('common:membership.proplus.activeLine', {
              remaining: proplusRemaining,
              date: new Date(proplusExpiresAt).toLocaleDateString(),
              balance,
              defaultValue: `ProPlus: ${proplusRemaining} (ističe ${new Date(proplusExpiresAt).toLocaleDateString()}) · Wallet: ${balance}`,
            })}
          </Text>
        ) : (
          <Text style={[styles.note, { marginBottom: 8 }]}>
            {t('common:membership.wallet.line', { balance, defaultValue: `Wallet: ${balance}` })}
          </Text>
        )}

        {loadingInitial ? (
          <View style={{ paddingTop: 32, alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text style={{ color: '#ccc', marginTop: 10 }}>{t('common:misc.loading', { defaultValue: 'Učitavanje…' })}</Text>
          </View>
        ) : (
          <>
            {/* HORIZONTALNI karusel kartica */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 18, paddingVertical: 8, paddingHorizontal: 8 }}
              style={{ marginBottom: 12 }}
            >
              {cards.map((plan) => (
                <PlanCard key={plan.key} plan={plan} />
              ))}

              {/* PROPLUS — mini kartica (iste širine, niža) */}
              <View style={{ alignItems: 'center' }}>
                <View
                  style={[
                    styles.card,
                    styles.cardProPlusMini,
                    {
                      borderWidth: 2,
                      width: PROPLUS_CARD_WIDTH,
                      height: PROPLUS_CARD_HEIGHT,
                      minHeight: PROPLUS_CARD_HEIGHT,
                    },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: '#ef4444', marginBottom: 6 }]}>
                    {t('common:membership.proplus.title', { defaultValue: 'ProPlus (godišnje)' })}
                  </Text>

                  <Text style={{ color: '#fff', textAlign: 'center' }}>
                    {t('common:membership.proplus.desc', { defaultValue: '600 tumačenja + bez CAP-a · 12 meseci' })}
                  </Text>

                  <TouchableOpacity
                    disabled={loadingPlanKey === 'proplus' || proplusActive}
                    onPress={purchaseProPlus}
                    style={[
                      styles.ctaBtn,
                      {
                        backgroundColor: '#ef4444',
                        opacity: loadingPlanKey === 'proplus' || proplusActive ? 0.5 : 1,
                        marginTop: 10,
                        minWidth: 170,
                      },
                    ]}
                  >
                    {loadingPlanKey === 'proplus'
                      ? <ActivityIndicator color="#0b132b" size="small" />
                      : <Text style={[styles.ctaText, { color: '#0b132b', fontSize: 15 }]}>
                          {proplusActive
                            ? t('common:membership.proplus.activeCta', { defaultValue: 'Aktivan' })
                            : (() => {
                                // proplus cena — identično kao ostali (price.amount/currency)
                                const node = pricing?.plans?.proplus ?? null;
                                const annualAmount = node?.price_annual ?? extractPriceValue(node?.annual) ?? extractPriceValue(node);
                                const annualCurr = currencyOf(node, null, pricing);
                                return annualAmount
                                  ? `Kupi (${annualAmount} ${annualCurr}/g)`
                                  : t('common:membership.proplus.buyCta', { defaultValue: 'Kupi ProPlus' });
                              })()}
                        </Text>}
                  </TouchableOpacity>

                  <View style={styles.bestRow}>
                    <MaterialCommunityIcons name="star-four-points" size={14} color="#ffd700" />
                    <Text style={styles.bestOffer}>Best offer</Text>
                    <MaterialCommunityIcons name="star-four-points" size={14} color="#ffd700" />
                  </View>
                </View>

                {/* DOPUNA +20 — VAN okvira ProPlus (zasebno dugme), odlepljeno (marginTop: 16) */}
                <TouchableOpacity
                  onPress={purchasePack20}
                  style={[styles.ctaBtn, { backgroundColor: '#ffd700', alignSelf: 'center', marginTop: 56, minWidth: 200, paddingVertical: 46 }]}
                  disabled={userPlan === 'free' && !proplusActive}
                >
                  <Text style={[styles.ctaText, { color: '#1f2937' }]}>
                    {t('common:membership.addons.buyPack20', {
                      price: pack20?.price?.amount,
                      currency: pack20?.price?.currency,
                      defaultValue: pack20?.price ? 'Kupi dopunu +20 ({{price}} {{currency}})' : 'Kupi dopunu +20',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Napomene */}
            <View style={{ paddingHorizontal: 14, marginTop: 2 }}>
              <Text style={styles.note}>
                {t('common:membership.notes.cancelPolicy', {
                  defaultValue: 'Otkazivanje prelazi na Free na datum obnove pretplate. CAP ograničava maksimum i nema propadanja salda.',
                })}
              </Text>
              <Text style={[styles.note, { marginTop: 6 }]}>
                {t('common:membership.notes.upgradeRules', {
                  defaultValue: 'Upgrade: Premium +30 odmah; Free→Pro +50, Premium→Pro +50. Downgrade Pro→Premium: saldo se seče na CAP 90. Free mesečni limit: 10.',
                })}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// === Podkomponente ===
function FeatureRow({ label, include, inverseColor }) {
  const iconName = include ? 'check-circle' : 'close-circle';
  const iconColor = include ? '#ffd700' : inverseColor ? '#ff5454' : '#888';
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureLabel}>{label}</Text>
      <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
    </View>
  );
}
function FeatureValue({ text, color = '#ffd700' }) {
  return (
    <View style={styles.featureRow}>
      <Text style={[styles.featureValue, { color }]}>{text}</Text>
    </View>
  );
}

// === Stilovi ===
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  screenTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'left',
  },
  closeInHeader: {
    padding: 6,
    marginLeft: 8,
    opacity: 0.9,
  },
  statusBar: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#252532',
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#252532',
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 22,
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  cardBest: {
    borderColor: '#ae7ffb',
    shadowColor: '#ae7ffb',
    shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0.25,
    shadowRadius: 10,
    elevation: 7,
  },
  cardProPlusMini: {
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: Platform.OS === 'ios' ? 0.20 : 0.20,
    shadowRadius: 10,
    elevation: 5,
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 19,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#444',
    width: '100%',
  },
  featureLabel: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  featureValue: {
    color: '#ffd700',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
  ctaBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    alignSelf: 'center',
    minWidth: 200,
    alignItems: 'center',
  },
  ctaText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  bestOffer: {
    color: '#ffd700',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  note: {
    color: '#ffd700cc',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '400',
  },
});
