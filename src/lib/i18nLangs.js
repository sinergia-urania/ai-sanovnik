import { SUPPORTED_LANGS } from '../i18n';

const META = {
  sr: { label: 'Srpski',             flag: '🇷🇸' },
  en: { label: 'English',            flag: '🇬🇧' },
  es: { label: 'Español',            flag: '🇪🇸' },
  de: { label: 'Deutsch',            flag: '🇩🇪' },
  fr: { label: 'Français',           flag: '🇫🇷' },
  tr: { label: 'Türkçe',             flag: '🇹🇷' },
  pt: { label: 'Português (BR)',     flag: '🇧🇷' }, // promeni u 🇵🇹 i label ako koristiš EU PT
  hi: { label: 'हिंदी',              flag: '🇮🇳' },
  id: { label: 'Bahasa Indonesia',   flag: '🇮🇩' },
};

// Jedini izvor istine za KODOVE je SUPPORTED_LANGS.
// UI lista se generiše i drži label/flag na jednom mestu.
export const LANGS = SUPPORTED_LANGS.map(code => ({
  code,
  label: META[code]?.label || code,
  flag:  META[code]?.flag  || '🏳️',
}));
