// File: src/components/SidebarMenu.jsx
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../providers/AuthProvider';
import { useSound } from '../providers/SoundProvider';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';

/* External legal docs */
const INFOHELM_BASE = process?.env?.EXPO_PUBLIC_INFOHELM_BASE || 'https://infohelm.org';
const SLUGS = { privacy: 'privacy-policy', dataDeletion: 'data-deletion', terms: 'terms-of-service' };
const MISSING_PER_LANG = { terms: new Set(['fr']) };
const deriveExternalUrl = (id, lang2 = 'en') => {
  const slug = SLUGS[id]; if (!slug) return '';
  const realLang = MISSING_PER_LANG[id]?.has(lang2) ? 'en' : (lang2 || 'en');
  return `${INFOHELM_BASE}/${slug}-${realLang}.html`;
};

/* Store / marketing meta (javne vrednosti) */
const ANDROID_PACKAGE = process?.env?.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.mare82.aisanovnik';
const IOS_APP_ID = process?.env?.EXPO_PUBLIC_IOS_APP_ID || '';
const MARKETING_URL = process?.env?.EXPO_PUBLIC_MARKETING_URL || 'https://infohelm.org';
const CONTACT_EMAIL = 'info@infohelm.org';

/* 🔮 Cross-promo: AI Tarot */
const TAROT_ANDROID_PACKAGE = process?.env?.EXPO_PUBLIC_TAROT_ANDROID_PACKAGE || '';
const TAROT_IOS_APP_ID     = process?.env?.EXPO_PUBLIC_TAROT_IOS_APP_ID || '';
const TAROT_MARKETING_URL  = process?.env?.EXPO_PUBLIC_TAROT_MARKETING_URL || 'https://infohelm.org/ai-tarot';
// stavi svoju ikonu ovde (40–48px)
const AI_TAROT_ICON = require('../assets/images/una.png');

function LegalModal({ visible, onClose, onOpenInternalDoc, lang2 }) {
  const { t } = useTranslation(['common']);
  const { playClick } = useSound();
  const openExternal = async (id) => {
    try { playClick?.(); } catch {}
    onClose?.();
    try {
      const url = deriveExternalUrl(id, lang2); if (!url) return;
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
    } catch {}
  };
  const openDisclaimer = () => { try { playClick?.(); } catch {}; onClose?.(); onOpenInternalDoc?.('disclaimer'); };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sectionModal}>
        <Text style={styles.sectionTitle}>📜 {t('common:legal.title', { defaultValue: 'Legal documents' })}</Text>

        <TouchableOpacity onPress={openDisclaimer} accessibilityRole="button">
          <Text style={styles.sectionText}>- {t('common:legal.disclaimer', { defaultValue: 'Disclaimer' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal('privacy')} accessibilityRole="link">
          <Text style={styles.sectionText}>- {t('common:legal.privacy', { defaultValue: 'Privacy Policy' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal('dataDeletion')} accessibilityRole="link">
          <Text style={styles.sectionText}>- {t('common:legal.dataDeletion', { defaultValue: 'Data Deletion' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openExternal('terms')} accessibilityRole="link">
          <Text style={styles.sectionText}>- {t('common:legal.terms', { defaultValue: 'Terms of Service' })}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionCloseBtn} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.text, { color: '#facc15' }]}>{t('common:buttons.close', { defaultValue: 'Close' })}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* Support (Rate & Share) */
function SupportModal({ visible, onClose, lang2 }) {
  const { t } = useTranslation(['common']);
  const { playClick } = useSound();

  const deepLink =
    Platform.OS === 'android'
      ? `market://details?id=${ANDROID_PACKAGE}`
      : `itms-apps://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`;

  const rate = async () => {
    try { playClick?.(); } catch {}
    try {
      if (Platform.OS === 'ios' && !IOS_APP_ID) {
        console.warn('Set EXPO_PUBLIC_IOS_APP_ID to enable iOS rating deep-link.');
        return;
      }
      await Linking.openURL(deepLink);
    } catch {}
    onClose?.();
  };

  const storeUrl =
    Platform.OS === 'android'
      ? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`
      : IOS_APP_ID
      ? `https://apps.apple.com/app/id${IOS_APP_ID}`
      : MARKETING_URL;

  const shareApp = async () => {
    try { playClick?.(); } catch {}
    try {
      const msg = t('common:support.shareMessage', {
        defaultValue:
          lang2 === 'sr'
            ? 'Preporučujem DreamCodex AI – tumačenje snova i lucidno sanjanje: '
            : 'Check out DreamCodex AI – dream interpretation & lucid dreaming: ',
      });
      await Share.share({ message: `${msg}${storeUrl}` });
    } catch {}
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sectionModal}>
        <Text style={styles.sectionTitle}>⭐ {t('common:support.title', { defaultValue: 'Support' })}</Text>

        <TouchableOpacity onPress={rate} accessibilityRole="button">
          <Text style={styles.sectionText}>- {t('common:support.rate', { defaultValue: 'Rate the app' })}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={shareApp} accessibilityRole="button">
          <Text style={styles.sectionText}>- {t('common:support.share', { defaultValue: 'Share with friends' })}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionCloseBtn} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.text, { color: '#facc15' }]}>{t('common:buttons.close', { defaultValue: 'Close' })}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// === BRAND HEADER (DreamCodex AI + sova) ===
const BRAND_IMG = require('../assets/images/sova.webp');

function BrandingHeader() {
  return (
    <View style={styles.brandingWrap}>
      <Text style={styles.brandingTitle}>
        <Text style={styles.brandDream}>Dream</Text>
        <Text style={styles.brandCodex}>Codex</Text>
        <Text style={styles.brandAI}> AI</Text>
      </Text>

      <Image
        source={BRAND_IMG}
        style={styles.brandingImage}
        contentFit="contain"
        transition={120}
        cachePolicy="memory-disk"
        accessibilityLabel="DreamCodex AI"
      />

      <View style={styles.brandingDivider} />
    </View>
  );
}

export default function SidebarMenu({ visible, onClose }) {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation(['common']);
  const { user, profile } = useAuth();
  const { playClick } = useSound();

  const [activeSection, setActiveSection] = useState(null); // 'profile' | 'legal' | 'settings' | 'support'
  useEffect(() => { if (!visible) setActiveSection(null); }, [visible]);

  const openInternalDoc = (id) => { onClose?.(); navigation.navigate('Doc', { id }); };
  const lang2 = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2);

  const aboutLabel = t('common:menu.about', { defaultValue: lang2 === 'sr' ? 'O aplikaciji' : 'About' });
  const plansLabel = t('common:menu.plans', { defaultValue: lang2 === 'sr' ? 'Planovi' : 'Plans' });
  const supportLabel = t('common:menu.support', { defaultValue: lang2 === 'sr' ? 'Oceni & Podeli' : 'Rate & Share' });
  const contactLabel = t('common:menu.contact', { defaultValue: lang2 === 'sr' ? 'Kontakt' : 'Contact' });

  const emailContact = async () => {
    try { playClick?.(); } catch {}
    try {
      const subject = encodeURIComponent('DreamCodex AI — Support');
      const url = `mailto:${CONTACT_EMAIL}?subject=${subject}`;
      const ok = await Linking.canOpenURL(url);
      await Linking.openURL(ok ? url : `mailto:${CONTACT_EMAIL}`);
    } catch {}
    onClose?.();
  };

  // 🔮 Open AI Tarot store page
  const openTarot = async () => {
    try { playClick?.(); } catch {}
    const url =
      Platform.OS === 'android'
        ? (TAROT_ANDROID_PACKAGE
            ? `https://play.google.com/store/apps/details?id=${TAROT_ANDROID_PACKAGE}`
            : TAROT_MARKETING_URL)
        : (TAROT_IOS_APP_ID
            ? `https://apps.apple.com/app/id${TAROT_IOS_APP_ID}`
            : TAROT_MARKETING_URL);
    try {
      const ok = await Linking.canOpenURL(url);
      await Linking.openURL(ok ? url : TAROT_MARKETING_URL);
    } catch {}
    // ne moramo da zatvaramo meni, ali deluje prirodno:
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* overlay */}
      <Pressable
        style={styles.overlay}
        onPress={() => { try { playClick?.(); } catch {}; onClose?.(); }}
      />
      <View style={styles.menu}>
        {/* BRANDING HEADER (fiksiran) */}
        <BrandingHeader />

        {/* LISTA KOJA SKROLUJE */}
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1) O aplikaciji */}
          <TouchableOpacity
            style={styles.item}
            onPress={() => { try { playClick?.(); } catch {}; openInternalDoc('about'); }}
            accessibilityRole="button"
            accessibilityLabel={aboutLabel}
          >
            <Text style={styles.text}>ℹ️ {aboutLabel}</Text>
          </TouchableOpacity>

          {/* 2) Profil */}
          <TouchableOpacity
            style={styles.item}
            onPress={() => { try { playClick?.(); } catch {}; setActiveSection('profile'); }}
            accessibilityRole="button"
            accessibilityLabel={t('common:menu.profile', { defaultValue: 'Profile' })}
          >
            <Text style={styles.text}>👤 {t('common:menu.profile', { defaultValue: 'Profile' })}</Text>
          </TouchableOpacity>

          {/* 3) Podešavanja */}
          <TouchableOpacity
            style={styles.item}
            onPress={() => { try { playClick?.(); } catch {}; setActiveSection('settings'); }}
            accessibilityRole="button"
            accessibilityLabel={t('common:menu.settings', { defaultValue: 'Settings' })}
          >
            <Text style={styles.text}>⚙️ {t('common:menu.settings', { defaultValue: 'Settings' })}</Text>
          </TouchableOpacity>

          {/* 4) Planovi */}
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              try { playClick?.(); } catch {}
              onClose?.();
              navigation.navigate('Plans');
            }}
            accessibilityRole="button"
            accessibilityLabel={plansLabel}
          >
            <Text style={styles.text}>💠 {plansLabel}</Text>
          </TouchableOpacity>

          {/* 5) Oceni & Podeli */}
          <TouchableOpacity
            style={styles.item}
            onPress={() => { try { playClick?.(); } catch {}; setActiveSection('support'); }}
            accessibilityRole="button"
            accessibilityLabel={supportLabel}
          >
            <Text style={styles.text}>⭐ {supportLabel}</Text>
          </TouchableOpacity>

          {/* 6) Pravna dokumenta */}
          <TouchableOpacity
            style={styles.item}
            onPress={() => { try { playClick?.(); } catch {}; setActiveSection('legal'); }}
            accessibilityRole="button"
            accessibilityLabel={t('common:legal.title', { defaultValue: 'Legal documents' })}
          >
            <Text style={styles.text}>📜 {t('common:legal.title', { defaultValue: 'Legal documents' })}</Text>
          </TouchableOpacity>

          {/* 7) Kontakt */}
          <TouchableOpacity
            style={styles.item}
            onPress={emailContact}
            accessibilityRole="button"
            accessibilityLabel={contactLabel}
          >
            <Text style={styles.text}>📧 {contactLabel}</Text>
          </TouchableOpacity>

          {/* 🔮 Cross-promo: Una Astro-Tarot AI(ispod Kontakt, iznad Zatvori) */}
          <View style={styles.promoWrap}>
            <Text style={styles.promoTitle}>
              {t('common:promo.title', { defaultValue: 'Try our new app' })}
            </Text>
            <TouchableOpacity
              onPress={openTarot}
              accessibilityRole="link"
              style={styles.promoTile}
            >
              <Image
                source={AI_TAROT_ICON}
                style={styles.promoIcon}
                contentFit="cover"
                transition={120}
                accessibilityLabel="Una Astro-Tarot AI"
              />
              <Text style={styles.promoCta}>
                {t('common:promo.cta', { defaultValue: 'Una Astro-Tarot AI' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Close */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => { try { playClick?.(); } catch {}; onClose?.(); }}
            accessibilityRole="button"
          >
            <Text style={[styles.text, { color: '#facc15' }]}>
              {t('common:buttons.close', { defaultValue: 'Close' })}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Modali */}
        <ProfileModal
          visible={activeSection === 'profile'}
          onClose={() => setActiveSection(null)}
          user={user}
          profile={profile}
        />

        <SettingsModal
          visible={activeSection === 'settings'}
          onClose={() => setActiveSection(null)}
        />

        <LegalModal
          visible={activeSection === 'legal'}
          onClose={() => setActiveSection(null)}
          onOpenInternalDoc={openInternalDoc}
          lang2={lang2}
        />

        <SupportModal
          visible={activeSection === 'support'}
          onClose={() => setActiveSection(null)}
          lang2={lang2}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  menu: {
    position: 'absolute', top: 0, left: 0, width: 260, height: '100%',
    backgroundColor: 'black', paddingVertical: 24, paddingHorizontal: 20,
    shadowColor: '#000', shadowOpacity: 0.8, elevation: 8,
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
  },

  // skrol zona
  menuScroll: { flex: 1, marginTop: 6 },
  menuScrollContent: { paddingBottom: 24 },

  // BRANDING
  brandingWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  brandingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  brandDream: { color: '#facc15' },
  brandCodex: { color: '#a78bfa' },
  brandAI: { color: '#facc15' },
  brandingImage: {
    width: 170,
    height: 100,
    marginTop: 6,
  },
  brandingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: '90%',
    marginTop: 10,
  },

  item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#232323' },
  text: { color: '#fff', fontSize: 17 },
  closeBtn: { marginTop: 8, alignItems: 'center' },

  // section modal
  sectionModal: {
    position: 'absolute', top: 56, left: 28, width: 240, minHeight: 260,
    backgroundColor: '#171717', borderRadius: 18, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.6, elevation: 12, alignItems: 'flex-start',
  },
  sectionTitle: { color: '#facc15', fontSize: 21, fontWeight: 'bold', marginBottom: 16 },
  sectionText: { color: '#fff', fontSize: 16, marginBottom: 14 },
  sectionCloseBtn: {
    marginTop: 8, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: '#333',
  },

  // 🔮 promo
  promoWrap: {
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#232323',
  },
  promoTitle: { color: '#aaa', fontSize: 12, marginBottom: 6 },
  promoTile: { alignItems: 'center', justifyContent: 'center' },
  promoIcon: { width: 44, height: 44, borderRadius: 10, marginBottom: 6 },
  promoCta: { color: '#facc15', fontWeight: '800', fontSize: 13 },
});
