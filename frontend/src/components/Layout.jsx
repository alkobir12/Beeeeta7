import React, { useState, Suspense } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTranslation } from 'react-i18next';
import AbuFahadFloatingChat from './AbuFahadFloatingChat';
import FinanceAlertsWidget from './FinanceAlertsWidget';
import ChatWidget from './ChatWidget';
import { Toaster } from './ui/toaster';



const Layout = ({ pageTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="layout-main" style={{ backgroundColor: '#121314', minHeight: '100vh', position: 'relative' }}>
      {/* Animated Background */}
      {process.env.NODE_ENV === 'production' ? null : <AnimatedBackground />}
      <div
        className="pointer-events-none"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(1200px circle at 20% 10%, rgba(168,85,247,0.18), transparent 45%), radial-gradient(900px circle at 80% 20%, rgba(99,102,241,0.16), transparent 50%)',
          opacity: 0.9,
          zIndex: 1,
        }}
      />
      
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
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-[50vh]">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
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
        {/* Workshop Assistant Chat Widget */}
        <ChatWidget />

      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
};

export default Layout;
