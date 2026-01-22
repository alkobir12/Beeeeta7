'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  DollarSign,
  BarChart3,
  Package,
  Users,
  Wrench,
  Calendar,
  Settings,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calculator,
  FolderTree,
  Wallet,
  BookOpen,
  Receipt,
  LogOut,
  ClipboardList,
} from 'lucide-react';

interface SubMenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  submenu?: boolean;
  items?: SubMenuItem[];
}

const Sidebar = () => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['المحاسبة', 'المالية']);

  const navigationItems: NavItem[] = [
    {
      title: 'لوحة التحكم',
      href: '/',
      icon: Home,
    },
    {
      title: 'المحاسبة',
      icon: BarChart3,
      submenu: true,
      items: [
        { title: 'دليل الحسابات', href: '/accounting/chart-of-accounts', icon: FolderTree },
        { title: 'القيود اليومية', href: '/accounting/journal-entries', icon: ClipboardList },
        { title: 'الميزانية العمومية', href: '/accounting/balance-sheet', icon: BarChart3 },
        { title: 'قائمة الدخل', href: '/accounting/income-statement', icon: TrendingUp },
        { title: 'التدفقات النقدية', href: '/accounting/cash-flow', icon: Wallet },
        { title: 'ميزان المراجعة', href: '/accounting/trial-balance', icon: BookOpen },
      ],
    },
    {
      title: 'المالية',
      icon: DollarSign,
      submenu: true,
      items: [
        { title: 'الفواتير', href: '/finance/invoices', icon: Receipt },
        { title: 'الضرائب', href: '/finance/taxes', icon: Calculator },
      ],
    },
    { title: 'المخزون', href: '/inventory', icon: Package },
    { title: 'العملاء', href: '/customers', icon: Users },
    { title: 'الخدمات', href: '/services', icon: Wrench },
    { title: 'المواعيد', href: '/appointments', icon: Calendar },
    { title: 'التقارير', href: '/reports', icon: FileText },
    { title: 'الإعدادات', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const isMenuOpen = (title: string) => openMenus.includes(title);

  return (
    <aside
      className={`fixed right-0 top-0 h-screen bg-gray-900 text-white z-50 ${
        isCollapsed ? 'w-20' : 'w-64'
      } transition-all duration-300 flex flex-col shadow-xl`}
      data-testid="sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex-shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <span className="font-bold text-lg">AP</span>
              </div>
              <div>
                <h1 className="font-bold text-lg">AutoProfit Pro</h1>
                <p className="text-xs text-gray-400">إدارة الورشة المالية</p>
              </div>
            </div>
            <button 
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              title="طي القائمة"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
              <span className="font-bold">AP</span>
            </div>
            <button 
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              title="فتح القائمة"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
        {navigationItems.map((item) => (
          <div key={item.title}>
            {item.submenu && item.items ? (
              <div>
                <button
                  onClick={() => toggleMenu(item.title)}
                  className={`flex items-center justify-between w-full p-3 rounded-lg transition-colors ${
                    isMenuOpen(item.title) ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} />
                    {!isCollapsed && <span className="font-medium">{item.title}</span>}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown 
                      size={16} 
                      className={`transition-transform duration-200 ${
                        isMenuOpen(item.title) ? 'rotate-180' : ''
                      }`} 
                    />
                  )}
                </button>
                
                {!isCollapsed && isMenuOpen(item.title) && (
                  <div className="mt-1 mr-3 space-y-0.5 border-r-2 border-gray-700 pr-3">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all ${
                          isActive(subItem.href) 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <subItem.icon size={16} />
                        <span>{subItem.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={item.href || '/'}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive(item.href || '/') 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {!isCollapsed && <span className="font-medium">{item.title}</span>}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 flex-shrink-0">
        <Link
          href="/login"
          className="flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          {!isCollapsed && <span>تسجيل الخروج</span>}
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
