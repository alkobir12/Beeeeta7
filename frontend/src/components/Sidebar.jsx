import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { 
  LayoutDashboard, 
  Car, 
  Users, 
  Wrench, 
  Brain, 
  BarChart3,
  Package,
  X,
  Building2,
  Truck,
  Archive,
  FileText
} from 'lucide-react';

import axios from 'axios';
  const [menuConfig, setMenuConfig] = React.useState(null);
  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/settings`);
        setMenuConfig(data?.menuConfig || null);
      } catch (_) {
        setMenuConfig(null);
      }
    };
    load();
  }, []);

const API_URL = import.meta.env.REACT_APP_BACKEND_URL + '/api';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
    { path: '/archive', label: 'أرشيف المركبات', icon: Archive },
    { path: '/services', label: 'الخدمات', icon: Wrench },
    { path: '/templates', label: 'النماذج', icon: FileText },
    { path: '/analytics', label: 'التحليلات', icon: BarChart3 },
    { path: '/parts', label: 'المخزون', icon: Package },
    { path: '/suppliers', label: 'الموردين', icon: Truck },
    { path: '/customers', label: 'العملاء', icon: Users },
    { path: '/technicians', label: 'الفنيين', icon: Wrench },
    { path: '/ai-assistant', label: 'المساعد الذكي', icon: Brain },
    { path: '/profile', label: 'ملف الورشة', icon: Building2 },
    { path: '/business-accounts', label: 'الفروع', icon: Building2 },
    { path: '/operations', label: 'عمليات شراء/بيع', icon: Package },
    { path: '/customer-receipts', label: 'توريد العملاء', icon: FileText },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } w-64`}
        dir="rtl"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleNavigate('/profile')}
            >
              <h2 className="text-2xl font-bold text-slate-800">ورشتي</h2>
              <p className="text-sm text-slate-500">نظام الإدارة</p>
              <Button 
                variant="outline"
                size="sm"
                className="mt-3 w-full justify-center"
          {/* Dynamic Menu based on settings */}
          {menuConfig?.items ? (
            <nav className="space-y-2">
              {menuConfig.items.map((item) => {
                if (item.group && item.children?.length) {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <div key={item.path}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        className={`w-full justify-start gap-3 py-6 text-base ${isActive ? 'bg-gradient-to-l from-blue-600 to-blue-700 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-700'}`}
                        onClick={() => handleNavigate(item.path)}
                      >
                        <Package size={20} />
                        {item.label}
                      </Button>
                      <div className="mr-6 mt-1 space-y-1">
                        {item.children.map((ch) => (
                          <Button key={ch.path} variant={location.pathname===ch.path?'default':'ghost'} className={`w-full justify-start ${location.pathname===ch.path?'bg-blue-600 text-white':'text-slate-700 hover:bg-slate-100'}`} onClick={() => handleNavigate(ch.path)}>
                            {ch.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (item.enabled === false) return null;
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 py-6 text-base transition-all duration-200 ${isActive ? 'bg-gradient-to-l from-blue-600 to-blue-700 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-700'}`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          ) : (
            <nav className="space-y-2">

                onClick={(e) => { e.stopPropagation(); handleNavigate('/ceo'); }}
              >
                المدير (CEO)
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="lg:hidden"
            >
              <X size={20} />
            </Button>
          </div>

          {/* Menu Items (fallback) */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? 'default' : 'ghost'}
                  className={`w-full justify-start gap-3 py-6 text-base transition-all duration-200 ${isActive ? 'bg-gradient-to-l from-blue-600 to-blue-700 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-700'}`}
                  onClick={() => handleNavigate(item.path)}
                >
                  <Icon size={20} />
                  {item.label}
                </Button>
              );
            })}
          </nav>
          )}

          {/* Quick Action */}
          <div className="mt-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 p-4">
              <p className="text-sm text-blue-800 mb-3 font-medium">إضافة سريعة</p>
              <Button 
                onClick={() => handleNavigate('/new-vehicle')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                <Car className="ml-2" size={18} />
                مركبة جديدة
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;