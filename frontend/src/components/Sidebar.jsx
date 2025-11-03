import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  LayoutDashboard,
  Car,
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
  BookOpen
} from 'lucide-react';
import axios from 'axios';

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
  '/knowledge': BookOpen,
  '/users': UsersIcon
};

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuConfig, setMenuConfig] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [workshopName, setWorkshopName] = useState('ورشتي');
  const [userPermissions, setUserPermissions] = useState({});
  const [userRole, setUserRole] = useState('admin');

  useEffect(() => {
    // Load user permissions from session
    try {
      const session = JSON.parse(localStorage.getItem('session') || '{}');
      setUserPermissions(session.permissions || {});
      setUserRole(session.role || 'admin');
    } catch (e) {
      console.error('Error loading permissions:', e);
    }
    
    const load = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/settings`);
        
        // Load workshop name
        setWorkshopName(data?.workshopName || 'ورشتي');
        
        let mc = data?.menuConfig || null;
        if (mc) {
          // Ensure Settings group contains Users and Templates
          const hasSettingsGroup = (mc.items||[]).some(it => it.path === '/settings' && it.group);
          if (!hasSettingsGroup) {
            mc.items.push({ group:true, path:'/settings', label:'الإعدادات', enabled:true, children:[
              { path:'/settings', label:'الإعدادات العامة', enabled:true },
              { path:'/templates', label:'نماذج الفواتير/التقارير', enabled:true },
              { path:'/users', label:'المستخدمون', enabled:true },
            ]});
          } else {
            const s = mc.items.find(it => it.path === '/settings' && it.group);
            const setChild = (p,l) => { if (!s.children.some(c => c.path===p)) s.children.push({path:p,label:l,enabled:true}); };
            setChild('/users','المستخدمون');
            setChild('/templates','نماذج الفواتير/التقارير');
          }
        }
        setMenuConfig(mc || null);
      } catch (_) {
        setMenuConfig(null);
      }
    };
    load();
  }, []);

  const handleNavigate = (path) => {
    // Check permissions before navigating
    const canNavigate = checkPathPermission(path);
    if (!canNavigate) {
      return; // Silently block navigation
    }
    navigate(path);
    if (onClose) onClose();
  };

  const checkPathPermission = (path) => {
    // Admin can access everything
    if (userRole === 'admin') return true;
    
    // Map paths to permissions
    const pathPermissions = {
      '/': 'canViewDashboard',
      '/customers': 'canManageCustomers',
      '/customer-receipts': 'canManageCustomers',
      '/new-vehicle': 'canManageVehicles',
      '/vehicle': 'canManageVehicles',
      '/archive': 'canManageVehicles',
      '/parts': 'canManageParts',
      '/suppliers': 'canManageParts',
      '/operations': 'canManageFinance',
      '/services': 'canManageServices',
      '/technicians': 'canManageServices',
      '/ceo': 'canAccessCEO',
      '/business-accounts': 'canAccessCEO',
      '/payroll': 'canManageFinance',
      '/settings': 'canManageSettings',
      '/templates': 'canManageSettings',
      '/users': 'canManageUsers',
      '/knowledge': 'canViewDashboard' // Everyone can access knowledge
    };
    
    const requiredPermission = pathPermissions[path];
    if (!requiredPermission) return true; // Unknown paths allowed
    
    return userPermissions[requiredPermission] === true;
  };

  const filterMenuByPermissions = (items) => {
    if (userRole === 'admin') return items; // Admin sees everything
    
    return items.filter(item => {
      if (!item.enabled) return false;
      
      if (item.group && item.children) {
        const filteredChildren = item.children.filter(ch => checkPathPermission(ch.path));
        if (filteredChildren.length === 0) return false;
        item.children = filteredChildren;
      } else {
        if (!checkPathPermission(item.path)) return false;
      }
      
      return true;
    });
  };

  const filteredMenu = useMemo(() => {
    if (!menuConfig?.items) return null;
    return {
      ...menuConfig,
      items: filterMenuByPermissions([...menuConfig.items])
    };
  }, [menuConfig, userPermissions, userRole]);

  return (
    <>
      {isOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />)}

      <div className={`fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} w-64 lg:w-72 overflow-y-auto`} dir="rtl">
        <div className="p-6 pb-24">
          <div className="flex items-center justify-between mb-8">
            <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleNavigate('/') }>
              <h2 className="text-2xl font-bold text-slate-800">{workshopName}</h2>
              <p className="text-sm text-slate-500">نظام الإدارة</p>
              {/* Only show CEO button if user has permission */}
              {(userRole === 'admin' || userPermissions.canAccessCEO) && (
                <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={(e) => { e.stopPropagation(); handleNavigate('/ceo'); }}>المدير (CEO)</Button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden"><X size={20} /></Button>
          </div>

          {filteredMenu?.items ? (
            <nav className="space-y-1">
              {filteredMenu.items.map((item) => {
                if (item.group && item.children?.length) {
                  const isActive = location.pathname.startsWith(item.path);
                  const collapsed = collapsedGroups[item.path];
                  return (
                    <div key={item.path}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        className={`w-full justify-between gap-3 py-3 text-sm ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
                        onClick={() => setCollapsedGroups(prev => ({...prev, [item.path]: !prev[item.path]}))}
                        title={item.label}
                      >
                        <div className="flex items-center gap-3">
                          <Cog size={18} />
                          {item.label}
                        </div>
                        <span className="text-xs opacity-80">{collapsed ? '▼' : '▲'}</span>
                      </Button>
                      {!collapsed && (
                        <div className="mr-4 mt-1 space-y-1">
                          {item.children.map((ch) => (
                            <Button key={ch.path} variant={location.pathname === ch.path ? 'default' : 'ghost'} className={`w-full justify-start ${location.pathname === ch.path ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`} onClick={() => handleNavigate(ch.path)} title={ch.label}>{ch.label}</Button>
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
                  <Button key={item.path} variant={isActive ? 'default' : 'ghost'} className={`w-full justify-start gap-3 py-2 text-sm transition-all duration-200 ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'}`} onClick={() => handleNavigate(item.path)} title={item.label}>
                    <Icon size={18} />{item.label}
                  </Button>
                );
              })}
            </nav>
          ) : null}

          <div className="mt-8">
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 p-4">
              <p className="text-sm text-slate-800 mb-3 font-medium">اختصارات</p>
              <div className="space-y-2">
                <Button onClick={() => handleNavigate('/settings')} variant="outline" className="w-full justify-start" title="إعدادات النظام والقوائم"><Cog className="ml-2" size={18} />الإعدادات</Button>
                <Button onClick={() => handleNavigate('/knowledge')} className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"><BookOpen className="ml-2" size={18} />إدارة المعرفة</Button>
              </div>
            </Card>
            
            {/* User Info & Logout */}
            <Card className="mt-4 bg-gradient-to-br from-slate-50 to-slate-100">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                      {(() => {
                        try {
                          const session = JSON.parse(localStorage.getItem('session') || '{}');
                          return session.name?.[0]?.toUpperCase() || 'م';
                        } catch(e) {
                          return 'م';
                        }
                      })()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {(() => {
                          try {
                            const session = JSON.parse(localStorage.getItem('session') || '{}');
                            return session.name || 'مدير النظام';
                          } catch(e) {
                            return 'مدير النظام';
                          }
                        })()}
                      </p>
                      <p className="text-xs text-slate-500">مسجل دخول</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      localStorage.removeItem('session');
                      window.location.href = '/login';
                    }} 
                    variant="destructive" 
                    className="w-full justify-center"
                    size="sm"
                  >
                    تسجيل خروج
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
