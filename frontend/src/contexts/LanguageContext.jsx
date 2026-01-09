import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
    console.log('Browser language detected:', browserLang);
    // إذا كانت اللغة تبدأ بـ 'ar' (مثل ar, ar-SA, ar-EG)، نستخدم العربية
    return browserLang.startsWith('ar') ? 'ar' : 'en';
  };

  const [language, setLanguage] = useState(detectLanguage());

  // تحديث اتجاه الصفحة عند تغيير اللغة
  useEffect(() => {
    console.log('Language changed to:', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // دالة الترجمة - معتمدة على language state
  const t = useCallback((key) => {
    if (language === 'en') {
      // استخدام النصوص الإنجليزية المحددة
      const translation = englishTexts[key] || key;
      return translation;
    }
    
    // للعربية، نبحث في ملف الترجمات
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // إذا لم نجد الترجمة، نرجع المفتاح
        console.warn('Translation missing for key:', key, 'in language:', language);
        return key;
      }
    }
    
    return value;
  }, [language]); // CRITICAL: Re-create function when language changes

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    isRTL: language === 'ar'
  }), [language, t]); // CRITICAL: Re-create context value when language or t changes

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
