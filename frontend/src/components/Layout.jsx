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

      {desktopSidebarHidden && (
        <button
          type="button"
          onClick={showDesktopSidebar}
          className="hidden lg:flex fixed left-5 top-5 z-50 items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 shadow-2xl shadow-black/30 backdrop-blur-xl hover:bg-slate-900"
          data-testid="desktop-sidebar-show-button"
        >
          <Eye size={16} />
          <span>إظهار القائمة</span>
        </button>
      )}
      
      {/* Main Content */}
      <main className="content-area" style={{ backgroundColor: 'transparent', position: 'relative', zIndex: 10, '--content-offset': contentOffset }}>
        <div className="hidden lg:block sticky top-4 z-40 mb-5">
          <div className="glass-card flex flex-wrap items-center justify-between gap-4 px-5 py-4 border border-white/10">
            <div>
              <p className="text-xs text-slate-400">أدوات العرض</p>
              <h2 className="text-sm font-semibold text-white">تحكم سريع في الخط والقائمة الجانبية</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleDesktopCollapse}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all ${desktopSidebarHidden ? 'border-white/10 bg-white/5 text-slate-500' : 'border-white/10 bg-white/6 text-slate-100 hover:bg-white/12'}`}
                disabled={desktopSidebarHidden}
                data-testid="desktop-sidebar-collapse-button"
              >
                {desktopSidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                <span>{desktopSidebarCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}</span>
              </button>

              <button
                type="button"
                onClick={desktopSidebarHidden ? showDesktopSidebar : hideDesktopSidebar}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5 text-slate-100 transition-all hover:bg-white/12"
                data-testid="desktop-sidebar-visibility-button"
              >
                {desktopSidebarHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{desktopSidebarHidden ? 'إظهار القائمة' : 'إخفاء القائمة'}</span>
              </button>

              <FontSizeControls testIdPrefix="desktop-font-size" />
            </div>
          </div>
        </div>

        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden sticky top-0 z-50 mb-4 rounded-[22px] border border-white/10 bg-slate-950/90 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-100 transition-colors hover:bg-white/12"
              aria-label="Open Menu"
              data-testid="mobile-sidebar-open-button"
            >
              <Menu size={22} className="text-foreground" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <h1 className="truncate text-base font-bold text-white">{pageTitle || t('app.dashboard')}</h1>
              <p className="text-xs text-slate-400">إدارة العرض والقراءة</p>
            </div>
            <div className="w-11"></div>
          </div>
          <div className="mt-3 flex justify-center">
            <FontSizeControls compact testIdPrefix="mobile-font-size" />
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
