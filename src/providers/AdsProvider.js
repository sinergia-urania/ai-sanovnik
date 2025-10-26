// File: src/providers/AdsProvider.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  InterstitialAd,
  TestIds
} from 'react-native-google-mobile-ads';

// ─────────────────────────────────────────────────────────────
// DEBUG KILL-SWITCH: dok tražimo uzrok "spinnera", hard off ads.
// Postavi na false kad proverimo da nisu uzrok.
const ADS_HARD_OFF = false;
// ─────────────────────────────────────────────────────────────

const DAILY_CAP = 7;
const COOLDOWN_MS = 20_000;

const AD_UNIT_ID = __DEV__
  ? (Platform.OS === 'ios' ? TestIds.INTERSTITIAL : TestIds.INTERSTITIAL)
  : (Platform.OS === 'ios'
      ? 'ca-app-pub-2786609619751533/2447519807'
      : 'ca-app-pub-2786609619751533/9071610235'
    );

const K_LAST_SHOWN = 'ads:lastShownAt';
const K_DAY_COUNT_PREFIX = 'ads:count:'; // + YYYYMMDD

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

async function getDayCount() {
  const key = `${K_DAY_COUNT_PREFIX}${todayKey()}`;
  const raw = await AsyncStorage.getItem(key);
  return raw ? Number(raw) || 0 : 0;
}
async function incDayCount() {
  const key = `${K_DAY_COUNT_PREFIX}${todayKey()}`;
  const n = (await getDayCount()) + 1;
  await AsyncStorage.setItem(key, String(n));
  return n;
}
async function getLastShownAt() {
  const raw = await AsyncStorage.getItem(K_LAST_SHOWN);
  return raw ? Number(raw) : 0;
}
async function setLastShownAt(ts) {
  await AsyncStorage.setItem(K_LAST_SHOWN, String(ts));
}

const AdsCtx = createContext({
  preload: () => {},
  showPreAnswerIfEligible: async () => ({ shown: false }),
  state: { loaded: false, isShowing: false, dayCount: 0, lastShownAt: 0 },
});

async function initAdsWithConsent() {
  try {
    console.log('[ads] consent: requestInfoUpdate()…');
    const info = await AdsConsent.requestInfoUpdate();
    console.log('[ads] consent: isConsentFormAvailable=', info?.isConsentFormAvailable);

    if (info.isConsentFormAvailable) {
      console.log('[ads] consent: loadAndShowConsentFormIfRequired()…');
      await AdsConsent.loadAndShowConsentFormIfRequired();
      console.log('[ads] consent: form handled');
    }
  } catch (e) {
    console.log('[ads] consent error:', String(e));
  }

  try {
    console.log('[ads] mobileAds.initialize()…');
    await mobileAds().initialize();
    console.log('[ads] mobileAds.initialize() done');
  } catch (e) {
    console.log('[ads] mobileAds init error:', String(e));
  }
}

export function AdsProvider({ children }) {
  const adRef = useRef(null);
  const listenerCleanup = useRef([]);
  const loadingRef = useRef(false);

  const [loaded, setLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const dayCountRef = useRef(0);
  const lastShownRef = useRef(0);

  const attachListeners = useCallback((ad) => {
    if (!ad) return;
    // cleanup stare
    try { listenerCleanup.current.forEach(unsub => unsub && unsub()); } catch {}
    listenerCleanup.current = [];

    listenerCleanup.current.push(
      ad.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[ads] event: LOADED');
        setLoaded(true);
        loadingRef.current = false;
      })
    );
    listenerCleanup.current.push(
      ad.addAdEventListener(AdEventType.ERROR, (e) => {
        console.log('[ads] event: ERROR', e);
        setLoaded(false);
        loadingRef.current = false;
        setTimeout(() => preloadInternal(), 1500);
      })
    );
    listenerCleanup.current.push(
      ad.addAdEventListener(AdEventType.OPENED, () => {
        console.log('[ads] event: OPENED');
        setIsShowing(true);
      })
    );
    listenerCleanup.current.push(
      ad.addAdEventListener(AdEventType.CLOSED, async () => {
        console.log('[ads] event: CLOSED');
        setIsShowing(false);
        setLoaded(false);
        const now = Date.now();
        await setLastShownAt(now);
        lastShownRef.current = now;
        await incDayCount();
        dayCountRef.current = await getDayCount();
        setTimeout(() => preloadInternal(), 800);
      })
    );
  }, []);

  const preloadInternal = useCallback(() => {
    if (ADS_HARD_OFF) { console.log('[ads] preload skipped (ADS_HARD_OFF)'); return; }
    if (loadingRef.current) return;
    if (adRef.current && loaded) return;

    loadingRef.current = true;
    console.log('[ads] preload: creating InterstitialAd…');

    try { listenerCleanup.current.forEach(unsub => unsub && unsub()); } catch {}
    listenerCleanup.current = [];

    const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    adRef.current = ad;
    attachListeners(ad);
    ad.load();
  }, [attachListeners, loaded]);

  const preload = useCallback(() => {
    preloadInternal();
  }, [preloadInternal]);

  const canShowNow = useCallback(async () => {
    if (ADS_HARD_OFF) return { ok: false, reason: 'hard_off' };

    const [count, last] = await Promise.all([getDayCount(), getLastShownAt()]);
    dayCountRef.current = count;
    lastShownRef.current = last;

    if (count >= DAILY_CAP) return { ok: false, reason: 'daily_cap' };
    if (Date.now() - last < COOLDOWN_MS) return { ok: false, reason: 'cooldown' };
    if (!loaded) return { ok: false, reason: 'not_loaded' };
    if (isShowing) return { ok: false, reason: 'already_showing' };
    return { ok: true };
  }, [loaded, isShowing]);

  const showPreAnswerIfEligible = useCallback(async () => {
    const guard = await canShowNow();
    if (!guard.ok) {
      console.log('[ads] skip show (reason=', guard.reason, ')');
      return { shown: false, reason: guard.reason };
    }
    try {
      console.log('[ads] show()');
      adRef.current?.show();
      // NE čekamo zatvaranje — UI ne sme da blokira odgovor!
      return { shown: true };
    } catch (e) {
      console.log('[ads] show error:', String(e));
      return { shown: false, error: String(e) };
    }
  }, [canShowNow]);

  useEffect(() => {
    (async () => {
      if (ADS_HARD_OFF) {
        console.log('[ads] HARD OFF — init/preload preskočeni');
        return;
      }
      await new Promise(r => setTimeout(r, 300));
      await initAdsWithConsent();
      preloadInternal();
    })();

    return () => {
      try { listenerCleanup.current.forEach(unsub => unsub && unsub()); } catch {}
      listenerCleanup.current = [];
    };
  }, [preloadInternal]);

  useEffect(() => {
    (async () => {
      dayCountRef.current = await getDayCount();
      lastShownRef.current = await getLastShownAt();
    })();
  }, []);

  const state = useMemo(() => ({
    loaded,
    isShowing,
    dayCount: dayCountRef.current,
    lastShownAt: lastShownRef.current,
  }), [loaded, isShowing]);

  const value = useMemo(() => ({
    preload,
    showPreAnswerIfEligible,
    state,
  }), [preload, showPreAnswerIfEligible, state]);

  return <AdsCtx.Provider value={value}>{children}</AdsCtx.Provider>;
}

export function useAds() {
  return useContext(AdsCtx);
}
