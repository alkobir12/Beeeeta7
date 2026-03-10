import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { ChevronsLeft, ChevronsRight, Eye, EyeOff, Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTranslation } from 'react-i18next';
import AbuFahadFloatingChat from './AbuFahadFloatingChat';
import FinanceAlertsWidget from './FinanceAlertsWidget';
import ChatWidget from './ChatWidget';
import { Toaster } from './ui/toaster';
import { FontSizeControls } from './FontSizeControls';



const Layout = ({ pageTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ui.sidebarCollapsed') === 'true';
    } catch (error) {
      return false;
    }
  });
  const [desktopSidebarHidden, setDesktopSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem('ui.sidebarHidden') === 'true';
    } catch (error) {
      return false;
    }
  });
  const { t } = useTranslation();

  useEffect(() => {
    localStorage.setItem('ui.sidebarCollapsed', String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('ui.sidebarHidden', String(desktopSidebarHidden));
  }, [desktopSidebarHidden]);

  const contentOffset = useMemo(() => {
    if (desktopSidebarHidden) return '0px';
    return desktopSidebarCollapsed ? '132px' : '322px';
  }, [desktopSidebarCollapsed, desktopSidebarHidden]);

  const toggleDesktopCollapse = () => {
    if (desktopSidebarHidden) {
      setDesktopSidebarHidden(false);
    }
    setDesktopSidebarCollapsed((prev) => !prev);
  };

  const showDesktopSidebar = () => setDesktopSidebarHidden(false);
  const hideDesktopSidebar = () => setDesktopSidebarHidden(true);
  const desktopDockLeft = desktopSidebarHidden ? '16px' : desktopSidebarCollapsed ? '148px' : '338px';

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
        isCollapsed={desktopSidebarCollapsed}
        isHidden={desktopSidebarHidden}
        onToggleCollapse={toggleDesktopCollapse}
        onHide={hideDesktopSidebar}
      />

      <div
        className="fixed top-3 left-3 z-50 flex items-center gap-2 rounded-[22px] border border-white/10 bg-slate-950/82 px-2 py-2 shadow-2xl shadow-black/35 backdrop-blur-2xl lg:hidden"
        data-testid="mobile-display-dock"
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-100 transition-colors hover:bg-white/12"
          aria-label="Open Menu"
          data-testid="mobile-sidebar-open-button"
        >
          <Menu size={18} className="text-foreground" />
        </button>
        <FontSizeControls compact minimal testIdPrefix="mobile-font-size" />
      </div>

      <div
        className="hidden lg:flex fixed top-4 z-50 items-center gap-2 rounded-[22px] border border-white/10 bg-slate-950/80 px-2 py-2 shadow-2xl shadow-black/35 backdrop-blur-2xl"
        style={{ left: desktopDockLeft }}
        data-testid="desktop-display-dock"
      >
        {!desktopSidebarHidden && (
          <button
            type="button"
            onClick={toggleDesktopCollapse}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-100 transition-all hover:bg-white/12"
            data-testid="desktop-sidebar-collapse-button"
            title={desktopSidebarCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          >
            {desktopSidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        )}

        <button
          type="button"
          onClick={desktopSidebarHidden ? showDesktopSidebar : hideDesktopSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-100 transition-all hover:bg-white/12"
          data-testid={desktopSidebarHidden ? 'desktop-sidebar-show-button' : 'desktop-sidebar-visibility-button'}
          title={desktopSidebarHidden ? 'إظهار القائمة' : 'إخفاء القائمة'}
        >
          {desktopSidebarHidden ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        <FontSizeControls compact minimal testIdPrefix="desktop-font-size" />
      </div>
      
      {/* Main Content */}
      <main className="content-area" style={{ backgroundColor: 'transparent', position: 'relative', zIndex: 10, '--content-offset': contentOffset }}>
        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden sticky top-0 z-40 mb-4 rounded-[20px] border border-white/10 bg-slate-950/88 px-16 py-3 shadow-xl shadow-black/25 backdrop-blur-xl">
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-bold text-white">{pageTitle || t('app.dashboard')}</h1>
          </div>
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
