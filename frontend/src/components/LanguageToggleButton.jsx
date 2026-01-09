import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageToggleButton = () => {
  const { language, setLanguage } = useLanguage();

  const handleToggle = () => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    console.log('Language toggle clicked. Current:', language, '→ New:', newLang);
    setLanguage(newLang);
  };

  return (
    <button
      onClick={handleToggle}
      className="sidebar-item w-full justify-between hover:bg-gray-100"
      title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      data-testid="language-toggle-button"
    >
      <span className="flex items-center gap-3">
        <Globe size={18} className="text-gray-500" />
        <span>{language === 'ar' ? 'English' : 'عربي'}</span>
      </span>
      <span className="text-xs text-gray-500">
        {language === 'ar' ? 'EN' : 'AR'}
      </span>
    </button>
  );
};

export default LanguageToggleButton;
