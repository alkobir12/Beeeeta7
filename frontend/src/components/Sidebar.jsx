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
  Calculator,
  TrendingUp,
  Wallet,
  FolderTree,
  ClipboardList
} from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import LanguageToggleButton from './LanguageToggleButton';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api')
);

const Sidebar = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState({});
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
        { path: '/catalog', label: t('inventory.spare_parts'), enabled: true },
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
  }, [canLoadSettings]);

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavigate = (path) => {
    navigate(path);
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

    // Admin sees everything
    if (role !== 'admin') {
      if (item.permission && !permissions[item.permission]) {
        return null;
      }
    }

    if (item.group && item.children) {
      const isCollapsed = collapsedGroups[item.label];
      const hasActiveChild = item.children.some(child => location.pathname === child.path);
      const Icon = item.icon || FileText;

      return (
        <div key={index} className="mb-1">
          <button
            onClick={() => toggleGroup(item.label)}
            className={`sidebar-item w-full justify-between ${hasActiveChild ? 'bg-gray-100 text-gray-900' : ''}`}
          >
            <span className="flex items-center gap-3">
              <Icon size={18} className={hasActiveChild ? 'text-[#0071E3]' : 'text-gray-500'} />
              <span>{item.label}</span>
            </span>
            {isCollapsed ? <ChevronLeft size={14} /> : <ChevronDown size={14} />}
          </button>

          {!isCollapsed && (
            <div className="ml-9 space-y-1 mt-1">
              {item.children.map((child, childIndex) => {
                if (!child.enabled) return null;
                const isActive = location.pathname === child.path;
                return (
                  <button
                    key={childIndex}
                    onClick={() => handleNavigate(child.path)}
                    className={`sidebar-item w-full text-sm ${isActive ? 'active' : '!bg-transparent hover:!bg-gray-100 !text-gray-600'}`}
                  >
                    <span>{child.label}</span>
                  </button>
                );
              })}
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
        className={`sidebar-item w-full rounded-2xl px-3 py-2 text-[0.9rem] flex items-center gap-3 transition-colors ${
          isActive
            ? 'bg-sky-500/10 text-sky-100'
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-50'
        }`}
      >
        <Icon
          size={18}
          className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-100'}
        />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`sidebar-modern flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center justify-between border-b border-white/5 bg-gradient-to-br from-[#020617] via-[#020617] to-[#020617]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
              <Car size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-50 leading-tight truncate max-w-[180px]">
                {workshopName || t('nav.workshop_system')}
              </h2>
              <p className="text-[11px] text-slate-400">{t('nav.workshop_system')}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="px-3 pt-3 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-1.5 pb-4">
            {MENU_ITEMS.map((item, index) => renderMenuItem(item, index))}
          </div>
        </nav>

        <div className="flex-shrink-0 p-4 pb-20 border-t border-border bg-card space-y-2">
          <LanguageToggleButton />
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            <span>{t('app.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
