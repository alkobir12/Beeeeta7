import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { resolveBackendBase } from '../utils/backendBase';
import axios from 'axios';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Layers,
  Lock,
  Zap,
  TrendingDown,
  FlaskConical,
} from 'lucide-react';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${resolveBackendBase() || ''}/api`.replace('//api', '/api')
);
const WORKSHOP_ID = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0) + ' ر.س';

const formatDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return iso;
  }
};

const StatCard = ({ icon: Icon, label, value, sublabel, tone = 'sky', testid }) => {
  const tones = {
    sky: 'from-sky-500/20 to-cyan-500/10 border-sky-400/30 text-sky-100',
    emerald: 'from-emerald-500/20 to-teal-500/10 border-emerald-400/30 text-emerald-100',
    rose: 'from-rose-500/20 to-pink-500/10 border-rose-400/30 text-rose-100',
    amber: 'from-amber-500/20 to-orange-500/10 border-amber-400/30 text-amber-100',
    violet: 'from-violet-500/20 to-fuchsia-500/10 border-violet-400/30 text-violet-100',
  };
  const iconTone = {
    sky: 'text-sky-300 bg-sky-500/15',
    emerald: 'text-emerald-300 bg-emerald-500/15',
    rose: 'text-rose-300 bg-rose-500/15',
    amber: 'text-amber-300 bg-amber-500/15',
    violet: 'text-violet-300 bg-violet-500/15',
  };
  return (
    <div
      data-testid={testid}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${tones[tone]} p-5 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
          <div className="text-3xl font-bold tabular-nums">{value}</div>
          {sublabel ? (
            <div className="text-xs opacity-70">{sublabel}</div>
          ) : null}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${iconTone[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
    </div>
  );
};

const EmptyRow = ({ message }) => (
  <div className="py-8 text-center text-slate-400 text-sm" data-testid="firewall-empty-row">
    {message}
  </div>
);

const PanelCard = ({ title, icon: Icon, tone = 'sky', children, testid, action }) => {
  const toneBorder = {
    sky: 'border-sky-400/20',
    emerald: 'border-emerald-400/20',
    rose: 'border-rose-400/20',
    amber: 'border-amber-400/20',
    violet: 'border-violet-400/20',
  };
  const iconWrap = {
    sky: 'text-sky-300 bg-sky-500/15',
    emerald: 'text-emerald-300 bg-emerald-500/15',
    rose: 'text-rose-300 bg-rose-500/15',
    amber: 'text-amber-300 bg-amber-500/15',
    violet: 'text-violet-300 bg-violet-500/15',
  };
  return (
    <div
      data-testid={testid}
      className={`rounded-2xl border ${toneBorder[tone]} bg-white/[0.03] backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg p-1.5 ${iconWrap[tone]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
};

export default function FirewallPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoLog, setDemoLog] = useState([]);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await axios.get(`${API_URL}/firewall/status`, {
        params: { workshop_id: WORKSHOP_ID, recent_limit: 20 },
      });
      setData(res.data || null);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchStatus]);

  const summary = data?.summary || {};
  const drift = data?.drift || {};
  const healthPercent = summary.balance_health_percent ?? 100;
  const healthy = healthPercent >= 99.99;

  const HealthBadge = useMemo(() => {
    const Icon = healthy ? ShieldCheck : ShieldAlert;
    const cls = healthy
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
      : 'bg-rose-500/15 text-rose-200 border-rose-400/30';
    return (
      <div
        data-testid="firewall-health-badge"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${cls}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {healthy ? 'النظام محمي وسليم' : 'تنبيه: قيود غير متوازنة مكتشفة'}
      </div>
    );
  }, [healthy]);

  const appendDemo = (msg, status = 'info') => {
    setDemoLog((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), msg, status, at: new Date() },
    ].slice(-12));
  };

  const runFirewallDemo = async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setDemoLog([]);
    try {
      // 1) Try to send an UNBALANCED journal entry — must be rejected.
      appendDemo('1) إرسال قيد غير متوازن (مدين 100 ≠ دائن 50)...', 'info');
      try {
        await axios.post(
          `${API_URL}/finance/journal-entries?workshop_id=${WORKSHOP_ID}`,
          {
            date: new Date().toISOString().slice(0, 10),
            description: 'FIREWALL_DEMO_UNBALANCED',
            transaction_type: 'manual',
            lines: [
              { account: '003', account_name: 'النقد', debit: 100, credit: 0 },
              { account: '025', account_name: 'الإيرادات', debit: 0, credit: 50 },
            ],
            total: 100,
            source: 'firewall_demo',
          }
        );
        appendDemo('❌ خطأ: تم قبول القيد غير المتوازن!', 'error');
      } catch (errReject) {
        const detail = errReject?.response?.data?.detail || errReject?.message;
        appendDemo(`✅ تم الرفض كما هو متوقع: ${detail}`, 'success');
      }

      // 2) Send a BALANCED journal entry — must be accepted.
      appendDemo('2) إرسال قيد متوازن (100 = 100)...', 'info');
      try {
        const res = await axios.post(
          `${API_URL}/finance/journal-entries?workshop_id=${WORKSHOP_ID}`,
          {
            date: new Date().toISOString().slice(0, 10),
            description: 'FIREWALL_DEMO_BALANCED',
            transaction_type: 'manual',
            lines: [
              { account: '003', account_name: 'النقد', debit: 100, credit: 0 },
              { account: '025', account_name: 'الإيرادات', debit: 0, credit: 100 },
            ],
            total: 100,
            source: 'firewall_demo',
          }
        );
        if (res?.data?.success) {
          appendDemo(`✅ تم القبول. ID: ${res.data.id?.slice(0, 8)}...`, 'success');
        } else {
          appendDemo(`⚠️ استجابة غير متوقعة: ${JSON.stringify(res?.data || {})}`, 'warn');
        }
      } catch (errAccept) {
        const detail = errAccept?.response?.data?.detail || errAccept?.message;
        appendDemo(`❌ رفض غير متوقع: ${detail}`, 'error');
      }

      // 3) Refresh status to show the rejection in the recent_rejections list.
      appendDemo('3) تحديث لوحة الحماية...', 'info');
      await fetchStatus();
      appendDemo('✅ اكتمل العرض التجريبي. راجع لوحة "آخر القيود المرفوضة" أدناه.', 'success');
    } finally {
      setDemoRunning(false);
    }
  };

  return (
    <div
      data-testid="firewall-panel-page"
      dir="rtl"
      className="relative min-h-screen p-4 md:p-6 lg:p-8 overflow-hidden"
    >
      {/* Background liquid layers */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute -top-20 -right-32 w-[480px] h-[480px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 w-[420px] h-[420px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[360px] h-[360px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <div
        data-testid="firewall-header-card"
        className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 md:p-6 mb-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-3 bg-emerald-500/15 text-emerald-300">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-50">
                لوحة جدار حماية المحاسبة
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                مراقبة فورية لقواعد القيد المزدوج، منع التكرار، وتوليد تكلفة البضاعة المباعة.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {HealthBadge}
                <span className="text-[11px] text-slate-400" data-testid="firewall-last-refreshed">
                  آخر تحديث: {refreshedAt ? formatDateTime(refreshedAt) : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              data-testid="firewall-run-demo-button"
              onClick={runFirewallDemo}
              disabled={demoRunning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 text-violet-100 text-sm font-medium transition disabled:opacity-50"
            >
              <FlaskConical className="w-4 h-4" />
              {demoRunning ? 'جاري التشغيل...' : 'عرض تجريبي للحماية'}
            </button>
            <button
              data-testid="firewall-refresh-button"
              onClick={fetchStatus}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
            <label
              data-testid="firewall-auto-refresh-toggle"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-emerald-500"
              />
              تحديث تلقائي (15ث)
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <div
          data-testid="firewall-error-banner"
          className="rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 p-3 text-sm mb-5"
        >
          {String(error)}
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
        <StatCard
          testid="firewall-stat-health"
          icon={Scale}
          tone={healthy ? 'emerald' : 'rose'}
          label="سلامة التوازن"
          value={`${healthPercent}%`}
          sublabel={`${summary.balanced_entries || 0} / ${summary.total_entries || 0} قيد`}
        />
        <StatCard
          testid="firewall-stat-rejections"
          icon={ShieldAlert}
          tone="rose"
          label="رفضيات هذه الجلسة"
          value={summary.lifetime_rejections ?? 0}
          sublabel="قيود غير متوازنة مرفوضة"
        />
        <StatCard
          testid="firewall-stat-idempotency"
          icon={Lock}
          tone="amber"
          label="ضربات منع التكرار"
          value={summary.lifetime_idempotency_hits ?? 0}
          sublabel="عمليات مكررة مُعادة"
        />
        <StatCard
          testid="firewall-stat-cogs"
          icon={Layers}
          tone="sky"
          label="قيود COGS"
          value={summary.cogs_entries ?? 0}
          sublabel={formatCurrency(summary.cogs_total_amount ?? 0)}
        />
        <StatCard
          testid="firewall-stat-drift"
          icon={TrendingDown}
          tone="violet"
          label="أقصى انحراف عشري"
          value={(drift.max ?? 0).toFixed(4)}
          sublabel={`المتوسط: ${(drift.avg ?? 0).toFixed(6)}`}
        />
      </div>

      {/* Demo log */}
      {demoLog.length > 0 ? (
        <PanelCard
          testid="firewall-demo-log-panel"
          title="سجل العرض التجريبي"
          icon={Zap}
          tone="violet"
        >
          <div className="space-y-1.5">
            {demoLog.map((l) => (
              <div
                key={l.id}
                data-testid="firewall-demo-log-row"
                className={`text-xs font-mono px-2.5 py-1.5 rounded-lg border ${
                  l.status === 'success'
                    ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-200'
                    : l.status === 'error'
                    ? 'bg-rose-500/10 border-rose-400/20 text-rose-200'
                    : l.status === 'warn'
                    ? 'bg-amber-500/10 border-amber-400/20 text-amber-200'
                    : 'bg-white/5 border-white/10 text-slate-200'
                }`}
              >
                <span className="opacity-60 ml-2">
                  {l.at.toLocaleTimeString('ar-SA', { hour12: false })}
                </span>
                {l.msg}
              </div>
            ))}
          </div>
        </PanelCard>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        {/* Rejections */}
        <PanelCard
          testid="firewall-rejections-panel"
          title="آخر القيود المرفوضة"
          icon={ShieldAlert}
          tone="rose"
        >
          {(data?.recent_rejections || []).length === 0 ? (
            <EmptyRow message="لا توجد رفضيات في هذه الجلسة — جدار الحماية يعمل بهدوء." />
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {(data?.recent_rejections || []).map((r, idx) => (
                <div
                  key={idx}
                  data-testid="firewall-rejection-row"
                  className="rounded-lg border border-rose-400/20 bg-rose-500/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-rose-200">
                    <span className="font-semibold">{r.reason || 'unbalanced'}</span>
                    <span className="opacity-70">{formatDateTime(r.ts)}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-slate-300">
                    <div>
                      <div className="opacity-60">مدين</div>
                      <div className="font-mono tabular-nums">{formatCurrency(r.debit)}</div>
                    </div>
                    <div>
                      <div className="opacity-60">دائن</div>
                      <div className="font-mono tabular-nums">{formatCurrency(r.credit)}</div>
                    </div>
                    <div>
                      <div className="opacity-60">انحراف</div>
                      <div className="font-mono tabular-nums text-rose-300">
                        {formatCurrency(r.drift)}
                      </div>
                    </div>
                  </div>
                  {r.description ? (
                    <div className="mt-1.5 text-slate-400 truncate" title={r.description}>
                      {r.description}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* Idempotency */}
        <PanelCard
          testid="firewall-idempotency-panel"
          title="ضربات منع التكرار"
          icon={Lock}
          tone="amber"
        >
          {(data?.recent_idempotency_hits || []).length === 0 ? (
            <EmptyRow message="لا توجد عمليات مكررة محجوبة بعد." />
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {(data?.recent_idempotency_hits || []).map((h, idx) => (
                <div
                  key={idx}
                  data-testid="firewall-idempotency-row"
                  className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-amber-200">
                    <span className="font-semibold font-mono">{h.key}</span>
                    <span className="opacity-70">{formatDateTime(h.ts)}</span>
                  </div>
                  <div className="mt-1 text-slate-300">
                    العملية: <span className="font-mono">{(h.operation_id || '').slice(0, 12)}</span>
                    {h.partner ? <span className="mx-2 opacity-70">•</span> : null}
                    {h.partner ? <span>{h.partner}</span> : null}
                    {h.amount ? (
                      <span className="float-left font-mono tabular-nums text-amber-200">
                        {formatCurrency(h.amount)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* COGS recent entries */}
        <PanelCard
          testid="firewall-cogs-panel"
          title="آخر قيود تكلفة البضاعة المباعة (COGS)"
          icon={Layers}
          tone="sky"
        >
          {(data?.recent_cogs_entries || []).length === 0 ? (
            <EmptyRow message="لم يتم توليد قيود COGS بعد — قم ببيع قطعة لرؤية القيد التلقائي." />
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {(data?.recent_cogs_entries || []).map((c, idx) => (
                <div
                  key={c.id || idx}
                  data-testid="firewall-cogs-row"
                  className="rounded-lg border border-sky-400/20 bg-sky-500/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-sky-200">
                    <span className="font-semibold truncate" title={c.description}>
                      {c.description || 'COGS'}
                    </span>
                    <span className="opacity-70 shrink-0 mr-2">{formatDateTime(c.date)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-slate-300 font-mono text-[11px]">
                      {(c.id || '').slice(0, 12)}
                    </span>
                    <span className="font-mono tabular-nums text-sky-200">
                      {formatCurrency(c.total)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                    {c.balanced ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        متوازن
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-300">
                        <AlertTriangle className="w-3 h-3" />
                        غير متوازن
                      </span>
                    )}
                    {c.reference_id ? (
                      <span className="text-slate-500">
                        ↳ مرجع: <span className="font-mono">{c.reference_id.slice(0, 8)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* Unbalanced in DB (should be empty) */}
        <PanelCard
          testid="firewall-unbalanced-db-panel"
          title="قيود تسربت غير متوازنة (يجب أن تكون صفر)"
          icon={Activity}
          tone={summary.unbalanced_entries_in_db ? 'rose' : 'emerald'}
        >
          {(data?.unbalanced_entries_in_db || []).length === 0 ? (
            <EmptyRow message="✅ لا توجد قيود غير متوازنة في قاعدة البيانات." />
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {(data?.unbalanced_entries_in_db || []).map((u, idx) => (
                <div
                  key={u.id || idx}
                  data-testid="firewall-unbalanced-row"
                  className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs"
                >
                  <div className="text-rose-200 font-semibold truncate">{u.description}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-slate-300">
                    <span>مدين: <span className="font-mono">{formatCurrency(u.debit)}</span></span>
                    <span>دائن: <span className="font-mono">{formatCurrency(u.credit)}</span></span>
                    <span>انحراف: <span className="font-mono text-rose-300">{formatCurrency(u.drift)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
