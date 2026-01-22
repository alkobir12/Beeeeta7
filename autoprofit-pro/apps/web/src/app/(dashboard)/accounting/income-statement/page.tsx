'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { accountingApi, IncomeStatementData, NamedAmount } from '@/lib/api';

export default function IncomeStatementPage() {
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default to current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);

  const fetchIncomeStatement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await accountingApi.getIncomeStatement(startDate, endDate);
      setData(reportData);
    } catch (err: unknown) {
      console.error('Error fetching income statement:', err);
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات';
      setError(errorMessage);
      // Fallback to mock data
      setData({
        revenues: [
          { name: 'إيرادات خدمات الصيانة', amount: 450000 },
          { name: 'إيرادات بيع قطع الغيار', amount: 280000 },
          { name: 'إيرادات خدمات الطلاء', amount: 120000 },
          { name: 'إيرادات أخرى', amount: 35000 },
        ],
        cost_of_goods_sold: [
          { name: 'تكلفة قطع الغيار المباعة', amount: 180000 },
          { name: 'تكلفة مواد الصيانة', amount: 85000 },
          { name: 'تكلفة مواد الطلاء', amount: 45000 },
        ],
        gross_profit: 575000,
        operating_expenses: [
          { name: 'رواتب الموظفين', amount: 180000 },
          { name: 'إيجار المبنى', amount: 50000 },
          { name: 'فواتير الكهرباء والماء', amount: 15000 },
          { name: 'مصاريف التسويق', amount: 25000 },
          { name: 'مصاريف إدارية', amount: 20000 },
          { name: 'استهلاك الأصول', amount: 35000 },
        ],
        operating_income: 250000,
        other_income: [
          { name: 'فوائد مكتسبة', amount: 5000 },
        ],
        other_expenses: [
          { name: 'فوائد قرض بنكي', amount: 25000 },
        ],
        net_income_before_tax: 230000,
        tax_expense: 34500,
        net_income: 195500,
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchIncomeStatement();
  }, [fetchIncomeStatement]);

  // Quick date presets
  const setPresetDates = (preset: string) => {
    const now = new Date();
    let start: Date, end: Date;

    switch (preset) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

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

  const totalRevenue = data.revenues.reduce((sum, item) => sum + item.amount, 0);
  const totalCOGS = data.cost_of_goods_sold.reduce((sum, item) => sum + item.amount, 0);
  const totalOpEx = data.operating_expenses.reduce((sum, item) => sum + item.amount, 0);
  const grossProfitMargin = totalRevenue > 0 ? ((data.gross_profit / totalRevenue) * 100).toFixed(1) : '0';
  const netProfitMargin = totalRevenue > 0 ? ((data.net_income / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6" data-testid="income-statement-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            قائمة الدخل
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            تقرير الأرباح والخسائر للفترة من {new Date(startDate).toLocaleDateString('ar-SA')} إلى {new Date(endDate).toLocaleDateString('ar-SA')}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <button
            onClick={fetchIncomeStatement}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="تحديث"
            data-testid="refresh-btn"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          <button 
            className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="export-btn"
          >
            <Download size={16} />
            <span>تصدير PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">الفترة:</span>
          </div>
          
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'this_month', label: 'هذا الشهر' },
              { key: 'last_month', label: 'الشهر الماضي' },
              { key: 'this_quarter', label: 'هذا الربع' },
              { key: 'this_year', label: 'هذه السنة' },
            ].map((preset) => (
              <button
                key={preset.key}
                onClick={() => setPresetDates(preset.key)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-2 mr-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              data-testid="start-date"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              data-testid="end-date"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            تعذر الاتصال بالخادم. يتم عرض بيانات تجريبية.
          </p>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90">إجمالي الإيرادات</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90">مجمل الربح</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(data.gross_profit)}</p>
          <p className="text-xs opacity-75 mt-1">هامش الربح: {grossProfitMargin}%</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90">الربح التشغيلي</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(data.operating_income)}</p>
        </div>
        <div className={`bg-gradient-to-br ${data.net_income >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white rounded-xl p-5 shadow-lg`}>
          <p className="text-sm opacity-90">صافي الدخل</p>
          <div className="flex items-center gap-2 mt-2">
            {data.net_income >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            <p className="text-2xl font-bold">{formatCurrency(data.net_income)}</p>
          </div>
          <p className="text-xs opacity-75 mt-1">هامش صافي الربح: {netProfitMargin}%</p>
        </div>
      </div>

      {/* Income Statement Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">تفاصيل قائمة الدخل</h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Revenues Section */}
          <div>
            <h3 className="text-md font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
              <TrendingUp size={18} />
              الإيرادات
            </h3>
            <div className="space-y-2 mr-4">
              {data.revenues.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-blue-200 dark:border-blue-800">
              <span className="font-bold text-blue-700 dark:text-blue-300">إجمالي الإيرادات</span>
              <span className="font-bold text-xl text-blue-600">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>

          {/* Cost of Goods Sold */}
          <div>
            <h3 className="text-md font-semibold text-orange-600 dark:text-orange-400 mb-3">
              (-) تكلفة المبيعات
            </h3>
            <div className="space-y-2 mr-4">
              {data.cost_of_goods_sold.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="font-medium text-red-600">({formatCurrency(item.amount)})</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-orange-200 dark:border-orange-800">
              <span className="font-bold text-orange-700 dark:text-orange-300">إجمالي تكلفة المبيعات</span>
              <span className="font-bold text-xl text-orange-600">({formatCurrency(totalCOGS)})</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-purple-800 dark:text-purple-200 text-lg">مجمل الربح</span>
              <span className="font-bold text-2xl text-purple-600">{formatCurrency(data.gross_profit)}</span>
            </div>
          </div>

          {/* Operating Expenses */}
          <div>
            <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mb-3">
              (-) المصروفات التشغيلية
            </h3>
            <div className="space-y-2 mr-4">
              {data.operating_expenses.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="font-medium text-red-600">({formatCurrency(item.amount)})</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-red-200 dark:border-red-800">
              <span className="font-bold text-red-700 dark:text-red-300">إجمالي المصروفات التشغيلية</span>
              <span className="font-bold text-xl text-red-600">({formatCurrency(totalOpEx)})</span>
            </div>
          </div>

          {/* Operating Income */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-orange-800 dark:text-orange-200 text-lg">الربح التشغيلي</span>
              <span className="font-bold text-2xl text-orange-600">{formatCurrency(data.operating_income)}</span>
            </div>
          </div>

          {/* Other Income/Expenses */}
          {(data.other_income.length > 0 || data.other_expenses.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.other_income.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-green-600 dark:text-green-400 mb-2">
                    (+) إيرادات أخرى
                  </h3>
                  {data.other_income.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{item.name}</span>
                      <span className="text-green-600">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.other_expenses.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mb-2">
                    (-) مصروفات أخرى
                  </h3>
                  {data.other_expenses.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{item.name}</span>
                      <span className="text-red-600">({formatCurrency(item.amount)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Net Income Before Tax */}
          <div className="flex justify-between items-center py-3 border-t border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-700 dark:text-gray-300">صافي الدخل قبل الضريبة</span>
            <span className="font-bold text-lg">{formatCurrency(data.net_income_before_tax)}</span>
          </div>

          {/* Tax */}
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 dark:text-gray-400">(-) ضريبة الدخل (15%)</span>
            <span className="text-red-600">({formatCurrency(data.tax_expense)})</span>
          </div>

          {/* Net Income */}
          <div className={`rounded-lg p-5 ${data.net_income >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {data.net_income >= 0 ? (
                  <TrendingUp className="text-green-600" size={24} />
                ) : (
                  <TrendingDown className="text-red-600" size={24} />
                )}
                <span className={`font-bold text-xl ${data.net_income >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  صافي الدخل
                </span>
              </div>
              <span className={`font-bold text-3xl ${data.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.net_income)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
