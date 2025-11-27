import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const current = i18n.language || 'ar';

  const setLang = (lng) => {
    if (lng === current) return;
    i18n.changeLanguage(lng);
    try {
      localStorage.setItem('language', lng);
    } catch (_) {}
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
    }
    // Force reload to ensure all components update
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={current === 'ar' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLang('ar')}
        title="العربية"
      >
        AR
      </Button>
      <Button
        variant={current === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLang('en')}
        title="English"
      >
        EN
      </Button>
    </div>
  );
};

export default LanguageToggle;
