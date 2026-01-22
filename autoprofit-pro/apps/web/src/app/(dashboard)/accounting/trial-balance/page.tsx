'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  Search,
  Filter
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { accountingApi, TrialBalanceData, TrialBalanceAccount } from '@/lib/api';

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await accountingApi.getTrialBalance(asOfDate);
      setData(reportData);
    } catch (err: unknown) {
      console.error('Error fetching trial balance:', err);
      setError('تعذر الاتصال بالخادم');
      // Mock data
      setData({
        accounts: [
          { code: '1101', name: 'النقدية في الصندوق', debit: 50000, credit: 0 },
          { code: '1102', name: 'البنك الأهلي', debit: 200000, credit: 0 },
          { code: '1201', name: 'العملاء', debit: 150000, credit: 0 },
          { code: '1301', name: 'المخزون', debit: 80000, credit: 0 },
          { code: '1501', name: 'السيارات والمعدات', debit: 500000, credit: 0 },
          { code: '1502', name: 'المباني', debit: 1000000, credit: 0 },
          { code: '2101', name: 'الموردين', debit: 0, credit: 75000 },
          { code: '2201', name: 'الضرائب المستحقة', debit: 0, credit: 45000 },
          { code: '2301', name: 'قرض بنكي', debit: 0, credit: 400000 },
          { code: '3101', name: 'رأس مال المالك', debit: 0, credit: 1000000 },
          { code: '3201', name: 'أرباح محتجزة', debit: 0, credit: 460000 },
          { code: '4101', name: 'إيرادات خدمات الصيانة', debit: 0, credit: 450000 },
          { code: '4102', name: 'إيرادات بيع قطع الغيار', debit: 0, credit: 280000 },
          { code: '5101', name: 'تكلفة قطع الغيار', debit: 180000, credit: 0 },
          { code: '5201', name: 'رواتب الموظفين', debit: 180000, credit: 0 },
          { code: '5202', name: 'إيجار المبنى', debit: 50000, credit: 0 },
          { code: '5203', name: 'فواتير الكهرباء والماء', debit: 15000, credit: 0 },
          { code: '5301', name: 'استهلاك الأصول', debit: 35000, credit: 0 },
        ],
        total_debit: 2440000,
        total_credit: 2710000,
        is_balanced: false,
      });
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchTrialBalance();
  }, [fetchTrialBalance]);

  const filteredAccounts = data?.accounts.filter(account => {
    const matchesSearch = !searchQuery || 
      account.code.includes(searchQuery) || 
      account.name.includes(searchQuery);
    
    const matchesType = typeFilter === 'all' ||
      (typeFilter === 'debit' && account.debit > 0) ||
      (typeFilter === 'credit' && account.credit > 0);
    
    return matchesSearch && matchesType;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <p className="text-gray-500 mt-4">لا توجد بيانات متاحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="trial-balance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ميزان المراجعة
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            الرصيد التجريبي حتى تاريخ {new Date(asOfDate).toLocaleDateString('ar-SA')}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />

          <button
            onClick={fetchTrialBalance}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download size={16} />
            <span>تصدير</span>
          </button>
        </div>
      </div>

      {/* Balance Status */}
      <div className={`rounded-lg p-4 flex items-center gap-3 ${
        data.is_balanced 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      }`}>
        {data.is_balanced ? (
          <>
            <CheckCircle className="text-green-600" size={24} />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">✓ ميزان المراجعة متوازن</p>
              <p className="text-sm text-green-600 dark:text-green-400">إجمالي المدين = إجمالي الدائن</p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="text-red-600" size={24} />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">⚠ ميزان المراجعة غير متوازن</p>
              <p className="text-sm text-red-600 dark:text-red-400">
                الفرق: {formatCurrency(Math.abs(data.total_debit - data.total_credit))} - يرجى مراجعة القيود
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-600" size={20} />
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">{error} - يتم عرض بيانات تجريبية</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90">إجمالي المدين</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(data.total_debit)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90">إجمالي الدائن</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(data.total_credit)}</p>
        </div>
        <div className={`bg-gradient-to-br ${data.is_balanced ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white rounded-xl p-5 shadow-lg`}>
          <p className="text-sm opacity-90">الفرق</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(Math.abs(data.total_debit - data.total_credit))}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث بكود الحساب أو الاسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="all">كل الحسابات</option>
              <option value="debit">مدين فقط</option>
              <option value="credit">دائن فقط</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">كود الحساب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">اسم الحساب</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">مدين</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">دائن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAccounts.map((account, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {account.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{account.name}</td>
                  <td className="px-4 py-3 text-left">
                    {account.debit > 0 ? (
                      <span className="font-medium text-blue-600">{formatCurrency(account.debit)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left">
                    {account.credit > 0 ? (
                      <span className="font-medium text-purple-600">{formatCurrency(account.credit)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                  الإجمالي
                </td>
                <td className="px-4 py-3 text-left font-bold text-xl text-blue-600">
                  {formatCurrency(data.total_debit)}
                </td>
                <td className="px-4 py-3 text-left font-bold text-xl text-purple-600">
                  {formatCurrency(data.total_credit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Accounts Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        إجمالي الحسابات: {data.accounts.length} | 
        حسابات مدينة: {data.accounts.filter(a => a.debit > 0).length} | 
        حسابات دائنة: {data.accounts.filter(a => a.credit > 0).length}
      </div>
    </div>
  );
}
