import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationAR from './locales/ar.json';
import translationEN from './locales/en.json';

const resources = {
  ar: {
    translation: translationAR
  },
  en: {
    translation: translationEN
  }
};

// Read preferred language from localStorage if available
const savedLng = (typeof window !== 'undefined' && localStorage.getItem('language')) || 'ar';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    lng: savedLng,
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

// Expose to window so existing code (Settings.jsx) can call window.i18n.changeLanguage
if (typeof window !== 'undefined') {
  window.i18n = i18n;
  // Ensure document direction reflects current language immediately
  document.documentElement.dir = savedLng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = savedLng;
}

export default i18n;
