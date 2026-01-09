// Custom hook for easy translation usage across the app
// This hook wraps useLanguage and provides convenience functions

import { useLanguage } from '../contexts/LanguageContext';

export const useTranslation = () => {
  const { t, language, setLanguage, isRTL } = useLanguage();

  // Helper function for conditional text based on language
  const getText = (englishText, arabicKey) => {
    if (language === 'ar' && arabicKey) {
      return t(arabicKey);
    }
    return englishText;
  };

  // Helper to get RTL class
  const rtlClass = isRTL ? 'rtl' : 'ltr';
  
  // Helper for direction attribute
  const dir = isRTL ? 'rtl' : 'ltr';

  return {
    t,
    getText,
    language,
    setLanguage,
    isRTL,
    rtlClass,
    dir
  };
};
