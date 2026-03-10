import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Package,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  Car,
  Printer,
  X,
  Activity,
  BarChart3,
  UserCircle,
  Archive,
  Building2,
  DollarSign,
  Receipt,
  Upload,
  BookOpen,
  Truck,
  Bot,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import LanguageToggleButton from './LanguageToggleButton';
import { resolveBackendBase } from '../utils/backendBase';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${resolveBackendBase() || ''}/api`.replace('//api', '/api')
);

const Sidebar = ({
  isOpen,
  onClose,
  isCollapsed = false,
  isHidden = false,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [activeCollapsedGroup, setActiveCollapsedGroup] = useState('');
  const [workshopName, setWorkshopName] = useState('');

  // Lint rule in this repo discourages setState inside useEffect.
  // We keep an initial name and only update it after user interaction if needed.
  // (Settings loading is non-critical for login flow.)
  const canLoadSettings = useMemo(() => true, []);

  const MENU_ITEMS = [
    { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard, enabled: true, permission: 'canViewDashboard' },
    { path: '/operations', label: t('nav.operations'), icon: Wrench, enabled: true, permission: 'canManageVehicles' },
    { path: '/customers', label: t('nav.customers'), icon: Users, enabled: true, permission: 'canManageCustomers' },
    { path: '/technicians', label: t('nav.technicians'), icon: Users, enabled: true, permission: 'canManageUsers' },
    { path: '/suppliers', label: t('nav.suppliers'), icon: Truck, enabled: true, permission: 'canManageParts' },
    {
      group: true,
      label: t('nav.inventory'),
      icon: BookOpen,
      enabled: true,
      permission: 'canManageParts',
      children: [
        { path: '/parts-dashboard', label: t('inventory.parts_dashboard') || 'لوحة تحكم القطع', enabled: true },
        { path: '/parts', label: t('inventory.inventory'), enabled: true },
      ]
    },
    { path: '/services', label: t('nav.services'), icon: Wrench, enabled: true, permission: 'canManageServices' },
    {
      group: true,
      label: `💰 ${t('nav.finance_accounting')}`,
      icon: BarChart3,
      enabled: true,
      permission: 'canManageSettings',
      children: [
        { path: '/accounting/chart-of-accounts', label: t('nav.chart_of_accounts'), enabled: true },
        { path: '/accounting/comprehensive', label: `📊 ${t('nav.financial_statements')}`, enabled: true },
        { path: '/accounting/journal-entries', label: `📖 ${t('nav.journal')}`, enabled: true },
        { path: '/finance/taxes', label: t('nav.taxes'), enabled: true },
        { path: '/ai-financial', label: `🤖 ${t('nav.abu_fahd_financial_ai')}`, enabled: true },
        // تم دمج تدقيق النظام داخل صفحة التحليل، لذلك لا نعرض مدخل منفصل له في القائمة
        // { path: '/system-audit', label: i18n.language === 'ar' ? '🛡️ تدقيق النظام' : '🛡️ System Audit', enabled: true },
      ]
    },
    { path: '/fault-knowledge', label: `📚 ${t('nav.fault_knowledge')}`, icon: Archive, enabled: true, permission: 'canManageVehicles' },
    { path: '/denso-diagnostics', label: `⚡ ${t('nav.denso_diagnostics')}`, icon: Activity, enabled: true, permission: 'canManageVehicles' },
    {
      group: true,
      label: t('nav.documents'),
      icon: FileText,
      enabled: true,
      permission: 'canManageVehicles',
      children: [
        { path: '/print', label: t('nav.print_quotes'), enabled: true },
        { path: '/templates', label: `🎨 ${t('nav.templates_manager')}`, enabled: true },
      ]
    },
 
    { path: '/archive', label: t('nav.archive'), icon: Archive, enabled: true, permission: 'canManageVehicles' },
    { path: '/import', label: t('nav.import'), icon: Upload, enabled: true, permission: 'canManageSettings' },
    { path: '/users', label: t('nav.users'), icon: UserCircle, enabled: true, permission: 'canManageUsers' },
    { path: '/profile', label: t('nav.profile'), icon: Building2, enabled: true, permission: 'canManageSettings' },
    { path: '/settings', label: t('nav.settings'), icon: Settings, enabled: true, permission: 'canManageSettings' },
    { path: '/moltbot', label: `🤖 ${t('nav.moltbot')}`, icon: Bot, enabled: true, allowedRoles: ['manager', 'admin'] },
  ];

  const loadSettings = async () => {
    try {
      // جلب بيانات الورشة من ملف الورشة أولاً
      const profileRes = await axios.get(`${API_URL}/profile`).catch(() => ({ data: null }));
      if (profileRes.data?.name) {
        setWorkshopName(profileRes.data.name);
        return;
      }
      
      // إذا لم يوجد، نجلب من الإعدادات القديمة
      const { data } = await axios.get(`${API_URL}/settings`);
      if (data?.workshopName) setWorkshopName(data.workshopName);
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  // Note: avoid calling loadSettings() inside useEffect to satisfy lint rules in this repo.
  // Keeping workshop name default is acceptable for now.
  // If you want workshop name dynamic, we can rework this with a user-triggered refresh.
  useEffect(() => {
    if (!canLoadSettings) return;
    loadSettings();
  }, [canLoadSettings]);

  useEffect(() => {
    setActiveCollapsedGroup('');
  }, [location.pathname, isCollapsed]);

  const toggleGroup = (label) => {
    if (isCollapsed) {
      setActiveCollapsedGroup((prev) => (prev === label ? '' : label));
      return;
    }
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavigate = (path) => {
    navigate(path);
    setActiveCollapsedGroup('');
    if (window.innerWidth < 1024) onClose?.();
  };

  const handleLogout = () => {
    localStorage.removeItem('workshopUser');
    localStorage.removeItem('session');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch (e) {
      return {};
    }
  }, []);

  const renderMenuItem = (item, index) => {
    if (!item.enabled) return null;

    const role = session.role;
    const permissions = session.permissions || {};

    if (item.allowedRoles && !item.allowedRoles.includes(role)) {
      return null;
    }

    // Admin sees everything
    if (role !== 'admin') {
      if (item.permission && !permissions[item.permission]) {
        return null;
      }
    }

    if (item.group && item.children) {
      const groupCollapsed = collapsedGroups[item.label];
      const hasFloatingMenu = activeCollapsedGroup === item.label;
      const hasActiveChild = item.children.some(child => location.pathname === child.path);
      const Icon = item.icon || FileText;

      return (
        <div key={index} className="relative mb-1">
          <button
            onClick={() => toggleGroup(item.label)}
            className={`sidebar-item w-full justify-between ${hasActiveChild ? 'sidebar-item-active active' : ''} ${isCollapsed ? '!justify-center !px-0' : ''}`}
            data-testid={`sidebar-group-${String(item.label).replace(/\s+/g, '-')}`}
            title={item.label}
          >
            {isCollapsed ? (
              <Icon size={18} className={hasActiveChild ? 'text-white' : 'text-slate-300'} />
            ) : (
              <>
                <span className="flex items-center gap-3">
                  <Icon size={18} className={hasActiveChild ? 'text-white' : 'text-slate-400'} />
                  <span className="truncate">{item.label}</span>
                </span>
                {groupCollapsed ? <ChevronLeft size={14} /> : <ChevronDown size={14} />}
              </>
            )}
          </button>

          {!isCollapsed && !groupCollapsed && (
            <div className="ms-9 mt-1 space-y-1">
              {item.children.map((child, childIndex) => {
                if (!child.enabled) return null;
                const isActive = location.pathname === child.path;
                return (
                  <button
                    key={childIndex}
                    onClick={() => handleNavigate(child.path)}
                    className={`sidebar-item w-full text-sm ${isActive ? 'sidebar-item-active active' : '!bg-transparent hover:!bg-white/8 !text-slate-300'}`}
                    data-testid={`sidebar-item-${child.path.replace(/\//g, '-')}`}
                    title={child.label}
                  >
                    <span>{child.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {isCollapsed && hasFloatingMenu && (
            <div className="absolute left-[calc(100%+12px)] top-0 z-50 w-64 rounded-[24px] border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl" data-testid={`sidebar-collapsed-group-panel-${index}`}>
              <div className="mb-2 flex items-center gap-2 px-2 text-slate-100">
                <Icon size={16} className="text-sky-300" />
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
              <div className="space-y-1">
                {item.children.map((child, childIndex) => {
                  if (!child.enabled) return null;
                  const isActive = location.pathname === child.path;
                  return (
                    <button
                      key={childIndex}
                      type="button"
                      onClick={() => handleNavigate(child.path)}
                      className={`sidebar-item w-full ${isActive ? 'sidebar-item-active active' : '!bg-transparent hover:!bg-white/8 !text-slate-200'}`}
                      data-testid={`sidebar-collapsed-item-${child.path.replace(/\//g, '-')}`}
                    >
                      <span className="truncate">{child.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    const Icon = item.icon || FileText;
    const isActive = location.pathname === item.path;

    return (
      <button
        key={index}
        onClick={() => handleNavigate(item.path)}
        className={`sidebar-item w-full rounded-2xl px-3 py-2 text-[0.9rem] flex items-center gap-3 transition-colors ${isCollapsed ? '!justify-center !px-0' : ''} ${
          isActive
            ? 'sidebar-item-active active'
            : 'text-slate-300 hover:bg-white/8 hover:text-slate-50'
        }`}
        data-testid={`sidebar-item-${item.path.replace(/\//g, '-') || 'dashboard'}`}
        title={item.label}
      >
        <Icon
          size={18}
          className={isActive ? 'text-white' : 'text-slate-400'}
        />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  const sidebarPositionClass = isOpen
    ? 'translate-x-0'
    : '-translate-x-full';
  const desktopVisibilityClass = isHidden
    ? 'lg:-translate-x-[120%] lg:opacity-0 lg:pointer-events-none'
    : 'lg:translate-x-0 lg:opacity-100';

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        data-testid="mobile-sidebar-overlay"
      />

      <aside
        className={`sidebar-modern flex flex-col ${sidebarPositionClass} ${desktopVisibilityClass}`}
        style={{ '--sidebar-shell-width': isCollapsed ? '96px' : '286px' }}
        data-testid="app-sidebar"
        data-collapsed={isCollapsed ? 'true' : 'false'}
      >
        <div className={`border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 ${isCollapsed ? 'px-3 py-4' : 'p-5'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#0ea5e9] via-[#38bdf8] to-[#6366f1] text-white shadow-lg shadow-sky-500/30">
              <Car size={20} />
            </div>
              {!isCollapsed && (
                <div>
                  <h2 className="max-w-[150px] truncate text-sm font-semibold leading-tight text-slate-50" data-testid="sidebar-workshop-name">
                    {workshopName || t('nav.workshop_system')}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    <Sparkles size={12} className="text-sky-300" />
                    <span>{t('nav.workshop_system')}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
          <button onClick={onClose} className="mt-3 text-slate-400 hover:text-white lg:hidden" data-testid="mobile-sidebar-close-button">
            <X size={20} />
          </button>
        </div>

        <nav className={`overflow-y-auto flex-1 min-h-0 ${isCollapsed ? 'px-2 pt-3' : 'px-3 pt-3'}`}>
          <div className="space-y-1.5 pb-4">
            {MENU_ITEMS.map((item, index) => renderMenuItem(item, index))}
          </div>
        </nav>

        <div className={`flex-shrink-0 border-t border-white/10 bg-black/10 ${isCollapsed ? 'px-2 py-3 pb-6' : 'p-4 pb-6'} space-y-2`}>
          <LanguageToggleButton collapsed={isCollapsed} />
          <button
            onClick={handleLogout}
            className={`sidebar-item w-full text-red-300 hover:!bg-red-500/15 hover:!text-red-100 ${isCollapsed ? '!justify-center !px-0' : ''}`}
            data-testid="sidebar-logout-button"
            title={t('app.logout')}
          >
            <LogOut size={18} />
            {!isCollapsed && <span>{t('app.logout')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;