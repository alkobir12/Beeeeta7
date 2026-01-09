import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../translations';
import { englishTexts } from '../constants/englishTexts';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // الكشف التلقائي عن لغة المتصفح/الجهاز
  const detectLanguage = () => {
    const browserLang = navigator.language || navigator.userLanguage;
    console.log('🌍 Browser language detected:', browserLang);
    return browserLang.startsWith('ar') ? 'ar' : 'en';
  };

  const [language, setLanguage] = useState(detectLanguage());
  const [renderKey, setRenderKey] = useState(0); // Force re-render trigger

  // Handle language change
  const changeLanguage = (newLang) => {
    console.log('🔄 Changing language from', language, 'to', newLang);
    setLanguage(newLang);
    setRenderKey(prev => prev + 1); // Force all consumers to re-render
  };

  // تحديث اتجاه الصفحة عند تغيير اللغة
  useEffect(() => {
    console.log('✅ Language effect triggered:', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // دالة الترجمة
  const t = (key) => {
    if (language === 'en') {
      return englishTexts[key] || key;
    }
    
    // للعربية، نبحث في ملف الترجمات
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn('⚠️ Translation missing for key:', key, 'in language:', language);
        return key;
      }
    }
    
    return value;
  };

  const value = {
    language,
    setLanguage: changeLanguage, // Use custom change function
    t,
    isRTL: language === 'ar',
    renderKey // Expose renderKey for debugging
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
