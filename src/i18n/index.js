import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import sr from './locales/sr.json';

// ⬇️ lekcije / dokumenti u posebnom namespace-u
import enLessons from './locales/en.doc.json';
import srLessons from './locales/sr.doc.json';

// 🔑 Izvuci granu "common" ako postoji; u suprotnom koristi ceo fajl
const enCommon = (en && en.common) ? en.common : en;
const srCommon = (sr && sr.common) ? sr.common : sr;

// Registruj resurse:
// - "translation" = ceo en/sr
// - "common" = samo common grana
// - "lessons" = en.doc/sr.doc
// - "doc" = alias na isti sadržaj (radi kompatibilnosti)
const resources = {
  en: { translation: en, common: enCommon, lessons: enLessons, doc: enLessons },
  sr: { translation: sr, common: srCommon, lessons: srLessons, doc: srLessons },
};

// 1) Detekcija jezika uređaja (sr-Latn/sr-Cyrl → 'sr')
function deviceLang() {
  const lc =
    (Array.isArray(Localization.getLocales?.()) && Localization.getLocales()[0]?.languageCode) ||
    (Localization?.locale || 'en').split('-')[0] ||
    'en';
  return lc && lc.toLowerCase().startsWith('sr') ? 'sr' : 'en';
}

// 2) Ključ u storage-u za ručni izbor
const STORAGE_KEY = 'app:lang';

// 3) Inicijalizacija
i18n.use(initReactI18next).init({
  resources,
  lng: deviceLang(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'sr'],
  load: 'languageOnly',           // sr-RS -> sr
  nonExplicitSupportedLngs: true,
  ns: ['translation', 'common', 'lessons', 'doc'],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/**
 * PATCH: spreči mešanje jezika — ako aktivni jezik NIJE sr/sr-RS,
 * a t() poziv prosledi defaultValue, ignoriši ga kako bi i18next
 * uredno pao na fallbackLng ('en') umesto srpskog defaulta iz koda.
 */
const _t = i18n.t.bind(i18n);
i18n.t = (key, options) => {
  const isObj = options && typeof options === 'object';
  if (isObj && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
    const lang = String(i18n.language || '').toLowerCase();
    if (!lang.startsWith('sr')) {
      const { defaultValue, ...rest } = options;
      return _t(key, rest); // bez defaultValue → koristi en iz resources/fallbackLng
    }
  }
  return _t(key, options);
};

// 4) Primeni prethodno sačuvan jezik (ako postoji)
(async () => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      await i18n.changeLanguage(saved); // bez liste — koristi ono što je korisnik izabrao
    }
  } catch {}
})();

// 5) Helperi
export async function setAppLanguage(lang) {
  if (!['en', 'sr'].includes(lang)) return;
  try { await AsyncStorage.setItem(STORAGE_KEY, lang); } catch {}
  await i18n.changeLanguage(lang);
}

export async function applyLangParam(lang) {
  if (lang && ['en', 'sr'].includes(lang)) {
    await setAppLanguage(lang);
  }
}

export default i18n;
