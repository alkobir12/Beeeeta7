import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
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
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountTreePage, setAccountTreePage] = useState(1);
  const [showChildrenTree, setShowChildrenTree] = useState(true);
  const [salesOpsPage, setSalesOpsPage] = useState(1);
  const [startDate, setStartDate] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 14);
    return safeDate(start);
  });
  const [endDate, setEndDate] = useState(() => safeDate(new Date()));

  const commonParams = useMemo(() => ({ workshop_id: workshopId, start_date: startDate, end_date: endDate }), [workshopId, startDate, endDate]);
  const shouldLoadCashFlow = activeTab === 'cashflow';
  const shouldLoadTrialBalance = activeTab === 'trial';

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
    enabled: Boolean(workshopId) && shouldLoadCashFlow,
  });

  const trialBalanceQuery = useQuery({
    queryKey: ['financial-trial-balance', workshopId, startDate, endDate],
    queryFn: async () => {
      const res = await financeAPI.getTrialBalance(commonParams);
      return res.data?.data || { accounts: [], totals: { total_debit: 0, total_credit: 0 } };
    },
    enabled: Boolean(workshopId) && shouldLoadTrialBalance,
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

  const chartAccountsQuery = useQuery({
    queryKey: ['financial-chart-of-accounts', workshopId],
    queryFn: async () => {
      const res = await financeAPI.getChartOfAccounts({ workshop_id: workshopId });
      return res.data?.data || [];
    },
    enabled: Boolean(workshopId),
  });

  const accountTreeDetailsQuery = useQuery({
    queryKey: ['financial-account-tree-details', workshopId, selectedAccount?.code, startDate, endDate, accountTreePage],
    queryFn: async () => {
      if (!selectedAccount?.code) return null;
      const res = await financeAPI.getAccountTreeDetails({
        workshop_id: workshopId,
        account_code: selectedAccount.code,
        start_date: startDate,
        end_date: endDate,
        include_descendants: true,
        page: accountTreePage,
        page_size: 20,
      });
      return res.data?.data || null;
    },
    enabled: Boolean(workshopId && selectedAccount?.code),
  });

  const salesOperationsQuery = useQuery({
    queryKey: ['financial-sales-operations', workshopId, startDate, endDate, salesOpsPage],
    queryFn: async () => {
      const res = await financeAPI.getAccountTreeDetails({
        workshop_id: workshopId,
        account_code: '4000',
        start_date: startDate,
        end_date: endDate,
        include_descendants: true,
        page: salesOpsPage,
        page_size: 10,
      });
      return res.data?.data || null;
    },
    enabled: Boolean(workshopId),
  });

  const loading = [
    balanceSheetQuery,
    incomeStatementQuery,
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
  const chartAccounts = chartAccountsQuery.data || [];
  const accountTree = accountTreeDetailsQuery.data || null;
  const salesOperationsData = salesOperationsQuery.data || null;

  const accountNameMap = useMemo(() => {
    const map = {};
    chartAccounts.forEach((acc) => {
      const code = String(acc?.code || '').trim();
      if (!code) return;
      map[code] = acc?.name || acc?.name_ar || code;
    });
    return map;
  }, [chartAccounts]);

  const revenueEntries = Object.entries(incomeStatementQuery.data?.details?.revenue_by_account || {});
  const expenseEntries = Object.entries(incomeStatementQuery.data?.details?.expenses_by_account || {});

  const resolveReadableAccountName = (code, rawName) => {
    const fallback = rawName || '';
    if (accountNameMap[code]) return accountNameMap[code];
    if (!fallback) return code;
    const trimmed = String(fallback).trim();
    if (!trimmed || trimmed === code || /^[0-9]+$/.test(trimmed)) {
      return accountNameMap[code] || code;
    }
    return trimmed;
  };

  const reconcileTypeLabelMap = {
    sale: 'بيع',
    purchase: 'شراء',
    expense: 'مصروف',
    sale_return: 'مرتجع بيع',
    purchase_return: 'مرتجع شراء',
    payment_order: 'أمر سداد',
  };

  const currentCashBalance = Number((incomeTotals.revenue || 0) - (incomeTotals.expenses || 0));
  const salesSummary = salesOperationsData?.operations?.summary || {
    total_credit: 0,
    total_cash_component: 0,
    total_receivable_component: 0,
    operations_cash_total: 0,
    operations_credit_total: 0,
  };

  const profitMargin = incomeTotals.revenue > 0 ? (incomeTotals.net_income / incomeTotals.revenue) * 100 : 0;
  const isBalanceEquationHealthy = Math.abs((bsTotals.assets || 0) - ((bsTotals.liabilities || 0) + (bsTotals.equity || 0))) < 0.01;

  useEffect(() => {
    setSalesOpsPage(1);
  }, [startDate, endDate]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['financial-balance-sheet', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-income-statement', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-cash-flow', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-trial-balance', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-ar-summary', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-reconciliation', workshopId] });
    queryClient.invalidateQueries({ queryKey: ['financial-chart-of-accounts', workshopId] });
    if (selectedAccount?.code) {
      queryClient.invalidateQueries({ queryKey: ['financial-account-tree-details', workshopId, selectedAccount.code] });
    }
    queryClient.invalidateQueries({ queryKey: ['financial-sales-operations', workshopId] });
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <GlassCard
            title="النقد الفعلي"
            value={formatCurrency(currentCashBalance || 0)}
            subtitle="الإيرادات - المصروفات"
            testId="financial-metric-current-cash"
            accent="from-cyan-500/25 to-blue-400/10"
          />
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
          <div className="space-y-4" data-testid="financial-income-panel">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/5 p-4" data-testid="financial-sales-operations-block">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm text-cyan-100 font-semibold" data-testid="financial-sales-operations-title">عمليات البيع (مع الإجمالي)</h3>
                  <p className="text-[11px] text-cyan-200/80">يعرض البيع الكلي، المحصل نقدًا، والذمم غير المسددة.</p>
                </div>
                <div className="text-xs text-cyan-100 space-y-1 text-left" data-testid="financial-sales-operations-summary">
                  <p>إجمالي البيع: <span className="font-semibold">{formatCurrency(salesSummary.total_credit || 0)}</span></p>
                  <p>المحصل نقدًا: <span className="font-semibold">{formatCurrency(salesSummary.operations_cash_total || 0)}</span></p>
                  <p>آجل غير مسدد: <span className="font-semibold">{formatCurrency(salesSummary.operations_credit_total || 0)}</span></p>
                </div>
              </div>

              {salesOperationsQuery.isLoading ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300" data-testid="financial-sales-operations-loading-state">
                  جاري تحميل عمليات البيع...
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto" data-testid="financial-sales-operations-table-wrap">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-300">
                          <th className="p-2 text-right">التاريخ</th>
                          <th className="p-2 text-right">الوصف</th>
                          <th className="p-2 text-right">النوع</th>
                          <th className="p-2 text-right">المبلغ</th>
                          <th className="p-2 text-right">نقدي</th>
                          <th className="p-2 text-right">آجل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(salesOperationsData?.operations?.items || []).map((item, idx) => (
                          <tr key={`${item.entry_id}-${idx}`} className="border-b border-white/5 text-slate-100">
                            <td className="p-2" data-testid={`financial-sales-op-date-${idx}`}>{String(item.date || '').slice(0, 10)}</td>
                            <td className="p-2" data-testid={`financial-sales-op-description-${idx}`}>{item.description || '-'}</td>
                            <td className="p-2" data-testid={`financial-sales-op-type-${idx}`}>{item.transaction_type_label_ar || item.transaction_type || '-'}</td>
                            <td className="p-2" data-testid={`financial-sales-op-total-${idx}`}>{formatCurrency(item.credit || 0)}</td>
                            <td className="p-2" data-testid={`financial-sales-op-cash-${idx}`}>{formatCurrency(item.cash_component || 0)}</td>
                            <td className="p-2" data-testid={`financial-sales-op-ar-${idx}`}>{formatCurrency(item.receivable_component || 0)}</td>
                          </tr>
                        ))}
                        {!(salesOperationsData?.operations?.items || []).length && (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400" data-testid="financial-sales-op-empty">لا توجد عمليات بيع ضمن الفترة.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex items-center justify-between" data-testid="financial-sales-operations-pagination">
                    <button
                      type="button"
                      onClick={() => setSalesOpsPage((p) => Math.max(1, p - 1))}
                      disabled={!salesOperationsData?.operations?.pagination?.has_prev}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-40"
                      data-testid="financial-sales-operations-prev-page-button"
                    >
                      السابق
                    </button>
                    <span className="text-xs text-slate-300" data-testid="financial-sales-operations-pagination-info">
                      صفحة {salesOperationsData?.operations?.pagination?.page || 1} / {salesOperationsData?.operations?.pagination?.total_pages || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSalesOpsPage((p) => p + 1)}
                      disabled={!salesOperationsData?.operations?.pagination?.has_next}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-40"
                      data-testid="financial-sales-operations-next-page-button"
                    >
                      التالي
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
                <h3 className="text-sm text-emerald-300 font-semibold flex items-center gap-2" data-testid="financial-income-revenue-title">
                  <TrendingUp size={14} />
                  الإيرادات حسب الحساب
                  <span className="text-[10px] text-slate-400">(اضغط لعرض الشجرة والعمليات)</span>
                </h3>
                <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
                  {revenueEntries.map(([code, row], idx) => {
                    const accountName = resolveReadableAccountName(code, row?.name);
                    const isSelected = selectedAccount?.code === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setSelectedAccount({ code, name: accountName });
                          setAccountTreePage(1);
                        }}
                        className={`w-full text-right rounded-xl border px-3 py-2 transition-all ${isSelected ? 'border-cyan-300/50 bg-cyan-500/15' : 'border-emerald-300/15 bg-emerald-500/10 hover:bg-emerald-500/20'}`}
                        data-testid={`financial-income-revenue-account-button-${idx}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-emerald-100" data-testid={`financial-income-revenue-name-${idx}`}>{accountName}</p>
                            <p className="text-[10px] text-emerald-200/80">{code}</p>
                          </div>
                          {isSelected ? <ChevronDown size={14} className="text-cyan-200" /> : <ChevronRight size={14} className="text-emerald-200" />}
                        </div>
                        <p className="text-sm text-white mt-1" data-testid={`financial-income-revenue-value-${idx}`}>{formatCurrency(row.amount || 0)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/5 p-4">
                <h3 className="text-sm text-rose-300 font-semibold flex items-center gap-2" data-testid="financial-income-expenses-title">
                  <TrendingDown size={14} />
                  المصروفات حسب الحساب
                  <span className="text-[10px] text-slate-400">(اضغط لعرض الشجرة والعمليات)</span>
                </h3>
                <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
                  {expenseEntries.map(([code, row], idx) => {
                    const accountName = resolveReadableAccountName(code, row?.name);
                    const isSelected = selectedAccount?.code === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setSelectedAccount({ code, name: accountName });
                          setAccountTreePage(1);
                        }}
                        className={`w-full text-right rounded-xl border px-3 py-2 transition-all ${isSelected ? 'border-cyan-300/50 bg-cyan-500/15' : 'border-rose-300/15 bg-rose-500/10 hover:bg-rose-500/20'}`}
                        data-testid={`financial-income-expenses-account-button-${idx}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-rose-100" data-testid={`financial-income-expenses-name-${idx}`}>{accountName}</p>
                            <p className="text-[10px] text-rose-200/80">{code}</p>
                          </div>
                          {isSelected ? <ChevronDown size={14} className="text-cyan-200" /> : <ChevronRight size={14} className="text-rose-200" />}
                        </div>
                        <p className="text-sm text-white mt-1" data-testid={`financial-income-expenses-value-${idx}`}>{formatCurrency(row.amount || 0)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedAccount && (
              <div className="rounded-3xl border border-cyan-300/30 bg-cyan-500/5 p-4" data-testid="financial-income-account-tree-panel">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-cyan-200">تفاصيل الحساب المحدد</p>
                    <h4 className="text-sm font-semibold text-white" data-testid="financial-income-selected-account-name">
                      {selectedAccount.name} ({selectedAccount.code})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChildrenTree((v) => !v)}
                    className="rounded-xl border border-cyan-200/35 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-50"
                    data-testid="financial-income-toggle-children-tree-button"
                  >
                    {showChildrenTree ? 'إخفاء الفروع' : 'إظهار الفروع'}
                  </button>
                </div>

                {showChildrenTree && (
                  <div className="mb-3" data-testid="financial-income-children-tree-list">
                    <p className="text-[11px] text-slate-300 mb-2">الحسابات الفرعية</p>
                    <div className="flex flex-wrap gap-2">
                      {(accountTree?.children || []).length ? (accountTree.children || []).map((child, idx) => (
                        <button
                          key={`${child.code}-${idx}`}
                          type="button"
                          onClick={() => {
                            setSelectedAccount({ code: child.code, name: child.name || child.code });
                            setAccountTreePage(1);
                          }}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-100"
                          data-testid={`financial-income-child-account-button-${idx}`}
                        >
                          {child.name} ({child.code})
                        </button>
                      )) : <span className="text-xs text-slate-400">لا توجد حسابات فرعية</span>}
                    </div>
                  </div>
                )}

                {accountTreeDetailsQuery.isLoading ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300" data-testid="financial-income-account-tree-loading-state">
                    جاري تحميل تفاصيل الحساب والعمليات...
                  </div>
                ) : (
                <div className="overflow-x-auto" data-testid="financial-income-account-operations-table-wrap">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-300">
                        <th className="p-2 text-right">التاريخ</th>
                        <th className="p-2 text-right">الوصف</th>
                        <th className="p-2 text-right">النوع</th>
                        <th className="p-2 text-right">مدين</th>
                        <th className="p-2 text-right">دائن</th>
                        <th className="p-2 text-right">حساب مقابل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(accountTree?.operations?.items || []).map((entry, idx) => (
                        <tr key={`${entry.entry_id}-${idx}`} className="border-b border-white/5 text-slate-100">
                          <td className="p-2" data-testid={`financial-income-account-op-date-${idx}`}>{String(entry.date || '').slice(0, 10)}</td>
                          <td className="p-2" data-testid={`financial-income-account-op-desc-${idx}`}>{entry.description || '-'}</td>
                          <td className="p-2" data-testid={`financial-income-account-op-type-${idx}`}>{entry.transaction_type_label_ar || entry.transaction_type || '-'}</td>
                          <td className="p-2" data-testid={`financial-income-account-op-debit-${idx}`}>{formatCurrency(entry.debit || 0)}</td>
                          <td className="p-2" data-testid={`financial-income-account-op-credit-${idx}`}>{formatCurrency(entry.credit || 0)}</td>
                          <td className="p-2" data-testid={`financial-income-account-op-counterparts-${idx}`}>
                            {(entry.counterpart_accounts || []).map((cp) => cp.name || cp.code).join(' • ') || '-'}
                          </td>
                        </tr>
                      ))}
                      {!(accountTree?.operations?.items || []).length && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400" data-testid="financial-income-account-op-empty">لا توجد عمليات لهذا الحساب ضمن الفترة.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}

                <div className="mt-3 flex items-center justify-between" data-testid="financial-income-account-pagination">
                  <button
                    type="button"
                    onClick={() => setAccountTreePage((p) => Math.max(1, p - 1))}
                    disabled={!accountTree?.operations?.pagination?.has_prev}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-40"
                    data-testid="financial-income-account-prev-page-button"
                  >
                    السابق
                  </button>
                  <span className="text-xs text-slate-300" data-testid="financial-income-account-pagination-info">
                    صفحة {accountTree?.operations?.pagination?.page || 1} / {accountTree?.operations?.pagination?.total_pages || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAccountTreePage((p) => p + 1)}
                    disabled={!accountTree?.operations?.pagination?.has_next}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-40"
                    data-testid="financial-income-account-next-page-button"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cashflow' && (
          cashFlowQuery.isLoading ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-slate-300" data-testid="financial-cashflow-loading-state">
              جاري تحميل بيانات التدفقات النقدية...
            </div>
          ) : (
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
          )
        )}

        {activeTab === 'receivables' && (
          <div data-testid="financial-receivables-panel">
            <ARReceivablesTab />
          </div>
        )}

        {activeTab === 'trial' && (
          trialBalanceQuery.isLoading ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-slate-300" data-testid="financial-trial-loading-state">
              جاري تحميل ميزان المراجعة...
            </div>
          ) : (
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
          )
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
                      <td className="p-3" data-testid={`financial-reconcile-type-${idx}`}>
                        <div className="font-medium">{row.type_label_ar || reconcileTypeLabelMap[row.type] || row.type}</div>
                        {(row.account_labels || []).length ? (
                          <div className="text-[10px] text-slate-400 mt-1" data-testid={`financial-reconcile-type-accounts-${idx}`}>
                            {(row.account_labels || []).join(' • ')}
                          </div>
                        ) : null}
                      </td>
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
