import i18n from './index'; // gde već eksportuješ i18n instancu

const DOC_MAP = {
  en: () => import('./locales/en.doc.json'),
  sr: () => import('./locales/sr.doc.json'),
  // dodaj kasnije: es, de, fr, it, pt, hi...
};

export async function ensureDocNamespace(lang) {
  const lng = (lang || i18n.language || 'en').slice(0, 2);
  if (i18n.hasResourceBundle(lng, 'doc')) return;
  const loader = DOC_MAP[lng] || DOC_MAP.en;
  const mod = await loader();
  i18n.addResourceBundle(lng, 'doc', mod.default || mod, true, true);
}
