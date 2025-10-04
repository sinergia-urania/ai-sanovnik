// File: src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import sr from './locales/sr.json';

const resources = { en: { translation: en }, sr: { translation: sr } };

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: (Localization?.locale || 'en').startsWith('sr') ? 'sr' : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;