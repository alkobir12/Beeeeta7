'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Users,
  Phone,
  Mail,
  Car,
  DollarSign,
  Edit,
  Eye,
  FileText
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  total_spent: number;
  visits_count: number;
  vehicles_count: number;
  last_visit?: string;
  status: 'active' | 'inactive';
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      // Mock data
      setCustomers([
        { id: '1', name: 'محمد أحمد العتيبي', phone: '0501234567', email: 'mohammed@email.com', total_spent: 45000, visits_count: 12, vehicles_count: 2, last_visit: '2024-12-18', status: 'active' },
        { id: '2', name: 'عبدالله سعد المالكي', phone: '0559876543', email: 'abdullah@email.com', total_spent: 28500, visits_count: 8, vehicles_count: 1, last_visit: '2024-12-15', status: 'active' },
        { id: '3', name: 'فهد خالد الدوسري', phone: '0541122334', total_spent: 67000, visits_count: 25, vehicles_count: 3, last_visit: '2024-12-20', status: 'active' },
        { id: '4', name: 'سلطان محمد الشهري', phone: '0532211443', email: 'sultan@email.com', total_spent: 15000, visits_count: 5, vehicles_count: 1, last_visit: '2024-11-28', status: 'active' },
        { id: '5', name: 'خالد عبدالرحمن القحطاني', phone: '0567788990', total_spent: 8500, visits_count: 3, vehicles_count: 1, last_visit: '2024-10-15', status: 'inactive' },
      ]);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return customer.name.toLowerCase().includes(query) || customer.phone.includes(query);
  });

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    totalRevenue: customers.reduce((sum, c) => sum + c.total_spent, 0),
    avgSpent: customers.length > 0 ? customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length : 0,
  };

  return (
    <div className="space-y-6" data-testid="customers-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-blue-600" />
            إدارة العملاء
          </h1>
          <p className="text-gray-600 dark:text-gray-400">قاعدة بيانات العملاء وسجلاتهم</p>
        </div>

        <button className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} />
          <span>إضافة عميل</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">العملاء النشطين</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <DollarSign className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الإيرادات</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <DollarSign className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">متوسط الإنفاق</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.avgSpent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <button onClick={fetchCustomers} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">{customer.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{customer.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      customer.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {customer.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone size={16} />
                  <span dir="ltr">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail size={16} />
                    <span>{customer.email}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{customer.visits_count}</p>
                  <p className="text-xs text-gray-500">زيارة</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-600">{customer.vehicles_count}</p>
                  <p className="text-xs text-gray-500">سيارة</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{(customer.total_spent / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-500">إنفاق</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                  <Eye size={16} />
                  <span>عرض</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <Edit size={16} />
                  <span>تعديل</span>
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                  <FileText size={16} />
                  <span>فاتورة</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
