import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';
import { useTranslation } from 'react-i18next';
import AbuFahadFloatingChat from './AbuFahadFloatingChat';
import FinanceAlertsWidget from './FinanceAlertsWidget';



const Layout = ({ children, pageTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="layout-main" style={{ backgroundColor: '#121314', minHeight: '100vh', position: 'relative' }}>
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <main className="content-area" style={{ backgroundColor: 'transparent', position: 'relative', zIndex: 10 }}>
        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between p-3 bg-card/95 backdrop-blur-lg rounded-xl shadow-lg border border-border mb-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 hover:bg-muted rounded-xl transition-colors"
            aria-label="Open Menu"
          >
            <Menu size={22} className="text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">{pageTitle || t('app.dashboard')}</h1>
          <div className="w-10"></div>
        </div>

        {/* Finance Alerts (Permanent Monitor) */}
        <FinanceAlertsWidget
          enabledPaths={[
            '/operations',
            '/accounting/chart-of-accounts',
            '/accounting/comprehensive',
            '/ai-financial',
          ]}
        />
        
        {/* Page Content */}
        <div className="animate-fade-in" style={{ position: 'relative', zIndex: 10 }}>
          <Outlet />
        </div>

        {/* AbuFahad Floating Chat (Finance only) */}
        <AbuFahadFloatingChat
          enabledPaths={[
            '/operations',
            '/accounting/chart-of-accounts',
            '/accounting/comprehensive',
          ]}
        />
      </main>
    </div>
  );
};

export default Layout;
