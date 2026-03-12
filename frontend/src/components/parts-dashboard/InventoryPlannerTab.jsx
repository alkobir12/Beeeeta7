import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, Building2, PackageSearch } from 'lucide-react';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

const urgencyConfig = {
  critical: {
    label: 'فوري',
    className: 'bg-red-500/15 text-red-200 border border-red-400/30',
  },
  high: {
    label: 'قريب',
    className: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
  },
  planned: {
    label: 'مجدول',
    className: 'bg-cyan-500/15 text-cyan-100 border border-cyan-400/30',
  },
  dormant: {
    label: 'راكد',
    className: 'bg-slate-500/15 text-slate-200 border border-slate-400/30',
  },
};

const architectureCards = (blueprint = {}) => [
  {
    key: 'supplier-coverage',
    label: 'تغطية الموردين',
    value: `${Number(blueprint.supplier_coverage_pct || 0).toLocaleString('ar-SA')}%`,
    hint: `${Number(blueprint.parts_with_supplier || 0).toLocaleString('ar-SA')} صنف موثّق بمورد`,
    icon: Building2,
    color: '#38bdf8',
  },
  {
    key: 'urgent',
    label: 'توريد عاجل',
    value: Number(blueprint.urgent_reorders_count || 0).toLocaleString('ar-SA'),
    hint: `${Number(blueprint.linked_backorder_quantity || 0).toLocaleString('ar-SA')} قطعة مرتبطة بطلبات معلّقة`,
    icon: AlertTriangle,
    color: '#ef4444',
  },
  {
    key: 'planned',
    label: 'تخطيط دوري',
    value: Number(blueprint.planned_reorders_count || 0).toLocaleString('ar-SA'),
    hint: `متوسط التغطية: ${blueprint.average_days_of_cover ? `${blueprint.average_days_of_cover} يوم` : 'غير متاح'}`,
    icon: PackageSearch,
    color: '#22c55e',
  },
  {
    key: 'dormant',
    label: 'مخزون راكد',
    value: formatCurrency(blueprint.dormant_stock_value),
    hint: `${Number(blueprint.margin_risk_count || 0).toLocaleString('ar-SA')} صنف بهامش خطر`,
    icon: Boxes,
    color: '#f59e0b',
  },
];

export const InventoryPlannerTab = ({ architecture, loading = false }) => {
  const navigate = useNavigate();
  const [orderDrafts, setOrderDrafts] = useState({});
  const [activeSupplier, setActiveSupplier] = useState('');

  const supplierKeys = useMemo(() => Object.keys(orderDrafts), [orderDrafts]);

  useEffect(() => {
    if (!activeSupplier && supplierKeys.length) {
      setActiveSupplier(supplierKeys[0]);
    }
  }, [activeSupplier, supplierKeys]);

  const addToOrder = (row) => {
    const supplierName = row.supplier || 'مورد غير محدد';
    setOrderDrafts((prev) => {
      const next = { ...prev };
      const existing = next[supplierName] || {
        supplier: supplierName,
        phone: row.supplier_phone || '',
        items: [],
      };
      const itemIndex = existing.items.findIndex((item) => item.part_id === row.part_id);
      if (itemIndex >= 0) {
        existing.items[itemIndex] = {
          ...existing.items[itemIndex],
          quantity: existing.items[itemIndex].quantity + row.suggested_order_quantity,
        };
      } else {
        existing.items.push({
          part_id: row.part_id,
          part_name: row.part_name,
          quantity: row.suggested_order_quantity,
          avg_monthly_usage: row.avg_monthly_usage,
          suggested_order_quantity: row.suggested_order_quantity,
          supplier: row.supplier,
          supplier_phone: row.supplier_phone,
        });
      }
      next[supplierName] = { ...existing };
      return next;
    });
    setActiveSupplier(supplierName);
  };

  const updateOrderItem = (supplierName, partId, quantity) => {
    setOrderDrafts((prev) => {
      const next = { ...prev };
      const draft = next[supplierName];
      if (!draft) return prev;
      draft.items = draft.items.map((item) =>
        item.part_id === partId ? { ...item, quantity } : item
      );
      next[supplierName] = { ...draft };
      return next;
    });
  };

  const removeOrderItem = (supplierName, partId) => {
    setOrderDrafts((prev) => {
      const next = { ...prev };
      const draft = next[supplierName];
      if (!draft) return prev;
      draft.items = draft.items.filter((item) => item.part_id !== partId);
      if (!draft.items.length) {
        delete next[supplierName];
      } else {
        next[supplierName] = { ...draft };
      }
      return next;
    });
  };

  const buildWhatsappMessage = (draft) => {
    if (!draft) return '';
    const lines = [
      `طلب توريد قطع - ${draft.supplier}`,
      '—',
      ...draft.items.map(
        (item) => `• ${item.part_name} | الكمية: ${item.quantity}`
      ),
      '—',
      'يرجى تأكيد توفر القطع ومدة التوريد.'
    ];
    return lines.join('\n');
  };

  if (loading) {
    return (
      <div className="glass-card p-5 text-slate-300" data-testid="inventory-architecture-loading">
        جاري تحميل معمارية المخزون وخطة التزويد...
      </div>
    );
  }

  if (!architecture) {
    return (
      <div className="glass-card p-5 text-slate-400" data-testid="inventory-architecture-empty">
        لا توجد بيانات كافية لبناء خطة التزويد حالياً.
      </div>
    );
  }

  const blueprint = architecture.blueprint || {};
  const cards = architectureCards(blueprint);
  const replenishmentPlan = architecture.replenishment_plan || [];
  const supplierHealth = architecture.supplier_health || [];
  const stockSegments = architecture.stock_segments || [];
  const executionBudget = architecture.execution_budget || {};

  return (
    <div className="space-y-4" data-testid="inventory-architecture-tab">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="inventory-architecture-cards">
        {cards.map((card) => (
          <div
            key={card.key}
            className="glass-card p-4 border-t-4"
            style={{ borderColor: card.color }}
            data-testid={`inventory-architecture-card-${card.key}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-300">{card.label}</p>
              <card.icon size={18} style={{ color: card.color }} />
            </div>
            <p className="text-2xl font-bold text-white" data-testid={`inventory-architecture-card-value-${card.key}`}>
              {card.value}
            </p>
            <p className="text-xs text-slate-400 mt-2">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="inventory-architecture-segments">
        {stockSegments.map((segment) => (
          <div key={segment.key} className="glass-card p-4" data-testid={`inventory-architecture-segment-${segment.key}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white">{segment.label}</p>
              <span className="text-sm text-cyan-200">{Number(segment.count || 0).toLocaleString('ar-SA')}</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">{segment.description}</p>
            <p className="text-xs text-slate-300 mt-3">القيمة التقديرية: {formatCurrency(segment.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="inventory-architecture-budget-strip">
        <div className="glass-card p-4" data-testid="inventory-architecture-budget-urgent">
          <p className="text-xs text-slate-400">ميزانية التوريد الفوري</p>
          <p className="text-lg text-red-200 font-semibold mt-2">{formatCurrency(executionBudget.urgent)}</p>
        </div>
        <div className="glass-card p-4" data-testid="inventory-architecture-budget-high">
          <p className="text-xs text-slate-400">ميزانية الأولوية القريبة</p>
          <p className="text-lg text-amber-200 font-semibold mt-2">{formatCurrency(executionBudget.high)}</p>
        </div>
        <div className="glass-card p-4" data-testid="inventory-architecture-budget-planned">
          <p className="text-xs text-slate-400">ميزانية التخطيط الدوري</p>
          <p className="text-lg text-cyan-200 font-semibold mt-2">{formatCurrency(executionBudget.planned)}</p>
        </div>
        <div className="glass-card p-4" data-testid="inventory-architecture-budget-total">
          <p className="text-xs text-slate-400">إجمالي التزام الشراء</p>
          <p className="text-lg text-white font-semibold mt-2">{formatCurrency(executionBudget.total_commitment)}</p>
        </div>
      </div>

      <div className="glass-card p-4 overflow-auto" data-testid="inventory-architecture-replenishment-card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-white font-semibold">خطة التزويد الذكية</h2>
            <p className="text-xs text-slate-400">توصيات مبنية على الطلب، حد الأمان، والطلبات المعلّقة</p>
          </div>
          <span className="text-xs text-slate-300" data-testid="inventory-architecture-period-badge">
            آخر {Number(blueprint.period_days || 0).toLocaleString('ar-SA')} يوم
          </span>
        </div>
        <table className="w-full text-sm text-right min-w-[980px]">
          <thead className="text-slate-400 border-b border-white/10">
            <tr>
              <th className="py-2">الصنف</th>
              <th className="py-2">المورد</th>
              <th className="py-2">المتاح / الأدنى</th>
              <th className="py-2">مبيعات الفترة</th>
              <th className="py-2">تغطية المخزون</th>
              <th className="py-2">طلبات معلّقة</th>
              <th className="py-2">الكمية المقترحة</th>
              <th className="py-2">التكلفة التقديرية</th>
              <th className="py-2">الأولوية</th>
              <th className="py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {replenishmentPlan.map((row) => {
              const badge = urgencyConfig[row.urgency] || urgencyConfig.planned;
              return (
                <tr key={row.part_id} className="border-b border-white/5 text-slate-200" data-testid={`inventory-architecture-plan-row-${row.part_id}`}>
                  <td className="py-3">
                    <div>
                      <p className="text-white">{row.part_name}</p>
                      <p className="text-xs text-slate-400">{row.part_number} • {row.category}</p>
                    </div>
                  </td>
                  <td className="py-3">{row.supplier || 'بدون مورد'}</td>
                  <td className="py-3">{row.current_quantity} / {row.min_quantity}</td>
                  <td className="py-3">{row.sold_period}</td>
                  <td className="py-3">{row.days_of_cover ? `${row.days_of_cover} يوم` : 'غير متاح'}</td>
                  <td className="py-3">{row.backorder_quantity}</td>
                  <td className="py-3 text-cyan-200 font-semibold">{row.suggested_order_quantity}</td>
                  <td className="py-3">{formatCurrency(row.estimated_purchase_cost)}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${badge.className}`} data-testid={`inventory-architecture-plan-urgency-${row.part_id}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => addToOrder(row)}
                        className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30"
                        data-testid={`inventory-architecture-add-to-order-${row.part_id}`}
                      >
                        إضافة للطلب
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/operations?part=${row.part_id}`)}
                        className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20"
                        data-testid={`inventory-architecture-view-operations-${row.part_id}`}
                      >
                        عرض العمليات
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!replenishmentPlan.length && (
              <tr>
                <td colSpan={10} className="py-5 text-center text-slate-400" data-testid="inventory-architecture-plan-empty">
                  لا توجد توصيات توريد حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-card p-4 overflow-auto" data-testid="inventory-architecture-suppliers-card">
        <h2 className="text-white font-semibold mb-3">صحة الموردين واستعداد الشراء</h2>
        <table className="w-full text-sm text-right min-w-[760px]">
          <thead className="text-slate-400 border-b border-white/10">
            <tr>
              <th className="py-2">المورد</th>
              <th className="py-2">أصناف متتبعة</th>
              <th className="py-2">عاجل</th>
              <th className="py-2">مجدول</th>
              <th className="py-2">طلبات العملاء</th>
              <th className="py-2">قيمة المخزون</th>
              <th className="py-2">التزام الشراء</th>
            </tr>
          </thead>
          <tbody>
            {supplierHealth.map((row, index) => (
              <tr key={`${row.supplier_name}-${index}`} className="border-b border-white/5 text-slate-200" data-testid={`inventory-architecture-supplier-row-${index}`}>
                <td className="py-3 text-white">{row.supplier_name}</td>
                <td className="py-3">{row.tracked_parts}</td>
                <td className="py-3 text-red-200">{row.urgent_items}</td>
                <td className="py-3 text-cyan-200">{row.planned_items}</td>
                <td className="py-3">{row.pending_backorders}</td>
                <td className="py-3">{formatCurrency(row.stock_value)}</td>
                <td className="py-3 font-semibold">{formatCurrency(row.purchase_commitment)}</td>
              </tr>
            ))}
            {!supplierHealth.length && (
              <tr>
                <td colSpan={7} className="py-5 text-center text-slate-400" data-testid="inventory-architecture-suppliers-empty">
                  لم يتم ربط الأصناف بموردين بما يكفي لإظهار المؤشرات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
