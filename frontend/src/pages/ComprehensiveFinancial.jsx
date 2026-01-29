import React, { useState } from 'react';
import { Scale, TrendingUp, Banknote, BarChart3, RefreshCw, Calendar } from 'lucide-react';
import FinancialCard from '../components/FinancialCard';
import { financeAPI, operationsAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useTheme } from '../contexts/ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import ARReceivablesTab from '../components/ARReceivablesTab';

const ComprehensiveFinancial = () => {
  const { themeName } = useTheme();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [activeTab, setActiveTab] = useState('balance');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
  const queryClient = useQueryClient();

  const balanceSheetQuery = useQuery({
    queryKey: ['balance-sheet', workshopId],
    queryFn: async () => {
      const res = await financeAPI.getBalanceSheet({ workshop_id: workshopId });
      return res.data?.data || null;
    }
  });

  const incomeStatementQuery = useQuery({
    queryKey: ['income-statement', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getIncomeStatement({ 
        workshop_id: workshopId, 
        start_date: startDate, 
        end_date: endDate 
      });
      return res.data?.data || null;
    }
  });

  const cashFlowQuery = useQuery({
    queryKey: ['cash-flow', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getCashFlow({ 
        workshop_id: workshopId, 
        start_date: startDate, 
        end_date: endDate 
      });
      return res.data?.data || null;
    }
  });

  const trialBalanceQuery = useQuery({
    queryKey: ['trial-balance', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getTrialBalance({ workshop_id: workshopId, start_date: startDate, end_date: endDate });
      const tbData = res.data?.data || res.data || {};
      return tbData.accounts || [];
    }
  });

  const receivablesSummaryQuery = useQuery({
    queryKey: ['ar-customers-summary', workshopId, endDate],
    queryFn: async () => {
      const res = await financeAPI.getARCustomers({ workshop_id: workshopId, as_of: endDate });
      return res.data?.data || null;
    }
  });

  const operationsQuery = useQuery({
    queryKey: ['operations', workshopId],
    queryFn: async () => {
      const res = await operationsAPI.list({});
      return res.data || [];
    },
    retry: 1,
  });


  const receivablesSummary = receivablesSummaryQuery.data;

  const balanceSheet = balanceSheetQuery.data;
  const incomeStatement = incomeStatementQuery.data;
  const cashFlow = cashFlowQuery.data;

  const loading = balanceSheetQuery.isLoading || incomeStatementQuery.isLoading || cashFlowQuery.isLoading || trialBalanceQuery.isLoading || receivablesSummaryQuery.isLoading || operationsQuery.isLoading;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['balance-sheet', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['income-statement', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['cash-flow', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['trial-balance', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['ar-customers-summary', workshopId] });
  };

  // Avoid blank/stuck page if a query fails
  const hasError = balanceSheetQuery.isError || incomeStatementQuery.isError || cashFlowQuery.isError || trialBalanceQuery.isError || receivablesSummaryQuery.isError;
  if (hasError) {
    return (
      <div className="max-w-7xl mx-auto p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>تعذر تحميل القوائم المالية</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>تحقق من اتصال الشبكة ثم اضغط تحديث.</p>
        <div className="mt-4">
          <button onClick={handleRefresh} className="apple-button">تحديث</button>
        </div>
      </div>
    );
  }


  const trialBalance = trialBalanceQuery.data;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const bsTotals = balanceSheet?.totals || { assets: 0, liabilities: 0, equity: 0 };
  const isTotals = incomeStatement?.totals || { revenue: 0, expenses: 0, net_income: 0 };
  const cfData = cashFlow || {};
  
  const isBalanced = Math.abs(bsTotals.assets - (bsTotals.liabilities + bsTotals.equity)) < 0.01;

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir={isRTL ? 'rtl' : 'ltr'} style={{
      backgroundColor: 'var(--bg-primary)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <Scale size={32} className="text-blue-500" />
            القوائم المالية الشاملة
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            الميزانية، الدخل، التدفقات، وميزان المراجعة في مكان واحد
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)'
          }}>
            <Calendar size={18} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="financial-start-date-input"
              className="bg-transparent border-0 outline-none text-sm w-32"


              style={{ color: 'var(--text-primary)' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="financial-end-date-input"
              className="bg-transparent border-0 outline-none text-sm w-32"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={handleRefresh}
            data-testid="financial-refresh-button"
            className="p-2.5 rounded-lg transition-colors flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            <RefreshCw size={18} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'balance', label: 'الميزانية العمومية', icon: Scale },
          { key: 'income', label: 'قائمة الدخل', icon: TrendingUp },
          { key: 'cashflow', label: 'التدفقات النقدية', icon: Banknote },
          { key: 'receivables', label: 'الذمم (نقد/آجل)', icon: Banknote },
          { key: 'trial', label: 'ميزان المراجعة', icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            data-testid={`financial-tab-${tab.key}`}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key 
                ? 'bg-blue-600 text-white shadow-lg' 
                : ''
            }`}
            style={activeTab !== tab.key ? {
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)'
            } : {}}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Balance Sheet Tab */}
      {activeTab === 'balance' && (
        <div className="space-y-6">
          {/* Balance Check */}
          <FinancialCard
            title={isBalanced ? 'الميزانية متوازنة ✓' : 'الميزانية غير متوازنة'}
            subtitle="معادلة الميزانية"
            icon={Scale}
            variant={isBalanced ? 'success' : 'danger'}
            expandable={false}
            details={[
              { label: 'الأصول', value: formatCurrency(bsTotals.assets) },
              { label: 'الخصوم + حقوق الملكية', value: formatCurrency(bsTotals.liabilities + bsTotals.equity) },
              { label: 'الفرق', value: formatCurrency(Math.abs(bsTotals.assets - (bsTotals.liabilities + bsTotals.equity))), valueColor: isBalanced ? 'text-emerald-400' : 'text-red-400' }
            ]}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FinancialCard
              title={formatCurrency(bsTotals.assets)}
              subtitle="إجمالي الأصول"
              icon={Scale}
              variant="default"
              details={
                balanceSheet?.sections?.assets?.slice(0, 5).map(acc => ({
                  label: acc.name,
                  value: formatCurrency(acc.balance)
                })) || []
              }
            />

            <FinancialCard
              title={formatCurrency(bsTotals.liabilities)}
              subtitle="إجمالي الخصوم"
              icon={TrendingUp}
              variant="warning"
              details={
                balanceSheet?.sections?.liabilities?.slice(0, 5).map(acc => ({
                  label: acc.name,
                  value: formatCurrency(acc.balance),
                  valueColor: 'text-red-400'
                })) || []
              }
            />

            <FinancialCard
              title={formatCurrency(bsTotals.equity)}
              subtitle="حقوق الملكية"
              icon={Banknote}
              variant="success"
              details={
                balanceSheet?.sections?.equity?.slice(0, 5).map(acc => ({
                  label: acc.name,
                  value: formatCurrency(acc.balance),
                  valueColor: 'text-emerald-400'
                })) || []
              }
            />
          </div>
        </div>
      )}

      {/* Income Statement Tab */}
      {activeTab === 'income' && (
        <div className="space-y-6">
          {/* Cash vs Credit quick cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FinancialCard
              title={formatCurrency(cfData.operating_activities?.cash_from_customers || 0)}
              subtitle="النقد المحصّل من العملاء"
              icon={Banknote}
              variant="success"
              expandable={false}
            />
            <FinancialCard
              title={formatCurrency(receivablesSummary?.total_ar || 0)}
              subtitle="المبيعات الآجلة (ذمم مدينة)"
              icon={TrendingUp}
              variant="warning"
              expandable={false}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FinancialCard
              title={formatCurrency(isTotals.revenue)}
              subtitle="إجمالي الإيرادات"
              icon={TrendingUp}
              trend="up"
              trendValue="+15%"
              variant="success"
              details={
                Object.entries(incomeStatement?.details?.revenue_by_account || {}).slice(0, 4).map(([code, data]) => ({
                  label: data.name || `حساب ${code}`,
                  value: formatCurrency(data.amount || 0)
                }))
              }
            />

            <FinancialCard
              title={formatCurrency(isTotals.expenses)}
              subtitle="إجمالي المصروفات"
              icon={TrendingUp}
              trend="down"
              variant="warning"
              details={
                Object.entries(incomeStatement?.details?.expenses_by_account || {}).slice(0, 4).map(([code, data]) => ({
                  label: data.name || `حساب ${code}`,
                  value: formatCurrency(data.amount || 0),
                  valueColor: 'text-red-400'
                }))
              }
            />

            <FinancialCard
              title={formatCurrency(isTotals.net_income)}
              subtitle="صافي الدخل"
              icon={TrendingUp}
              trend={isTotals.net_income >= 0 ? 'up' : 'down'}
              variant={isTotals.net_income >= 0 ? 'success' : 'danger'}
              details={[
                { label: 'الإيرادات', value: formatCurrency(isTotals.revenue) },
                { label: 'المصروفات', value: formatCurrency(isTotals.expenses), valueColor: 'text-red-400' },
                { label: 'صافي الدخل', value: formatCurrency(isTotals.net_income), valueColor: isTotals.net_income >= 0 ? 'text-emerald-400' : 'text-red-400' }
              ]}
            />

            <FinancialCard
              title={`${isTotals.revenue > 0 ? ((isTotals.net_income / isTotals.revenue) * 100).toFixed(1) : '0'}%`}
              subtitle="هامش الربح الصافي"
              icon={BarChart3}
              variant={isTotals.revenue > 0 && (isTotals.net_income / isTotals.revenue) > 0.2 ? 'success' : 'warning'}
              expandable={false}
            />
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FinancialCard
            title={formatCurrency(cfData.operating_activities?.net_operating_cash || 0)}
            subtitle="الأنشطة التشغيلية"
            icon={Banknote}
            trend={(cfData.operating_activities?.net_operating_cash || 0) >= 0 ? 'up' : 'down'}
            variant={(cfData.operating_activities?.net_operating_cash || 0) >= 0 ? 'success' : 'danger'}
            details={[
              { label: 'النقد من العملاء', value: formatCurrency(cfData.operating_activities?.cash_from_customers || 0) },
              { label: 'النقد للموردين', value: formatCurrency(cfData.operating_activities?.cash_to_suppliers || 0), valueColor: 'text-red-400' }
            ]}
          />

          <FinancialCard
            title={formatCurrency(cfData.investing_activities?.net_investing_cash || 0)}
            subtitle="الأنشطة الاستثمارية"
            icon={TrendingUp}
            variant="default"
            details={[
              { label: 'شراء معدات', value: formatCurrency(cfData.investing_activities?.equipment_purchases || 0), valueColor: 'text-red-400' }
            ]}
          />

          <FinancialCard
            title={formatCurrency(cfData.financing_activities?.net_financing_cash || 0)}
            subtitle="الأنشطة التمويلية"
            icon={Banknote}
            variant="warning"
            details={[
              { label: 'قروض جديدة', value: formatCurrency(cfData.financing_activities?.new_loans || 0), valueColor: 'text-emerald-400' }
            ]}
          />

          <FinancialCard
            title={formatCurrency(cfData.ending_cash || 0)}
            subtitle="رصيد النقد النهائي"
            icon={Banknote}
            variant="success"
            details={[
              { label: 'رصيد البداية', value: formatCurrency(cfData.beginning_cash || 0) },
              { label: 'صافي التغير', value: formatCurrency(cfData.net_change_in_cash || 0), valueColor: (cfData.net_change_in_cash || 0) >= 0 ? 'text-emerald-400' : 'text-red-400' }
            ]}
          />
        </div>
      )}

      {/* Receivables (AR) Tab */}
      {activeTab === 'receivables' && (
        <ARReceivablesTab />
      )}

      {/* Trial Balance Tab */}
      {activeTab === 'trial' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            ميزان المراجعة
          </h2>
          
          {trialBalance && trialBalance.length > 0 ? (
            <div className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-500 to-indigo-600">
                    <tr>
                      <th className="px-4 py-3 text-right text-white font-semibold">رمز الحساب</th>
                      <th className="px-4 py-3 text-right text-white font-semibold">اسم الحساب</th>
                      <th className="px-4 py-3 text-right text-white font-semibold">مدين</th>
                      <th className="px-4 py-3 text-right text-white font-semibold">دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.map((account, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50/5" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {account.code}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {account.name || account.name_ar}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(account.debit || 0)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(account.credit || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900/20 font-bold">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right" style={{ color: 'var(--text-primary)' }}>
                        الإجمالي
                      </td>
                      <td className="px-4 py-3 font-mono text-lg" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(trialBalance.reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto mb-4 text-slate-400" />
              <p style={{ color: 'var(--text-secondary)' }}>لا توجد حسابات في ميزان المراجعة</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComprehensiveFinancial;
