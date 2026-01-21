import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { TrendingUp, DollarSign, Package, Users, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FinancialDashboard = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [ratios, setRatios] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [topPerformers, setTopPerformers] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ratiosRes, plRes, topRes, bsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics-advanced/financial-ratios`),
        axios.get(`${API_URL}/analytics-advanced/profit-loss`),
        axios.get(`${API_URL}/analytics-advanced/top-performers`),
        axios.get(`${API_URL}/accounts-chart/balance-sheet/summary`)
      ]);
      
      setRatios(ratiosRes.data);
      setProfitLoss(plRes.data);
      setTopPerformers(topRes.data);
      setBalanceSheet(bsRes.data);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getRatioStatus = (value, thresholds) => {
    if (value >= thresholds.good) return { color: 'text-green-600', bg: 'bg-green-50', label: 'ممتاز' };
    if (value >= thresholds.ok) return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'جيد' };
    return { color: 'text-red-600', bg: 'bg-red-50', label: 'يحتاج تحسين' };
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{isArabic ? 'لوحة التحكم المالية' : 'Financial Dashboard'}</h1>
        <p className="text-gray-500 mt-1">{isArabic ? 'تحليلات ونسب مالية متقدمة' : 'Advanced Financial Analytics'}</p>
      </div>

      {/* الميزانية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{isArabic ? 'الأصول' : 'Assets'}</p>
                <p className="text-2xl font-bold text-green-600">{balanceSheet?.assets?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-400">{isArabic ? 'ر.س' : 'SAR'}</p>
              </div>
              <TrendingUp className="text-green-500" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{isArabic ? 'الالتزامات' : 'Liabilities'}</p>
                <p className="text-2xl font-bold text-red-600">{balanceSheet?.liabilities?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-400">{isArabic ? 'ر.س' : 'SAR'}</p>
              </div>
              <AlertCircle className="text-red-500" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{isArabic ? 'صافي الربح' : 'Net Income'}</p>
                <p className="text-2xl font-bold text-blue-600">{balanceSheet?.net_income?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-400">{isArabic ? 'ر.س' : 'SAR'}</p>
              </div>
              <DollarSign className="text-blue-500" size={32} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{isArabic ? 'الإيرادات' : 'Revenue'}</p>
                <p className="text-2xl font-bold text-purple-600">{balanceSheet?.revenue?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-400">{isArabic ? 'ر.س' : 'SAR'}</p>
              </div>
              <Package className="text-purple-500" size={32} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* النسب المالية */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? '📊 النسب المالية' : '📊 Financial Ratios'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ratios?.ratios && Object.entries({
              'current_ratio': { label: 'نسبة التداول', thresholds: { good: 2, ok: 1 } },
              'quick_ratio': { label: 'النسبة السريعة', thresholds: { good: 1, ok: 0.5 } },
              'gross_margin': { label: 'هامش الربح الإجمالي', thresholds: { good: 40, ok: 20 }, suffix: '%' },
              'net_margin': { label: 'هامش الربح الصافي', thresholds: { good: 15, ok: 5 }, suffix: '%' },
              'inventory_turnover': { label: 'معدل دوران المخزون', thresholds: { good: 4, ok: 2 } },
              'debt_ratio': { label: 'نسبة الدين', thresholds: { good: 30, ok: 50 }, suffix: '%', inverse: true }
            }).map(([key, config]) => {
              const value = ratios.ratios[key] || 0;
              const status = getRatioStatus(value, config.thresholds);
              
              return (
                <div key={key} className={`p-4 rounded-lg border ${status.bg}`}>
                  <p className="text-sm text-gray-600 mb-1">{config.label}</p>
                  <p className={`text-3xl font-bold ${status.color}`}>
                    {value}{config.suffix || ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{status.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* قائمة الدخل */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? '💵 قائمة الدخل' : '💵 Profit & Loss'}</CardTitle>
          </CardHeader>
          <CardContent>
            {profitLoss && (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">{isArabic ? 'إيرادات الخدمات' : 'Services Revenue'}</span>
                  <span className="font-semibold">{profitLoss.revenue?.services?.toLocaleString() || 0} {isArabic ? 'ر.س' : 'SAR'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">{isArabic ? 'إيرادات القطع' : 'Parts Revenue'}</span>
                  <span className="font-semibold">{profitLoss.revenue?.parts?.toLocaleString() || 0} {isArabic ? 'ر.س' : 'SAR'}</span>
                </div>
                <div className="flex justify-between py-2 border-b font-bold">
                  <span>{isArabic ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
                  <span className="text-blue-600">{profitLoss.revenue?.total?.toLocaleString() || 0} {isArabic ? 'ر.س' : 'SAR'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">{isArabic ? 'تكلفة البضاعة المباعة' : 'COGS'}</span>
                  <span className="text-red-600">({profitLoss.cost_of_goods_sold?.toLocaleString() || 0})</span>
                </div>
                <div className="flex justify-between py-2 border-b font-bold">
                  <span>{isArabic ? 'مجمل الربح' : 'Gross Profit'}</span>
                  <span className="text-green-600">{profitLoss.gross_profit?.toLocaleString() || 0} {isArabic ? 'ر.س' : 'SAR'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">{isArabic ? 'مصروفات التشغيل' : 'Operating Expenses'}</span>
                  <span className="text-red-600">({profitLoss.operating_expenses?.total?.toLocaleString() || 0})</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-blue-500 font-bold text-lg">
                  <span>{isArabic ? 'صافي الربح' : 'Net Profit'}</span>
                  <span className={profitLoss.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {profitLoss.net_profit?.toLocaleString() || 0} {isArabic ? 'ر.س' : 'SAR'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? '🏆 الأكثر أداءً' : '🏆 Top Performers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">{isArabic ? 'أفضل الخدمات' : 'Top Services'}</h4>
                {topPerformers?.top_services?.map((service, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-gray-500">{service.count} {isArabic ? 'عملية' : 'operations'}</p>
                    </div>
                    <span className="font-bold text-blue-600">{service.revenue?.toLocaleString()} {isArabic ? 'ر.س' : 'SAR'}</span>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">{isArabic ? 'أفضل القطع' : 'Top Parts'}</h4>
                {topPerformers?.top_parts?.map((part, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium text-sm">{part.name}</p>
                      <p className="text-xs text-gray-500">{part.quantity} {isArabic ? 'قطعة' : 'units'}</p>
                    </div>
                    <span className="font-bold text-green-600">{part.revenue?.toLocaleString()} {isArabic ? 'ر.س' : 'SAR'}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinancialDashboard;
