'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Download, 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building,
  Banknote
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { accountingApi, CashFlowData } from '@/lib/api';

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);

  const fetchCashFlow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await accountingApi.getCashFlow(startDate, endDate);
      setData(reportData);
    } catch (err: unknown) {
      console.error('Error fetching cash flow:', err);
      setError('تعذر الاتصال بالخادم');
      // Mock data
      setData({
        operating_activities: [
          { name: 'صافي الدخل', amount: 195500 },
          { name: 'استهلاك الأصول', amount: 35000 },
          { name: 'التغير في الذمم المدينة', amount: -25000 },
          { name: 'التغير في المخزون', amount: -15000 },
          { name: 'التغير في الذمم الدائنة', amount: 20000 },
        ],
        investing_activities: [
          { name: 'شراء معدات', amount: -75000 },
          { name: 'بيع أصول قديمة', amount: 15000 },
        ],
        financing_activities: [
          { name: 'سداد قرض بنكي', amount: -50000 },
          { name: 'توزيعات أرباح', amount: -30000 },
        ],
        net_change_in_cash: 70500,
        opening_cash: 250000,
        closing_cash: 320500,
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

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

  const operatingTotal = data.operating_activities.reduce((sum, item) => sum + item.amount, 0);
  const investingTotal = data.investing_activities.reduce((sum, item) => sum + item.amount, 0);
  const financingTotal = data.financing_activities.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6" data-testid="cash-flow-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            قائمة التدفقات النقدية
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            حركة النقدية للفترة من {new Date(startDate).toLocaleDateString('ar-SA')} إلى {new Date(endDate).toLocaleDateString('ar-SA')}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          <button
            onClick={fetchCashFlow}
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

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-600" size={20} />
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">{error} - يتم عرض بيانات تجريبية</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Wallet className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">رصيد البداية</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(data.opening_cash)}
              </p>
            </div>
          </div>
        </div>

        <div className={`bg-white dark:bg-gray-800 rounded-xl p-5 border ${data.net_change_in_cash >= 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${data.net_change_in_cash >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {data.net_change_in_cash >= 0 ? (
                <TrendingUp className="text-green-600" size={24} />
              ) : (
                <TrendingDown className="text-red-600" size={24} />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">صافي التغير</p>
              <p className={`text-xl font-bold ${data.net_change_in_cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.net_change_in_cash >= 0 ? '+' : ''}{formatCurrency(data.net_change_in_cash)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Banknote className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">رصيد النهاية</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(data.closing_cash)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5">
          <p className="text-sm opacity-90">نسبة النمو</p>
          <p className="text-2xl font-bold mt-1">
            {data.opening_cash > 0 ? (((data.closing_cash - data.opening_cash) / data.opening_cash) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Cash Flow Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operating Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building className="text-blue-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الأنشطة التشغيلية</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {data.operating_activities.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{item.name}</span>
                  <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className={`mt-4 p-3 rounded-lg ${operatingTotal >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 dark:text-gray-200">الإجمالي</span>
                <span className={`font-bold text-lg ${operatingTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(operatingTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Investing Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ArrowUpRight className="text-purple-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الأنشطة الاستثمارية</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {data.investing_activities.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{item.name}</span>
                  <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className={`mt-4 p-3 rounded-lg ${investingTotal >= 0 ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 dark:text-gray-200">الإجمالي</span>
                <span className={`font-bold text-lg ${investingTotal >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  {formatCurrency(investingTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financing Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <ArrowDownRight className="text-orange-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الأنشطة التمويلية</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {data.financing_activities.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{item.name}</span>
                  <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className={`mt-4 p-3 rounded-lg ${financingTotal >= 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 dark:text-gray-200">الإجمالي</span>
                <span className={`font-bold text-lg ${financingTotal >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  {formatCurrency(financingTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Summary */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">ملخص التدفقات النقدية</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 dark:text-gray-400">رصيد النقدية في بداية الفترة</span>
            <span className="font-medium">{formatCurrency(data.opening_cash)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 dark:text-gray-400">صافي التدفقات من الأنشطة التشغيلية</span>
            <span className={`font-medium ${operatingTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {operatingTotal >= 0 ? '+' : ''}{formatCurrency(operatingTotal)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 dark:text-gray-400">صافي التدفقات من الأنشطة الاستثمارية</span>
            <span className={`font-medium ${investingTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {investingTotal >= 0 ? '+' : ''}{formatCurrency(investingTotal)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 dark:text-gray-400">صافي التدفقات من الأنشطة التمويلية</span>
            <span className={`font-medium ${financingTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financingTotal >= 0 ? '+' : ''}{formatCurrency(financingTotal)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
            <span className="font-bold text-gray-800 dark:text-gray-200">صافي التغير في النقدية</span>
            <span className={`font-bold text-lg ${data.net_change_in_cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.net_change_in_cash >= 0 ? '+' : ''}{formatCurrency(data.net_change_in_cash)}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 mt-4">
            <span className="font-bold text-blue-800 dark:text-blue-200 text-lg">رصيد النقدية في نهاية الفترة</span>
            <span className="font-bold text-2xl text-blue-600">{formatCurrency(data.closing_cash)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
