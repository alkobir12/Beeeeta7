import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { financeAPI } from '../services/api';
import QuickCard from './QuickCard';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

const severityConfig = {
  high: {
    icon: AlertTriangle,
    pill: 'bg-red-500/10 border-red-500/20 text-red-200',
    cardVariant: 'danger',
  },
  medium: {
    icon: ShieldAlert,
    pill: 'bg-orange-500/10 border-orange-500/20 text-orange-200',
    cardVariant: 'warning',
  },
  low: {
    icon: CheckCircle,
    pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
    cardVariant: 'success',
  },
};

export default function FinanceAlertsWidget({
  enabledPaths = ['/operations', '/accounting/chart-of-accounts', '/accounting/comprehensive', '/ai-financial'],
}) {
  const location = useLocation();
  const path = location.pathname || '';
  const enabled = useMemo(() => enabledPaths.includes(path), [enabledPaths, path]);

  const workshopId = process.env.REACT_APP_WORKSHOP_ID;

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    if (!workshopId) return;
    try {
      setLoading(true);
      const res = await financeAPI.getAlerts({ workshop_id: workshopId });
      const list = res.data?.data?.alerts || [];
      setAlerts(Array.isArray(list) ? list : []);
      setLastUpdated(new Date());
    } catch (e) {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [enabled, workshopId]);

  if (!enabled) return null;

  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const mediumCount = alerts.filter((a) => a.severity === 'medium').length;

  return (
    <div className="w-full" dir="rtl">
      {/* Sticky mini bar */}
      <div className="sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/85 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-300" />
              ) : highCount > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              ) : mediumCount > 0 ? (
                <ShieldAlert className="h-4 w-4 text-orange-400" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              )}

              <span className="font-semibold">مراقب النظام المحاسبي</span>
              <span className="text-slate-400">•</span>
              {loading ? (
                <span className="text-slate-400">جاري الفحص...</span>
              ) : alerts.length ? (
                <span>
                  {highCount ? `${highCount} عالي` : '0 عالي'} / {mediumCount ? `${mediumCount} متوسط` : '0 متوسط'}
                </span>
              ) : (
                <span className="text-slate-300">لا توجد تنبيهات حالياً</span>
              )}

              {lastUpdated ? (
                <span className="text-slate-500 hidden sm:inline">(آخر تحديث: {lastUpdated.toLocaleTimeString('ar-SA')})</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900"
              >
                {isOpen ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
              </button>
              <button
                type="button"
                onClick={load}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900"
              >
                تحديث
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details cards */}
      {isOpen && alerts.length ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts.slice(0, 8).map((a) => {
              const cfg = severityConfig[a.severity] || severityConfig.low;
              return (
                <QuickCard
                  key={a.id}
                  title={a.title}
                  value={a.message}
                  subtitle={a.action}
                  icon={cfg.icon}
                  variant={cfg.cardVariant}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
