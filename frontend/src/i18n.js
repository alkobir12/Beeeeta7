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

// Get detected language from browser/device
const getDetectedLanguage = () => {
  // First check if user has a saved preference
  const savedLng = typeof window !== 'undefined' && localStorage.getItem('language');
  if (savedLng) return savedLng;
  
  // Detect from browser/device language
  const browserLang = navigator.language || navigator.userLanguage || '';
  // Check if browser language starts with 'ar' (Arabic)
  if (browserLang.startsWith('ar')) return 'ar';
  // Check if browser language starts with 'en' (English)
  if (browserLang.startsWith('en')) return 'en';
  
  // Default to Arabic if not detected
  return 'ar';
};

const detectedLng = typeof window !== 'undefined' ? getDetectedLanguage() : 'ar';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    lng: detectedLng,
    debug: false,
    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language preference
      caches: ['localStorage'],
      lookupLocalStorage: 'language',
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false, // Prevents issues with SSR and Safari
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'span'],
    }
  });

// Apply direction and language to document
const applyLanguageDirection = (lang) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
};

// Apply initial direction
applyLanguageDirection(detectedLng);

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  applyLanguageDirection(lng);
  localStorage.setItem('language', lng);
});

// Expose to window
if (typeof window !== 'undefined') {
  window.i18n = i18n;
}

export default i18n;
