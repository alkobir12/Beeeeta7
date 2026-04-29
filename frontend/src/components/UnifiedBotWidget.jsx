/**
 * UnifiedBotWidget — بوت موحد يجمع:
 * 1. المساعد الذكي (Workshop AI)
 * 2. المدقق المالي (Finance Auditor)
 * 3. أوامر سريعة: إنشاء قيد / إنشاء عملية
 *
 * الموضع: فوق زر القائمة على الجوال (bottom-20 left-4)
 *         في الزاوية السفلى اليسرى على الديسكتوب
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, MessageSquare, ShieldCheck, Plus, ChevronLeft, Send, Loader, FileText, Wrench } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const WID = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';

// ─── tabs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'assistant', label: 'المساعد', icon: MessageSquare },
  { id: 'auditor',   label: 'المدقق',   icon: ShieldCheck  },
  { id: 'create',    label: 'إنشاء',    icon: Plus         },
];

// ─── initial messages ──────────────────────────────────────────────────────
const INIT_ASSISTANT = [
  { role: 'assistant', content: 'مرحباً! أنا مساعد الورشة الذكي. يمكنني مساعدتك في تشخيص الأعطال واقتراح الصيانة والإجابة على أسئلة الورشة.' }
];
const INIT_AUDITOR = [
  { role: 'assistant', content: 'مرحباً! أنا المدقق المالي. يمكنني مراجعة القيود، تحليل الإيرادات، وإنشاء قيود يومية مباشرة بأوامر نصية.' }
];

export default function UnifiedBotWidget() {
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState('assistant');
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);

  // assistant state
  const [aMessages, setAMessages] = useState(INIT_ASSISTANT);
  // auditor state
  const [fMessages, setFMessages] = useState(INIT_AUDITOR);
  const [fSession, setFSession]   = useState(() => `sess-${Date.now()}`);

  // create form state
  const [createMode, setCreateMode] = useState('journal'); // 'journal' | 'operation'
  const [createForm, setCreateForm] = useState({
    description: '', debit_account: '', credit_account: '', amount: '', date: new Date().toISOString().split('T')[0],
    // operation fields
    type: 'sale', payment_method: 'bank', partner_name: '', total: '',
  });
  const [createResult, setCreateResult] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aMessages, fMessages, tab]);

  // ─── المساعد الذكي ──────────────────────────────────────────────────────
  const sendAssistant = useCallback(async (text) => {
    if (!text.trim()) return;
    setAMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput(''); setLoading(true);
    try {
      const r = await axios.post(`${API}/api/ai/chat`, {
        message: text, workshop_id: WID,
        history: aMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      });
      const reply = r.data?.response || r.data?.message || 'لا استجابة';
      setAMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setAMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ، حاول مرة أخرى.' }]);
    } finally { setLoading(false); }
  }, [aMessages]);

  // ─── المدقق المالي ──────────────────────────────────────────────────────
  const sendAuditor = useCallback(async (text) => {
    if (!text.trim()) return;
    setFMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput(''); setLoading(true);
    try {
      // كشف أوامر الإنشاء المباشرة
      const lc = text.toLowerCase();
      if (lc.includes('أنشئ قيد') || lc.includes('انشئ قيد') || lc.includes('create journal')) {
        setTab('create'); setCreateMode('journal');
        setFMessages(prev => [...prev, { role: 'assistant', content: 'انتقلت إلى تبويب "إنشاء" — أكمل بيانات القيد وسيُسجَّل مباشرة.' }]);
        setLoading(false); return;
      }
      if (lc.includes('أنشئ عملية') || lc.includes('انشئ عملية') || lc.includes('create operation')) {
        setTab('create'); setCreateMode('operation');
        setFMessages(prev => [...prev, { role: 'assistant', content: 'انتقلت إلى تبويب "إنشاء" — أكمل بيانات العملية.' }]);
        setLoading(false); return;
      }

      const r = await axios.post(`${API}/api/finance-bot/chat`, {
        message: text, session_id: fSession, workshop_id: WID,
        findings: [], action: null,
      });
      const data = r.data || {};
      const reply = data.response || 'لا استجابة';
      setFMessages(prev => [...prev, {
        role: 'assistant', content: reply,
        state: data.state, linkedData: data.linked_data,
        contradictions: data.contradictions, autoEscalated: data.auto_escalated,
        sessionId: fSession,
      }]);
    } catch {
      setFMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ، حاول مرة أخرى.' }]);
    } finally { setLoading(false); }
  }, [fMessages, fSession]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (tab === 'assistant') sendAssistant(input);
    else if (tab === 'auditor') sendAuditor(input);
  };

  // ─── إنشاء قيد/عملية ───────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true); setCreateResult(null);
    try {
      if (createMode === 'journal') {
        const amt = parseFloat(createForm.amount);
        if (!amt || !createForm.debit_account || !createForm.credit_account) {
          setCreateResult({ ok: false, msg: 'يرجى إدخال الحساب المدين والدائن والمبلغ' });
          return;
        }
        const payload = {
          workshop_id: WID,
          date: createForm.date,
          description: createForm.description || 'قيد يدوي',
          lines: [
            { account: createForm.debit_account.trim(),  account_name: createForm.debit_account.trim(),  debit: amt, credit: 0 },
            { account: createForm.credit_account.trim(), account_name: createForm.credit_account.trim(), debit: 0, credit: amt },
          ],
          total: amt,
          source: 'manual_bot',
        };
        await axios.post(`${API}/api/finance/journal-entries?workshop_id=${WID}`, payload);
        setCreateResult({ ok: true, msg: `✅ تم إنشاء القيد: ${createForm.description || 'قيد يدوي'} — ${amt.toLocaleString('ar-SA')} ر.س` });
        setCreateForm(prev => ({ ...prev, description: '', amount: '' }));
      } else {
        const tot = parseFloat(createForm.total);
        if (!tot || !createForm.partner_name) {
          setCreateResult({ ok: false, msg: 'يرجى إدخال اسم الشريك والإجمالي' });
          return;
        }
        const payload = {
          workshopId: WID, workshop_id: WID,
          type: createForm.type,
          paymentMethod: createForm.payment_method,
          paymentStatus: 'paid',
          partnerType: createForm.type === 'purchase' ? 'supplier' : 'customer',
          partnerName: createForm.partner_name,
          scope: 'workshop',
          date: createForm.date,
          total: tot, subtotal: tot,
          items: [{ name: createForm.description || createForm.type, itemType: 'service', qty: 1, price: tot, total: tot }],
        };
        const r = await axios.post(`${API}/api/operations`, payload);
        setCreateResult({ ok: true, msg: `✅ تم إنشاء العملية (${r.data?.id?.slice(0,8)})` });
        setCreateForm(prev => ({ ...prev, description: '', total: '', partner_name: '' }));
      }
    } catch (err) {
      setCreateResult({ ok: false, msg: err?.response?.data?.detail || 'حدث خطأ أثناء الإنشاء' });
    } finally { setLoading(false); }
  };

  const messages = tab === 'assistant' ? aMessages : fMessages;

  return (
    <>
      {/* ─── زر البوت ───────────────────────────────────────────────────── */}
      <div
        className="fixed z-[75] left-4 bottom-20 lg:bottom-6 lg:left-auto lg:right-6"
        data-testid="unified-bot-trigger"
      >
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
          {/* نقطة خضراء */}
          {!open && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-green-400 border border-slate-900 animate-pulse" />}
        </button>
      </div>

      {/* ─── نافذة البوت ────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed z-[74] left-4 bottom-36 lg:bottom-20 lg:left-auto lg:right-6 w-[92vw] max-w-[400px] rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col"
          style={{ height: '520px', background: 'rgba(2,6,23,0.97)', backdropFilter: 'blur(20px)' }}
          data-testid="unified-bot-panel"
        >
          {/* رأس البوت */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0"
            style={{ background: 'rgba(15,23,42,0.9)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100">المساعد الموحد</div>
                <div className="text-[10px] text-green-400">متصل</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400">
              <X size={15} />
            </button>
          </div>

          {/* تبويبات */}
          <div className="flex border-b border-slate-800/60 flex-shrink-0">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => { setTab(t.id); setInput(''); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                    tab === t.id ? 'border-b-2 border-sky-500 text-sky-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  data-testid={`bot-tab-${t.id}`}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* محتوى التبويب */}
          {tab !== 'create' ? (
            <>
              {/* رسائل */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`bot-message-${i}`}>
                    <div
                      className="max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                      style={m.role === 'user'
                        ? { background: 'rgba(14,165,233,0.2)', color: 'rgba(186,230,253,0.95)', borderRadius: '14px 14px 4px 14px' }
                        : { background: 'rgba(30,41,59,0.8)', color: 'rgba(226,232,240,0.92)', borderRadius: '14px 14px 14px 4px' }
                      }
                    >
                      {m.content}
                      {/* تناقضات المدقق */}
                      {m.contradictions?.length > 0 && (
                        <div className="mt-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 p-1.5 text-[10px] text-amber-300">
                          {m.contradictions[0].description?.slice(0, 80)}
                        </div>
                      )}
                      {/* حالة المدقق */}
                      {m.state && (
                        <span className={`mt-1 inline-block rounded-full text-[9px] px-1.5 py-0.5 ${
                          m.state === 'escalated' ? 'bg-red-500/20 text-red-300' :
                          m.state === 'resolved'  ? 'bg-green-500/20 text-green-300' :
                          'bg-sky-500/20 text-sky-300'}`}>
                          {m.state === 'escalated' ? 'مصعّدة' : m.state === 'resolved' ? 'محلولة' : 'قيد التحقيق'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-xl px-3 py-2 bg-slate-800/80">
                      <Loader size={14} className="text-sky-400 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* صندوق الإدخال */}
              <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-slate-800/60 flex-shrink-0">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={tab === 'auditor' ? 'مثال: أنشئ قيد، أو راجع الميزان...' : 'اسأل عن أي شيء...'}
                  className="flex-1 rounded-xl px-3 py-2 text-[12px] text-slate-100 outline-none"
                  style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }}
                  disabled={loading}
                  data-testid="bot-input"
                />
                <button type="submit" disabled={loading || !input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                  style={{ background: 'rgba(14,165,233,0.25)', border: '1px solid rgba(14,165,233,0.4)' }}>
                  <Send size={14} className="text-sky-300" />
                </button>
              </form>
            </>
          ) : (
            /* ─── تبويب الإنشاء ─────────────────────────────────────── */
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* اختيار النوع */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'journal',   label: 'قيد يومية',  icon: FileText },
                  { v: 'operation', label: 'عملية',      icon: Wrench   },
                ].map(({ v, label, icon: Icon }) => (
                  <button key={v} onClick={() => { setCreateMode(v); setCreateResult(null); }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold border transition-all ${
                      createMode === v
                        ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                    }`}
                    data-testid={`create-mode-${v}`}
                  >
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreate} className="space-y-2.5">
                {/* حقول مشتركة */}
                <div>
                  <label className="text-[10px] text-slate-400 mb-0.5 block">التاريخ</label>
                  <input type="date" value={createForm.date}
                    onChange={e => setCreateForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-0.5 block">
                    {createMode === 'journal' ? 'الوصف' : 'اسم العميل / المورد'}
                  </label>
                  <input value={createMode === 'journal' ? createForm.description : createForm.partner_name}
                    onChange={e => setCreateForm(p => createMode === 'journal'
                      ? { ...p, description: e.target.value } : { ...p, partner_name: e.target.value })}
                    placeholder={createMode === 'journal' ? 'مثال: فطور عمال' : 'مثال: أحمد العتيبي'}
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                </div>

                {createMode === 'journal' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 mb-0.5 block">حساب المدين</label>
                        <input value={createForm.debit_account}
                          onChange={e => setCreateForm(p => ({ ...p, debit_account: e.target.value }))}
                          placeholder="مثال: 036"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 mb-0.5 block">حساب الدائن</label>
                        <input value={createForm.credit_account}
                          onChange={e => setCreateForm(p => ({ ...p, credit_account: e.target.value }))}
                          placeholder="مثال: 004"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 mb-0.5 block">المبلغ (ر.س)</label>
                      <input type="number" min="0" step="0.01" value={createForm.amount}
                        onChange={e => setCreateForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 mb-0.5 block">نوع العملية</label>
                        <select value={createForm.type}
                          onChange={e => setCreateForm(p => ({ ...p, type: e.target.value }))}
                          className="w-full rounded-lg px-2 py-1.5 text-xs text-slate-100"
                          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }}>
                          <option value="sale">بيع / خدمة</option>
                          <option value="purchase">شراء</option>
                          <option value="expense">مصروف</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 mb-0.5 block">وسيلة السداد</label>
                        <select value={createForm.payment_method}
                          onChange={e => setCreateForm(p => ({ ...p, payment_method: e.target.value }))}
                          className="w-full rounded-lg px-2 py-1.5 text-xs text-slate-100"
                          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }}>
                          <option value="bank">بنك</option>
                          <option value="cash">نقد</option>
                          <option value="pos">نقاط بيع</option>
                          <option value="credit">آجل</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 mb-0.5 block">الإجمالي (ر.س)</label>
                      <input type="number" min="0" step="0.01" value={createForm.total}
                        onChange={e => setCreateForm(p => ({ ...p, total: e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(71,85,105,0.5)' }} />
                    </div>
                  </>
                )}

                {createResult && (
                  <div className={`rounded-lg p-2 text-[11px] ${
                    createResult.ok ? 'bg-green-500/10 border border-green-500/30 text-green-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
                  }`} data-testid="create-result">{createResult.msg}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}
                  data-testid="create-submit-btn">
                  {loading ? <Loader size={14} className="animate-spin mx-auto" /> :
                    createMode === 'journal' ? 'إنشاء القيد' : 'إنشاء العملية'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
