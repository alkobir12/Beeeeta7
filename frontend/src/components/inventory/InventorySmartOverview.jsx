import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Boxes, CircleDollarSign, TrendingUp } from 'lucide-react';

const currency = (value) => Number(value || 0).toLocaleString('ar-SA');

export const InventorySmartOverview = ({ summary, topMovers = [], loading = false }) => {
  if (loading) {
    return (
      <div className="glass-card p-5" data-testid="inventory-smart-overview-loading">
        <p className="text-slate-300">جاري تحميل لوحة المخزون الذكية...</p>
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    { key: 'critical', label: 'تنبيهات حرجة', value: summary.critical_alerts_count, icon: AlertTriangle, color: '#ef4444' },
    { key: 'backorders', label: 'طلبات Backorder', value: summary.pending_backorders_count, icon: Boxes, color: '#f59e0b' },
    { key: 'cost', label: 'قيمة المخزون (تكلفة)', value: `${currency(summary.inventory_cost_value)} ر.س`, icon: CircleDollarSign, color: '#06b6d4' },
    { key: 'profit', label: 'ربحية محتملة', value: `${currency(summary.potential_profit_value)} ر.س`, icon: TrendingUp, color: '#10b981' },
  ];

  return (
    <div className="space-y-4" data-testid="inventory-smart-overview">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2" data-testid="inventory-smart-overview-title">
            <Activity size={20} className="text-cyan-300" />
            Smart Inventory Snapshot
          </h2>
          <p className="text-slate-400 text-sm" data-testid="inventory-smart-overview-updated-at">
            آخر تحديث: {new Date(summary.updated_at).toLocaleString('ar-SA')}
          </p>
        </div>
        <Link
          to="/parts-dashboard"
          className="apple-button inline-flex items-center justify-center"
          data-testid="inventory-open-control-panel-link"
        >
          فتح لوحة التحكم المتقدمة
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="inventory-smart-overview-cards">
        {cards.map((card) => (
          <div key={card.key} className="glass-card p-4 border-t-4" style={{ borderColor: card.color }} data-testid={`inventory-smart-card-${card.key}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-300">{card.label}</p>
              <card.icon size={16} style={{ color: card.color }} />
            </div>
            <p className="text-xl font-bold text-white" data-testid={`inventory-smart-card-value-${card.key}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-4" data-testid="inventory-top-movers-card">
        <p className="text-sm text-slate-300 mb-3">أعلى القطع حركة (30 يوم)</p>
        <div className="space-y-2">
          {topMovers.length ? topMovers.map((item) => (
            <div key={item.part_id} className="flex items-center justify-between text-sm" data-testid={`inventory-top-mover-${item.part_id}`}>
              <span className="text-white">{item.part_name}</span>
              <span className="text-cyan-300">{item.sold_qty_30} مباع • متبقي {item.current_qty}</span>
            </div>
          )) : (
            <p className="text-slate-400 text-sm" data-testid="inventory-top-movers-empty">لا توجد حركة بيع كافية بعد</p>
          )}
        </div>
      </div>
    </div>
  );
};
