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
  const isRTL = i18n.dir() === 'rtl';

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur border-b border-border lg:hidden">
        <Button 
          onClick={() => setSidebarOpen(true)}
          variant="ghost"
          size="icon"
          aria-label="Menu"
        >
          <Menu size={24} />
        </Button>
        <div className="flex-1" />
        <LanguageToggle />
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className={`
        transition-all duration-300 pt-4 px-4 pb-16
        ${isRTL ? 'lg:mr-72' : 'lg:ml-72'}
      `}>
        {children}
      </div>

      {/* Global z.ai Chat button - opens external assistant */}
      <ZaiChatWidget />
    </div>
  );
};

export default Layout;
