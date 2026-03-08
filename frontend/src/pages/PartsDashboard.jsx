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
      const [opsRes, bizRes, partsRes] = await Promise.all([
        api.get('/operations'),
        api.get('/biz-accounts'),
        partAPI.getAll(),
      ]);

      const operations = Array.isArray(opsRes.data) ? opsRes.data : [];
      const bizAccounts = Array.isArray(bizRes.data) ? bizRes.data : [];
      const parts = Array.isArray(partsRes.data) ? partsRes.data : [];

      const partMap = new Map(parts.map((part) => [String(part.id), part]));
      const rakanBizIds = new Set(
        bizAccounts.filter((account) => isRakanBusinessAccount(account)).map((account) => String(account.id || account.code || ''))
      );

      const now = new Date();
      const start = new Date(now.getTime() - (daysFilter * 24 * 60 * 60 * 1000));

      const withinPeriod = operations.filter((op) => {
        const dateValue = op.date || op.op_date || op.createdAt || op.created_at;
        const date = dateValue ? new Date(dateValue) : null;
        if (!date || Number.isNaN(date.getTime())) return false;
        return date >= start;
      });

      const rakanOps = withinPeriod.filter((op) => isRakanOperation(op, rakanBizIds));
      const sales = rakanOps.filter((op) => op.type === 'sale');
      const purchases = rakanOps.filter((op) => op.type === 'purchase');

      const revenue = sales.reduce((sum, op) => sum + Number(op.total || 0), 0);
      const expense = purchases.reduce((sum, op) => sum + Number(op.total || 0), 0);
      const profit = revenue - expense;

      let soldQty = 0;
      const priceBuckets = new Map();
      const halfPoint = new Date(start.getTime() + ((now.getTime() - start.getTime()) / 2));

      for (const op of sales) {
        const opDate = new Date(op.date || op.op_date || op.createdAt || op.created_at || now);
        for (const item of (op.items || [])) {
          const itemPartId = String(item.itemId || item.partId || item.item_id || '');
          if (!itemPartId) continue;
          const qty = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          soldQty += qty;

          if (!priceBuckets.has(itemPartId)) {
            priceBuckets.set(itemPartId, { first: [], second: [] });
          }
          const bucket = priceBuckets.get(itemPartId);
          if (opDate <= halfPoint) {
            bucket.first.push(price);
          } else {
            bucket.second.push(price);
          }
        }
      }

      const priceTrend = [];
      for (const [partId, bucket] of priceBuckets.entries()) {
        const firstAvg = bucket.first.length ? bucket.first.reduce((a, b) => a + b, 0) / bucket.first.length : 0;
        const secondAvg = bucket.second.length ? bucket.second.reduce((a, b) => a + b, 0) / bucket.second.length : 0;
        if (!firstAvg && !secondAvg) continue;
        const delta = secondAvg - firstAvg;
        const pct = firstAvg ? (delta / firstAvg) * 100 : 0;
        priceTrend.push({
          part_id: partId,
          part_name: partMap.get(partId)?.name || `قطعة ${partId.slice(0, 6)}`,
          first_avg: Number(firstAvg.toFixed(2)),
          second_avg: Number(secondAvg.toFixed(2)),
          delta: Number(delta.toFixed(2)),
          change_pct: Number(pct.toFixed(2)),
        });
      }
      priceTrend.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

      const sellRate = daysFilter > 0 ? soldQty / daysFilter : 0;
      const insights = [];
      if (profit < 0) insights.push('تنبيه: ربحية قطع راكان سلبية خلال الفترة المحددة، يلزم مراجعة الأسعار وتكلفة الشراء.');
      if (sellRate < 1) insights.push('معدل البيع اليومي منخفض، يوصى بحملات تنشيط أو مراجعة تشكيلة القطع.');
      if (priceTrend.some((row) => row.change_pct <= -10)) insights.push('بعض القطع انخفض سعر بيعها بأكثر من 10%، تحقق من تأثير ذلك على الهامش.');
      if (priceTrend.some((row) => row.change_pct >= 10)) insights.push('هناك قطع ارتفع سعرها بأكثر من 10%، راقب تقبل العملاء ومعدل التحويل.');
      if (!insights.length) insights.push('الأداء مستقر؛ استمر في مراقبة تغيّر الأسعار والهامش أسبوعيًا.');

      setRakanAnalytics({
        period_days: daysFilter,
        operations_count: rakanOps.length,
        sales_count: sales.length,
        purchases_count: purchases.length,
        revenue,
        expense,
        profit,
        sold_qty: soldQty,
        sell_rate_per_day: Number(sellRate.toFixed(2)),
        price_trend: priceTrend.slice(0, 12),
        recent_ops: rakanOps
          .slice()
          .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
          .slice(0, 12),
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
      { key: 'sales', label: 'مبيعات القطع', value: formatCurrency(overview.sales_total), icon: TrendingUp, color: '#22c55e' },
      { key: 'purchases', label: 'مشتريات القطع', value: formatCurrency(overview.purchases_total), icon: ShoppingCart, color: '#f59e0b' },
      { key: 'profit', label: 'ربح تقديري', value: formatCurrency(overview.gross_profit_estimate), icon: BarChart3, color: '#38bdf8' },
      { key: 'low', label: 'منخفض المخزون', value: overview.low_stock_count || 0, icon: AlertTriangle, color: '#f97316' },
      { key: 'out', label: 'نافد المخزون', value: overview.out_of_stock_count || 0, icon: Boxes, color: '#ef4444' },
      { key: 'parts', label: 'إجمالي الأصناف', value: overview.total_parts || 0, icon: ClipboardList, color: '#a78bfa' },
    ],
    [overview]
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
                <div className="glass-card p-4 border-t-4" style={{ borderColor: '#22c55e' }}>
                  <p className="text-xs text-slate-300">إيراد قطع راكان</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-revenue">{formatCurrency(rakanAnalytics?.revenue)}</p>
                </div>
                <div className="glass-card p-4 border-t-4" style={{ borderColor: '#f97316' }}>
                  <p className="text-xs text-slate-300">مصروف قطع راكان</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-expense">{formatCurrency(rakanAnalytics?.expense)}</p>
                </div>
                <div className="glass-card p-4 border-t-4" style={{ borderColor: '#38bdf8' }}>
                  <p className="text-xs text-slate-300">الربح / الخسارة</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-profit">{formatCurrency(rakanAnalytics?.profit)}</p>
                </div>
                <div className="glass-card p-4 border-t-4" style={{ borderColor: '#a78bfa' }}>
                  <p className="text-xs text-slate-300">معدل البيع اليومي</p>
                  <p className="text-xl font-bold text-white" data-testid="parts-control-rakan-sell-rate">{Number(rakanAnalytics?.sell_rate_per_day || 0).toFixed(2)} قطعة/يوم</p>
                </div>
              </div>

              <div className="glass-card p-4" data-testid="parts-control-rakan-insights">
                <h2 className="text-white font-semibold mb-3">تحليل ذكي</h2>
                <div className="space-y-2">
                  {(rakanAnalytics?.insights || []).map((insight, idx) => (
                    <p key={`rakan-insight-${idx}`} className="text-sm text-slate-200">• {insight}</p>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4 overflow-auto" data-testid="parts-control-rakan-price-trend">
                <h2 className="text-white font-semibold mb-3">متغير أسعار القطع عبر الزمن</h2>
                <table className="w-full text-sm text-right">
                  <thead className="text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-2">القطعة</th>
                      <th className="py-2">متوسط أول المدة</th>
                      <th className="py-2">متوسط آخر المدة</th>
                      <th className="py-2">التغير</th>
                      <th className="py-2">النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rakanAnalytics?.price_trend || []).map((row) => (
                      <tr key={row.part_id} className="border-b border-white/5 text-slate-200" data-testid={`parts-control-rakan-trend-row-${row.part_id}`}>
                        <td className="py-2">{row.part_name}</td>
                        <td className="py-2">{formatCurrency(row.first_avg)}</td>
                        <td className="py-2">{formatCurrency(row.second_avg)}</td>
                        <td className="py-2">{formatCurrency(row.delta)}</td>
                        <td className="py-2">{row.change_pct}%</td>
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