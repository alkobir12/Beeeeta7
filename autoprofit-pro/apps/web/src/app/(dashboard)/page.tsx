'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, Users, Package, Calendar } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  color: string;
  description: string;
}

function StatsCard(props: StatCardProps) {
  const { title, value, change, trend, color, description } = props;
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      <div className="flex items-baseline justify-between">
        <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
        <div className={`text-xs font-semibold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {change}
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCustomers: 0,
    inventoryCount: 0,
    appointmentsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: ربط بواجهة الـ API الحقيقية
    setTimeout(() => {
      setStats({
        totalRevenue: 4_523_000,
        totalCustomers: 1234,
        inventoryCount: 12_450,
        appointmentsCount: 156,
      });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const dashboardStats: StatCardProps[] = [
    {
      title: 'إجمالي الإيرادات',
      value: `${(stats.totalRevenue / 1000).toFixed(0)} ألف ريال`,
      change: '+12.5%',
      trend: 'up',
      color: 'bg-green-500',
      description: 'منذ الشهر الماضي',
    },
    {
      title: 'إجمالي العملاء',
      value: stats.totalCustomers.toString(),
      change: '+8.2%',
      trend: 'up',
      color: 'bg-blue-500',
      description: 'عملاء نشطين',
    },
    {
      title: 'المخزون الحالي',
      value: stats.inventoryCount.toString(),
      change: '-3.1%',
      trend: 'down',
      color: 'bg-purple-500',
      description: 'قطعة في المخزون',
    },
    {
      title: 'المواعيد',
      value: stats.appointmentsCount.toString(),
      change: '+24%',
      trend: 'up',
      color: 'bg-orange-500',
      description: 'موعد هذا الأسبوع',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">مرحباً بعودتك 👋</h1>
        <p className="text-gray-600 dark:text-gray-400">
          إليك نظرة عامة على أداء ورشتك هذا الشهر
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>
    </div>
  );
}
