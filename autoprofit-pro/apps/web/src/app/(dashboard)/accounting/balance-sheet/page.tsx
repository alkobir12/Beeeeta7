'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { accountingApi, BalanceSheetData, NamedAmount } from '@/lib/api';

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await accountingApi.getBalanceSheet(asOfDate);
      setData(reportData);
    } catch (err: unknown) {
      console.error('Error fetching balance sheet:', err);
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات';
      setError(errorMessage);
      // Fallback to mock data for demo purposes
      setData({
        assets: {
          current_assets: [
            { name: 'النقدية في الصندوق', amount: 50000 },
            { name: 'البنك الأهلي', amount: 200000 },
            { name: 'العملاء', amount: 150000 },
            { name: 'المخزون', amount: 80000 },
          ],
          fixed_assets: [
            { name: 'السيارات والمعدات', amount: 500000 },
            { name: 'المباني', amount: 1000000 },
            { name: 'الأثاث والتجهيزات', amount: 150000 },
          ],
          total: 2_130_000,
        },
        liabilities: {
          current_liabilities: [
            { name: 'الموردين', amount: 75000 },
            { name: 'الضرائب المستحقة', amount: 45000 },
            { name: 'الرواتب المستحقة', amount: 30000 },
          ],
          long_term_liabilities: [
            { name: 'قرض بنكي', amount: 400000 },
          ],
          total: 550_000,
        },
        equity: {
          capital: [{ name: 'رأس مال المالك', amount: 1_000_000 }],
          retained_earnings: [{ name: 'أرباح محتجزة', amount: 480_000 }],
          net_income: 100_000,
          total: 1_580_000,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

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

  // Calculate balance check
  const isBalanced = Math.abs(data.assets.total - (data.liabilities.total + data.equity.total)) < 0.01;

  return (
    <div className="space-y-6" data-testid="balance-sheet-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            الميزانية العمومية
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            تقرير المركز المالي للورشة حتى تاريخ{' '}
            {new Date(asOfDate).toLocaleDateString('ar-SA')}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">التاريخ:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              data-testid="date-picker"
            />
          </div>

          <button
            onClick={fetchBalanceSheet}
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

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            تعذر الاتصال بالخادم. يتم عرض بيانات تجريبية.
          </p>
        </div>
      )}

      {/* Balance Check */}
      <div className={`rounded-lg p-3 flex items-center gap-2 ${isBalanced ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        {isBalanced ? (
          <>
            <TrendingUp className="text-green-600" size={20} />
            <span className="text-green-800 dark:text-green-200 text-sm font-medium">
              ✓ الميزانية متوازنة - الأصول = الخصوم + حقوق الملكية
            </span>
          </>
        ) : (
          <>
            <TrendingDown className="text-red-600" size={20} />
            <span className="text-red-800 dark:text-red-200 text-sm font-medium">
              ⚠ الميزانية غير متوازنة - يرجى مراجعة القيود
            </span>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg" data-testid="total-assets-card">
          <p className="text-sm opacity-90">إجمالي الأصول</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(data.assets.total)}
          </p>
          <p className="text-xs opacity-75 mt-2">
            {data.assets.current_assets.length + data.assets.fixed_assets.length} حساب
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg" data-testid="total-liabilities-card">
          <p className="text-sm opacity-90">إجمالي الخصوم</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(data.liabilities.total)}
          </p>
          <p className="text-xs opacity-75 mt-2">
            {data.liabilities.current_liabilities.length + data.liabilities.long_term_liabilities.length} حساب
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg" data-testid="total-equity-card">
          <p className="text-sm opacity-90">حقوق الملكية</p>
          <p className="text-2xl font-bold mt-2">
            {formatCurrency(data.equity.total)}
          </p>
          <p className="text-xs opacity-75 mt-2">
            صافي الدخل: {formatCurrency(data.equity.net_income)}
          </p>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الأصول</h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Current Assets */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">الأصول المتداولة</h3>
              <div className="space-y-2">
                {data.assets.current_assets.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="font-medium text-gray-700 dark:text-gray-300">إجمالي الأصول المتداولة</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(data.assets.current_assets.reduce((sum, item) => sum + item.amount, 0))}
                </span>
              </div>
            </div>

            {/* Fixed Assets */}
            <div className="pt-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">الأصول الثابتة</h3>
              <div className="space-y-2">
                {data.assets.fixed_assets.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="font-medium text-gray-700 dark:text-gray-300">إجمالي الأصول الثابتة</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(data.assets.fixed_assets.reduce((sum, item) => sum + item.amount, 0))}
                </span>
              </div>
            </div>

            {/* Total Assets */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-green-800 dark:text-green-200">إجمالي الأصول</span>
                <span className="font-bold text-xl text-green-600">{formatCurrency(data.assets.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Liabilities & Equity Section */}
        <div className="space-y-6">
          {/* Liabilities */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الخصوم</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Current Liabilities */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">الخصوم المتداولة</h3>
                <div className="space-y-2">
                  {data.liabilities.current_liabilities.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Long-term Liabilities */}
              {data.liabilities.long_term_liabilities.length > 0 && (
                <div className="pt-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">الخصوم طويلة الأجل</h3>
                  <div className="space-y-2">
                    {data.liabilities.long_term_liabilities.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Liabilities */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-red-800 dark:text-red-200">إجمالي الخصوم</span>
                  <span className="font-bold text-xl text-red-600">{formatCurrency(data.liabilities.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">حقوق الملكية</h2>
            </div>
            <div className="p-4 space-y-2">
              {data.equity.capital.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {data.equity.retained_earnings.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">صافي الدخل للفترة</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(data.equity.net_income)}</span>
              </div>

              {/* Total Equity */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-800 dark:text-blue-200">إجمالي حقوق الملكية</span>
                  <span className="font-bold text-xl text-blue-600">{formatCurrency(data.equity.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Equation Summary */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-4">معادلة الميزانية</h3>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg px-6 py-3">
            <p className="text-sm text-green-700 dark:text-green-300">الأصول</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.assets.total)}</p>
          </div>
          <span className="text-2xl font-bold text-gray-400">=</span>
          <div className="bg-red-100 dark:bg-red-900/30 rounded-lg px-6 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">الخصوم</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(data.liabilities.total)}</p>
          </div>
          <span className="text-2xl font-bold text-gray-400">+</span>
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg px-6 py-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">حقوق الملكية</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(data.equity.total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
