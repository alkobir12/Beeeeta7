import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Loader2, RefreshCw, ShoppingCart, TrendingUp, Wrench, Cog } from 'lucide-react';
import { api, financeAPI, operationsAPI, partAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { InventoryPlannerTab } from '../components/parts-dashboard/InventoryPlannerTab';
import { RakanExpenseTrackingPanel } from '../components/parts-dashboard/RakanExpenseTrackingPanel';
import { RakanPriceTimelinePanel } from '../components/parts-dashboard/RakanPriceTimelinePanel';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

const pctClass = (value) => {
  if (value > 0) return 'text-rose-300';
  if (value < 0) return 'text-emerald-300';
  return 'text-slate-300';
};

const deltaTone = (value) => {
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-rose-300';
  return 'text-slate-300';
};

const HIGH_VOLATILITY_THRESHOLD = 15;

const formatLearningStatus = (value, ready, samples) => {
  if (ready) {
    return formatCurrency(value);
  }
  return `قيد التعلم (${samples}/5)`;
};

const backorderStatusOptions = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'ordered', label: 'تم الطلب' },
  { value: 'arrived', label: 'وصلت' },
  { value: 'cancelled', label: 'ملغية' },
];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeAccountCode = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('acc-') && /^acc-\d+$/.test(raw)) return raw.replace('acc-', '');
  return raw;
};

const WORKSHOP_ACCOUNT_TARGETS = [
  {
    key: 'workshop-parts',
    title: 'حساب قطع غيار الورشة',
    icon: Wrench,
    color: '#38bdf8',
    keywords: ['قطع غيار الورشة', 'قطع غيار الورشه', 'قطع الورشة', 'قطع الورشه'],
  },
  {
    key: 'engine-repair',
    title: 'حساب إصلاح المحركات',
    icon: Cog,
    color: '#f59e0b',
    keywords: ['إصلاح المحركات', 'اصلاح المحركات', 'إصلاح محركات', 'اصلاح محركات'],
  },
];

const PartsDashboard = () => {
  const [daysFilter, setDaysFilter] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [backorders, setBackorders] = useState([]);
  const [backorderStatusFilter, setBackorderStatusFilter] = useState('all');
  const [loadingBackorders, setLoadingBackorders] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [rakanAnalytics, setRakanAnalytics] = useState(null);
  const [loadingRakanAnalytics, setLoadingRakanAnalytics] = useState(true);
  const [inventoryArchitecture, setInventoryArchitecture] = useState(null);
  const [loadingInventoryArchitecture, setLoadingInventoryArchitecture] = useState(true);
  const [workshopAccountStats, setWorkshopAccountStats] = useState([]);
  const [loadingWorkshopAccountStats, setLoadingWorkshopAccountStats] = useState(true);
  const [expandedRakanCard, setExpandedRakanCard] = useState('profitability');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState('all');
  const [savingBackorder, setSavingBackorder] = useState(false);
  const [resettingTotals, setResettingTotals] = useState(false);
  const [partsList, setPartsList] = useState([]);
  const [formData, setFormData] = useState({
    part_id: '',
    part_name: '',
    requested_quantity: 1,
    customer_name: '',
    customer_phone: '',
    vehicle_reference: '',
    expected_date: '',
    note: '',
  });

  const buildWorkshopAccountCards = (accounts, operations) => {
    const periodStart = Date.now() - (Number(daysFilter || 30) * 24 * 60 * 60 * 1000);
    return WORKSHOP_ACCOUNT_TARGETS.map((target) => {
      const account = accounts.find((acc) => {
        const haystack = [acc?.name, acc?.name_ar, acc?.code].map((v) => normalizeText(v)).join(' ');
        return target.keywords.some((keyword) => haystack.includes(normalizeText(keyword)));
      });

      if (!account) {
        return {
          ...target,
          accountFound: false,
          accountName: 'غير موجود',
          balance: 0,
          periodOpsCount: 0,
          periodAmount: 0,
          lastMovementDate: null,
        };
      }

      const accountIds = new Set([
        normalizeText(account?.id),
        normalizeText(account?.code),
        normalizeText(normalizeAccountCode(account?.code)),
      ].filter(Boolean));

      const matchedOps = operations.filter((op) => {
        const possibleIds = [
          op?.accountingAccountId,
          op?.accountId,
          op?.account_code,
          normalizeAccountCode(op?.accountingAccountId),
          normalizeAccountCode(op?.accountId),
          normalizeAccountCode(op?.account_code),
        ].map((v) => normalizeText(v)).filter(Boolean);
        return possibleIds.some((id) => accountIds.has(id));
      });

      const periodOps = matchedOps.filter((op) => {
        const rawDate = op?.date || op?.createdAt || op?.created_at;
        const ts = rawDate ? new Date(rawDate).getTime() : NaN;
        return Number.isFinite(ts) && ts >= periodStart;
      });

      const sortedOps = [...matchedOps].sort((a, b) => {
        const aTs = new Date(a?.date || a?.createdAt || a?.created_at || 0).getTime();
        const bTs = new Date(b?.date || b?.createdAt || b?.created_at || 0).getTime();
        return bTs - aTs;
      });

      return {
        ...target,
        accountFound: true,
        accountName: account?.name_ar || account?.name || account?.code || target.title,
        balance: Number(account?.balance || 0),
        periodOpsCount: periodOps.length,
        periodAmount: periodOps.reduce((sum, op) => sum + Number(op?.total || op?.amount || 0), 0),
        lastMovementDate: sortedOps[0]?.date || sortedOps[0]?.createdAt || sortedOps[0]?.created_at || null,
      };
    });
  };

  const loadControlPanel = async () => {
    setLoadingAnalytics(true);
    try {
      const { data } = await api.get('/inventory/control-panel', { params: { days: daysFilter } });
      setAnalytics(data || null);
    } catch (error) {
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadBackorders = async () => {
    setLoadingBackorders(true);
    try {
      const params = backorderStatusFilter !== 'all' ? { status: backorderStatusFilter } : undefined;
      const { data } = await api.get('/inventory/backorders', { params });
      setBackorders(Array.isArray(data) ? data : []);
    } catch (error) {
      setBackorders([]);
    } finally {
      setLoadingBackorders(false);
    }
  };

  const loadParts = async () => {
    try {
      const response = await partAPI.getAll();
      setPartsList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPartsList([]);
    }
  };

  const loadRakanAnalytics = async () => {
    setLoadingRakanAnalytics(true);
    try {
      const { data } = await api.get('/inventory/rakan-analytics', { params: { days: daysFilter } });
      setRakanAnalytics(data || null);
    } catch (error) {
      setRakanAnalytics(null);
    } finally {
      setLoadingRakanAnalytics(false);
    }
  };

  const loadInventoryArchitecture = async () => {
    setLoadingInventoryArchitecture(true);
    try {
      const { data } = await api.get('/inventory/architecture', { params: { days: daysFilter } });
      setInventoryArchitecture(data || null);
    } catch (error) {
      setInventoryArchitecture(null);
    } finally {
      setLoadingInventoryArchitecture(false);
    }
  };

  const loadWorkshopAccountStats = async () => {
    setLoadingWorkshopAccountStats(true);

    const readCachedArray = (key) => {
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    };

    const cachedOperations = readCachedArray('operationsCache:all');
    const cachedAccounts = readCachedArray('chartAccountsCache:all');

    if (cachedAccounts.length) {
      setWorkshopAccountStats(buildWorkshopAccountCards(cachedAccounts, cachedOperations));
      setLoadingWorkshopAccountStats(false);
    }

    try {
      const [accountsRes, operationsRes] = await Promise.all([
        financeAPI.getChartOfAccounts(),
        cachedOperations.length ? Promise.resolve({ data: cachedOperations }) : operationsAPI.list({ limit: 120 }),
      ]);

      const accountsPayload = accountsRes?.data;
      const accounts = Array.isArray(accountsPayload?.data)
        ? accountsPayload.data
        : Array.isArray(accountsPayload)
          ? accountsPayload
          : [];

      const operationsPayload = operationsRes?.data;
      const operations = Array.isArray(operationsPayload) ? operationsPayload : [];
      if (accounts.length) {
        localStorage.setItem('chartAccountsCache:all', JSON.stringify(accounts));
      }

      setWorkshopAccountStats(buildWorkshopAccountCards(accounts, operations));
    } catch (error) {
      if (!cachedAccounts.length) {
        setWorkshopAccountStats(
          WORKSHOP_ACCOUNT_TARGETS.map((target) => ({
            ...target,
            accountFound: false,
            accountName: 'تعذر تحميل الحساب',
            balance: 0,
            periodOpsCount: 0,
            periodAmount: 0,
            lastMovementDate: null,
          }))
        );
      }
    } finally {
      setLoadingWorkshopAccountStats(false);
    }
  };

  const handleResetInventoryTotals = async () => {
    const confirmed = window.confirm('سيتم إعادة ضبط إجمالي المبيعات والمصروفات في لوحة القطع وأرشفة العمليات السابقة. هل تريد المتابعة؟');
    if (!confirmed) return;

    setResettingTotals(true);
    try {
      await api.post('/inventory/reset-totals');
      await Promise.all([
        loadControlPanel(),
        loadRakanAnalytics(),
        loadWorkshopAccountStats(),
      ]);
    } finally {
      setResettingTotals(false);
    }
  };

  useEffect(() => {
    loadControlPanel();
    loadRakanAnalytics();
    loadInventoryArchitecture();
    loadWorkshopAccountStats();
  }, [daysFilter]);

  useEffect(() => {
    loadBackorders();
  }, [backorderStatusFilter]);

  useEffect(() => {
    loadParts();
  }, []);

  const handleCreateBackorder = async (event) => {
    event.preventDefault();
    if (!formData.customer_name.trim()) return;

    const selectedPart = partsList.find((part) => part.id === formData.part_id);
    const resolvedPartName = formData.part_name || selectedPart?.name || '';
    if (!resolvedPartName) return;

    try {
      setSavingBackorder(true);
      await api.post('/inventory/backorders', {
        part_id: formData.part_id || null,
        part_name: resolvedPartName,
        requested_quantity: Number(formData.requested_quantity || 1),
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        vehicle_reference: formData.vehicle_reference || null,
        expected_date: formData.expected_date || null,
        note: formData.note || null,
      });
      setFormData({
        part_id: '',
        part_name: '',
        requested_quantity: 1,
        customer_name: '',
        customer_phone: '',
        vehicle_reference: '',
        expected_date: '',
        note: '',
      });
      await Promise.all([loadBackorders(), loadControlPanel()]);
    } finally {
      setSavingBackorder(false);
    }
  };

  const updateBackorderStatus = async (backorderId, status) => {
    await api.patch(`/inventory/backorders/${backorderId}/status`, { status });
    await Promise.all([loadBackorders(), loadControlPanel()]);
  };

  const overview = analytics?.overview || {};
  const priceTrendHighlights = rakanAnalytics?.price_trend || [];
  const expenseBreakdown = rakanAnalytics?.expense_breakdown || [];
  const learnedPricing = rakanAnalytics?.learned_pricing || [];
  const periodDelta = rakanAnalytics?.period_delta || {};
  const cards = useMemo(
    () => [
      { key: 'inventory-cost', label: 'قيمة المخزون (تكلفة)', value: formatCurrency(overview.inventory_cost_value), icon: ShoppingCart, color: '#22c55e' },
      { key: 'inventory-retail', label: 'قيمة المخزون (بيع)', value: formatCurrency(overview.inventory_retail_value), icon: BarChart3, color: '#38bdf8' },
      { key: 'period-ops', label: 'عمليات الفترة', value: Number((analytics?.recent_part_operations || []).length).toLocaleString('ar-SA'), icon: TrendingUp, color: '#8b5cf6' },
      { key: 'low', label: 'منخفض المخزون', value: overview.low_stock_count || 0, icon: AlertTriangle, color: '#f97316' },
      { key: 'out', label: 'نافد المخزون', value: overview.out_of_stock_count || 0, icon: Boxes, color: '#ef4444' },
      { key: 'parts', label: 'إجمالي الأصناف', value: overview.total_parts || 0, icon: ClipboardList, color: '#a78bfa' },
    ],
    [overview, analytics]
  );

  return (
    <div className="p-6 space-y-6" data-testid="parts-control-panel-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="parts-control-panel-title">Parts Control Panel</h1>
          <p className="text-slate-400" data-testid="parts-control-panel-subtitle">
            تحليلات ذكية للمبيعات والمخزون وإدارة backorders من شاشة واحدة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="filter-select"
            value={daysFilter}
            onChange={(e) => setDaysFilter(Number(e.target.value))}
            data-testid="parts-control-days-filter"
          >
            <option value={30}>آخر 30 يوم</option>
            <option value={60}>آخر 60 يوم</option>
            <option value={90}>آخر 90 يوم</option>
            <option value={180}>آخر 180 يوم</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="bg-white/10 text-white border-white/20"
            onClick={() => Promise.all([loadControlPanel(), loadBackorders(), loadRakanAnalytics(), loadInventoryArchitecture(), loadWorkshopAccountStats()])}
            data-testid="parts-control-refresh-button"
          >
            <RefreshCw size={16} className="ml-1" /> تحديث
          </Button>
          <Button
            type="button"
            variant="outline"
            className="bg-rose-500/15 text-rose-100 border-rose-300/30"
            onClick={handleResetInventoryTotals}
            disabled={resettingTotals}
            data-testid="parts-control-reset-totals-button"
          >
            {resettingTotals ? <Loader2 size={16} className="ml-1 animate-spin" /> : null}
            إعادة ضبط الإجماليات
          </Button>
        </div>
      </div>

      {(overview?.totals_reset_at || rakanAnalytics?.totals_reset_at) && (
        <div className="glass-card p-3 text-xs text-amber-200" data-testid="parts-control-reset-totals-note">
          أرشيف العمليات السابقة مفعل من تاريخ: {new Date(overview?.totals_reset_at || rakanAnalytics?.totals_reset_at).toLocaleString('ar-SA')}
        </div>
      )}

      {loadingWorkshopAccountStats ? (
        <div className="glass-card p-5 text-slate-300 flex items-center gap-2" data-testid="parts-control-workshop-account-loading">
          <Loader2 className="animate-spin" size={16} /> جاري تحميل إحصائيات حسابات الورشة...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="parts-control-workshop-account-cards">
          {workshopAccountStats.map((card) => (
            <div key={card.key} className="glass-card p-5 border-t-4" style={{ borderColor: card.color }} data-testid={`parts-control-workshop-account-card-${card.key}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-300" data-testid={`parts-control-workshop-account-title-${card.key}`}>{card.title}</p>
                  <p className="text-xs text-slate-400" data-testid={`parts-control-workshop-account-name-${card.key}`}>{card.accountName}</p>
                </div>
                <card.icon size={18} style={{ color: card.color }} />
              </div>
              <p className="text-2xl font-bold text-white" data-testid={`parts-control-workshop-account-balance-${card.key}`}>
                {formatCurrency(card.balance)}
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/5 p-2" data-testid={`parts-control-workshop-account-period-ops-${card.key}`}>
                  <p className="text-slate-400">عمليات الفترة</p>
                  <p className="text-white font-semibold">{Number(card.periodOpsCount || 0).toLocaleString('ar-SA')}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2" data-testid={`parts-control-workshop-account-period-amount-${card.key}`}>
                  <p className="text-slate-400">إجمالي الفترة</p>
                  <p className="text-white font-semibold">{formatCurrency(card.periodAmount)}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400" data-testid={`parts-control-workshop-account-last-movement-${card.key}`}>
                آخر حركة: {card.lastMovementDate ? new Date(card.lastMovementDate).toLocaleDateString('ar-SA') : 'لا توجد'}
              </p>
              {!card.accountFound && (
                <p className="mt-2 text-[11px] text-amber-300" data-testid={`parts-control-workshop-account-missing-${card.key}`}>
                  لم يتم العثور على الحساب في دليل الحسابات.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2" data-testid="parts-control-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl text-sm border ${activeTab === 'overview' ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100' : 'bg-white/5 border-white/10 text-slate-300'}`}
          data-testid="parts-control-tab-overview"
        >
          النظرة العامة
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rakan')}
          className={`px-4 py-2.5 rounded-xl text-sm border ${activeTab === 'rakan' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-white/5 border-white/10 text-slate-300'}`}
          data-testid="parts-control-tab-rakan"
        >
          تحليلات قطع راكان
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('planner')}
          className={`px-4 py-2.5 rounded-xl text-sm border ${activeTab === 'planner' ? 'bg-sky-500/20 border-sky-400/40 text-sky-100' : 'bg-white/5 border-white/10 text-slate-300'}`}
          data-testid="parts-control-tab-planner"
        >
          معمارية المخزون
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backorders')}
          className={`px-4 py-2.5 rounded-xl text-sm border ${activeTab === 'backorders' ? 'bg-amber-500/20 border-amber-400/40 text-amber-100' : 'bg-white/5 border-white/10 text-slate-300'}`}
          data-testid="parts-control-tab-backorders"
        >
          Backorders
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="parts-control-overview-cards">
            {cards.map((card) => (
              <div key={card.key} className="glass-card p-5 border-t-4" style={{ borderColor: card.color }} data-testid={`parts-control-card-${card.key}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-300">{card.label}</p>
                  <card.icon size={18} style={{ color: card.color }} />
                </div>
                <p className="text-2xl font-bold text-white" data-testid={`parts-control-card-value-${card.key}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {loadingAnalytics && (
            <div className="glass-card p-5 text-slate-300 flex items-center gap-2" data-testid="parts-control-loading">
              <Loader2 className="animate-spin" size={16} /> جاري تحميل التحليلات...
            </div>
          )}

          {!loadingAnalytics && analytics && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="parts-control-kpis-section">
                <div className="glass-card p-4" data-testid="parts-control-top-selling-card">
                  <h2 className="text-white font-semibold mb-3">الأكثر مبيعًا</h2>
                  <div className="space-y-2">
                    {(analytics.top_selling_parts || []).slice(0, 8).map((part) => (
                      <div key={part.part_id} className="flex items-center justify-between text-sm" data-testid={`parts-control-top-selling-${part.part_id}`}>
                        <span className="text-slate-200">{part.part_name}</span>
                        <span className="text-cyan-300">{part.sold_quantity} قطعة</span>
                      </div>
                    ))}
                    {!(analytics.top_selling_parts || []).length && (
                      <p className="text-slate-400 text-sm" data-testid="parts-control-top-selling-empty">لا توجد بيانات مبيعات كافية</p>
                    )}
                  </div>
                </div>

                <div className="glass-card p-4" data-testid="parts-control-margin-watchlist-card">
                  <h2 className="text-white font-semibold mb-3">تحذير الهوامش</h2>
                  <div className="space-y-2">
                    {(analytics.margin_watchlist || []).slice(0, 8).map((part) => (
                      <div key={part.part_id} className="flex items-center justify-between text-sm" data-testid={`parts-control-margin-item-${part.part_id}`}>
                        <span className="text-slate-200">{part.part_name}</span>
                        <span className="text-amber-300">{part.margin_ratio}%</span>
                      </div>
                    ))}
                    {!(analytics.margin_watchlist || []).length && (
                      <p className="text-slate-400 text-sm" data-testid="parts-control-margin-empty">لا توجد قطع بهوامش خطرة</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 overflow-auto" data-testid="parts-control-category-performance-card">
                <h2 className="text-white font-semibold mb-3">أداء الفئات</h2>
                <table className="w-full text-sm text-right">
                  <thead className="text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-2">الفئة</th>
                      <th className="py-2">عدد الأصناف</th>
                      <th className="py-2">المباع</th>
                      <th className="py-2">الإيراد</th>
                      <th className="py-2">منخفض المخزون</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.category_performance || []).map((row) => (
                      <tr key={row.category} className="border-b border-white/5 text-slate-200" data-testid={`parts-control-category-row-${row.category}`}>
                        <td className="py-2">{row.category}</td>
                        <td className="py-2">{row.stock_items}</td>
                        <td className="py-2">{row.sold_quantity}</td>
                        <td className="py-2">{formatCurrency(row.revenue)}</td>
                        <td className="py-2">{row.low_stock_items}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'rakan' && (
        <>
          {loadingRakanAnalytics ? (
            <div className="glass-card p-5 text-slate-300 flex items-center gap-2" data-testid="parts-control-rakan-loading">
              <Loader2 className="animate-spin" size={16} /> جاري تحميل تحليلات قطع راكان...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="parts-control-rakan-cards">
                <button
                  type="button"
                  className={`glass-card p-4 border-t-4 text-right transition ${expandedRakanCard === 'revenue' ? 'ring-2 ring-emerald-300/40' : ''}`}
                  style={{ borderColor: '#22c55e' }}
                  onClick={() => setExpandedRakanCard((prev) => (prev === 'revenue' ? '' : 'revenue'))}
                  data-testid="parts-control-rakan-card-revenue"
                >
                  <p className="text-xs text-slate-300">إيراد قطع راكان</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-revenue">{formatCurrency(rakanAnalytics?.revenue)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">عمليات البيع المرتبطة بحسابات راكان</p>
                </button>
                <button
                  type="button"
                  className={`glass-card p-4 border-t-4 text-right transition ${expandedRakanCard === 'expense' ? 'ring-2 ring-amber-300/40' : ''}`}
                  style={{ borderColor: '#f59e0b' }}
                  onClick={() => setExpandedRakanCard((prev) => (prev === 'expense' ? '' : 'expense'))}
                  data-testid="parts-control-rakan-card-expense"
                >
                  <p className="text-xs text-slate-300">إجمالي المصروفات</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-expense">{formatCurrency(rakanAnalytics?.expense)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">مشتريات قطع + مصروفات تشغيل/شخصية</p>
                </button>
                <button
                  type="button"
                  className={`glass-card p-4 border-t-4 text-right transition ${expandedRakanCard === 'profitability' ? 'ring-2 ring-sky-300/40' : ''}`}
                  style={{ borderColor: '#38bdf8' }}
                  onClick={() => setExpandedRakanCard((prev) => (prev === 'profitability' ? '' : 'profitability'))}
                  data-testid="parts-control-rakan-card-profit"
                >
                  <p className="text-xs text-slate-300">الربح / الخسارة</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-profit">{formatCurrency(rakanAnalytics?.profit)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">الإيراد - (المشتريات + المصروفات)</p>
                </button>
                <button
                  type="button"
                  className={`glass-card p-4 border-t-4 text-right transition ${expandedRakanCard === 'velocity' ? 'ring-2 ring-purple-300/40' : ''}`}
                  style={{ borderColor: '#a78bfa' }}
                  onClick={() => setExpandedRakanCard((prev) => (prev === 'velocity' ? '' : 'velocity'))}
                  data-testid="parts-control-rakan-card-velocity"
                >
                  <p className="text-xs text-slate-300">معدل البيع اليومي</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-sell-rate">{Number(rakanAnalytics?.sell_rate_per_day || 0).toFixed(2)} قطعة/يوم</p>
                  <p className="text-[11px] text-slate-400 mt-1">إجمالي المبيعات: {Number(rakanAnalytics?.sold_qty || 0).toLocaleString('ar-SA')} قطعة</p>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="parts-control-rakan-period-comparison">
                {[
                  { key: 'revenue', label: 'تغير الإيراد', value: rakanAnalytics?.period_comparison?.revenue },
                  { key: 'expense', label: 'تغير المصروفات', value: rakanAnalytics?.period_comparison?.expense },
                  { key: 'profit', label: 'تغير الربحية', value: rakanAnalytics?.period_comparison?.profit },
                  { key: 'sold-qty', label: 'تغير الكميات المباعة', value: rakanAnalytics?.period_comparison?.sold_qty, suffix: 'قطعة' },
                ].map((item) => (
                  <div key={item.key} className="glass-card p-4" data-testid={`parts-control-rakan-comparison-${item.key}`}>
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className="text-lg font-bold text-white mt-2">
                      {item.suffix ? `${Number(item.value?.delta || 0).toLocaleString('ar-SA')} ${item.suffix}` : formatCurrency(item.value?.delta)}
                    </p>
                    <p className={`text-xs mt-2 ${(item.value?.delta || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {(item.value?.delta || 0) >= 0 ? '▲' : '▼'} {Number(item.value?.pct || 0).toLocaleString('ar-SA')}% مقارنة بالفترة السابقة
                    </p>
                  </div>
                ))}
              </div>

              {expandedRakanCard === 'revenue' && (
                <div className="glass-card p-4" data-testid="parts-control-rakan-expanded-revenue">
                  <h3 className="text-white font-semibold mb-3">تفاصيل الإيرادات</h3>
                  <div className="overflow-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="text-slate-400 border-b border-white/10">
                        <tr>
                          <th className="py-2">التاريخ</th>
                          <th className="py-2">الحساب</th>
                          <th className="py-2">الشريك</th>
                          <th className="py-2">المبلغ</th>
                          <th className="py-2">السبب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rakanAnalytics?.ledger || []).filter((row) => row.direction === 'in').slice(0, 12).map((row) => (
                          <tr key={`rakan-ledger-in-${row.id}`} className="border-b border-white/5 text-slate-200">
                            <td className="py-2">{new Date(row.date).toLocaleDateString('ar-SA')}</td>
                            <td className="py-2">{row.account_name}</td>
                            <td className="py-2">{row.partner_name || '-'}</td>
                            <td className="py-2">{formatCurrency(row.amount)}</td>
                            <td className="py-2">{row.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expandedRakanCard === 'expense' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="parts-control-rakan-expanded-expense">
                  <div className="glass-card p-4">
                    <h3 className="text-white font-semibold mb-3">تفصيل المصروفات حسب الحساب</h3>
                    <div className="space-y-2">
                      {(rakanAnalytics?.expense_breakdown || []).map((row) => (
                        <div key={`expense-breakdown-${row.account_name}`} className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">{row.account_name}</span>
                          <span className="text-amber-300">{formatCurrency(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-card p-4">
                    <h3 className="text-white font-semibold mb-3">مصروفات آخر العمليات</h3>
                    <div className="space-y-2 max-h-[280px] overflow-auto">
                      {(rakanAnalytics?.ledger || []).filter((row) => row.direction === 'out').slice(0, 12).map((row) => (
                        <div key={`expense-ledger-${row.id}`} className="rounded-lg bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-white">{row.account_name}</p>
                            <p className="text-sm text-amber-300">{formatCurrency(row.amount)}</p>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{row.reason || 'بدون سبب'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {expandedRakanCard === 'profitability' && (
                <div className="glass-card p-4" data-testid="parts-control-rakan-expanded-profitability">
                  <h3 className="text-white font-semibold mb-3">تحليل الربحية</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">الإيراد</p>
                      <p className="text-white font-semibold">{formatCurrency(rakanAnalytics?.revenue)}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">المشتريات</p>
                      <p className="text-white font-semibold">{formatCurrency(rakanAnalytics?.purchase_expense)}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">مصروفات أخرى</p>
                      <p className="text-white font-semibold">{formatCurrency(rakanAnalytics?.other_expense)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" data-testid="parts-control-rakan-profit-delta">
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">معدل فرق الربح/الخسارة</p>
                      <p className={`text-white font-semibold ${deltaTone(periodDelta.profit)}`}>
                        {formatCurrency(periodDelta.profit)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">معدل فرق هامش الربح</p>
                      <p className={`text-white font-semibold ${deltaTone(periodDelta.profit_margin)}`}>
                        {Number(periodDelta.profit_margin || 0).toLocaleString('ar-SA')}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {expandedRakanCard === 'velocity' && (
                <div className="glass-card p-4" data-testid="parts-control-rakan-expanded-velocity">
                  <h3 className="text-white font-semibold mb-3">مؤشرات سرعة البيع</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">عدد عمليات راكان</p>
                      <p className="text-white font-semibold">{Number(rakanAnalytics?.operations_count || 0).toLocaleString('ar-SA')}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">عمليات البيع</p>
                      <p className="text-white font-semibold">{Number(rakanAnalytics?.sales_count || 0).toLocaleString('ar-SA')}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-slate-400 text-xs">عمليات الشراء/المصروف</p>
                      <p className="text-white font-semibold">{Number(rakanAnalytics?.expense_ops_count || 0).toLocaleString('ar-SA')}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass-card p-4" data-testid="parts-control-rakan-insights">
                <h2 className="text-white font-semibold mb-3">تحليل ذكي</h2>
                <div className="space-y-2">
                  {(rakanAnalytics?.insights || []).map((insight, idx) => (
                    <p key={`rakan-insight-${idx}`} className="text-sm text-slate-200">• {insight}</p>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4" data-testid="parts-control-rakan-expense-reasons">
                <h2 className="text-white font-semibold mb-3">أكثر أسباب الصرف تكرارًا</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {(rakanAnalytics?.expense_reasons || []).map((row, index) => (
                    <div key={`${row.reason}-${index}`} className="rounded-xl bg-white/5 p-3" data-testid={`parts-control-rakan-expense-reason-${index}`}>
                      <p className="text-sm text-white">{row.reason}</p>
                      <p className="text-xs text-amber-300 mt-2">{formatCurrency(row.amount)}</p>
                    </div>
                  ))}
                  {!(rakanAnalytics?.expense_reasons || []).length && (
                    <p className="text-sm text-slate-400" data-testid="parts-control-rakan-expense-reasons-empty">
                      لا توجد أسباب صرف موثقة بما يكفي في الفترة الحالية.
                    </p>
                  )}
                </div>
              </div>

              <RakanExpenseTrackingPanel
                analytics={rakanAnalytics}
                selectedCategory={selectedExpenseCategory}
                onSelectCategory={setSelectedExpenseCategory}
              />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="parts-control-rakan-price-expense-summary">
                <div className="glass-card p-4" data-testid="parts-control-rakan-price-highlights">
                  <h2 className="text-white font-semibold mb-3">أكبر تحركات الأسعار</h2>
                  <div className="space-y-2">
                    {priceTrendHighlights.slice(0, 6).map((row) => {
                      const volatilityValue = Number(row.volatility_pct || 0);
                      const isHighVolatility = volatilityValue >= HIGH_VOLATILITY_THRESHOLD;
                      return (
                        <div
                          key={row.part_id}
                          className="rounded-xl bg-white/5 p-3 flex flex-col gap-2"
                          data-testid={`parts-control-rakan-price-highlight-${row.part_id}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-white">{row.part_name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-cyan-200">تذبذب {volatilityValue.toLocaleString('ar-SA')}%</span>
                              {isHighVolatility && (
                                <span
                                  className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-200"
                                  data-testid={`parts-control-rakan-volatility-alert-${row.part_id}`}
                                >
                                  تنبيه تذبذب عالي
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className={pctClass(row.sale_change_pct)}>
                              بيع: {formatCurrency(row.sale_change)} ({Number(row.sale_change_pct || 0).toLocaleString('ar-SA')}%)
                            </span>
                            <span className={pctClass(row.purchase_change_pct)}>
                              شراء: {formatCurrency(row.purchase_change)} ({Number(row.purchase_change_pct || 0).toLocaleString('ar-SA')}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {!priceTrendHighlights.length && (
                      <p className="text-sm text-slate-400" data-testid="parts-control-rakan-price-highlights-empty">
                        لا توجد تغيّرات سعرية كافية في الفترة الحالية.
                      </p>
                    )}
                  </div>
                </div>

                <div className="glass-card p-4" data-testid="parts-control-rakan-expense-breakdown">
                  <h2 className="text-white font-semibold mb-3">مصروفات حسب الحساب</h2>
                  <div className="space-y-2">
                    {expenseBreakdown.map((row, index) => (
                      <div
                        key={`${row.account}-${index}`}
                        className="rounded-xl bg-white/5 p-3 flex items-center justify-between"
                        data-testid={`parts-control-rakan-expense-breakdown-${index}`}
                      >
                        <p className="text-sm text-white">{row.account_name}</p>
                        <p className="text-sm text-amber-300">{formatCurrency(row.amount)}</p>
                      </div>
                    ))}
                    {!expenseBreakdown.length && (
                      <p className="text-sm text-slate-400" data-testid="parts-control-rakan-expense-breakdown-empty">
                        لا توجد مصروفات مصنفة حسب الحساب في الفترة الحالية.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-card p-4" data-testid="parts-control-rakan-learned-pricing">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-white font-semibold">التسعير الذكي (يتعلم ذاتياً)</h2>
                  <span className="text-xs text-slate-400">يعتمد على جميع العمليات ويُفعّل بعد 5 عمليات</span>
                </div>
                <div className="space-y-2">
                  {learnedPricing.map((row, index) => (
                    <div
                      key={`${row.part_id}-${index}`}
                      className="rounded-xl bg-white/5 p-3 grid grid-cols-1 lg:grid-cols-4 gap-3 text-xs"
                      data-testid={`parts-control-rakan-learned-row-${index}`}
                    >
                      <div>
                        <p className="text-white text-sm">{row.part_name}</p>
                        {row.gap_pct !== null && row.gap_pct !== undefined && (
                          <p className={`mt-1 ${deltaTone(row.gap_pct)}`}>فارق ربح {Number(row.gap_pct).toLocaleString('ar-SA')}%</p>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-400">سعر بيع متعلم</p>
                        <p className={`text-white ${row.sale_ready ? 'font-semibold' : 'text-slate-300'}`}>
                          {formatLearningStatus(row.learned_sale_price, row.sale_ready, row.sale_samples)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">سعر شراء متعلم</p>
                        <p className={`text-white ${row.purchase_ready ? 'font-semibold' : 'text-slate-300'}`}>
                          {formatLearningStatus(row.learned_purchase_price, row.purchase_ready, row.purchase_samples)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">فرق الربح/الخسارة</p>
                        <p className={`text-white ${deltaTone(row.gap_value || 0)}`}>
                          {row.gap_value !== null && row.gap_value !== undefined ? formatCurrency(row.gap_value) : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!learnedPricing.length && (
                    <p className="text-sm text-slate-400" data-testid="parts-control-rakan-learned-pricing-empty">
                      لا توجد بيانات كافية لتوليد تسعير ذكي حالياً.
                    </p>
                  )}
                </div>
              </div>

              <div data-testid="parts-control-rakan-price-trend">
                <RakanPriceTimelinePanel analytics={rakanAnalytics} />
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'planner' && (
        <InventoryPlannerTab
          architecture={inventoryArchitecture}
          loading={loadingInventoryArchitecture}
        />
      )}

      {activeTab === 'backorders' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-testid="parts-control-backorders-section">
        <form className="glass-card p-4 space-y-3" onSubmit={handleCreateBackorder} data-testid="parts-control-backorder-form">
          <h2 className="text-white font-semibold">إنشاء طلب Backorder</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">القطعة</label>
              <select
                className="apple-input"
                value={formData.part_id}
                onChange={(e) => {
                  const selected = partsList.find((part) => part.id === e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    part_id: e.target.value,
                    part_name: selected?.name || prev.part_name,
                  }));
                }}
                data-testid="parts-control-backorder-part-select"
              >
                <option value="">اختيار من المخزون (اختياري)</option>
                {partsList.map((part) => (
                  <option key={part.id} value={part.id}>{part.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">اسم القطعة</label>
              <input
                className="apple-input"
                value={formData.part_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, part_name: e.target.value }))}
                data-testid="parts-control-backorder-part-name-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">الكمية المطلوبة</label>
              <input
                type="number"
                min={1}
                className="apple-input"
                value={formData.requested_quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, requested_quantity: Number(e.target.value) }))}
                data-testid="parts-control-backorder-quantity-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">اسم العميل</label>
              <input
                className="apple-input"
                value={formData.customer_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer_name: e.target.value }))}
                data-testid="parts-control-backorder-customer-name-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">رقم العميل</label>
              <input
                className="apple-input"
                value={formData.customer_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))}
                data-testid="parts-control-backorder-customer-phone-input"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">تاريخ متوقع للوصول</label>
              <input
                type="date"
                className="apple-input"
                value={formData.expected_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, expected_date: e.target.value }))}
                data-testid="parts-control-backorder-expected-date-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
            <textarea
              className="apple-input min-h-[72px]"
              value={formData.note}
              onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
              data-testid="parts-control-backorder-note-input"
            />
          </div>
          <Button
            type="submit"
            disabled={savingBackorder}
            className="apple-button"
            data-testid="parts-control-backorder-submit-button"
          >
            {savingBackorder ? 'جاري الحفظ...' : 'حفظ الطلب'}
          </Button>
        </form>

        <div className="glass-card p-4" data-testid="parts-control-backorders-list-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">قائمة طلبات Backorder</h2>
            <select
              className="filter-select"
              value={backorderStatusFilter}
              onChange={(e) => setBackorderStatusFilter(e.target.value)}
              data-testid="parts-control-backorder-status-filter"
            >
              {backorderStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {loadingBackorders ? (
            <p className="text-slate-400 text-sm" data-testid="parts-control-backorders-loading">جاري تحميل الطلبات...</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto" data-testid="parts-control-backorders-list">
              {backorders.map((order) => (
                <div key={order.id} className="rounded-xl bg-white/5 p-3" data-testid={`parts-control-backorder-item-${order.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-white text-sm font-medium" data-testid={`parts-control-backorder-part-${order.id}`}>{order.part_name}</p>
                      <p className="text-xs text-slate-400" data-testid={`parts-control-backorder-meta-${order.id}`}>
                        {order.customer_name} • كمية {order.requested_quantity}
                      </p>
                    </div>
                    <select
                      className="apple-input h-9 text-sm"
                      value={order.status}
                      onChange={(e) => updateBackorderStatus(order.id, e.target.value)}
                      data-testid={`parts-control-backorder-status-select-${order.id}`}
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="ordered">تم الطلب</option>
                      <option value="arrived">وصلت</option>
                      <option value="cancelled">ملغية</option>
                    </select>
                  </div>
                </div>
              ))}
              {!backorders.length && (
                <p className="text-slate-400 text-sm" data-testid="parts-control-backorders-empty">لا توجد طلبات مطابقة</p>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default PartsDashboard;