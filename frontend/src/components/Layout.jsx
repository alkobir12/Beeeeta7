import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { Eye, EyeOff, Menu } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTranslation } from 'react-i18next';
import AbuFahadFloatingChat from './AbuFahadFloatingChat';
import FinanceAlertsWidget from './FinanceAlertsWidget';
import ChatWidget from './ChatWidget';
import { Toaster } from './ui/toaster';
import { hasPermission, resolveRoutePermission } from '../utils/permissions';



const Layout = ({ pageTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 1024);
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
  const location = useLocation();
  const readSession = () => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch (error) {
      return {};
    }
  };
  const [session, setSession] = useState(() => readSession());

  useEffect(() => {
    localStorage.setItem('ui.sidebarCollapsed', String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('ui.sidebarHidden', String(desktopSidebarHidden));
  }, [desktopSidebarHidden]);

  useEffect(() => {
    const handleResize = () => setIsMobileViewport(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener('storage', sync);
    window.addEventListener('sessionUpdated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('sessionUpdated', sync);
    };
  }, []);

  useEffect(() => {
    const handleSidebarPrefs = (event) => {
      const detail = event?.detail;
      if (detail && typeof detail === 'object') {
        if (typeof detail.collapsed === 'boolean') {
          setDesktopSidebarCollapsed(detail.collapsed);
        }
        if (typeof detail.hidden === 'boolean') {
          setDesktopSidebarHidden(detail.hidden);
        }
        return;
      }

      try {
        setDesktopSidebarCollapsed(localStorage.getItem('ui.sidebarCollapsed') === 'true');
        setDesktopSidebarHidden(localStorage.getItem('ui.sidebarHidden') === 'true');
      } catch (error) {
        return;
      }
    };

    window.addEventListener('ui-sidebar-preferences-changed', handleSidebarPrefs);
    return () => window.removeEventListener('ui-sidebar-preferences-changed', handleSidebarPrefs);
  }, []);

  const contentOffset = useMemo(() => {
    if (desktopSidebarHidden) return '0px';
    return desktopSidebarCollapsed ? '132px' : '322px';
  }, [desktopSidebarCollapsed, desktopSidebarHidden]);

  const toggleSidebarVisibility = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen((prev) => !prev);
      return;
    }
    setDesktopSidebarHidden((prev) => !prev);
  };

  const permissionRule = resolveRoutePermission(location.pathname);
  const canAccessRoute = !permissionRule || hasPermission(session, permissionRule.module, permissionRule.action);

  const UnauthorizedPanel = () => (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center shadow-xl shadow-black/20">
      <h2 className="text-lg font-bold text-white" data-testid="permission-denied-title">غير مصرح بالوصول</h2>
      <p className="mt-2 text-sm text-slate-300" data-testid="permission-denied-description">
        لا تملك الصلاحية لعرض هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، تواصل مع مدير النظام.
      </p>
    </div>
  );

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
      />

      <div className="fixed bottom-4 left-4 z-50 lg:bottom-6 lg:left-6" data-testid="floating-sidebar-visibility-wrapper">
        <button
          type="button"
          onClick={toggleSidebarVisibility}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/85 text-slate-100 shadow-2xl shadow-black/35 backdrop-blur-2xl transition-all hover:bg-white/12"
          data-testid={desktopSidebarHidden ? 'floating-sidebar-show-button' : 'floating-sidebar-hide-button'}
          title={isMobileViewport ? 'القائمة' : desktopSidebarHidden ? 'إظهار القائمة' : 'إخفاء القائمة'}
          aria-label={isMobileViewport ? 'Toggle Menu' : desktopSidebarHidden ? 'Show Sidebar' : 'Hide Sidebar'}
        >
          {isMobileViewport ? <Menu size={18} /> : desktopSidebarHidden ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      
      {/* Main Content */}
      <main className="content-area" style={{ backgroundColor: 'transparent', position: 'relative', zIndex: 10, '--content-offset': contentOffset }}>
        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden sticky top-0 z-40 mt-8 mb-4 rounded-[20px] border border-white/10 bg-slate-950/88 px-4 py-3 shadow-xl shadow-black/25 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-100 transition-colors hover:bg-white/12"
              aria-label="Open Menu"
              data-testid="mobile-sidebar-open-button"
            >
              <Menu size={18} className="text-foreground" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <h1 className="truncate text-sm font-bold text-white">{pageTitle || t('app.dashboard')}</h1>
            </div>
            <span className="h-9 w-9" aria-hidden="true" />
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
            {canAccessRoute ? <Outlet /> : <UnauthorizedPanel />}
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
