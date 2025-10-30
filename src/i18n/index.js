// File: src/i18n/index.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import pt from './locales/pt.json'; // ili './locales/pt-br.json' ako tako držiš
import sr from './locales/sr.json';
import tr from './locales/tr.json';

// lekcije/dokumenti (poseban namespace)
import deLessons from './locales/de.doc.json';
import enLessons from './locales/en.doc.json';
import esLessons from './locales/es.doc.json';
import frLessons from './locales/fr.doc.json';
import hiLessons from './locales/hi.doc.json';
import idLessons from './locales/id.doc.json';
import ptLessons from './locales/pt.doc.json';
import srLessons from './locales/sr.doc.json';
import trLessons from './locales/tr.doc.json';

// ---- SUPPORTED jezici (redosled je i redosled prikaza u UI) ----
export const SUPPORTED_LANGS = ['sr', 'en', 'es', 'de', 'fr', 'tr', 'pt', 'hi', 'id'];

// 2) Ključ u storage-u za ručni izbor
export const LANG_STORAGE_KEY = 'app:lang';

// 🔑 common grana (ako postoji)
const enCommon = (en && en.common) ? en.common : en;
const srCommon = (sr && sr.common) ? sr.common : sr;

// 🧱 Resursi
// - en/sr: pravi fajlovi
// - ostali: prazno → automatski fallback na 'en'
const resources = {
  en: { translation: en, common: en.common ?? en, lessons: enLessons, doc: enLessons },
  sr: { translation: sr, common: sr.common ?? sr, lessons: srLessons, doc: srLessons },

  de: { translation: de, common: de.common ?? de, lessons: deLessons, doc: deLessons },
  es: { translation: es, common: es.common ?? es, lessons: esLessons, doc: esLessons },
  pt: { translation: pt, common: pt.common ?? pt, lessons: ptLessons, doc: ptLessons },
  fr: { translation: fr, common: fr.common ?? fr, lessons: frLessons, doc: frLessons },
  hi: { translation: hi, common: hi.common ?? hi, lessons: hiLessons, doc: hiLessons },
  id: { translation: id, common: id.common ?? id, lessons: idLessons, doc: idLessons },
  tr: { translation: tr, common: tr.common ?? tr, lessons: trLessons, doc: trLessons },
};

// Normalizacija šifri jezika: "en-US" → "en", "pt-BR" → "pt", "in" → "id", "sr-RS" → "sr"
function normalizeLang(code) {
  if (!code) return 'en';
  const c = String(code).toLowerCase();

  if (c.startsWith('sr')) return 'sr';
  if (c.startsWith('en')) return 'en';
  if (c.startsWith('es')) return 'es';
  if (c.startsWith('de')) return 'de';
  if (c.startsWith('fr')) return 'fr';
  if (c.startsWith('tr')) return 'tr';
  if (c.startsWith('pt')) return 'pt';
  // istorijska šifra za indonežanski je “in”; standard je “id”
  if (c === 'in' || c.startsWith('id')) return 'id';

  return c.split('-')[0]; // languageOnly
}

// 1) Detekcija jezika uređaja
function deviceLang() {
  const first =
    (Array.isArray(Localization.getLocales?.()) && Localization.getLocales()[0]?.languageCode) ||
    (Localization?.locale || 'en');
  const norm = normalizeLang(first);

  return SUPPORTED_LANGS.includes(norm) ? norm : 'en';
}

// 3) Inicijalizacija
i18n.use(initReactI18next).init({
  resources,
  lng: deviceLang(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGS,
  load: 'languageOnly',           // sr-RS -> sr
  nonExplicitSupportedLngs: true,
  ns: ['translation', 'common', 'lessons', 'doc'],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// PATCH: spreči mešanje jezika (zadržiš specijalno ponašanje za sr)
// Ako proslediš defaultValue, za ne-sr jezike ignorisaćemo defaultValue
// da bi radio fallback na 'en' (umesto prikaza eng. stringa kao defaultValue).
const _t = i18n.t.bind(i18n);
i18n.t = (key, options) => {
  const isObj = options && typeof options === 'object';
  if (isObj && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
    const lang = String(i18n.language || '').toLowerCase();
    if (!lang.startsWith('sr')) {
      const { defaultValue, ...rest } = options;
      return _t(key, rest); // bez defaultValue → koristi fallbackLng ('en')
    }
  }
  return _t(key, options);
};

// 4) Primeni prethodno sačuvan jezik (ako postoji)
(async () => {
  try {
    const saved = await AsyncStorage.getItem(LANG_STORAGE_KEY);
    if (saved) {
      const norm = normalizeLang(saved);
      if (SUPPORTED_LANGS.includes(norm)) {
        await i18n.changeLanguage(norm);
      }
    }
  } catch {}
})();

// 5) Helperi
export async function setAppLanguage(lang) {
  const norm = normalizeLang(lang);
  if (!SUPPORTED_LANGS.includes(norm)) return;
  try { await AsyncStorage.setItem(LANG_STORAGE_KEY, norm); } catch {}
  await i18n.changeLanguage(norm);
}

export async function applyLangParam(lang) {
  if (!lang) return;
  const norm = normalizeLang(lang);
  if (SUPPORTED_LANGS.includes(norm)) {
    await setAppLanguage(norm);
  }
}

export default i18n;
