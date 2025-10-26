// File: src/screens/StaticDocScreen.jsx
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Linking,
    Platform, // ⬅️ NEW
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Markdown from 'react-native-markdown-display'; // ⬅️ NEW
import { ensureDocNamespace } from '../i18n/docLoader';
import { useSound } from '../providers/SoundProvider';

const INFOHELM_BASE = process?.env?.EXPO_PUBLIC_INFOHELM_BASE || 'https://infohelm.org';
const SUPPORTED_LANGS = ['sr', 'en', 'fr', 'es', 'pt', 'de', 'hi'];

const SLUGS = {
  privacy: 'privacy-policy',
  dataDeletion: 'data-deletion',
  terms: 'terms-of-service',
};
const MISSING_PER_LANG = { terms: new Set(['fr']) };

export default function StaticDocScreen(props) {
  const nav = useNavigation();
  const route = useRoute();
  const { t, i18n } = useTranslation();
  const { playClick } = useSound();

  const docId = props.id || props.docId || route.params?.id || route.params?.docId || 'about';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await ensureDocNamespace(i18n.resolvedLanguage || i18n.language);
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, [i18n.language, i18n.resolvedLanguage]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const title     = t(`doc:${docId}.title`,     { defaultValue: '' });
  const updatedAt = t(`doc:${docId}.updatedAt`, { defaultValue: '' });
  const bodyMd    = t(`doc:${docId}.bodyMd`,    { defaultValue: '' });
  const body      = t(`doc:${docId}.body`,      { returnObjects: true, defaultValue: [] });

  const shortLang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2);
  const langForUrl = SUPPORTED_LANGS.includes(shortLang) ? shortLang : 'en';

  const canonicalLang = (lng) => (String(lng || '').slice(0, 2) || 'en');
  const deriveUrl = (id) => {
    const slug = SLUGS[id];
    if (!slug) return '';
    const fallbackLang = MISSING_PER_LANG[id]?.has(langForUrl) ? 'en' : canonicalLang(langForUrl);
    return `${INFOHELM_BASE}/${slug}-${fallbackLang}.html`;
  };

  const normalizeUrl = (url) => {
    if (!url) return '';
    let href = String(url).trim();
    if (/^\/\//.test(href)) href = 'https:' + href;
    if (!/^https?:\/\//i.test(href)) href = `${INFOHELM_BASE}/${href.replace(/^\/+/, '')}`;
    return href.replace(/^http:\/\//i, 'https://');
  };
  const withUtm = (href) => {
    try {
      const u = new URL(href);
      if (!u.searchParams.get('utm_source')) {
        u.searchParams.set('utm_source', 'dreamcodex_ai');
        u.searchParams.set('utm_medium', 'app');
        u.searchParams.set('utm_campaign', 'static_docs');
        u.searchParams.set('utm_content', docId);
      }
      return u.toString();
    } catch { return href; }
  };

  const explicitSource = t(`doc:${docId}.sourceUrl`, { defaultValue: '' });
  const externalUrl = withUtm(normalizeUrl(explicitSource) || deriveUrl(docId));

  const handleClose = () => {
    try { playClick?.(); } catch {}
    if (nav?.canGoBack?.()) nav.goBack();
    else nav.navigate('Home');
  };

  const openWeb = async () => {
    try { playClick?.(); } catch {}
    try {
      const ok = await Linking.canOpenURL(externalUrl);
      if (ok) return Linking.openURL(externalUrl);
      throw new Error('CANNOT_OPEN');
    } catch {
      const fb = withUtm(deriveUrl(docId));
      if (fb) {
        try { const ok2 = await Linking.canOpenURL(fb); if (ok2) await Linking.openURL(fb); } catch {}
      }
    }
  };

  return (
    <View style={styles.container}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!updatedAt && (
        <Text style={styles.updatedAt}>
          {t('common:labels.updatedAt', { defaultValue: 'Updated' })}: {updatedAt}
        </Text>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.btn} onPress={handleClose} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common:buttons.close', { defaultValue: 'Close' })}</Text>
        </TouchableOpacity>

        {!!externalUrl && (
          <TouchableOpacity style={styles.btn} onPress={openWeb} accessibilityRole="link">
            <Text style={styles.btnText}>
              {t('common:labels.openOnWeb', { defaultValue: 'Open on the web' })}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {bodyMd ? (
          <Markdown
            style={mdStyles}
            onLinkPress={(url) => {
              try { playClick?.(); } catch {}
              Linking.openURL(url).catch(() => {});
              return true; // handled
            }}
          >
            {bodyMd}
          </Markdown>
        ) : Array.isArray(body) && body.length ? (
          body.map((p, i) => <Text key={i} style={styles.paragraph}>{p}</Text>)
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#181818', paddingTop: 12 },
  title: { color: '#facc15', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 8, marginBottom: 2, letterSpacing: 1.1 },
  updatedAt: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  actionRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 10 },
  btn: { backgroundColor: '#232323', borderColor: '#facc15', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: '#facc15', fontWeight: 'bold' },
  content: { paddingHorizontal: 18, paddingBottom: 30, paddingTop: 12 },
  paragraph: { color: '#fff', fontSize: 16, lineHeight: 24, marginBottom: 12 },
});

/** Markdown theme (dark) */
const mdStyles = {
  body: { color: '#ddd', fontSize: 15, lineHeight: 22 },
  heading1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  heading2: { color: '#f5f5f5', fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  heading3: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  paragraph: { color: '#ddd', marginBottom: 10 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { flexDirection: 'row', marginBottom: 4 },
  strong: { fontWeight: '800', color: '#fff' },
  em: { fontStyle: 'italic' },
  blockquote: {
    backgroundColor: '#141414',
    borderLeftColor: '#9b87f5',
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: '#1b1b1b',
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: '#E6E6E6',
  },
  code_block: {
    backgroundColor: '#101010',
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: '#E6E6E6',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  fence: {
    backgroundColor: '#101010',
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: '#E6E6E6',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  link: { color: '#9b87f5', textDecorationLine: 'underline' },
  image: { borderRadius: 8, marginVertical: 8, alignSelf: 'center' },
  hr: { backgroundColor: '#2a2a2a', height: 1, marginVertical: 12 },
};
