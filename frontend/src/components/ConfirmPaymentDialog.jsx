import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

const todayISO = () => new Date().toISOString().split('T')[0];

const METHODS = [
  { value: 'bank', label: 'بنك / تحويل', sub: '004', color: 'border-sky-500/60 bg-sky-500/10 text-sky-200' },
  { value: 'cash', label: 'نقد',          sub: '003', color: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' },
  { value: 'pos',  label: 'نقاط بيع',    sub: '006', color: 'border-violet-500/60 bg-violet-500/10 text-violet-200' },
];

const emptyLine = () => ({ id: Date.now() + Math.random(), method: 'bank', amountStr: '' });

const ConfirmPaymentDialog = ({ open, onOpenChange, onConfirm, loading = false, remainingBalance = 0 }) => {
  const [lines, setLines]       = useState([emptyLine()]);
  const [dateStr, setDateStr]   = useState(todayISO());

  /* reset when dialog opens */
  const handleOpenChange = (v) => {
    if (v) {
      setLines([emptyLine()]);
      setDateStr(todayISO());
    }
    onOpenChange(v);
  };

  const updateLine = (id, field, value) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const removeLine = (id) => {
    setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
  };

  /* إجمالي ما أُدخل */
  const enteredTotal = lines.reduce((s, l) => {
    const n = parseFloat(l.amountStr);
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  /* هل يوجد خطأ في أي سطر؟ */
  const hasError = lines.some(l => {
    if (!l.amountStr.trim()) return false; // فارغ = مقبول
    const n = parseFloat(l.amountStr);
    return !Number.isFinite(n) || n <= 0;
  });

  const handleSubmit = () => {
    if (hasError) return;

    // بناء قائمة المدفوعات
    const paymentLines = lines.map(l => {
      const n = parseFloat(l.amountStr);
      return {
        method: l.method,
        amount: Number.isFinite(n) && n > 0 ? n : null,  // null = حصة من الرصيد
      };
    });

    onConfirm({ paymentLines, date: dateStr || todayISO() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تأكيد السداد</DialogTitle>
          {remainingBalance > 0 && (
            <p className="text-sm text-amber-300 mt-1">
              الرصيد المتبقي: <span className="font-bold tabular-nums">{remainingBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</span> ر.س
            </p>
          )}
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* سطور الوسائل */}
          {lines.map((line, idx) => {
            const n = parseFloat(line.amountStr);
            const isValid = !line.amountStr.trim() || (Number.isFinite(n) && n > 0);
            return (
              <div key={line.id} className="rounded-xl border border-white/10 bg-white/4 p-3 space-y-2" data-testid={`pay-line-${idx}`}>
                {/* وسيلة الدفع */}
                <div className="grid grid-cols-3 gap-1.5">
                  {METHODS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateLine(line.id, 'method', opt.value)}
                      className={`rounded-lg border px-1.5 py-2 text-center text-xs transition-all ${
                        line.method === opt.value
                          ? opt.color + ' border-opacity-80 font-semibold'
                          : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500'
                      }`}
                      data-testid={`pay-line-${idx}-method-${opt.value}`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[9px] opacity-60">{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {/* المبلغ */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amountStr}
                    onChange={e => updateLine(line.id, 'amountStr', e.target.value)}
                    placeholder={
                      idx === 0 && lines.length === 1
                        ? `${remainingBalance > 0 ? remainingBalance.toLocaleString('ar-SA') : 'المبلغ'} ر.س — فارغ = كامل الرصيد`
                        : 'المبلغ'
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm bg-slate-900/60 text-slate-100 outline-none focus:ring-1 ${
                      isValid ? 'border-slate-600 focus:ring-sky-500' : 'border-red-500 focus:ring-red-500'
                    }`}
                    data-testid={`pay-line-${idx}-amount`}
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/30 text-xs"
                      data-testid={`pay-line-${idx}-remove`}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {!isValid && (
                  <p className="text-xs text-red-400">مبلغ غير صحيح</p>
                )}
              </div>
            );
          })}

          {/* زر إضافة وسيلة */}
          <button
            type="button"
            onClick={addLine}
            className="w-full rounded-xl border border-dashed border-slate-500 py-2 text-xs text-slate-400 hover:border-sky-500 hover:text-sky-300 transition-all"
            data-testid="pay-add-method-btn"
          >
            + إضافة وسيلة دفع أخرى
          </button>

          {/* إجمالي ما أُدخل */}
          {enteredTotal > 0 && (
            <div className="flex justify-between text-sm rounded-lg bg-white/5 px-3 py-2">
              <span className="text-slate-400">إجمالي المُدخل</span>
              <span className="font-bold tabular-nums text-sky-300">
                {enteredTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
              </span>
            </div>
          )}

          {/* تاريخ السداد */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">تاريخ السداد</label>
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-sky-500"
              data-testid="confirm-payment-dialog-date"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || hasError}
            data-testid="confirm-payment-dialog-submit"
          >
            {loading ? 'جارٍ التنفيذ...' : 'تأكيد السداد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentDialog;
