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
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  CreditCard,
  TrendingUp,
  Shield,
  ClipboardCheck,
  Truck,
} from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  const navigationItems = [
    {
      title: 'لوحة التحكم',
      href: '/dashboard',
      icon: Home,
    },
    {
      title: 'المالية',
      icon: DollarSign,
      submenu: true,
      items: [
        { title: 'نظرة عامة', href: '/dashboard/finance', icon: TrendingUp },
        { title: 'المبيعات', href: '/dashboard/finance/sales', icon: TrendingUp },
        { title: 'المشتريات', href: '/dashboard/finance/purchases', icon: CreditCard },
        { title: 'المصروفات', href: '/dashboard/finance/expenses', icon: DollarSign },
        { title: 'الفواتير', href: '/dashboard/finance/invoices', icon: FileText },
        { title: 'الرواتب', href: '/dashboard/finance/payroll', icon: Users },
        { title: 'الضرائب', href: '/dashboard/finance/taxes', icon: Shield },
      ],
    },
    {
      title: 'المحاسبة',
      icon: BarChart3,
      submenu: true,
      items: [
        { title: 'نظرة عامة', href: '/dashboard/accounting', icon: BarChart3 },
        { title: 'دليل الحسابات', href: '/dashboard/accounting/chart-of-accounts', icon: FileText },
        { title: 'القيود اليومية', href: '/dashboard/accounting/journal-entries', icon: ClipboardCheck },
        { title: 'الميزانية العمومية', href: '/dashboard/accounting/balance-sheet', icon: BarChart3 },
        { title: 'قائمة الدخل', href: '/dashboard/accounting/income-statement', icon: TrendingUp },
        { title: 'التدفقات النقدية', href: '/dashboard/accounting/cash-flow', icon: DollarSign },
      ],
    },
    { title: 'المخزون', href: '/dashboard/inventory', icon: Package },
    { title: 'العملاء', href: '/dashboard/customers', icon: Users },
    { title: 'الخدمات', href: '/dashboard/services', icon: Wrench },
    { title: 'المواعيد', href: '/dashboard/appointments', icon: Calendar },
    { title: 'الموردين', href: '/dashboard/suppliers', icon: Truck },
    { title: 'التقارير', href: '/dashboard/reports', icon: FileText },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <aside
      className={`fixed right-0 top-0 h-screen bg-gray-900 text-white ${
        isCollapsed ? 'w-20' : 'w-64'
      } transition-all duration-300`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg" />
              <div>
                <h1 className="font-bold">AutoProfit Pro</h1>
                <p className="text-sm text-gray-400">إدارة الورشة المالية</p>
              </div>
            </div>
            <button onClick={() => setIsCollapsed(true)}>
              <ChevronLeft size={20} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button onClick={() => setIsCollapsed(false)}>
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-64px)]">
        {navigationItems.map((item) => (
          <div key={item.title}>
            {item.submenu ? (
              <div>
                <button
                  onClick={() =>
                    setActiveSubmenu(activeSubmenu === item.title ? null : item.title)
                  }
                  className="flex items-center justify-between w-full p-3 rounded hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} />
                    {!isCollapsed && <span>{item.title}</span>}
                  </div>
                </button>
                {!isCollapsed && activeSubmenu === item.title && (
                  <div className="mr-10 mt-2 space-y-2">
                    {item.items?.map((subItem) => (
                      <Link
                        key={subItem.title}
                        href={subItem.href}
                        className={`flex items-center gap-3 p-3 rounded text-sm ${
                          isActive(subItem.href) ? 'bg-blue-600' : 'hover:bg-gray-800'
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
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded ${
                  isActive(item.href) ? 'bg-blue-600' : 'hover:bg-gray-800'
                }`}
              >
                <item.icon size={20} />
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
