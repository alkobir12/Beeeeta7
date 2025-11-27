import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import {
  LayoutDashboard,
  Users as UsersIcon,
  Wrench,
  Brain,
  BarChart3,
  Package,
  X,
  Building2,
  Truck,
  Archive,
  FileText,
  Settings as Cog,
  BookOpen,
  Moon,
  Sun,
  LogOut,
  Menu,
  ChevronDown,
  ChevronLeft,
  Printer,
  Receipt,
  Car
} from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

// أيقونات القائمة
const PATH_ICONS = {
  '/': LayoutDashboard,
  '/customers': UsersIcon,
  '/customer-receipts': Receipt,
  '/technicians': Wrench,
  '/services': Wrench,
  '/operations': Package,
  '/analytics': BarChart3,
  '/archive': Archive,
  '/suppliers': Truck,
  '/parts': Package,
  '/templates': FileText,
  '/ai-assistant': Brain,
  '/business-accounts': Building2,
  '/profile': Building2,
  '/import': FileText,
  '/settings': Cog,
  '/invoice-templates': FileText,
  '/ceo': Brain,
  '/knowledge': BookOpen,
  '/users': UsersIcon,
  '/public-agent': Brain,
  '/quotations': FileText,
  '/print': Printer,
  '/references': BookOpen
};

// أسماء الصفحات بالعربي
const PAGE_NAMES = {
  '/': 'لوحة التحكم',
  '/customers': 'العملاء',
  '/customer-receipts': 'إيصالات العملاء',
  '/technicians': 'الفنيين',
  '/services': 'الخدمات',
  '/operations': 'العمليات',
  '/analytics': 'التحليلات',
  '/archive': 'الأرشيف',
  '/suppliers': 'الموردين',
  '/parts': 'قطع الغيار',
  '/templates': 'القوالب',
  '/ai-assistant': 'المساعد الذكي',
  '/business-accounts': 'حسابات الأعمال',
  '/profile': 'ملف الورشة',
  '/import': 'استيراد',
  '/settings': 'الإعدادات',
  '/invoice-templates': 'قوالب الفواتير',
  '/ceo': 'لوحة المدير',
  '/knowledge': 'قاعدة المعرفة',
  '/users': 'المستخدمين',
  '/public-agent': 'الوكيل الذكي',
  '/quotations': 'عروض الأسعار',
  '/print': 'طباعة المستندات',
  '/references': 'المراجع الفنية',
  '/new-vehicle': 'استقبال مركبة'
};

// القائمة الافتراضية
const DEFAULT_MENU = [
  { path: '/', label: 'لوحة التحكم', enabled: true },
  { path: '/customers', label: 'العملاء', enabled: true },
  { path: '/technicians', label: 'الفنيين', enabled: true },
  { path: '/parts', label: 'قطع الغيار', enabled: true },
  { path: '/services', label: 'الخدمات', enabled: true },
  { path: '/operations', label: 'العمليات', enabled: true },
  { 
    group: true, 
    label: 'المستندات', 
    enabled: true, 
    children: [
      { path: '/print', label: 'طباعة المستندات', enabled: true },
      { path: '/quotations', label: 'عروض الأسعار', enabled: true },
      { path: '/invoice-templates', label: 'قوالب الفواتير', enabled: true },
    ]
  },
  { 
    group: true, 
    label: 'الذكاء الاصطناعي', 
    enabled: true, 
    children: [
      { path: '/knowledge', label: 'قاعدة المعرفة', enabled: true },
      { path: '/references', label: 'المراجع الفنية', enabled: true },
      { path: '/public-agent', label: 'الوكيل الذكي', enabled: true },
    ]
  },
  { 
    group: true, 
    label: 'الإدارة', 
    enabled: true, 
    children: [
      { path: '/ceo', label: 'لوحة المدير', enabled: true },
      { path: '/analytics', label: 'التحليلات', enabled: true },
      { path: '/business-accounts', label: 'حسابات الأعمال', enabled: true },
      { path: '/users', label: 'المستخدمين', enabled: true },
    ]
  },
  { 
    group: true, 
    label: 'الإعدادات', 
    enabled: true, 
    children: [
      { path: '/profile', label: 'ملف الورشة', enabled: true },
      { path: '/settings', label: 'الإعدادات', enabled: true },
      { path: '/archive', label: 'الأرشيف', enabled: true },
    ]
  },
];

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [workshopName, setWorkshopName] = useState('ورشتي');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/settings`);
      if (data?.workshopName) {
        setWorkshopName(data.workshopName);
      }
      if (data?.menuConfig?.items) {
        setMenuItems(data.menuConfig.items);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('workshopUser');
    navigate('/login');
  };

  const renderMenuItem = (item, index) => {
    if (!item.enabled) return null;

    if (item.group && item.children) {
      const isCollapsed = collapsedGroups[item.label];
      const hasActiveChild = item.children.some(child => location.pathname === child.path);
      
      return (
        <div key={index} className="mb-2">
          <button
            onClick={() => toggleGroup(item.label)}
            className={`sidebar-item w-full justify-between ${
              hasActiveChild ? 'bg-white/5' : ''
            }`}
          >
            <span className="flex items-center gap-3">
              <Cog className="sidebar-item-icon" />
              <span>{item.label}</span>
            </span>
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {!isCollapsed && (
            <div className="mr-4 mt-1 border-r border-white/10 pr-2">
              {item.children.map((child, childIndex) => {
                if (!child.enabled) return null;
                const Icon = PATH_ICONS[child.path] || FileText;
                const isActive = location.pathname === child.path;
                
                return (
                  <button
                    key={childIndex}
                    onClick={() => handleNavigate(child.path)}
                    className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="sidebar-item-icon" />
                    <span>{child.label || PAGE_NAMES[child.path]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const Icon = PATH_ICONS[item.path] || FileText;
    const isActive = location.pathname === item.path;
    
    return (
      <button
        key={index}
        onClick={() => handleNavigate(item.path)}
        className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
      >
        <Icon className="sidebar-item-icon" />
        <span>{item.label || PAGE_NAMES[item.path]}</span>
      </button>
    );
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <aside className={`sidebar-modern ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Car size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="sidebar-title">{workshopName}</h2>
            <p className="text-xs opacity-60">نظام إدارة الورش</p>
          </div>
          <button 
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuItems.map((item, index) => renderMenuItem(item, index))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm opacity-70">الوضع</span>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="sidebar-item-icon" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
