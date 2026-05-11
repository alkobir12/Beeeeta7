/**
 * 💳 SmartPOSJournal — POS-style fast journal entry creation
 *
 * Comprehensive yet simple:
 *  • 6 quick templates (cash sale / cash expense / collect from customer /
 *    pay supplier / bank deposit / bank withdrawal).
 *  • Numpad-style amount input + sub-account picker + payment method + note.
 *  • Optional "Cart mode" for multi-item ticket (services/parts) that
 *    builds a balanced invoice journal entry.
 *  • Side panel: latest 5 entries with one-click "Copy" to re-use as template.
 *
 * Builds a balanced double-entry journal entry and POSTs to
 * /api/finance/journal-entries (Double-Entry Firewall enforces balance).
 */

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Banknote,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Delete,
  HandCoins,
  Landmark,
  Loader2,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  UserCheck,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';

const formatSAR = (n) =>
  new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0) + ' ر.س';

// ----- Quick templates -----
const TEMPLATES = [
  {
    key: 'cash_sale',
    title: '💵 بيع نقدي',
    color: 'emerald',
    desc: 'إيراد نقدي مباشر',
    debitAccount: '003',
    debitName: 'النقد',
    creditAccount: '042',
    creditName: 'إيراد قطع الورشة',
    needsPaymentMethod: true,
  },
  {
    key: 'card_sale',
    title: '💳 بيع بنكي/بطاقة',
    color: 'sky',
    desc: 'إيراد عبر البنك أو POS',
    debitAccount: '004',
    debitName: 'البنك',
    creditAccount: '042',
    creditName: 'إيراد قطع الورشة',
    needsPaymentMethod: false,
  },
  {
    key: 'cash_expense',
    title: '🧾 صرف نقدي',
    color: 'rose',
    desc: 'مصروف نقدي مباشر',
    debitAccount: '035',
    debitName: 'مصروفات تشغيلية',
    creditAccount: '003',
    creditName: 'النقد',
    needsPaymentMethod: false,
  },
  {
    key: 'collect_customer',
    title: '🤝 تحصيل من عميل',
    color: 'amber',
    desc: 'دفعة من عميل آجل',
    debitAccount: '003',
    debitName: 'النقد',
    creditAccount: '005',
    creditName: 'العملاء (ذمم مدينة)',
    needsPaymentMethod: true,
  },
  {
    key: 'pay_supplier',
    title: '📦 سداد لمورد',
    color: 'violet',
    desc: 'تسوية مع مورد',
    debitAccount: '2101',
    debitName: 'الموردون (ذمم دائنة)',
    creditAccount: '003',
    creditName: 'النقد',
    needsPaymentMethod: true,
  },
  {
    key: 'bank_deposit',
    title: '🏧 إيداع بنكي',
    color: 'cyan',
    desc: 'نقل من النقد للبنك',
    debitAccount: '004',
    debitName: 'البنك',
    creditAccount: '003',
    creditName: 'النقد',
    needsPaymentMethod: false,
  },
];

const PAYMENT_METHODS = [
  { key: 'cash', label: 'نقدي', account: '003' },
  { key: 'bank', label: 'بنك / بطاقة', account: '004' },
  { key: 'pos', label: 'نقاط بيع', account: '006' },
];

const toneClasses = (color) => {
  const map = {
    emerald: { bg: 'from-emerald-500/25 to-teal-500/15', border: 'border-emerald-400/30', text: 'text-emerald-100', active: 'ring-emerald-400/40' },
    sky: { bg: 'from-sky-500/25 to-cyan-500/15', border: 'border-sky-400/30', text: 'text-sky-100', active: 'ring-sky-400/40' },
    rose: { bg: 'from-rose-500/25 to-pink-500/15', border: 'border-rose-400/30', text: 'text-rose-100', active: 'ring-rose-400/40' },
    amber: { bg: 'from-amber-500/25 to-orange-500/15', border: 'border-amber-400/30', text: 'text-amber-100', active: 'ring-amber-400/40' },
    violet: { bg: 'from-violet-500/25 to-fuchsia-500/15', border: 'border-violet-400/30', text: 'text-violet-100', active: 'ring-violet-400/40' },
    cyan: { bg: 'from-cyan-500/25 to-teal-500/15', border: 'border-cyan-400/30', text: 'text-cyan-100', active: 'ring-cyan-400/40' },
  };
  return map[color] || map.sky;
};

export default function SmartPOSJournal({ apiBase, workshopId, accounts = [], recentEntries = [], onSaved }) {
  const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [debitOverride, setDebitOverride] = useState('');
  const [creditOverride, setCreditOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(null);
  const [mode, setMode] = useState('template'); // 'template' | 'cart'
  const [cart, setCart] = useState([]);
  const [cartItem, setCartItem] = useState({ name: '', price: '', qty: 1 });

  // Reset overrides when template changes
  useEffect(() => {
    setDebitOverride('');
    setCreditOverride('');
  }, [activeTemplate?.key]);

  // Compute effective accounts (apply overrides + payment method)
  const effective = useMemo(() => {
    if (mode === 'cart') {
      // Cart mode: debit cash/bank (based on payment method), credit revenue 042
      const pm = PAYMENT_METHODS.find((m) => m.key === paymentMethod) || PAYMENT_METHODS[0];
      const cartTotal = cart.reduce((sum, c) => sum + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
      return {
        debitAccount: pm.account,
        debitName: pm.label,
        creditAccount: '042',
        creditName: 'إيراد قطع الورشة',
        amount: cartTotal,
      };
    }
    const tpl = activeTemplate || TEMPLATES[0];
    let dr = debitOverride || tpl.debitAccount;
    let drName = tpl.debitName;
    if (tpl.needsPaymentMethod) {
      const pm = PAYMENT_METHODS.find((m) => m.key === paymentMethod);
      if (pm) {
        if (tpl.key === 'cash_sale' || tpl.key === 'collect_customer') {
          dr = pm.account;
          drName = pm.label;
        } else if (tpl.key === 'pay_supplier') {
          // Pay from selected payment account (cash/bank)
          return {
            debitAccount: tpl.debitAccount,
            debitName: tpl.debitName,
            creditAccount: pm.account,
            creditName: pm.label,
            amount: Number(amount) || 0,
          };
        }
      }
    }
    const cr = creditOverride || tpl.creditAccount;
    return {
      debitAccount: dr,
      debitName: drName,
      creditAccount: cr,
      creditName: tpl.creditName,
      amount: Number(amount) || 0,
    };
  }, [activeTemplate, amount, paymentMethod, debitOverride, creditOverride, mode, cart]);

  const isValid = useMemo(() => {
    if (mode === 'cart') return cart.length > 0 && effective.amount > 0;
    return Number(amount) > 0;
  }, [mode, cart, amount, effective.amount]);

  // ----- Numpad -----
  const appendDigit = (d) => {
    setAmount((prev) => {
      if (d === '.' && prev.includes('.')) return prev;
      if (prev === '0' && d !== '.') return String(d);
      return String(prev || '') + String(d);
    });
  };
  const backspaceAmount = () => setAmount((prev) => String(prev).slice(0, -1));
  const clearAmount = () => setAmount('');

  // ----- Cart helpers -----
  const addCartItem = () => {
    const n = cartItem.name.trim();
    const p = Number(cartItem.price);
    const q = Number(cartItem.qty) || 1;
    if (!n || !(p > 0)) return;
    setCart((prev) => [...prev, { id: Date.now() + Math.random(), name: n, price: p, qty: q }]);
    setCartItem({ name: '', price: '', qty: 1 });
  };
  const removeCartItem = (id) => setCart((prev) => prev.filter((c) => c.id !== id));

  // ----- Save -----
  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setSavedToast(null);
    try {
      const totalAmount = Number(effective.amount.toFixed(2));
      const description =
        mode === 'cart'
          ? `فاتورة سريعة — ${cart.map((c) => `${c.name}×${c.qty}`).join('، ')}`
          : `${activeTemplate?.title || 'قيد'} — ${note || ''}`.trim();

      const entry = {
        date: new Date().toISOString().slice(0, 10),
        description,
        transaction_type: mode === 'cart' ? 'invoice' : 'manual',
        source: mode === 'cart' ? 'pos_cart' : 'pos_template',
        total: totalAmount,
        lines: [
          {
            account: effective.debitAccount,
            account_name: effective.debitName,
            debit: totalAmount,
            credit: 0,
          },
          {
            account: effective.creditAccount,
            account_name: effective.creditName,
            debit: 0,
            credit: totalAmount,
          },
        ],
      };

      const res = await axios.post(
        `${apiBase}/finance/journal-entries`,
        entry,
        { params: { workshop_id: workshopId } }
      );

      if (res?.data?.success || res?.data?.id) {
        setSavedToast({ ok: true, id: res.data.id, total: totalAmount });
        // Reset
        setAmount('');
        setNote('');
        setCart([]);
        if (typeof onSaved === 'function') onSaved(res.data);
      } else {
        setSavedToast({ ok: false, error: 'استجابة غير متوقعة' });
      }
    } catch (err) {
      setSavedToast({
        ok: false,
        error: err?.response?.data?.detail || err?.message || 'فشل الحفظ',
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSavedToast(null), 4500);
    }
  };

  // ----- Copy from a recent entry -----
  const copyFromRecent = (entry) => {
    const lines = entry?.lines || [];
    const debitLine = lines.find((l) => Number(l.debit) > 0);
    const creditLine = lines.find((l) => Number(l.credit) > 0);
    if (!debitLine || !creditLine) return;
    const total = Number(entry.total || debitLine.debit || 0);
    setMode('template');
    // Find matching template (best-effort)
    const tpl = TEMPLATES.find(
      (t) => t.debitAccount === debitLine.account && t.creditAccount === creditLine.account
    );
    if (tpl) setActiveTemplate(tpl);
    setDebitOverride(debitLine.account);
    setCreditOverride(creditLine.account);
    setAmount(String(total));
    setNote(String(entry.description || ''));
  };

  const tone = toneClasses(activeTemplate?.color || 'sky');

  return (
    <div className="space-y-4" dir="rtl" data-testid="pos-journal-root">
      {/* Mode toggle */}
      <div className="flex items-center gap-2" data-testid="pos-mode-toggle">
        <button
          type="button"
          onClick={() => setMode('template')}
          data-testid="pos-mode-template-button"
          className={`px-4 py-2 rounded-xl text-sm border transition ${
            mode === 'template'
              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-50'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Wallet size={14} className="inline-block ml-1" />
          قوالب سريعة
        </button>
        <button
          type="button"
          onClick={() => setMode('cart')}
          data-testid="pos-mode-cart-button"
          className={`px-4 py-2 rounded-xl text-sm border transition ${
            mode === 'cart'
              ? 'bg-violet-500/20 border-violet-400/40 text-violet-50'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <ShoppingCart size={14} className="inline-block ml-1" />
          سلة كاشير
        </button>
      </div>

      {mode === 'template' ? (
        <>
          {/* Template grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="pos-templates-grid">
            {TEMPLATES.map((tpl) => {
              const tt = toneClasses(tpl.color);
              const active = tpl.key === activeTemplate?.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => setActiveTemplate(tpl)}
                  data-testid={`pos-template-${tpl.key}`}
                  className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-right transition ${tt.bg} ${tt.border} ${tt.text} ${
                    active ? `ring-2 ${tt.active}` : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="text-lg font-bold">{tpl.title}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{tpl.desc}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Cart builder */}
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-3 space-y-3" data-testid="pos-cart-builder">
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="اسم الخدمة/القطعة"
                value={cartItem.name}
                onChange={(e) => setCartItem((s) => ({ ...s, name: e.target.value }))}
                className="col-span-6 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500"
                data-testid="pos-cart-item-name"
              />
              <input
                type="number"
                placeholder="السعر"
                value={cartItem.price}
                onChange={(e) => setCartItem((s) => ({ ...s, price: e.target.value }))}
                className="col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 tabular-nums"
                data-testid="pos-cart-item-price"
              />
              <input
                type="number"
                min="1"
                placeholder="الكمية"
                value={cartItem.qty}
                onChange={(e) => setCartItem((s) => ({ ...s, qty: e.target.value }))}
                className="col-span-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 tabular-nums"
                data-testid="pos-cart-item-qty"
              />
              <button
                type="button"
                onClick={addCartItem}
                disabled={!cartItem.name || !Number(cartItem.price)}
                data-testid="pos-cart-add-item"
                className="col-span-1 rounded-lg bg-violet-500/30 border border-violet-300/40 text-violet-50 disabled:opacity-40 flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>
            {cart.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">السلة فارغة — أضف خدمات/قطع لبناء الفاتورة</div>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {cart.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs" data-testid="pos-cart-row">
                    <div className="flex-1 truncate text-slate-100">{c.name}</div>
                    <div className="text-slate-400 tabular-nums">{c.qty} × {formatSAR(c.price)}</div>
                    <div className="text-emerald-200 font-semibold tabular-nums">{formatSAR((Number(c.price) || 0) * (Number(c.qty) || 1))}</div>
                    <button onClick={() => removeCartItem(c.id)} className="text-rose-300 hover:text-rose-200">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Amount + Numpad + Payment + Save */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Amount display */}
          <div className={`rounded-2xl border bg-gradient-to-br ${tone.bg} ${tone.border} p-4`} data-testid="pos-amount-display">
            <div className="text-[10px] uppercase tracking-wider text-slate-300/80 mb-1">المبلغ</div>
            <div className={`text-4xl lg:text-5xl font-black tabular-nums ${tone.text}`} data-testid="pos-amount-value">
              {mode === 'cart' ? formatSAR(effective.amount) : (amount ? formatSAR(amount) : '٠٫٠٠ ر.س')}
            </div>
            <div className="mt-2 text-[11px] text-slate-300/80 flex flex-wrap gap-x-2">
              <span>مدين: <span className="font-mono">{effective.debitAccount}</span> · {effective.debitName}</span>
              <span>↔</span>
              <span>دائن: <span className="font-mono">{effective.creditAccount}</span> · {effective.creditName}</span>
            </div>
          </div>

          {/* Numpad — only for template mode */}
          {mode === 'template' ? (
            <div className="grid grid-cols-4 gap-2" data-testid="pos-numpad">
              {['7', '8', '9', 'C', '4', '5', '6', '⌫', '1', '2', '3', '.', '0', '00', '000', 'OK'].map((k) => {
                const isAction = ['C', '⌫', 'OK'].includes(k);
                const handler = () => {
                  if (k === 'C') return clearAmount();
                  if (k === '⌫') return backspaceAmount();
                  if (k === 'OK') return handleSave();
                  return appendDigit(k);
                };
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={handler}
                    disabled={k === 'OK' && (!isValid || saving)}
                    data-testid={`pos-numpad-${k === '⌫' ? 'backspace' : k === '.' ? 'dot' : k.toLowerCase()}`}
                    className={`h-12 rounded-xl text-lg font-bold tabular-nums transition ${
                      k === 'OK'
                        ? 'bg-emerald-500/30 border border-emerald-300/40 text-emerald-50 disabled:opacity-40 col-span-1'
                        : k === 'C'
                        ? 'bg-rose-500/15 border border-rose-300/30 text-rose-100'
                        : k === '⌫'
                        ? 'bg-amber-500/15 border border-amber-300/30 text-amber-100'
                        : 'bg-white/5 border border-white/10 text-slate-100 hover:bg-white/10'
                    }`}
                  >
                    {k === '⌫' ? <Delete size={18} className="inline-block" /> : k}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Payment method (when applicable) */}
          {(activeTemplate?.needsPaymentMethod || mode === 'cart') ? (
            <div className="flex items-center gap-2" data-testid="pos-payment-method-row">
              <span className="text-xs text-slate-400">طريقة الدفع:</span>
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMethod(m.key)}
                  data-testid={`pos-payment-method-${m.key}`}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    paymentMethod === m.key
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-50'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {m.key === 'cash' ? <Banknote size={12} className="inline-block ml-1" /> : null}
                  {m.key === 'bank' ? <Landmark size={12} className="inline-block ml-1" /> : null}
                  {m.key === 'pos' ? <CreditCard size={12} className="inline-block ml-1" /> : null}
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Note */}
          {mode === 'template' ? (
            <input
              type="text"
              placeholder="ملاحظة (اختياري)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="pos-note-input"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500"
            />
          ) : null}

          {/* Big Save button (mainly for cart, since numpad has OK for templates) */}
          {mode === 'cart' ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || saving}
              data-testid="pos-save-button"
              className="w-full h-12 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-300/40 text-emerald-50 font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'جاري الحفظ...' : `حفظ القيد (${formatSAR(effective.amount)})`}
            </button>
          ) : null}

          {savedToast ? (
            <div
              data-testid="pos-save-toast"
              className={`rounded-xl border p-3 text-sm ${
                savedToast.ok
                  ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100'
                  : 'bg-rose-500/10 border-rose-400/30 text-rose-100'
              }`}
            >
              {savedToast.ok ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  تم حفظ قيد بقيمة {formatSAR(savedToast.total)}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <X size={16} />
                  {savedToast.error}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Side: Recent entries */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-3" data-testid="pos-recent-entries-panel">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-2">
            <HandCoins size={12} />
            آخر القيود
          </div>
          {(recentEntries || []).length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4">لا توجد قيود سابقة</div>
          ) : (
            <ul className="space-y-1.5 max-h-[480px] overflow-y-auto">
              {(recentEntries || []).slice(0, 5).map((e, idx) => (
                <li key={e?.id || idx} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs" data-testid="pos-recent-entry-row">
                  <div className="flex items-center justify-between">
                    <div className="text-slate-200 truncate flex-1" title={e?.description}>
                      {e?.description || '—'}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyFromRecent(e)}
                      data-testid="pos-recent-entry-copy"
                      className="shrink-0 text-cyan-300 hover:text-cyan-100"
                      title="نسخ"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-200 tabular-nums">{formatSAR(e?.total)}</span>
                    <span className="text-slate-400">{e?.date || ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
