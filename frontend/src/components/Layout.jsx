import React, { useState } from 'react';
import { Button } from './ui/button';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import LanguageToggle from './LanguageToggle';
import ZaiChatWidget from './ZaiChatWidget';
import { useTranslation } from 'react-i18next';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { i18n } = useTranslation();
  const lang = i18n.language || (typeof window !== 'undefined' && localStorage.getItem('language')) || 'ar';
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir={dir}>
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-slate-200">
        {/* Mobile Menu Button */}
        <div className="lg:hidden">
          <Button 
            onClick={() => setSidebarOpen(true)}
            className="bg-white shadow hover:shadow-md transition-all"
            size="icon"
            aria-label="Menu"
          >
            <Menu size={22} className="text-slate-700" />
          </Button>
        </div>
        <div className="flex-1" />
        <LanguageToggle />
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:mr-64 pb-16">
        {children}
      </div>
    </div>
  );
};

export default Layout;
