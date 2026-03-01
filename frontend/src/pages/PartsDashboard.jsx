import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Loader2, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react';
import { api, partAPI } from '../services/api';
import { Button } from '../components/ui/button';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

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

  useEffect(() => {
    loadControlPanel();
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
            onClick={() => Promise.all([loadControlPanel(), loadBackorders()])}
            data-testid="parts-control-refresh-button"
          >
            <RefreshCw size={16} className="ml-1" /> تحديث
          </Button>
        </div>
      </div>

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

          <div className="glass-card p-4 overflow-auto" data-testid="parts-control-recent-operations-card">
            <h2 className="text-white font-semibold mb-3">آخر عمليات القطع</h2>
            <table className="w-full text-sm text-right">
              <thead className="text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-2">التاريخ</th>
                  <th className="py-2">النوع</th>
                  <th className="py-2">الشريك</th>
                  <th className="py-2">الإجمالي</th>
                  <th className="py-2">الدفع</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.recent_part_operations || []).map((op) => (
                  <tr key={op.id} className="border-b border-white/5 text-slate-200" data-testid={`parts-control-recent-op-${op.id}`}>
                    <td className="py-2">{new Date(op.date).toLocaleDateString('ar-SA')}</td>
                    <td className="py-2">{op.type === 'sale' ? 'بيع' : 'شراء'}</td>
                    <td className="py-2">{op.partner_name || '-'}</td>
                    <td className="py-2">{formatCurrency(op.total)}</td>
                    <td className="py-2">{op.payment_method === 'credit' ? 'آجل' : 'نقدي'}</td>
                  </tr>
                ))}
                {!(analytics.recent_part_operations || []).length && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400" data-testid="parts-control-recent-op-empty">لا توجد عمليات خلال الفترة المحددة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

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
    </div>
  );
};

export default PartsDashboard;