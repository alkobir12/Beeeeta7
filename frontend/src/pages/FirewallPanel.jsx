import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Stethoscope,
  Bot,
  Download,
  Settings,
  Bell,
  Clipboard,
  X,
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

const SETTINGS_KEY = 'firewallPanelSettings.v1';
const DEFAULT_SETTINGS = {
  rejectionAlertThreshold: 10,   // toast when lifetime_rejections crosses this
  healthAlertPercent: 99,         // toast when health < X%
  refreshIntervalSec: 15,
  enableAlerts: true,
};
const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
};
const saveSettings = (s) => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* noop */ }
};

export default function FirewallPanel() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoLog, setDemoLog] = useState([]);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [toast, setToast] = useState(null);
  const [showRejectionDetail, setShowRejectionDetail] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await axios.get(`${API_URL}/firewall/status`, {
        params: { workshop_id: WORKSHOP_ID, recent_limit: 20 },
      });
      setData(res.data || null);
      setRefreshedAt(new Date());
      setPulseTick((t) => t + 1);
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
    const ms = Math.max(5, Number(settings.refreshIntervalSec) || 15) * 1000;
    const id = setInterval(fetchStatus, ms);
    return () => clearInterval(id);
  }, [autoRefresh, fetchStatus, settings.refreshIntervalSec]);

  // 🔔 Alert engine — fire a transient toast when thresholds cross
  useEffect(() => {
    if (!settings.enableAlerts || !data?.summary) return;
    const s = data.summary;
    const rej = Number(s.lifetime_rejections || 0);
    const hp = Number(s.balance_health_percent ?? 100);
    if (rej >= Number(settings.rejectionAlertThreshold || 9999)) {
      setToast({
        tone: 'warning',
        title: 'تنبيه: رفضيات مرتفعة',
        body: `تجاوز عدد الرفضيات الحد (${rej} ≥ ${settings.rejectionAlertThreshold})`,
      });
    } else if (hp < Number(settings.healthAlertPercent || 0)) {
      setToast({
        tone: 'critical',
        title: 'تنبيه: تراجع سلامة التوازن',
        body: `نسبة السلامة ${hp.toFixed(2)}% < ${settings.healthAlertPercent}%`,
      });
    }
  }, [data?.summary, settings]);

  useEffect(() => { saveSettings(settings); }, [settings]);

  // Auto-dismiss toast after 6s
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // 🩺 Run live audit and link it back to the firewall
  const runAuditNow = async () => {
    if (auditRunning) return;
    setAuditRunning(true);
    setAuditResult(null);
    try {
      const res = await axios.post(`${API_URL}/finance/audit-system`, null, {
        params: { workshop_id: WORKSHOP_ID },
      });
      setAuditResult(res.data?.data || null);
    } catch (err) {
      setAuditResult({ error: err?.response?.data?.detail || err?.message });
    } finally {
      setAuditRunning(false);
    }
  };

  // 📥 Export rejections as CSV
  const exportRejectionsCSV = () => {
    const rows = data?.recent_rejections || [];
    if (rows.length === 0) {
      setToast({ tone: 'info', title: 'لا توجد رفضيات للتصدير', body: '' });
      return;
    }
    const header = ['الوقت', 'السبب', 'مدين', 'دائن', 'انحراف', 'الوصف', 'المصدر'];
    const csv = [
      header.join(','),
      ...rows.map((r) => [
        r.ts || '',
        r.reason || '',
        r.debit || 0,
        r.credit || 0,
        r.drift || 0,
        (r.description || '').replace(/,/g, '،').replace(/\n/g, ' '),
        r.source || '',
      ].map((v) => `"${String(v)}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firewall-rejections-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // 📋 Copy a one-line status report to clipboard
  const copyStatusReport = async () => {
    const s = data?.summary || {};
    const text = [
      `🛡️ تقرير جدار حماية المحاسبة`,
      `الوقت: ${new Date().toLocaleString('ar-SA')}`,
      `إجمالي القيود: ${s.total_entries || 0}`,
      `سلامة التوازن: ${s.balance_health_percent || 100}%`,
      `قيود مكسورة في DB: ${s.unbalanced_entries_in_db || 0}`,
      `رفضيات الجلسة: ${s.lifetime_rejections || 0}`,
      `ضربات منع التكرار: ${s.lifetime_idempotency_hits || 0}`,
      `قيود COGS: ${s.cogs_entries || 0} (${formatCurrency(s.cogs_total_amount || 0)})`,
      `أقصى انحراف: ${data?.drift?.max || 0}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: 'success', title: 'تم النسخ', body: 'التقرير الآن في الحافظة.' });
    } catch (e) {
      setToast({ tone: 'critical', title: 'فشل النسخ', body: String(e) });
    }
  };

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
                <span
                  data-testid="firewall-counters-note"
                  title="عدادات الجلسة (الرفضيات/منع التكرار/COGS) محفوظة في ذاكرة الخادم وتُعاد عند إعادة تشغيله. أما القيود المتوازنة وقيود COGS في قاعدة البيانات فهي دائمة."
                  className="text-[11px] text-slate-500 italic cursor-help"
                >
                  • العدادات لحظية لهذه الجلسة
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
              تحديث تلقائي ({settings.refreshIntervalSec}ث)
              {autoRefresh ? (
                <span
                  key={pulseTick}
                  data-testid="firewall-live-pulse"
                  className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"
                />
              ) : null}
            </label>
            <button
              data-testid="firewall-settings-button"
              onClick={() => setShowSettings((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm transition"
            >
              <Settings className="w-4 h-4" />
              الإعدادات
            </button>
          </div>
        </div>
      </div>

      {/* 🔔 Toast */}
      {toast ? (
        <div
          data-testid="firewall-toast"
          className={`fixed top-6 left-6 z-50 max-w-md rounded-xl border p-3 shadow-2xl backdrop-blur-xl ${
            toast.tone === 'critical'
              ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
              : toast.tone === 'warning'
              ? 'bg-amber-500/15 border-amber-400/40 text-amber-100'
              : toast.tone === 'success'
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
              : 'bg-sky-500/15 border-sky-400/40 text-sky-100'
          }`}
        >
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{toast.title}</div>
              {toast.body ? <div className="text-xs opacity-80 mt-1">{toast.body}</div> : null}
            </div>
            <button
              data-testid="firewall-toast-close"
              onClick={() => setToast(null)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ⚙️ Settings Panel (collapsible) */}
      {showSettings ? (
        <div
          data-testid="firewall-settings-panel"
          className="rounded-2xl border border-violet-400/30 bg-violet-500/10 backdrop-blur-xl p-4 md:p-5 mb-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-violet-300" />
            <h3 className="text-sm font-semibold text-violet-100">إعدادات لوحة الحماية والتنبيهات</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-200">
            <label className="flex flex-col gap-1">
              <span>عتبة تنبيه الرفضيات</span>
              <input
                data-testid="firewall-setting-rejection-threshold"
                type="number"
                min="1"
                value={settings.rejectionAlertThreshold}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, rejectionAlertThreshold: Number(e.target.value) || 0 }))
                }
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>حد سلامة التوازن (٪)</span>
              <input
                data-testid="firewall-setting-health-percent"
                type="number"
                min="50"
                max="100"
                value={settings.healthAlertPercent}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, healthAlertPercent: Number(e.target.value) || 0 }))
                }
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>فاصل التحديث (ث)</span>
              <input
                data-testid="firewall-setting-refresh-interval"
                type="number"
                min="5"
                max="600"
                value={settings.refreshIntervalSec}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, refreshIntervalSec: Number(e.target.value) || 15 }))
                }
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
              />
            </label>
            <label className="flex items-end gap-2">
              <input
                data-testid="firewall-setting-enable-alerts"
                type="checkbox"
                checked={settings.enableAlerts}
                onChange={(e) => setSettings((s) => ({ ...s, enableAlerts: e.target.checked }))}
                className="accent-violet-400 w-4 h-4"
              />
              <span>تفعيل التنبيهات</span>
            </label>
          </div>
        </div>
      ) : null}

      {/* 🔗 Quick Actions — wires the panel to Auditor + Financial Assistant */}
      <div
        data-testid="firewall-quick-actions"
        className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 mb-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400 ml-2">
            إجراءات سريعة:
          </span>
          <button
            data-testid="firewall-run-audit-button"
            onClick={runAuditNow}
            disabled={auditRunning}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 text-xs font-medium transition disabled:opacity-50"
          >
            <Stethoscope className={`w-4 h-4 ${auditRunning ? 'animate-pulse' : ''}`} />
            {auditRunning ? 'جارٍ التدقيق...' : 'تشغيل تدقيق المحاسبة'}
          </button>
          <button
            data-testid="firewall-open-assistant-button"
            onClick={() => navigate('/ai-financial')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-100 text-xs font-medium transition"
          >
            <Bot className="w-4 h-4" />
            افتح المساعد المالي
          </button>
          <button
            data-testid="firewall-export-csv-button"
            onClick={exportRejectionsCSV}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs transition"
          >
            <Download className="w-4 h-4" />
            تصدير الرفضيات CSV
          </button>
          <button
            data-testid="firewall-copy-report-button"
            onClick={copyStatusReport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs transition"
          >
            <Clipboard className="w-4 h-4" />
            نسخ تقرير الحالة
          </button>
        </div>
      </div>

      {/* 🩺 Audit Result Card */}
      {auditResult ? (
        <div
          data-testid="firewall-audit-result-card"
          className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl p-4 md:p-5 mb-5"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-emerald-200">
              <Stethoscope className="w-4 h-4" />
              <h3 className="text-sm font-semibold">نتيجة التدقيق المحاسبي</h3>
            </div>
            <button
              data-testid="firewall-audit-result-close"
              onClick={() => setAuditResult(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {auditResult.error ? (
            <div className="text-rose-200 text-sm" data-testid="firewall-audit-error">
              ❌ {String(auditResult.error)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-slate-400 mb-1">درجة الصحة</div>
                <div className="text-2xl font-bold text-emerald-200">
                  {auditResult.health_score ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-slate-400 mb-1">حالة الجدار من التدقيق</div>
                <div className="text-base font-semibold text-slate-100" data-testid="firewall-audit-fw-status">
                  {auditResult?.details?.firewall_check?.status || '—'}
                </div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-slate-400 mb-1">الحكم النهائي</div>
                <div className="text-xs text-slate-200">
                  {auditResult?.summary?.final_verdict || '—'}
                </div>
              </div>
              {(auditResult?.details?.firewall_check?.issues || []).length > 0 ? (
                <div className="sm:col-span-3 rounded-lg bg-rose-500/10 border border-rose-400/30 p-3 text-rose-100 text-xs space-y-1">
                  {(auditResult.details.firewall_check.issues || []).map((m, i) => (
                    <div key={i}>{m}</div>
                  ))}
                </div>
              ) : null}
              {(auditResult?.details?.firewall_check?.warnings || []).length > 0 ? (
                <div className="sm:col-span-3 rounded-lg bg-amber-500/10 border border-amber-400/30 p-3 text-amber-100 text-xs space-y-1">
                  {(auditResult.details.firewall_check.warnings || []).map((m, i) => (
                    <div key={i}>{m}</div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

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
                <button
                  key={idx}
                  type="button"
                  data-testid="firewall-rejection-row"
                  onClick={() => setShowRejectionDetail(r)}
                  className="w-full text-right rounded-lg border border-rose-400/20 bg-rose-500/5 hover:bg-rose-500/10 p-3 text-xs transition"
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
                </button>
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

      {/* 🔍 Rejection Detail Modal */}
      {showRejectionDetail ? (
        <div
          data-testid="firewall-rejection-detail-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowRejectionDetail(null)}
        >
          <div
            className="max-w-lg w-full rounded-2xl border border-rose-400/40 bg-slate-900/95 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-rose-200">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold">تفاصيل القيد المرفوض</h3>
              </div>
              <button
                data-testid="firewall-rejection-detail-close"
                onClick={() => setShowRejectionDetail(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre
              data-testid="firewall-rejection-detail-json"
              dir="ltr"
              className="text-[11px] font-mono bg-black/40 text-slate-200 p-3 rounded-lg overflow-auto max-h-[60vh] whitespace-pre-wrap break-all"
            >
              {JSON.stringify(showRejectionDetail, null, 2)}
            </pre>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      JSON.stringify(showRejectionDetail, null, 2)
                    );
                    setToast({ tone: 'success', title: 'تم النسخ' });
                  } catch (e) {
                    /* noop */
                  }
                }}
                data-testid="firewall-rejection-detail-copy"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200"
              >
                <Clipboard className="w-3.5 h-3.5" />
                نسخ JSON
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
