import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LanguageToggleButton = ({ collapsed = false }) => {
  const { i18n } = useTranslation();

  const handleToggle = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    console.log('🔄 Toggling language:', i18n.language, '→', newLang);
    localStorage.setItem('language', newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={handleToggle}
      className={`sidebar-item w-full hover:bg-white/5 ${collapsed ? '!justify-center !px-0' : 'justify-between'}`}
      title={i18n.language === 'ar' ? 'التبديل إلى الإنجليزية' : 'التبديل إلى العربية'}
      data-testid="language-toggle-button"
    >
      {collapsed ? (
        <span className="flex items-center justify-center text-slate-200">
          <Globe size={18} className="text-slate-200" />
        </span>
      ) : (
        <>
          <span className="flex items-center gap-3">
            <Globe size={18} className="text-gray-500" />
            <span>{i18n.language === 'ar' ? 'English' : 'عربي'}</span>
          </span>
          <span className="text-xs text-gray-500">
            {i18n.language === 'ar' ? 'EN' : 'AR'}
          </span>
        </>
      )}
    </button>
  );
};

export default LanguageToggleButton;
