import React, { useEffect, useState } from 'react';
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
  Bot
} from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const Sidebar = ({ isOpen, onClose }) => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [workshopName, setWorkshopName] = useState('الورشة');

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
    { path: '/diesel-expert', label: '🔧 خبير الديزل', icon: Bot, enabled: true, permission: 'canManageVehicles' },
    { path: '/denso-diagnostics', label: '⚡ تشخيص دينسو', icon: Activity, enabled: true, permission: 'canManageVehicles' },
    {
      group: true,
      label: t('nav.documents'),
      icon: FileText,
      enabled: true,
      permission: 'canManageVehicles',
      children: [
        { path: '/print', label: t('buttons.print'), enabled: true },
        { path: '/quotations', label: 'عروض الأسعار', enabled: true },
        { path: '/templates', label: 'القوالب', enabled: true },
        { path: '/invoice-templates', label: 'قوالب الفواتير', enabled: true },
      ]
    },
    {
      group: true,
      label: t('nav.finance'),
      icon: Building2,
      enabled: true,
      permission: 'canManageFinance',
      children: [
        { path: '/analytics', label: t('reports_module.analytics'), enabled: true },
        { path: '/ceo', label: 'لوحة المدير', enabled: true },
        { path: '/payroll', label: 'الرواتب', enabled: true },
        { path: '/business-accounts', label: 'حسابات الأعمال', enabled: true },
        { path: '/customer-receipts', label: 'إيصالات العملاء', enabled: true },
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

  useEffect(() => {
    loadSettings();
  }, []);

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) onClose?.();
  };

  const handleLogout = () => {
    localStorage.removeItem('workshopUser');
    navigate('/login');
  };

  const [session, setSession] = useState({});

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('session') || '{}');
      setSession(s);
    } catch (e) {
      setSession({});
    }
  }, []); // Run once on mount

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
        className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
      >
        <Icon size={18} className={`icon ${isActive ? 'text-white' : 'text-gray-500'}`} />
        <span>{item.label}</span>
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

      <aside className={`sidebar-modern ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0071E3] to-[#00C7BE] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Car size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{workshopName}</h2>
              <p className="text-xs text-gray-500">Workshop Management System</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-500">
            <X size={20} />
          </button>
        </div>

        <nav className="px-4 pb-4 overflow-y-auto h-[calc(100vh-140px)]">
          <div className="space-y-1">
            {MENU_ITEMS.map((item, index) => renderMenuItem(item, index))}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white/50 backdrop-blur-md space-y-2">
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
