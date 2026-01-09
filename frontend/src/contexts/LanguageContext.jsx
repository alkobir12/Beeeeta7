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
    // إذا كانت اللغة تبدأ بـ 'ar' (مثل ar, ar-SA, ar-EG)، نستخدم العربية
    return browserLang.startsWith('ar') ? 'ar' : 'en';
  };

  const [language, setLanguage] = useState(detectLanguage());

  // تحديث اتجاه الصفحة عند تغيير اللغة
  useEffect(() => {
    console.log('[LanguageProvider] Language changed to:', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    console.log('[LanguageProvider] Set dir to:', document.documentElement.dir);
  }, [language]);

  // دالة الترجمة
  const t = (key) => {
    if (language === 'en') {
      // استخدام النصوص الإنجليزية المحددة
      return englishTexts[key] || key;
    }
    
    // للعربية، نبحث في ملف الترجمات
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // إذا لم نجد الترجمة، نرجع المفتاح
        return key;
      }
    }
    
    return value;
  };

  const value = {
    language,
    setLanguage,
    t,
    isRTL: language === 'ar'
  };
  
  console.log('[LanguageProvider] Providing context:', { language, isRTL: language === 'ar' });

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
