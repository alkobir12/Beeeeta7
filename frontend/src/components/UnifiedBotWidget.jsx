/**
 * UnifiedBotWidget — بوت موحد يجمع:
 * 1. المساعد الذكي (Workshop AI)
 * 2. المدقق المالي (Finance Auditor)
 * 3. نقطة بيع ذكية + إنشاء قيد/عملية بربط تلقائي للحسابات
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Bot, X, MessageSquare, ShieldCheck, Plus, Send, Loader,
  FileText, Wrench, Zap, CreditCard, ShoppingBag, DollarSign,
  Users, Package, TrendingUp, AlertCircle, CheckCircle, ChevronDown
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const WID = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';

// ─── خريطة الحسابات ────────────────────────────────────────────────────────
const ACCOUNTS = {
  '003': 'النقد',   '004': 'البنك',     '005': 'العملاء',
  '006': 'نقاط بيع','027': 'خدمات ميكانيكية','028': 'إصلاح محركات',
  '029': 'فرامل وتعليق','030': 'تكلفة الخدمات','035': 'المصروفات التشغيلية',
  '036': 'مصروفات عامة','037': 'رواتب','042': 'ايراد قطع الورشه',
  '2101': 'الموردون (آجل)', '211': 'فروقات ترحيل',
  '043': 'قطع غيار راكان (شراء)', '044': 'قطع غيار راكان (بيع)',
  '053': 'رسوم شحن راكان',
};

// حسابات خاصة تظهر في قائمة الاختيار
const SPECIAL_ACCOUNTS = [
  { code: '042', name: 'ايراد قطع الورشه', group: 'الورشة' },
  { code: '027', name: 'إيرادات خدمات ميكانيكية', group: 'الورشة' },
  { code: '028', name: 'إيرادات إصلاح محركات', group: 'الورشة' },
  { code: '029', name: 'إيرادات فرامل وتعليق', group: 'الورشة' },
  { code: '043', name: 'قطع غيار راكان (شراء)', group: 'راكان' },
  { code: '044', name: 'قطع غيار راكان (بيع)', group: 'راكان' },
  { code: '053', name: 'رسوم شحن راكان', group: 'راكان' },
  { code: '035', name: 'المصروفات التشغيلية', group: 'مصروفات' },
  { code: '036', name: 'مصروفات عامة وإدارية', group: 'مصروفات' },
  { code: '037', name: 'رواتب', group: 'مصروفات' },
  { code: '005', name: 'العملاء (ذمم مدينة)', group: 'حسابات' },
  { code: '2101', name: 'الموردون (آجل)', group: 'حسابات' },
];

const PAYMENT_ACCOUNT = { bank: '004', cash: '003', pos: '006', credit: '005' };

// ─── نماذج العمليات الذكية ──────────────────────────────────────────────────
const SMART_TEMPLATES = [
  {
    id: 'service_sale',
    label: 'بيع خدمة',
    icon: Wrench,
    color: '#38bdf8',
    desc: 'صيانة / خدمة ميكانيكية',
    getLines: (pm, amt) => [
      { account: PAYMENT_ACCOUNT[pm] || '004', name: ACCOUNTS[PAYMENT_ACCOUNT[pm]] || 'البنك', debit: amt, credit: 0 },
      { account: '027', name: 'خدمات ميكانيكية', debit: 0, credit: amt },
    ],
    opType: 'sale',
  },
  {
    id: 'parts_sale',
    label: 'بيع قطع',
    icon: Package,
    color: '#a78bfa',
    desc: 'قطع غيار ورشة',
    getLines: (pm, amt) => [
      { account: PAYMENT_ACCOUNT[pm] || '004', name: ACCOUNTS[PAYMENT_ACCOUNT[pm]] || 'البنك', debit: amt, credit: 0 },
      { account: '042', name: 'ايراد قطع الورشه', debit: 0, credit: amt },
    ],
    opType: 'sale',
  },
  {
    id: 'expense',
    label: 'مصروف',
    icon: TrendingUp,
    color: '#fb923c',
    desc: 'مصروف تشغيلي / إداري',
    getLines: (pm, amt) => [
      { account: '036', name: 'مصروفات عامة', debit: amt, credit: 0 },
      { account: PAYMENT_ACCOUNT[pm] || '004', name: ACCOUNTS[PAYMENT_ACCOUNT[pm]] || 'البنك', debit: 0, credit: amt },
    ],
    opType: 'expense',
  },
  {
    id: 'salary',
    label: 'رواتب',
    icon: Users,
    color: '#34d399',
    desc: 'رواتب الموظفين / العمال',
    getLines: (pm, amt) => [
      { account: '037', name: 'رواتب', debit: amt, credit: 0 },
      { account: PAYMENT_ACCOUNT[pm] || '004', name: ACCOUNTS[PAYMENT_ACCOUNT[pm]] || 'البنك', debit: 0, credit: amt },
    ],
    opType: 'expense',
  },
  {
    id: 'credit_sale',
    label: 'بيع آجل',
    icon: CreditCard,
    color: '#f59e0b',
    desc: 'خدمة بالآجل (ذمة مدينة)',
    getLines: (_pm, amt) => [
      { account: '005', name: 'العملاء (ذمم مدينة)', debit: amt, credit: 0 },
      { account: '027', name: 'خدمات ميكانيكية', debit: 0, credit: amt },
    ],
    opType: 'sale',
    forcePayment: 'credit',
  },
  {
    id: 'purchase',
    label: 'مشتريات',
    icon: ShoppingBag,
    color: '#64748b',
    desc: 'شراء قطع / مواد من مورد',
    getLines: (pm, amt) => [
      { account: '030', name: 'تكلفة الخدمات', debit: amt, credit: 0 },
      { account: pm === 'credit' ? '2101' : PAYMENT_ACCOUNT[pm] || '004',
        name: pm === 'credit' ? 'الموردون (آجل)' : ACCOUNTS[PAYMENT_ACCOUNT[pm]] || 'البنك', debit: 0, credit: amt },
    ],
    opType: 'purchase',
  },
];

// اقتراح النموذج من الوصف النصي
const guessTemplate = (text) => {
  const t = text.toLowerCase();
  if (/راتب|رواتب|أجر|عمال/.test(t)) return 'salary';
  if (/قطع|فلتر|زيت|مرشح/.test(t)) return 'parts_sale';
  if (/آجل|اجل|ذمة|دين/.test(t)) return 'credit_sale';
  if (/شراء|مشتري|مورد|فاتورة شراء/.test(t)) return 'purchase';
  if (/مصروف|مصاريف|بنزين|فطور|إيجار|كهرباء|ماء/.test(t)) return 'expense';
  if (/صيانة|خدمة|فرامل|كلتش|تعليق|مكيف/.test(t)) return 'service_sale';
  return null;
};

// ─── tabs ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'assistant', label: 'المساعد', icon: MessageSquare },
  { id: 'auditor',   label: 'المدقق',  icon: ShieldCheck  },
  { id: 'create',    label: 'إنشاء',   icon: Zap          },
  { id: 'quick',     label: 'فوري',    icon: DollarSign   },
];

const INIT_ASSISTANT = [{ role: 'assistant', content: 'مرحباً! أنا مساعد الورشة. اسألني عن أي شيء.' }];
const INIT_AUDITOR   = [{ role: 'assistant', content: 'مرحباً! أنا المدقق المالي. يمكنني مراجعة الحسابات وإنشاء قيود بأوامر نصية مثل "أنشئ قيد".' }];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
const PAYMENT_METHODS = [
  { v: 'bank', l: 'بنك', acc: '004' },
  { v: 'cash', l: 'نقد', acc: '003' },
  { v: 'pos',  l: 'POS', acc: '006' },
  { v: 'credit', l: 'آجل', acc: '005' },
];

export default function UnifiedBotWidget() {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState('assistant');
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);

  // assistant / auditor messages
  const [aMessages, setAMessages] = useState(INIT_ASSISTANT);
  const [fMessages, setFMessages] = useState(INIT_AUDITOR);
  const [fSession]                = useState(`sess-${Date.now()}`);

  // smart create state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [paymentMethod, setPaymentMethod]        = useState('bank');
  const [amount, setAmount]                      = useState('');
  const [description, setDescription]            = useState('');
  const [partnerName, setPartnerName]            = useState('');
  const [date, setDate]                          = useState(new Date().toISOString().split('T')[0]);
  const [customDebit, setCustomDebit]            = useState('');
  const [customCredit, setCustomCredit]          = useState('');
  const [createResult, setCreateResult]          = useState(null);
  const [createMode, setCreateMode]              = useState('smart'); // 'smart' | 'manual'

  // vehicle + account linking
  const [vehicles, setVehicles]               = useState([]);
  const [vehicleSearch, setVehicleSearch]     = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleDropOpen, setVehicleDropOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null); // override credit account

  const messagesEndRef = useRef(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aMessages, fMessages, tab]);

  // auditor: load real financial context on tab open
  const [finContext, setFinContext] = useState(null);

  useEffect(() => {
    if (tab !== 'auditor' || finContext) return;
    const load = async () => {
      try {
        const [isR, alertsR, rakanR] = await Promise.all([
          axios.get(`${API}/api/finance/reports/income-statement`),
          axios.get(`${API}/api/finance/alerts?workshop_id=${WID}`),
          axios.get(`${API}/api/inventory/rakan-analytics?days=90`),
        ]);
        const totals = isR.data?.data?.totals || {};
        const alerts = alertsR.data?.data?.alerts || [];
        const rakan  = rakanR.data || {};
        const ctx = {
          revenue:  Number(totals.revenue  || 0),
          expenses: Number(totals.expenses || 0),
          net:      Number(totals.net_income || 0),
          rakanRev: Number(rakan.revenue || 0),
          alerts,
        };
        setFinContext(ctx);
        // رسالة ترحيب مع بيانات فعلية
        const alertSummary = alerts.length
          ? `\n\n⚠️ تنبيهات نشطة: ${alerts.map(a => a.title).join('، ')}`
          : '\n\n✅ لا توجد تنبيهات مالية حالياً.';
        setFMessages([{
          role: 'assistant',
          content: `مرحباً! اطّلعت على بيانات النظام الآن:\n\n` +
            `💰 إجمالي الإيرادات: ${ctx.revenue.toLocaleString('ar-SA')} ر.س\n` +
            `📉 إجمالي المصروفات: ${ctx.expenses.toLocaleString('ar-SA')} ر.س\n` +
            `📊 صافي الدخل: ${ctx.net.toLocaleString('ar-SA')} ر.س\n` +
            `🔧 إيرادات راكان: ${ctx.rakanRev.toLocaleString('ar-SA')} ر.س` +
            alertSummary +
            `\n\nيمكنني مراجعة الحسابات أو كتابة "أنشئ قيد" للانتقال للإنشاء المباشر.`,
        }]);
      } catch {
        // keep default message on error
      }
    };
    load();
  }, [tab]);

  // جلب المركبات عند فتح تبويب الإنشاء
  useEffect(() => {
    if (tab !== 'create' || vehicles.length) return;
    axios.get(`${API}/api/vehicles?limit=200`)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.vehicles || [];
        setVehicles(list);
      })
      .catch(() => {});
  }, [tab, vehicles.length]);

  // auto-detect template from description
  useEffect(() => {
    if (!description) return;
    const guess = guessTemplate(description);
    if (guess && !selectedTemplate) setSelectedTemplate(guess);
  }, [description]);

  const currentTemplate = useMemo(() => SMART_TEMPLATES.find(t => t.id === selectedTemplate), [selectedTemplate]);

  const previewLines = useMemo(() => {
    if (createMode === 'manual') {
      const amt = parseFloat(amount) || 0;
      if (!amt || !customDebit || !customCredit) return [];
      return [
        { account: customDebit,  name: ACCOUNTS[customDebit]  || customDebit,  debit: amt, credit: 0 },
        { account: customCredit, name: ACCOUNTS[customCredit] || customCredit, debit: 0, credit: amt },
      ];
    }
    if (!currentTemplate || !amount) return [];
    const pm = currentTemplate.forcePayment || paymentMethod;
    const lines = currentTemplate.getLines(pm, parseFloat(amount) || 0);
    // إذا تم اختيار حساب خاص → نُبدّل سطر الدائن (الإيراد/المصروف)
    if (selectedAccount) {
      return lines.map((l, i) => {
        // آخر سطر عادةً هو الدائن للإيراد أو المدين للمصروف
        if (i === 1 && l.credit > 0) {
          return { ...l, account: selectedAccount.code, name: selectedAccount.name };
        }
        if (i === 0 && l.debit > 0 && currentTemplate.opType !== 'sale') {
          return { ...l, account: selectedAccount.code, name: selectedAccount.name };
        }
        return l;
      });
    }
    return lines;
  }, [currentTemplate, paymentMethod, amount, createMode, customDebit, customCredit, selectedAccount]);

  const isBalanced = useMemo(() => {
    const d = previewLines.reduce((s, l) => s + l.debit, 0);
    const c = previewLines.reduce((s, l) => s + l.credit, 0);
    return Math.abs(d - c) < 0.01 && d > 0;
  }, [previewLines]);

  // ─── المساعد ─────────────────────────────────────────────────────────────
  const sendAssistant = useCallback(async (text) => {
    if (!text.trim()) return;
    setAMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput(''); setLoading(true);
    try {
      const r = await axios.post(`${API}/api/ai/chat`, {
        message: text, workshop_id: WID,
        history: aMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      });
      setAMessages(prev => [...prev, { role: 'assistant', content: r.data?.response || r.data?.message || 'لا استجابة' }]);
    } catch { setAMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ، حاول مرة أخرى.' }]); }
    finally { setLoading(false); }
  }, [aMessages]);

  // ─── المدقق ──────────────────────────────────────────────────────────────
  const sendAuditor = useCallback(async (text) => {
    if (!text.trim()) return;
    setFMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput(''); setLoading(true);
    try {
      const lc = text.toLowerCase();
      if (lc.includes('أنشئ قيد') || lc.includes('انشئ قيد')) {
        setTab('create'); setCreateMode('smart');
        setFMessages(prev => [...prev, { role: 'assistant', content: '✅ انتقلت لتبويب الإنشاء الذكي — اختر نموذج العملية وأدخل المبلغ.' }]);
        setLoading(false); return;
      }
      if (lc.includes('أنشئ عملية') || lc.includes('انشئ عملية')) {
        setTab('create'); setCreateMode('smart');
        setFMessages(prev => [...prev, { role: 'assistant', content: '✅ انتقلت لتبويب الإنشاء — اختر نوع العملية.' }]);
        setLoading(false); return;
      }
      // إضافة السياق المالي الفعلي مع الرسالة
      const contextNote = finContext
        ? `[بيانات النظام — الإيرادات: ${finContext.revenue.toLocaleString('ar-SA')} ر.س | المصروفات: ${finContext.expenses.toLocaleString('ar-SA')} ر.س | صافي: ${finContext.net.toLocaleString('ar-SA')} ر.س | راكان: ${finContext.rakanRev.toLocaleString('ar-SA')} ر.س]\n`
        : '';
      const r = await axios.post(`${API}/api/finance-bot/chat`, {
        message: contextNote + text,
        session_id: fSession, workshop_id: WID,
        financial_data: finContext ? { totals: { revenue: finContext.revenue, expenses: finContext.expenses, net_income: finContext.net } } : {},
        findings: [], action: null,
      });
      const data = r.data || {};
      setFMessages(prev => [...prev, {
        role: 'assistant', content: data.response || 'لا استجابة',
        state: data.state, linkedData: data.linked_data,
        contradictions: data.contradictions, sessionId: fSession,
      }]);
    } catch { setFMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ، حاول مرة أخرى.' }]); }
    finally { setLoading(false); }
  }, [fMessages, fSession, finContext]);

  // state عملية فورية
  const [quickAmount, setQuickAmount]   = useState('');
  const [quickPM, setQuickPM]           = useState('bank');
  const [quickDesc, setQuickDesc]       = useState('');
  const [quickResult, setQuickResult]   = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);

  const handleQuickOp = async () => {
    const amt = parseFloat(quickAmount);
    if (!amt || amt <= 0) { setQuickResult({ ok: false, msg: 'أدخل مبلغاً صحيحاً' }); return; }
    setQuickLoading(true); setQuickResult(null);
    try {
      const pm = PAYMENT_ACCOUNT[quickPM] || '004';
      // قيد يومية فوري
      await axios.post(`${API}/api/finance/journal-entries?workshop_id=${WID}`, {
        workshop_id: WID, date: new Date().toISOString().split('T')[0],
        description: quickDesc || 'عملية فورية',
        lines: [
          { account: pm, account_name: ACCOUNTS[pm] || pm, debit: amt, credit: 0 },
          { account: '027', account_name: 'خدمات ميكانيكية', debit: 0, credit: amt },
        ],
        total: amt, source: 'quick_op',
      });
      // عملية أيضاً
      await axios.post(`${API}/api/operations`, {
        workshopId: WID, workshop_id: WID,
        type: 'sale', paymentMethod: quickPM, paymentStatus: 'paid',
        partnerName: quickDesc || 'عملية فورية', partnerType: 'customer',
        scope: 'workshop', date: new Date().toISOString().split('T')[0],
        total: amt, subtotal: amt,
        items: [{ name: quickDesc || 'خدمة', itemType: 'service', qty: 1, price: amt, total: amt }],
      });
      setQuickResult({ ok: true, msg: `✅ ${amt.toLocaleString('ar-SA')} ر.س — سُجّلت قيداً وعملية` });
      setQuickAmount(''); setQuickDesc('');
    } catch (err) {
      setQuickResult({ ok: false, msg: err?.response?.data?.detail || 'فشل الإنشاء' });
    } finally { setQuickLoading(false); }
  };

  // ─── الإنشاء الذكي ───────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isBalanced) { setCreateResult({ ok: false, msg: 'القيد غير متوازن أو البيانات ناقصة' }); return; }
    setLoading(true); setCreateResult(null);
    try {
      const amt = parseFloat(amount);
      const pm  = currentTemplate?.forcePayment || paymentMethod;

      // إنشاء القيد المحاسبي
      await axios.post(`${API}/api/finance/journal-entries?workshop_id=${WID}`, {
        workshop_id: WID,
        date,
        description: description || currentTemplate?.desc || 'قيد يدوي',
        lines: previewLines.map(l => ({ account: l.account, account_name: l.name, debit: l.debit, credit: l.credit })),
        total: amt,
        source: 'smart_bot',
      });

      // إذا كانت عملية بيع/شراء → إنشاء عملية أيضاً
      if (currentTemplate && currentTemplate.opType !== 'expense' && partnerName) {
        await axios.post(`${API}/api/operations`, {
          workshopId: WID, workshop_id: WID,
          type: currentTemplate.opType,
          paymentMethod: pm,
          paymentStatus: pm === 'credit' ? 'credit' : 'paid',
          partnerName: partnerName || selectedVehicle?.customerName,
          partnerType: currentTemplate.opType === 'purchase' ? 'supplier' : 'customer',
          scope: 'workshop', date, total: amt, subtotal: amt,
          // ربط المركبة إذا تم اختيارها
          ...(selectedVehicle && { vehicleId: selectedVehicle.id, vehicleInfo: `${selectedVehicle.plateNumber} - ${selectedVehicle.customerName}` }),
          // الحساب المحاسبي المحدد
          ...(selectedAccount && { accountingAccountCode: selectedAccount.code }),
          items: [{ name: description || currentTemplate.label, itemType: 'service', qty: 1, price: amt, total: amt }],
        });
      }

      setCreateResult({ ok: true, msg: `✅ تم إنشاء القيد بنجاح (${previewLines.map(l=>l.name).join(' / ')}) — ${amt.toLocaleString('ar-SA')} ر.س` });
      setAmount(''); setDescription(''); setPartnerName('');
    } catch (err) {
      setCreateResult({ ok: false, msg: err?.response?.data?.detail || 'فشل الإنشاء' });
    } finally { setLoading(false); }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (tab === 'assistant') sendAssistant(input);
    else if (tab === 'auditor') sendAuditor(input);
  };

  const messages = tab === 'assistant' ? aMessages : fMessages;

  return (
    <>
      {/* ─── زر البوت ─────────────────────────────────────────────────── */}
      <div className="fixed z-[75] left-4 bottom-20 lg:bottom-6 lg:left-auto lg:right-6" data-testid="unified-bot-trigger">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 border"
          style={{
            background: open ? 'rgba(239,68,68,0.9)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
            borderColor: open ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.5)',
          }}
          data-testid="unified-bot-button"
        >
          {open ? <X size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
          {!open && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-green-400 border border-slate-900 animate-pulse" />}
        </button>
      </div>

      {/* ─── نافذة البوت ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed z-[74] left-4 bottom-36 lg:bottom-20 lg:left-auto lg:right-6 w-[92vw] max-w-[420px] rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col"
          style={{ height: '580px', background: 'rgba(2,6,23,0.97)', backdropFilter: 'blur(20px)' }}
          data-testid="unified-bot-panel"
        >
          {/* رأس */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 flex-shrink-0"
            style={{ background: 'rgba(15,23,42,0.9)' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100">المساعد الموحد</div>
                <div className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />متصل</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400"><X size={14} /></button>
          </div>

          {/* تبويبات */}
          <div className="flex border-b border-slate-800/60 flex-shrink-0">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => { setTab(t.id); setInput(''); setCreateResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                    tab === t.id ? 'border-b-2 border-sky-500 text-sky-300 bg-sky-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                  data-testid={`bot-tab-${t.id}`}>
                  <Icon size={12} />{t.label}
                  {t.id === 'create' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" />}
                </button>
              );
            })}
          </div>

          {/* ─── محتوى ──────────────────────────────────────────────────── */}
          {tab !== 'create' ? (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                      style={m.role === 'user'
                        ? { background: 'rgba(14,165,233,0.2)', color: 'rgba(186,230,253,0.95)', borderRadius:'14px 14px 4px 14px' }
                        : { background: 'rgba(30,41,59,0.8)', color: 'rgba(226,232,240,0.92)', borderRadius:'14px 14px 14px 4px' }}>
                      {m.content}
                      {m.contradictions?.length > 0 && (
                        <div className="mt-1.5 rounded bg-amber-500/10 border border-amber-500/30 p-1.5 text-[10px] text-amber-300">
                          ⚠️ {m.contradictions[0].description?.slice(0, 70)}
                        </div>
                      )}
                      {m.state && (
                        <span className={`mt-1 inline-block rounded-full text-[9px] px-1.5 py-0.5 ${
                          m.state==='escalated'?'bg-red-500/20 text-red-300':m.state==='resolved'?'bg-green-500/20 text-green-300':'bg-sky-500/20 text-sky-300'}`}>
                          {m.state==='escalated'?'مصعّدة':m.state==='resolved'?'محلولة':'قيد التحقيق'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-xl px-3 py-2 bg-slate-800/80 flex items-center gap-1.5">
                      <Loader size={12} className="text-sky-400 animate-spin" />
                      <span className="text-[10px] text-slate-400">جارٍ التفكير...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-slate-800/60 flex-shrink-0">
                <input value={input} onChange={e => setInput(e.target.value)}
                  placeholder={tab==='auditor' ? '"أنشئ قيد" أو راجع الحسابات...' : 'اسأل عن أي شيء...'}
                  className="flex-1 rounded-xl px-3 py-2 text-[11px] text-slate-100 outline-none"
                  style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }}
                  disabled={loading} data-testid="bot-input" />
                <button type="submit" disabled={loading || !input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40"
                  style={{ background: 'rgba(14,165,233,0.25)', border: '1px solid rgba(14,165,233,0.4)' }}>
                  <Send size={13} className="text-sky-300" />
                </button>
              </form>
            </>
          ) : tab === 'quick' ? (
            /* ─── عملية فورية ──────────────────────────────────────── */
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center pt-2">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                  <DollarSign size={22} className="text-white" />
                </div>
                <div className="text-sm font-bold text-white">عملية فورية</div>
                <div className="text-[11px] text-slate-400 mt-0.5">قيد + عملية بضغطة واحدة</div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.v} type="button" onClick={() => setQuickPM(pm.v)}
                    className={`py-2 rounded-xl border text-[11px] font-medium transition-all ${quickPM===pm.v?'border-sky-500/60 bg-sky-500/20 text-sky-200':'border-slate-700 text-slate-400 hover:text-slate-200'}`}
                    data-testid={`quick-pm-${pm.v}`}>
                    <div>{pm.l}</div><div className="text-[9px] opacity-60">{pm.acc}</div>
                  </button>
                ))}
              </div>
              <input value={quickDesc} onChange={e => setQuickDesc(e.target.value)}
                placeholder="الوصف (اختياري) — مثال: صيانة فرامل"
                className="w-full rounded-xl px-3 py-2 text-sm text-slate-100"
                style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }}
                data-testid="quick-desc-input" />
              <input type="number" min="0" step="0.01" value={quickAmount}
                onChange={e => setQuickAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl px-3 py-4 text-2xl font-bold text-center text-white"
                style={{ background: 'rgba(30,41,59,0.8)', border: '2px solid rgba(34,197,94,0.4)' }}
                data-testid="quick-amount-input" />
              <div className="grid grid-cols-5 gap-1.5">
                {QUICK_AMOUNTS.map(a => (
                  <button key={a} type="button" onClick={() => setQuickAmount(String(a))}
                    className={`py-1.5 rounded-lg text-[11px] border transition-colors ${quickAmount===String(a)?'border-green-500/60 bg-green-500/15 text-green-300':'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                    {a}
                  </button>
                ))}
              </div>
              {quickResult && (
                <div className={`rounded-xl p-3 text-sm text-center font-medium ${quickResult.ok?'bg-green-500/10 border border-green-500/30 text-green-300':'bg-red-500/10 border border-red-500/30 text-red-300'}`}
                  data-testid="quick-result">{quickResult.msg}</div>
              )}
              <button type="button" onClick={handleQuickOp} disabled={quickLoading || !quickAmount}
                className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: quickAmount&&!quickLoading?'linear-gradient(135deg,#22c55e,#16a34a)':'rgba(71,85,105,0.5)' }}
                data-testid="quick-submit-btn">
                {quickLoading ? <Loader size={18} className="animate-spin mx-auto" /> : (
                  <span>⚡ تسجيل فوري{quickAmount&&` — ${Number(quickAmount).toLocaleString('ar-SA')} ر.س`}</span>
                )}
              </button>
              <div className="text-[10px] text-slate-600 text-center">
                يُنشئ: Dr {ACCOUNTS[PAYMENT_ACCOUNT[quickPM]]||'البنك'} / Cr إيرادات + عملية مباشرة
              </div>
            </div>
          ) : (
            /* ─── تبويب الإنشاء الذكي ──────────────────────────────── */
            <div className="flex-1 overflow-y-auto">
              {/* وضع: ذكي أو يدوي */}
              <div className="flex gap-1.5 p-3 pb-0">
                {[['smart','ذكي ✨'],['manual','يدوي']].map(([v,l]) => (
                  <button key={v} onClick={() => { setCreateMode(v); setSelectedTemplate(null); setCreateResult(null); }}
                    className={`flex-1 text-[11px] py-1.5 rounded-lg border transition-colors font-medium ${
                      createMode===v ? 'border-sky-500/60 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
                    data-testid={`create-mode-${v}`}>{l}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreate} className="p-3 space-y-3">
                {createMode === 'smart' ? (
                  <>
                    {/* نماذج سريعة */}
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1.5 block">نوع العملية</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SMART_TEMPLATES.map(t => {
                          const Icon = t.icon;
                          return (
                            <button key={t.id} type="button"
                              onClick={() => { setSelectedTemplate(t.id); setCreateResult(null); if (t.forcePayment) setPaymentMethod(t.forcePayment); }}
                              className={`rounded-xl p-2 flex flex-col items-center gap-1 border text-[10px] transition-all ${
                                selectedTemplate === t.id
                                  ? 'border-opacity-60 font-semibold'
                                  : 'border-slate-700/60 bg-slate-800/30 text-slate-400 hover:text-slate-200'
                              }`}
                              style={selectedTemplate === t.id ? { borderColor: t.color, background: `${t.color}15`, color: t.color } : {}}
                              data-testid={`template-${t.id}`}>
                              <Icon size={14} />
                              <span>{t.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* وسيلة السداد */}
                    {selectedTemplate && !currentTemplate?.forcePayment && (
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block">وسيلة السداد</label>
                        <div className="flex gap-1.5">
                          {PAYMENT_METHODS.map(pm => (
                            <button key={pm.v} type="button" onClick={() => setPaymentMethod(pm.v)}
                              className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-colors ${
                                paymentMethod===pm.v ? 'border-sky-500/60 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-500'}`}
                              data-testid={`pm-${pm.v}`}>
                              {pm.l}
                              <div className="text-[9px] opacity-60">{pm.acc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* الوصف */}
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block">الوصف (اختياري — يُعرَّف النموذج تلقائياً)</label>
                      <input value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="مثال: صيانة فرامل، فطور عمال، شراء زيت..."
                        className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100"
                        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                    </div>

                    {/* اسم الشريك */}
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block">
                        {currentTemplate?.opType === 'purchase' ? 'اسم المورد' : 'اسم العميل'} (اختياري — لإنشاء عملية أيضاً)
                      </label>
                      <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                        placeholder="اترك فارغاً لقيد فقط"
                        className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100"
                        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                    </div>

                    {/* ربط مركبة حالية */}
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block">ربط مركبة (اختياري)</label>
                      <div className="relative">
                        <input
                          value={selectedVehicle
                            ? `${selectedVehicle.plateNumber} — ${selectedVehicle.customerName}`
                            : vehicleSearch}
                          onChange={e => { setVehicleSearch(e.target.value); setSelectedVehicle(null); setVehicleDropOpen(true); }}
                          onFocus={() => setVehicleDropOpen(true)}
                          placeholder="ابحث برقم اللوحة أو اسم العميل..."
                          className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 pr-7"
                          style={{ background: 'rgba(30,41,59,0.8)', border: `1px solid ${selectedVehicle ? 'rgba(56,189,248,0.5)' : 'rgba(71,85,105,0.5)'}` }}
                          data-testid="vehicle-search-input"
                        />
                        {selectedVehicle && (
                          <button type="button" onClick={() => { setSelectedVehicle(null); setVehicleSearch(''); setPartnerName(''); }}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                            <X size={11} />
                          </button>
                        )}
                        {vehicleDropOpen && !selectedVehicle && (
                          <div className="absolute top-full left-0 right-0 mt-0.5 rounded-lg border border-slate-700 max-h-36 overflow-y-auto z-50"
                            style={{ background: 'rgba(15,23,42,0.98)' }}>
                            {vehicles
                              .filter(v => {
                                const q = vehicleSearch.toLowerCase();
                                return !q || v.plateNumber?.toLowerCase().includes(q) || v.customerName?.toLowerCase().includes(q);
                              })
                              .slice(0, 15)
                              .map(v => (
                                <button key={v.id} type="button"
                                  onClick={() => { setSelectedVehicle(v); setVehicleSearch(''); setVehicleDropOpen(false); setPartnerName(v.customerName || ''); }}
                                  className="w-full text-right px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-sky-500/15 flex justify-between items-center"
                                  data-testid={`vehicle-option-${v.id}`}>
                                  <span className="text-slate-400 text-[10px]">{v.customerName}</span>
                                  <span className="font-medium text-sky-300">{v.plateNumber}</span>
                                </button>
                              ))}
                            {vehicles.filter(v => {
                              const q = vehicleSearch.toLowerCase();
                              return !q || v.plateNumber?.toLowerCase().includes(q) || v.customerName?.toLowerCase().includes(q);
                            }).length === 0 && (
                              <div className="px-2.5 py-2 text-[10px] text-slate-500">لا توجد نتائج</div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedVehicle && (
                        <div className="mt-1 text-[10px] text-sky-400 flex items-center gap-1">
                          ✓ مرتبط: {selectedVehicle.plateNumber} — {selectedVehicle.brand} {selectedVehicle.model}
                        </div>
                      )}
                    </div>

                    {/* اختيار حساب خاص (override) */}
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block">حساب خاص (اختياري — يُبدّل حساب الإيراد/المصروف)</label>
                      <select
                        value={selectedAccount?.code || ''}
                        onChange={e => {
                          const acc = SPECIAL_ACCOUNTS.find(a => a.code === e.target.value);
                          setSelectedAccount(acc || null);
                        }}
                        className="w-full rounded-lg px-2 py-1.5 text-[11px] text-slate-100"
                        style={{ background: 'rgba(30,41,59,0.8)', border: `1px solid ${selectedAccount ? 'rgba(167,139,250,0.5)' : 'rgba(71,85,105,0.5)'}` }}
                        data-testid="special-account-select"
                      >
                        <option value="">الحساب الافتراضي من النموذج</option>
                        {Object.entries(
                          SPECIAL_ACCOUNTS.reduce((g, a) => ({ ...g, [a.group]: [...(g[a.group]||[]), a] }), {})
                        ).map(([group, accs]) => (
                          <optgroup key={group} label={group}>
                            {accs.map(a => (
                              <option key={a.code} value={a.code}>[{a.code}] {a.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {selectedAccount && (
                        <div className="mt-1 text-[10px] text-violet-400 flex items-center gap-1">
                          ✓ مُبدَّل إلى: [{selectedAccount.code}] {selectedAccount.name}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* ─── وضع يدوي ──────────────────────────────────────── */
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block">حساب المدين</label>
                        <input value={customDebit} onChange={e => setCustomDebit(e.target.value)}
                          placeholder="مثال: 036"
                          className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100"
                          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                        {customDebit && <div className="text-[9px] text-sky-400 mt-0.5">{ACCOUNTS[customDebit] || '—'}</div>}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block">حساب الدائن</label>
                        <input value={customCredit} onChange={e => setCustomCredit(e.target.value)}
                          placeholder="مثال: 004"
                          className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100"
                          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                        {customCredit && <div className="text-[9px] text-sky-400 mt-0.5">{ACCOUNTS[customCredit] || '—'}</div>}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block">الوصف</label>
                      <input value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="وصف القيد..."
                        className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100"
                        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                    </div>
                  </>
                )}

                {/* التاريخ + المبلغ */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">التاريخ</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-[11px] text-slate-100"
                      style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">المبلغ (ر.س)</label>
                    <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100"
                      style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }}
                      data-testid="create-amount-input" />
                  </div>
                </div>

                {/* أزرار مبالغ سريعة */}
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_AMOUNTS.map(a => (
                    <button key={a} type="button" onClick={() => setAmount(String(a))}
                      className={`px-2 py-1 rounded-lg text-[10px] border transition-colors ${
                        amount===String(a) ? 'border-sky-500/60 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                      {a}
                    </button>
                  ))}
                </div>

                {/* معاينة القيد */}
                {previewLines.length > 0 && (
                  <div className={`rounded-xl border p-2.5 ${isBalanced ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                    data-testid="journal-preview">
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold">
                      {isBalanced ? <CheckCircle size={12} className="text-green-400" /> : <AlertCircle size={12} className="text-red-400" />}
                      <span className={isBalanced ? 'text-green-300' : 'text-red-300'}>
                        {isBalanced ? 'قيد متوازن ✓' : 'قيد غير متوازن'}
                      </span>
                    </div>
                    {previewLines.map((l, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] py-0.5">
                        <span className="text-slate-300">[{l.account}] {l.name}</span>
                        <div className="flex gap-3">
                          {l.debit  > 0 && <span className="text-red-300">د {l.debit.toLocaleString('ar-SA')}</span>}
                          {l.credit > 0 && <span className="text-green-300">ء {l.credit.toLocaleString('ar-SA')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {createResult && (
                  <div className={`rounded-lg p-2 text-[11px] ${
                    createResult.ok ? 'bg-green-500/10 border border-green-500/30 text-green-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
                  }`} data-testid="create-result">{createResult.msg}</div>
                )}

                <button type="submit" disabled={loading || !isBalanced}
                  className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: isBalanced ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : 'rgba(71,85,105,0.5)' }}
                  data-testid="create-submit-btn">
                  {loading ? <Loader size={14} className="animate-spin mx-auto" /> :
                    partnerName ? 'إنشاء القيد + العملية' : 'إنشاء القيد'}
                </button>

                {/* مقترحات */}
                <div className="rounded-xl border border-dashed border-slate-700 p-2.5 text-[10px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-400 mb-1">💡 اقتراحات سريعة:</div>
                  {[
                    ['بيع خدمة بنك', () => { setSelectedTemplate('service_sale'); setPaymentMethod('bank'); }],
                    ['مصروف نقدي', () => { setSelectedTemplate('expense'); setPaymentMethod('cash'); }],
                    ['رواتب عمال', () => { setSelectedTemplate('salary'); setPaymentMethod('bank'); }],
                    ['مشتريات آجل', () => { setSelectedTemplate('purchase'); setPaymentMethod('credit'); }],
                  ].map(([l, fn]) => (
                    <button key={l} type="button" onClick={fn}
                      className="w-full text-right py-1 px-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-sky-300 transition-colors">
                      → {l}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
