'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertCircle,
  Package,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit_cost: number;
  selling_price: number;
  total_value: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  last_updated: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      // API call would go here
      // For now, using mock data
      setItems([
        { id: '1', sku: 'OIL-001', name: 'زيت محرك 5W-30', category: 'زيوت', quantity: 150, min_quantity: 50, unit_cost: 45, selling_price: 75, total_value: 6750, status: 'in_stock', last_updated: '2024-12-20' },
        { id: '2', sku: 'FLT-001', name: 'فلتر زيت تويوتا', category: 'فلاتر', quantity: 85, min_quantity: 30, unit_cost: 25, selling_price: 55, total_value: 2125, status: 'in_stock', last_updated: '2024-12-19' },
        { id: '3', sku: 'BRK-001', name: 'بطانات فرامل أمامية', category: 'فرامل', quantity: 25, min_quantity: 20, unit_cost: 120, selling_price: 200, total_value: 3000, status: 'low_stock', last_updated: '2024-12-18' },
        { id: '4', sku: 'BAT-001', name: 'بطارية 70 أمبير', category: 'بطاريات', quantity: 12, min_quantity: 10, unit_cost: 350, selling_price: 550, total_value: 4200, status: 'low_stock', last_updated: '2024-12-17' },
        { id: '5', sku: 'SPK-001', name: 'شمعات إشعال NGK', category: 'كهرباء', quantity: 0, min_quantity: 40, unit_cost: 35, selling_price: 65, total_value: 0, status: 'out_of_stock', last_updated: '2024-12-15' },
        { id: '6', sku: 'TIR-001', name: 'إطار ميشلان 205/55R16', category: 'إطارات', quantity: 32, min_quantity: 16, unit_cost: 280, selling_price: 420, total_value: 8960, status: 'in_stock', last_updated: '2024-12-20' },
      ]);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      in_stock: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'متوفر' },
      low_stock: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', label: 'مخزون منخفض' },
      out_of_stock: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'غير متوفر' },
    };
    const badge = badges[status] || badges.in_stock;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || 
      item.name.includes(searchQuery) || 
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [...new Set(items.map(item => item.category))];
  
  const stats = {
    totalItems: items.length,
    totalValue: items.reduce((sum, item) => sum + item.total_value, 0),
    lowStock: items.filter(item => item.status === 'low_stock').length,
    outOfStock: items.filter(item => item.status === 'out_of_stock').length,
  };

  return (
    <div className="space-y-6" data-testid="inventory-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="text-blue-600" />
            إدارة المخزون
          </h1>
          <p className="text-gray-600 dark:text-gray-400">تتبع وإدارة قطع الغيار والمواد</p>
        </div>

        <button className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} />
          <span>إضافة صنف</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الأصناف</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">قيمة المخزون</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertCircle className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">مخزون منخفض</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">نفد من المخزون</p>
              <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="all">كل الفئات</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="all">كل الحالات</option>
            <option value="in_stock">متوفر</option>
            <option value="low_stock">مخزون منخفض</option>
            <option value="out_of_stock">غير متوفر</option>
          </select>

          <button onClick={fetchInventory} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-semibold">الكود</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">الصنف</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">الفئة</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">الكمية</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">التكلفة</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">سعر البيع</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">القيمة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{item.sku}</span>
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{item.category}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={item.quantity <= item.min_quantity ? 'text-red-600 font-bold' : ''}>{item.quantity}</span>
                      <span className="text-gray-400 text-sm"> / {item.min_quantity}</span>
                    </td>
                    <td className="px-4 py-4 text-left">{formatCurrency(item.unit_cost)}</td>
                    <td className="px-4 py-4 text-left font-medium text-green-600">{formatCurrency(item.selling_price)}</td>
                    <td className="px-4 py-4 text-left font-medium">{formatCurrency(item.total_value)}</td>
                    <td className="px-4 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Eye size={16} /></button>
                        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Edit size={16} /></button>
                        <button className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
