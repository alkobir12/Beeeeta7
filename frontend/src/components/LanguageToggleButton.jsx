import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageToggleButton = () => {
  const { language, setLanguage, isRTL } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
      title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Globe size={16} />
      <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
};

export default LanguageToggleButton;
