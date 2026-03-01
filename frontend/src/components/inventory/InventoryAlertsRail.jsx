import React from 'react';
import { AlertCircle, AlertTriangle, BellRing } from 'lucide-react';

const severityStyles = {
  critical: { text: 'حرج', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  high: { text: 'مرتفع', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  medium: { text: 'متوسط', bg: 'rgba(14,165,233,0.15)', color: '#38bdf8' },
  info: { text: 'معلومة', bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc' },
};

export const InventoryAlertsRail = ({ alerts = [], onSelectAlert }) => {
  return (
    <div className="glass-card p-4" data-testid="inventory-alerts-rail">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2" data-testid="inventory-alerts-rail-title">
          <BellRing size={18} className="text-amber-300" />
          مركز التنبيهات الذكي
        </h3>
        <span className="text-xs text-slate-400" data-testid="inventory-alerts-rail-count">{alerts.length} تنبيه</span>
      </div>

      <div className="space-y-2 max-h-72 overflow-auto" data-testid="inventory-alerts-rail-list">
        {alerts.length ? alerts.map((alert) => {
          const style = severityStyles[alert.severity] || severityStyles.info;
          return (
            <button
              key={alert.id}
              type="button"
              className="w-full text-right p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              onClick={() => onSelectAlert?.(alert)}
              data-testid={`inventory-alert-item-${alert.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white text-sm font-medium">{alert.title}</p>
                  <p className="text-slate-300 text-xs mt-1" data-testid={`inventory-alert-message-${alert.id}`}>{alert.message}</p>
                  {!!alert.suggested_action && (
                    <p className="text-[11px] text-cyan-300 mt-1" data-testid={`inventory-alert-action-${alert.id}`}>
                      الإجراء المقترح: {alert.suggested_action}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ background: style.bg, color: style.color }}
                    data-testid={`inventory-alert-severity-${alert.id}`}
                  >
                    {style.text}
                  </span>
                  {(alert.alert_type === 'out_of_stock' || alert.alert_type === 'low_stock') ? (
                    <AlertTriangle size={14} style={{ color: style.color }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: style.color }} />
                  )}
                </div>
              </div>
            </button>
          );
        }) : (
          <p className="text-sm text-slate-400" data-testid="inventory-alerts-rail-empty">لا توجد تنبيهات حالياً</p>
        )}
      </div>
    </div>
  );
};
