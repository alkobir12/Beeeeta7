import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LanguageToggleButton = () => {
  const { i18n } = useTranslation();

  const handleToggle = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    console.log('🔄 Toggling language:', i18n.language, '→', newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={handleToggle}
      className="sidebar-item w-full justify-between hover:bg-gray-100"
      title={i18n.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      data-testid="language-toggle-button"
    >
      <span className="flex items-center gap-3">
        <Globe size={18} className="text-gray-500" />
        <span>{i18n.language === 'ar' ? 'English' : 'عربي'}</span>
      </span>
      <span className="text-xs text-gray-500">
        {i18n.language === 'ar' ? 'EN' : 'AR'}
      </span>
    </button>
  );
};

export default LanguageToggleButton;
