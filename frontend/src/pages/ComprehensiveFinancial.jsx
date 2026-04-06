import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarDays,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import ARReceivablesTab from '../components/ARReceivablesTab';

const tabs = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'balance', label: 'الميزانية' },
  { key: 'income', label: 'قائمة الدخل' },
  { key: 'cashflow', label: 'التدفقات النقدية' },
  { key: 'receivables', label: 'الذمم' },
  { key: 'trial', label: 'ميزان المراجعة' },
  { key: 'reconcile', label: 'مطابقة العمليات' },
];

const GlassCard = ({ title, value, subtitle, testId, accent = 'from-sky-500/25 to-cyan-400/10' }) => (
  <div
    className="rounded-3xl border border-white/15 bg-slate-950/45 backdrop-blur-2xl p-5 shadow-[0_10px_45px_-20px_rgba(14,165,233,0.55)]"
    data-testid={`${testId}-card`}
  >
    <div className={`h-1.5 w-28 rounded-full bg-gradient-to-r ${accent}`} />
    <p className="mt-3 text-xs text-slate-300" data-testid={`${testId}-title`}>{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-50" data-testid={testId}>{value}</p>
    {subtitle ? <p className="mt-2 text-xs text-slate-400" data-testid={`${testId}-subtitle`}>{subtitle}</p> : null}
  </div>
);

const safeDate = (date) => date.toISOString().split('T')[0];

export default function ComprehensiveFinancial() {
  const queryClient = useQueryClient();
  const workshopId = process.env.REACT_APP_WORKSHOP_ID;
  const [activeTab, setActiveTab] = useState('overview');
  const [startDate, setStartDate] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 14);
    return safeDate(start);
  });
  const [endDate, setEndDate] = useState(() => safeDate(new Date()));

  const commonParams = useMemo(() => ({ workshop_id: workshopId, start_date: startDate, end_date: endDate }), [workshopId, startDate, endDate]);

  const balanceSheetQuery = useQuery({
    queryKey: ['financial-balance-sheet', workshopId, endDate],
    queryFn: async () => {
      const res = await financeAPI.getBalanceSheet({ workshop_id: workshopId, as_of_date: endDate });
      return res.data?.data || null;
    },
    enabled: Boolean(workshopId),
  });

  const incomeStatementQuery = useQuery({
    queryKey: ['financial-income-statement', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getIncomeStatement(commonParams);
      return res.data?.data || null;
    },
    enabled: Boolean(workshopId),
  });

  const cashFlowQuery = useQuery({
    queryKey: ['financial-cash-flow', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getCashFlow(commonParams);
      return res.data?.data || null;
    },
    enabled: Boolean(workshopId),
  });

  const trialBalanceQuery = useQuery({
    queryKey: ['financial-trial-balance', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getTrialBalance(commonParams);
      return res.data?.data || { accounts: [], totals: { total_debit: 0, total_credit: 0 } };
    },
    enabled: Boolean(workshopId),
  });

  const receivablesSummaryQuery = useQuery({
    queryKey: ['financial-ar-summary', workshopId, endDate],
    queryFn: async () => {
      const res = await financeAPI.getARCustomers({ workshop_id: workshopId, as_of: endDate });
      return res.data?.data || { total_ar: 0, customers: [] };
    },
    enabled: Boolean(workshopId),
  });

  const reconciliationQuery = useQuery({
    queryKey: ['financial-reconciliation', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getReconciliation(commonParams);
      return res.data?.data || { summary: { matched: true, total_absolute_difference: 0 }, rows: [] };
    },
    enabled: Boolean(workshopId),
  });

  const loading = [
    balanceSheetQuery,
    incomeStatementQuery,
    cashFlowQuery,
    trialBalanceQuery,
    receivablesSummaryQuery,
    reconciliationQuery,
  ].some((query) => query.isLoading);

  const hasError = [
    balanceSheetQuery,
    incomeStatementQuery,
    cashFlowQuery,
    trialBalanceQuery,
    receivablesSummaryQuery,
    reconciliationQuery,
  ].some((query) => query.isError);

  const bsTotals = balanceSheetQuery.data?.totals || { assets: 0, liabilities: 0, equity: 0 };
  const incomeTotals = incomeStatementQuery.data?.totals || { revenue: 0, expenses: 0, net_income: 0 };
  const cashFlow = cashFlowQuery.data || {};
  const trialBalance = trialBalanceQuery.data || { accounts: [], totals: { total_debit: 0, total_credit: 0 } };
  const arSummary = receivablesSummaryQuery.data || { total_ar: 0, customers: [] };
  const reconciliation = reconciliationQuery.data || { summary: { matched: true, total_absolute_difference: 0 }, rows: [] };

  const profitMargin = incomeTotals.revenue > 0 ? (incomeTotals.net_income / incomeTotals.revenue) * 100 : 0;
  const isBalanceEquationHealthy = Math.abs((bsTotals.assets || 0) - ((bsTotals.liabilities || 0) + (bsTotals.equity || 0))) < 0.01;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['financial-balance-sheet', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-income-statement', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-cash-flow', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-trial-balance', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-ar-summary', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-reconciliation', workshopId] });
  };

  if (!workshopId) {
    return (
      <div className="max-w-4xl mx-auto p-6" dir="rtl">
        <div className="rounded-2xl border border-rose-300/40 bg-rose-500/10 p-5" data-testid="financial-missing-workshop-id-alert">
          <h2 className="text-lg font-semibold text-rose-200">تعذر تحميل اللوحة المالية</h2>
          <p className="text-sm text-rose-100 mt-1">المتغير REACT_APP_WORKSHOP_ID غير موجود في البيئة.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]" data-testid="financial-loading-state">
        <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="max-w-5xl mx-auto p-6" dir="rtl">
        <div className="rounded-3xl border border-amber-300/35 bg-amber-500/10 p-5" data-testid="financial-error-state">
          <h2 className="text-lg font-semibold text-amber-100">تعذر تحميل بعض البيانات المالية</h2>
          <p className="text-sm text-amber-50 mt-1">يمكنك إعادة التحديث الآن.</p>
          <button
            onClick={refreshAll}
            className="mt-4 rounded-xl px-4 py-2 bg-amber-500/20 border border-amber-200/35 text-amber-50"
            data-testid="financial-error-refresh-button"
          >
            إعادة التحديث
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6" dir="rtl">
      <div className="rounded-[34px] border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-5 md:p-7 shadow-[0_35px_120px_-45px_rgba(14,165,233,0.45)]">
        <div className="absolute pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight" data-testid="financial-dashboard-main-title">
              لوحة المؤشرات المالية
            </h1>
            <p className="text-sm md:text-base text-slate-300 mt-3" data-testid="financial-dashboard-main-subtitle">
              تصميم زجاجي شامل مع مطابقة تلقائية بين العمليات والقيود خلال الفترة المحددة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2" data-testid="financial-date-range-panel">
              <CalendarDays size={16} className="text-cyan-300" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm text-slate-100 outline-none"
                data-testid="financial-start-date-input"
              />
              <span className="text-slate-300">إلى</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm text-slate-100 outline-none"
                data-testid="financial-end-date-input"
              />
            </div>
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200/40 bg-cyan-500/20 px-3 py-2 text-cyan-50"
              data-testid="financial-refresh-button"
            >
              <RefreshCw size={16} />
              تحديث
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <GlassCard
            title="إجمالي الإيرادات"
            value={formatCurrency(incomeTotals.revenue || 0)}
            subtitle="من القيود اليومية خلال الفترة"
            testId="financial-metric-revenue"
          />
          <GlassCard
            title="إجمالي المصروفات"
            value={formatCurrency(incomeTotals.expenses || 0)}
            subtitle="تكاليف التشغيل والمشتريات"
            testId="financial-metric-expenses"
            accent="from-rose-500/25 to-orange-400/10"
          />
          <GlassCard
            title="صافي الربح"
            value={formatCurrency(incomeTotals.net_income || 0)}
            subtitle={`الهامش: ${profitMargin.toFixed(1)}%`}
            testId="financial-metric-net-income"
            accent={incomeTotals.net_income >= 0 ? 'from-emerald-500/25 to-teal-400/10' : 'from-rose-500/25 to-pink-400/10'}
          />
          <GlassCard
            title="إجمالي الذمم المدينة"
            value={formatCurrency(arSummary.total_ar || 0)}
            subtitle={`عدد العملاء: ${(arSummary.customers || []).length}`}
            testId="financial-metric-ar-total"
            accent="from-violet-500/25 to-blue-400/10"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm border transition-all ${
                activeTab === tab.key
                  ? 'bg-cyan-500/30 border-cyan-300/45 text-cyan-50'
                  : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
              }`}
              data-testid={`financial-tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="financial-overview-panel">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2" data-testid="financial-balance-status-title">
                <Scale size={16} className="text-cyan-300" />
                حالة معادلة الميزانية
              </h3>
              <p className={`mt-3 text-sm ${isBalanceEquationHealthy ? 'text-emerald-300' : 'text-rose-300'}`} data-testid="financial-balance-equation-status">
                {isBalanceEquationHealthy ? '✅ الميزانية متوازنة' : '⚠️ الميزانية غير متوازنة'}
              </p>
              <div className="mt-3 space-y-1 text-sm text-slate-200">
                <p data-testid="financial-overview-assets">الأصول: {formatCurrency(bsTotals.assets || 0)}</p>
                <p data-testid="financial-overview-liabilities-equity">الخصوم + حقوق الملكية: {formatCurrency((bsTotals.liabilities || 0) + (bsTotals.equity || 0))}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2" data-testid="financial-reconcile-summary-title">
                <ShieldCheck size={16} className="text-violet-300" />
                ملخص المطابقة المحاسبية
              </h3>
              <p
                className={`mt-3 text-sm ${reconciliation.summary?.matched ? 'text-emerald-300' : 'text-amber-300'}`}
                data-testid="financial-reconcile-summary-status"
              >
                {reconciliation.summary?.matched ? '✅ لا توجد فروقات' : '⚠️ توجد فروقات تحتاج مراجعة'}
              </p>
              <p className="mt-2 text-sm text-slate-100" data-testid="financial-reconcile-summary-diff">
                إجمالي الفروقات المطلقة: {formatCurrency(reconciliation.summary?.total_absolute_difference || 0)}
              </p>
              <p className="mt-1 text-xs text-slate-300" data-testid="financial-reconcile-summary-missing-journals">
                قيود العمليات المفقودة: {reconciliation.summary?.missing_operation_journals?.count || 0}
              </p>
              <p className="mt-1 text-xs text-slate-400" data-testid="financial-reconcile-summary-unclassified-journals">
                قيود غير مصنفة: {reconciliation.summary?.unclassified_journal_entries?.count || 0}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'balance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="financial-balance-panel">
            {[
              { key: 'assets', label: 'الأصول', list: balanceSheetQuery.data?.sections?.assets || [] },
              { key: 'liabilities', label: 'الخصوم', list: balanceSheetQuery.data?.sections?.liabilities || [] },
              { key: 'equity', label: 'حقوق الملكية', list: balanceSheetQuery.data?.sections?.equity || [] },
            ].map((section) => (
              <div key={section.key} className="rounded-3xl border border-white/15 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-white" data-testid={`financial-balance-${section.key}-title`}>{section.label}</h3>
                <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
                  {section.list.length ? section.list.map((acc, idx) => (
                    <div key={`${section.key}-${idx}`} className="rounded-xl border border-white/10 bg-slate-900/45 px-3 py-2">
                      <p className="text-xs text-slate-300" data-testid={`financial-balance-${section.key}-name-${idx}`}>{acc.name}</p>
                      <p className="text-sm text-slate-100 font-semibold" data-testid={`financial-balance-${section.key}-value-${idx}`}>{formatCurrency(acc.balance || 0)}</p>
                    </div>
                  )) : <p className="text-xs text-slate-400" data-testid={`financial-balance-${section.key}-empty`}>لا توجد بيانات</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'income' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="financial-income-panel">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
              <h3 className="text-sm text-emerald-300 font-semibold flex items-center gap-2" data-testid="financial-income-revenue-title">
                <TrendingUp size={14} />
                الإيرادات حسب الحساب
              </h3>
              <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
                {Object.entries(incomeStatementQuery.data?.details?.revenue_by_account || {}).map(([code, row], idx) => (
                  <div key={code} className="rounded-xl border border-emerald-300/15 bg-emerald-500/10 px-3 py-2">
                    <p className="text-xs text-emerald-100" data-testid={`financial-income-revenue-name-${idx}`}>{row.name || code}</p>
                    <p className="text-sm text-white" data-testid={`financial-income-revenue-value-${idx}`}>{formatCurrency(row.amount || 0)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
              <h3 className="text-sm text-rose-300 font-semibold flex items-center gap-2" data-testid="financial-income-expenses-title">
                <TrendingDown size={14} />
                المصروفات حسب الحساب
              </h3>
              <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
                {Object.entries(incomeStatementQuery.data?.details?.expenses_by_account || {}).map(([code, row], idx) => (
                  <div key={code} className="rounded-xl border border-rose-300/15 bg-rose-500/10 px-3 py-2">
                    <p className="text-xs text-rose-100" data-testid={`financial-income-expenses-name-${idx}`}>{row.name || code}</p>
                    <p className="text-sm text-white" data-testid={`financial-income-expenses-value-${idx}`}>{formatCurrency(row.amount || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="financial-cashflow-panel">
            <GlassCard
              title="التدفق التشغيلي"
              value={formatCurrency(cashFlow.operating_activities?.net_operating_cash || 0)}
              subtitle="صافي الأنشطة التشغيلية"
              testId="financial-cash-operating"
              accent="from-emerald-500/25 to-cyan-400/10"
            />
            <GlassCard
              title="التدفق الاستثماري"
              value={formatCurrency(cashFlow.investing_activities?.net_investing_cash || 0)}
              subtitle="صافي الأنشطة الاستثمارية"
              testId="financial-cash-investing"
              accent="from-indigo-500/25 to-sky-400/10"
            />
            <GlassCard
              title="التدفق التمويلي"
              value={formatCurrency(cashFlow.financing_activities?.net_financing_cash || 0)}
              subtitle="صافي الأنشطة التمويلية"
              testId="financial-cash-financing"
              accent="from-violet-500/25 to-fuchsia-400/10"
            />
            <GlassCard
              title="صافي التغير النقدي"
              value={formatCurrency(cashFlow.net_change_in_cash || 0)}
              subtitle="خلال الفترة المحددة"
              testId="financial-cash-net-change"
              accent="from-amber-500/25 to-orange-400/10"
            />
          </div>
        )}

        {activeTab === 'receivables' && (
          <div data-testid="financial-receivables-panel">
            <ARReceivablesTab />
          </div>
        )}

        {activeTab === 'trial' && (
          <div className="rounded-3xl border border-white/15 bg-white/5 p-4" data-testid="financial-trial-balance-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-200 border-b border-white/10">
                    <th className="p-3 text-right">الكود</th>
                    <th className="p-3 text-right">الحساب</th>
                    <th className="p-3 text-right">مدين</th>
                    <th className="p-3 text-right">دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {(trialBalance.accounts || []).map((acc, idx) => (
                    <tr key={`${acc.code}-${idx}`} className="border-b border-white/5 text-slate-100">
                      <td className="p-3" data-testid={`financial-trial-code-${idx}`}>{acc.code}</td>
                      <td className="p-3" data-testid={`financial-trial-name-${idx}`}>{acc.name || acc.name_ar}</td>
                      <td className="p-3" data-testid={`financial-trial-debit-${idx}`}>{formatCurrency(acc.debit || 0)}</td>
                      <td className="p-3" data-testid={`financial-trial-credit-${idx}`}>{formatCurrency(acc.credit || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-cyan-200 font-semibold">
                    <td className="p-3" colSpan={2}>الإجمالي</td>
                    <td className="p-3" data-testid="financial-trial-total-debit">{formatCurrency(trialBalance.totals?.total_debit || 0)}</td>
                    <td className="p-3" data-testid="financial-trial-total-credit">{formatCurrency(trialBalance.totals?.total_credit || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reconcile' && (
          <div className="rounded-3xl border border-white/15 bg-white/5 p-4" data-testid="financial-reconciliation-panel">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-100" data-testid="financial-reconcile-panel-summary">
              {reconciliation.summary?.matched ? (
                <ShieldCheck size={16} className="text-emerald-300" />
              ) : (
                <AlertTriangle size={16} className="text-amber-300" />
              )}
              <span>
                {reconciliation.summary?.matched ? 'مطابقة كاملة بين العمليات والقيود' : 'يوجد اختلاف بين العمليات والقيود'}
              </span>
            </div>
            <div className="mb-3 text-xs text-slate-300" data-testid="financial-reconcile-panel-metrics">
              <span>قيود مفقودة: {reconciliation.summary?.missing_operation_journals?.count || 0}</span>
              <span className="mx-2">|</span>
              <span>قيود غير مصنفة: {reconciliation.summary?.unclassified_journal_entries?.count || 0}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-200">
                    <th className="p-3 text-right">النوع</th>
                    <th className="p-3 text-right">عدد العمليات</th>
                    <th className="p-3 text-right">عدد القيود</th>
                    <th className="p-3 text-right">إجمالي العمليات</th>
                    <th className="p-3 text-right">إجمالي القيود</th>
                    <th className="p-3 text-right">الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {(reconciliation.rows || []).map((row, idx) => (
                    <tr key={`${row.type}-${idx}`} className="border-b border-white/5 text-slate-100">
                      <td className="p-3" data-testid={`financial-reconcile-type-${idx}`}>{row.type}</td>
                      <td className="p-3" data-testid={`financial-reconcile-op-count-${idx}`}>{row.operations_count}</td>
                      <td className="p-3" data-testid={`financial-reconcile-je-count-${idx}`}>{row.journal_entries_count}</td>
                      <td className="p-3" data-testid={`financial-reconcile-op-total-${idx}`}>{formatCurrency(row.operations_total || 0)}</td>
                      <td className="p-3" data-testid={`financial-reconcile-je-total-${idx}`}>{formatCurrency(row.journal_entries_total || 0)}</td>
                      <td className={`p-3 ${Math.abs(Number(row.difference || 0)) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`} data-testid={`financial-reconcile-diff-${idx}`}>
                        {formatCurrency(row.difference || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
