import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translations from './translations';
import { englishTexts } from './constants/englishTexts';

// Convert flat englishTexts to nested structure
const englishTranslations = {};
Object.keys(englishTexts).forEach(key => {
  const keys = key.split('.');
  let current = englishTranslations;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = englishTexts[key];
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: englishTranslations },
      ar: { translation: translations }
    },
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],

    detection: {
      // Default to Arabic unless user explicitly changes
      order: ['localStorage'],
      lookupLocalStorage: 'language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

// Set RTL/LTR based on language
i18n.on('languageChanged', (lng) => {
  console.log('🔄 i18next language changed to:', lng);
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

// Set initial direction
document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = i18n.language;

console.log('✅ i18next initialized with language:', i18n.language);

export default i18n;
