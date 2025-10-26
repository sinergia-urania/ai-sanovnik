// src/utils/featureGuard.js
import Toast from 'react-native-toast-message';
import { hasAccess } from './planRules';

/**
 * Vrati true ako ima pristup; u suprotnom pokaži toast i otvori Plans.
 * Parametri:
 *  - plan: npr. 'free' | 'premium' | 'pro' | 'proplus'
 *  - need: npr. 'premium' | 'pro'   (string iz FeaturePlan)
 *  - t: i18n t funkcija
 *  - navigation: react-navigation
 *  - toastKey: 'journal' | 'lucid' | 'media'
 */
export function guardFeature({ plan, need, t, navigation, toastKey }) {
  if (hasAccess(plan, need)) return true;

  const titles = {
    journal: {
      t1: t('common.membership.title', { defaultValue: 'Planovi i pretplate' }),
      t2: t('journal.lockedBody', { defaultValue: 'Dnevnik je dostupan od Premium plana.' }),
    },
    lucid: {
      t1: t('common.membership.title', { defaultValue: 'Planovi i pretplate' }),
      t2: t('lucid.lockedBody', { defaultValue: 'Trening lucidnog je dostupan na PRO planu.' }),
    },
    media: {
      t1: t('common.membership.title', { defaultValue: 'Planovi i pretplate' }),
      t2: t('media.lockedBody', { defaultValue: 'Multimedija je dostupna na PRO planu.' }),
    },
  };

  const { t1, t2 } = titles[toastKey] || titles.journal;
  Toast.show({ type: 'info', text1: t1, text2: t2, position: 'bottom' });

  const last = navigation?.getState?.()?.routes?.slice?.(-1)?.[0]?.name;
  if (last !== 'Plans') navigation?.navigate?.('Plans');

  return false;
}
