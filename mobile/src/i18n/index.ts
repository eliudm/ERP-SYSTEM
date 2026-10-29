import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../utils/storage';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './languageMap';

import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enPos from './locales/en/pos.json';

import swCommon from './locales/sw/common.json';
import swNav from './locales/sw/nav.json';
import swAuth from './locales/sw/auth.json';
import swDashboard from './locales/sw/dashboard.json';
import swPos from './locales/sw/pos.json';

import frCommon from './locales/fr/common.json';
import frNav from './locales/fr/nav.json';
import frAuth from './locales/fr/auth.json';
import frDashboard from './locales/fr/dashboard.json';
import frPos from './locales/fr/pos.json';

// i18next's init() is synchronous, but reading the last-chosen language back
// out of on-device storage is necessarily async (see `storage` in
// ../utils/storage — expo-secure-store on native, localStorage on web, both
// Promise-based). So: initialize synchronously with the 'en' default first
// (nothing renders with the wrong language flashing, since the gate in
// src/app/_layout.tsx withholds the app tree until bootstrapLanguage()
// below resolves), then switch language once the stored value is known.
i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      nav: enNav,
      auth: enAuth,
      dashboard: enDashboard,
      pos: enPos,
    },
    sw: {
      common: swCommon,
      nav: swNav,
      auth: swAuth,
      dashboard: swDashboard,
      pos: swPos,
    },
    fr: {
      common: frCommon,
      nav: frNav,
      auth: frAuth,
      dashboard: frDashboard,
      pos: frPos,
    },
  },
  ns: ['common', 'nav', 'auth', 'dashboard', 'pos'],
  defaultNS: 'common',
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/**
 * Reads the last-chosen language out of local storage and applies it.
 * Call once on app start, before rendering the provider tree, and await it
 * (see src/app/_layout.tsx) so there's no flash of the wrong language.
 * Once a user is authenticated, the tenant's `defaultLanguage` setting
 * takes over as authoritative and overrides whatever was stored here.
 */
export async function bootstrapLanguage(): Promise<void> {
  try {
    const stored = await storage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Storage unavailable — 'en' default stands for this session.
  }
}

export default i18n;
