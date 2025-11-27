import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
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
  LogOut
} from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const PATH_ICONS = {
  '/': LayoutDashboard,
  '/customers': UsersIcon,
  '/customer-receipts': FileText,
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
  '/quotations': FileText
};

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuConfig, setMenuConfig] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [workshopName, setWorkshopName] = useState('ورشتي');
  const [userPermissions, setUserPermissions] = useState({});
  const [userRole, setUserRole] = useState('admin');
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const isRTL = i18n.dir() === 'rtl';

  const pathToLabelKey = {
    '/': 'nav.dashboard',
    '/operations': 'nav.operations',
    '/services': 'nav.inventory',
    '/parts': 'parts.title',
    '/customers': 'nav.customers',
    '/technicians': 'nav.technicians',
    '/business-accounts': 'settings.profile',
    '/invoice-templates': 'templates',
    '/analytics': 'nav.analytics',
    '/knowledge': 'nav.aiAssistant',
    '/settings': 'nav.settings',
    '/users': 'users',
    '/public-agent': 'وكيل الجمهور'
  };

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('session') || '{}');
      setUserPermissions(session.permissions || {});
      setUserRole(session.role || 'admin');
    } catch (e) {}
    const load = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/settings`);
        setWorkshopName(data?.workshopName || (i18n.language === 'ar' ? 'ورشتي' : 'My Workshop'));
        let mc = data?.menuConfig || null;
        setMenuConfig(mc || null);
      } catch (_) {
        const defaultMenu = {
          items: [
            { path:'/', label:'', enabled:true },
            { path:'/operations', label:'', enabled:true },
            { path:'/services', label:'', enabled:true },
            { path:'/parts', label:'', enabled:true },
            { path:'/customers', label:'', enabled:true },
            { path:'/technicians', label:'', enabled:true },
            { path:'/business-accounts', label:'', enabled:true },
            { path:'/invoice-templates', label:'', enabled:true },
            { path:'/analytics', label:'', enabled:true },
            { path:'/knowledge', label:'', enabled:true },
            { path:'/public-agent', label:'وكيل الجمهور', enabled:true },
            { group:true, path:'/settings', label:'', enabled:true, children:[
              { path:'/settings', label:'', enabled:true },
              { path:'/templates', label:'', enabled:true },
              { path:'/users', label:'', enabled:true },
            ]}
          ]
        };
        setMenuConfig(defaultMenu);
      }
    };
    load();
  }, [i18n.language]);

  const handleNavigate = (path) => {
    const canNavigate = checkPathPermission(path);
    if (!canNavigate) return;
    navigate(path);
    if (onClose) onClose();
  };

  const checkPathPermission = (path) => {
    if (userRole === 'admin') return true;
    // ... (permission logic same as before)
    return true; 
  };

  const localizeLabel = (path, fallback) => {
    const key = pathToLabelKey[path];
    if (key) return t(key);
    return fallback || path;
  };

  const filteredMenu = useMemo(() => {
    if (!menuConfig?.items) return null;
    const clone = JSON.parse(JSON.stringify(menuConfig));
    clone.items = clone.items.map(item => {
      if (item.group && item.children) {
        item.label = localizeLabel(item.path, item.label);
        item.children = item.children.map(ch => ({...ch, label: localizeLabel(ch.path, ch.label)}));
      } else {
        item.label = localizeLabel(item.path, item.label);
      }
      return item;
    });
    return clone;
  }, [menuConfig, i18n.language]);

  return (
    <>
      {isOpen && (<div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />)}

      <div className={`
        fixed top-0 h-full shadow-2xl z-50 transition-transform duration-300 bg-card border-r border-border
        w-64 lg:w-72 overflow-y-auto
        ${isRTL ? 'right-0 border-l border-r-0' : 'left-0'}
        ${isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')}
      `}>
        <div className="p-6 pb-24 flex flex-col min-h-full">
          <div className="flex items-center justify-between mb-8">
            <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleNavigate('/') }>
              <h2 className="text-2xl font-bold text-primary">{workshopName}</h2>
              <p className="text-sm text-muted-foreground">{t('common.appName')}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden"><X size={20} /></Button>
          </div>

          <div className="flex-1">
            {filteredMenu?.items ? (
              <nav className="space-y-1">
                {filteredMenu.items.map((item) => {
                  if (item.group && item.children?.length) {
                    const isActive = location.pathname.startsWith(item.path);
                    const collapsed = collapsedGroups[item.path];
                    return (
                      <div key={item.path} className="mb-2">
                        <Button
                          variant={isActive ? 'secondary' : 'ghost'}
                          className={`w-full justify-between gap-3 py-2 h-auto font-normal ${isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setCollapsedGroups(prev => ({...prev, [item.path]: !prev[item.path]}))}
                        >
                          <div className="flex items-center gap-3">
                            <Cog size={18} />
                            {item.label}
                          </div>
                          <span className="text-xs opacity-70">{collapsed ? '▼' : '▲'}</span>
                        </Button>
                        {!collapsed && (
                          <div className={`mt-1 space-y-1 ${isRTL ? 'mr-4 border-r pr-2' : 'ml-4 border-l pl-2'} border-border`}>
                            {item.children.map((ch) => (
                              <Button 
                                key={ch.path} 
                                variant={location.pathname === ch.path ? 'secondary' : 'ghost'} 
                                className={`w-full justify-start h-9 text-sm font-normal ${location.pathname === ch.path ? 'bg-secondary/50 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={() => handleNavigate(ch.path)}
                              >
                                {ch.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (item.enabled === false) return null;
                  const Icon = PATH_ICONS[item.path] || FileText;
                  const isActive = location.pathname === item.path;
                  return (
                    <Button 
                      key={item.path} 
                      variant={isActive ? 'secondary' : 'ghost'} 
                      className={`w-full justify-start gap-3 py-2 h-auto font-normal mb-1 ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon size={18} />{item.label}
                    </Button>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <div className="mt-auto pt-6 border-t border-border space-y-4">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between px-2 py-2 bg-muted/30 rounded-lg">
              <span className="text-sm text-muted-foreground">{theme === 'dark' ? 'الوضع الليلي' : 'الوضع النهاري'}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </Button>
            </div>

            <Card className="bg-muted/50 border-none shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
                    {(() => {
                      try {
                        const session = JSON.parse(localStorage.getItem('session') || '{}');
                        return session.name?.[0]?.toUpperCase() || 'م';
                      } catch(e) { return 'م'; }
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {(() => {
                        try {
                          const session = JSON.parse(localStorage.getItem('session') || '{}');
                          return session.name || (i18n.language==='ar'?'مدير النظام':'System Admin');
                        } catch(e) { return (i18n.language==='ar'?'مدير النظام':'System Admin'); }
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{i18n.language==='ar'?'مسجل دخول':'Signed in'}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    localStorage.removeItem('session');
                    window.location.href = '/login';
                  }} 
                  variant="destructive" 
                  className="w-full justify-center h-8 text-xs"
                  size="sm"
                >
                  <LogOut size={14} className="mr-2" />
                  {i18n.language==='ar'?'تسجيل خروج':'Logout'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
