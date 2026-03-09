import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Loader2, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react';
import { api, partAPI } from '../services/api';
import { Button } from '../components/ui/button';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const RAKAN_KEYWORDS = ['راكان', 'rakan'];

const isRakanBusinessAccount = (account = {}) => {
  const text = [account.name, account.code].map((v) => normalizeText(v)).join(' ');
  return RAKAN_KEYWORDS.some((k) => text.includes(k));
};

const isRakanOperation = (operation = {}, rakanBizIds = new Set()) => {
  const scope = normalizeText(operation.scope);
  const source = normalizeText(operation.source);
  const businessUnit = normalizeText(operation.businessUnit || operation.business_unit);
  const notes = normalizeText(operation.notes);
  return (
    rakanBizIds.has(String(operation.accountId || '')) ||
    scope === 'rakan_parts' ||
    source === 'rakan_parts_pos' ||
    businessUnit === 'rakan_parts' ||
    notes.includes('[rakan_parts]')
  );
};

const isRakanChartAccount = (account = {}) => {
  const text = [account.name_ar, account.name, account.code, account.category]
    .map((v) => normalizeText(v))
    .join(' ');
  return RAKAN_KEYWORDS.some((k) => text.includes(k));
};

const getOperationDate = (operation = {}) => {
  const value = operation.date || operation.op_date || operation.createdAt || operation.created_at;
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const backorderStatusOptions = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'ordered', label: 'تم الطلب' },
  { value: 'arrived', label: 'وصلت' },
  { value: 'cancelled', label: 'ملغية' },
];

const PartsDashboard = () => {
  const [daysFilter, setDaysFilter] = useState(90);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [backorders, setBackorders] = useState([]);
  const [backorderStatusFilter, setBackorderStatusFilter] = useState('all');
  const [loadingBackorders, setLoadingBackorders] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [rakanAnalytics, setRakanAnalytics] = useState(null);
  const [loadingRakanAnalytics, setLoadingRakanAnalytics] = useState(true);
  const [expandedRakanCard, setExpandedRakanCard] = useState('profitability');
  const [savingBackorder, setSavingBackorder] = useState(false);
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
      const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
      const [opsRes, bizRes, partsRes, chartRes] = await Promise.all([
        api.get('/operations'),
        api.get('/biz-accounts'),
        partAPI.getAll(),
        api.get('/finance/chart-of-accounts', { params: { workshop_id: workshopId } }),
      ]);

      const operations = Array.isArray(opsRes.data) ? opsRes.data : [];
      const bizAccounts = Array.isArray(bizRes.data) ? bizRes.data : [];
      const parts = Array.isArray(partsRes.data) ? partsRes.data : [];
      const chartRows = chartRes?.data?.success && Array.isArray(chartRes?.data?.data)
        ? chartRes.data.data
        : [];

      const partMap = new Map(parts.map((part) => [String(part.id), part]));
      const rakanBizIds = new Set(
        bizAccounts.filter((account) => isRakanBusinessAccount(account)).map((account) => String(account.id || account.code || ''))
      );
      const chartById = new Map(chartRows.map((acc) => [String(acc.id || acc.code || ''), acc]));
      const rakanChartIds = new Set(
        chartRows.filter((account) => isRakanChartAccount(account)).map((account) => String(account.id || account.code || ''))
      );

      const now = new Date();
      const start = new Date(now.getTime() - (daysFilter * 24 * 60 * 60 * 1000));

      const withinPeriod = operations.filter((op) => {
        const date = getOperationDate(op);
        if (!date) return false;
        return date >= start;
      });

      const rakanOps = withinPeriod
        .filter((op) => {
          const accountingId = String(op.accountingAccountId || '');
          return isRakanOperation(op, rakanBizIds) || rakanChartIds.has(accountingId);
        })
        .sort((a, b) => {
          const db = getOperationDate(b);
          const da = getOperationDate(a);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        });

      const sales = rakanOps.filter((op) => op.type === 'sale');
      const purchases = rakanOps.filter((op) => op.type === 'purchase');
      let soldQty = 0;
      let revenue = 0;
      let purchaseExpense = 0;
      let otherExpense = 0;
      const expenseBreakdownMap = new Map();
      const ledger = [];
      const priceTimeline = new Map();

      for (const op of rakanOps) {
        const amount = Number(op.total || 0);
        const accountRef = String(op.accountingAccountId || op.accountId || '');
        const chartAccount = chartById.get(accountRef);
        const accountType = normalizeText(chartAccount?.type || op.type || '');
        const accountName = chartAccount?.name_ar || chartAccount?.name || chartAccount?.code || op.accountingAccountId || op.accountId || '-';
        const operationDate = getOperationDate(op) || now;

        const isRevenue = accountType === 'revenue' || op.type === 'sale';
        const isPurchase = op.type === 'purchase';
        const isExpense = accountType === 'expense' || isPurchase || ['expense', 'payroll', 'salary'].includes(op.type);

        if (isRevenue) revenue += amount;
        if (isExpense) {
          if (isPurchase) {
            purchaseExpense += amount;
          } else {
            otherExpense += amount;
          }
          const current = expenseBreakdownMap.get(accountName) || 0;
          expenseBreakdownMap.set(accountName, current + amount);
        }

        ledger.push({
          id: op.id,
          type: op.type,
          date: operationDate.toISOString(),
          account_name: accountName,
          account_type: accountType,
          amount,
          partner_name: op.partnerName || '-',
          reason: op.notes || '-',
          direction: isRevenue ? 'in' : (isExpense ? 'out' : 'neutral'),
        });

        for (const item of (op.items || [])) {
          const partId = String(item.itemId || item.partId || item.item_id || '');
          if (!partId) continue;
          const qty = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          if (op.type === 'sale') soldQty += qty;

          if (!priceTimeline.has(partId)) {
            priceTimeline.set(partId, { sale: [], purchase: [] });
          }
          const bucket = priceTimeline.get(partId);
          if (op.type === 'sale') {
            bucket.sale.push({ price, date: operationDate.toISOString() });
          } else if (op.type === 'purchase') {
            bucket.purchase.push({ price, date: operationDate.toISOString() });
          }
        }
      }

      const priceTrend = [];
      for (const [partId, bucket] of priceTimeline.entries()) {
        const sortDesc = (arr) => (arr || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        const saleSorted = sortDesc(bucket.sale);
        const purchaseSorted = sortDesc(bucket.purchase);
        const latestSale = saleSorted.slice(0, 3).map((row) => Number(row.price || 0));
        const latestPurchase = purchaseSorted.slice(0, 3).map((row) => Number(row.price || 0));
        if (!latestSale.length && !latestPurchase.length) continue;

        const saleChange = latestSale.length >= 2 ? latestSale[0] - latestSale[latestSale.length - 1] : 0;
        const purchaseChange = latestPurchase.length >= 2 ? latestPurchase[0] - latestPurchase[latestPurchase.length - 1] : 0;

        priceTrend.push({
          part_id: partId,
          part_name: partMap.get(partId)?.name || `قطعة ${partId.slice(0, 6)}`,
          latest_sale_prices: latestSale,
          latest_purchase_prices: latestPurchase,
          sale_change: Number(saleChange.toFixed(2)),
          purchase_change: Number(purchaseChange.toFixed(2)),
        });
      }
      priceTrend.sort((a, b) => (
        (Math.abs(b.sale_change) + Math.abs(b.purchase_change))
        - (Math.abs(a.sale_change) + Math.abs(a.purchase_change))
      ));

      const sellRate = daysFilter > 0 ? soldQty / daysFilter : 0;
      const totalExpense = purchaseExpense + otherExpense;
      const profit = revenue - totalExpense;
      const expenseBreakdown = Array.from(expenseBreakdownMap.entries())
        .map(([account_name, amount]) => ({ account_name, amount: Number(amount.toFixed(2)) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 12);

      const insights = [];
      if (profit < 0) insights.push('تنبيه: صافي نتيجة حسابات قطع راكان سالب في الفترة المحددة، راجع المصروفات التشغيلية والمشتريات.');
      if (otherExpense > 0 && otherExpense > purchaseExpense) insights.push('المصروفات غير المرتبطة بالمخزون أعلى من المشتريات، يلزم ضبط بند المصروفات الشخصية/التشغيلية.');
      if (sellRate < 1) insights.push('معدل البيع اليومي منخفض، يوصى بحملات تنشيط أو مراجعة تشكيلة القطع.');
      if (priceTrend.some((row) => row.sale_change <= -10)) insights.push('بعض القطع تراجع سعر بيعها في آخر 3 تسعيرات، تحقق من أثر ذلك على الهامش.');
      if (priceTrend.some((row) => row.purchase_change >= 10)) insights.push('تكلفة شراء بعض القطع ارتفعت في آخر 3 تسعيرات، راجع التسعير النهائي.');
      if (!insights.length) insights.push('الأداء مستقر؛ استمر في مراقبة تغيّر الأسعار والهامش أسبوعيًا.');

      setRakanAnalytics({
        period_days: daysFilter,
        operations_count: rakanOps.length,
        sales_count: sales.length,
        purchases_count: purchases.length,
        expense_ops_count: ledger.filter((row) => row.direction === 'out').length,
        revenue,
        purchase_expense: purchaseExpense,
        other_expense: otherExpense,
        expense: totalExpense,
        profit,
        sold_qty: soldQty,
        sell_rate_per_day: Number(sellRate.toFixed(2)),
        expense_breakdown: expenseBreakdown,
        ledger: ledger.slice(0, 30),
        price_trend: priceTrend.slice(0, 12),
        recent_ops: rakanOps.slice(0, 16),
        insights,
      });
    } catch (error) {
      setRakanAnalytics(null);
    } finally {
      setLoadingRakanAnalytics(false);
    }
  };

  useEffect(() => {
    loadControlPanel();
    loadRakanAnalytics();
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
            onClick={() => Promise.all([loadControlPanel(), loadBackorders(), loadRakanAnalytics()])}
            data-testid="parts-control-refresh-button"
          >
            <RefreshCw size={16} className="ml-1" /> تحديث
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2" data-testid="parts-control-tabs">
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

              <div className="glass-card p-4 overflow-auto" data-testid="parts-control-rakan-price-trend">
                <h2 className="text-white font-semibold mb-3">متغير أسعار القطع عبر الزمن (آخر 3 تسعيرات بيع/شراء)</h2>
                <table className="w-full text-sm text-right">
                  <thead className="text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-2">القطعة</th>
                      <th className="py-2">آخر 3 أسعار بيع</th>
                      <th className="py-2">تغير البيع</th>
                      <th className="py-2">آخر 3 أسعار شراء</th>
                      <th className="py-2">تغير الشراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rakanAnalytics?.price_trend || []).map((row) => (
                      <tr key={row.part_id} className="border-b border-white/5 text-slate-200" data-testid={`parts-control-rakan-trend-row-${row.part_id}`}>
                        <td className="py-2">{row.part_name}</td>
                        <td className="py-2">{(row.latest_sale_prices || []).length ? row.latest_sale_prices.map((p) => formatCurrency(p)).join(' | ') : '-'}</td>
                        <td className="py-2">{formatCurrency(row.sale_change)}</td>
                        <td className="py-2">{(row.latest_purchase_prices || []).length ? row.latest_purchase_prices.map((p) => formatCurrency(p)).join(' | ') : '-'}</td>
                        <td className="py-2">{formatCurrency(row.purchase_change)}</td>
                      </tr>
                    ))}
                    {!(rakanAnalytics?.price_trend || []).length && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400" data-testid="parts-control-rakan-trend-empty">لا توجد بيانات كافية لتحليل الأسعار</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
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