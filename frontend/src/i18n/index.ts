import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGE_STORAGE_KEY } from './languageMap';

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

const storedLanguage = (() => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, nav: enNav, auth: enAuth, dashboard: enDashboard, pos: enPos },
    sw: { common: swCommon, nav: swNav, auth: swAuth, dashboard: swDashboard, pos: swPos },
    fr: { common: frCommon, nav: frNav, auth: frAuth, dashboard: frDashboard, pos: frPos },
  },
  ns: ['common', 'nav', 'auth', 'dashboard', 'pos'],
  defaultNS: 'common',
  lng: storedLanguage ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
