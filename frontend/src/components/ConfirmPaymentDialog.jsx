import React, { useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

const todayISO = () => new Date().toISOString().split('T')[0];

const ConfirmPaymentDialog = ({ open, onOpenChange, onConfirm, loading = false, remainingBalance }) => {
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [receiptFile, setReceiptFile] = useState(null);
  const [encodingReceipt, setEncodingReceipt] = useState(false);

  const handleOpenChange = (v) => {
    if (v) {
      setAmountStr('');
      setDateStr(todayISO());
      setPaymentMethod('bank');
      setReceiptFile(null);
    }
    onOpenChange(v);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });

  const handleSubmit = async () => {
    if (parsed.error) return;
    let receipt = null;
    if (receiptFile) {
      setEncodingReceipt(true);
      try {
        const base64 = await fileToBase64(receiptFile);
        receipt = {
          name: receiptFile.name,
          mimeType: receiptFile.type || 'application/octet-stream',
          base64,
        };
      } finally {
        setEncodingReceipt(false);
      }
    }
    // amount=undefined يعني السداد الكامل (يُحسب في الـ parent)
    onConfirm({ amount: parsed.amount, date: dateStr || todayISO(), paymentMethod, receipt });
  };

  const parsed = useMemo(() => {
    const raw = amountStr.trim();
    if (!raw) return { amount: undefined, error: null };  // فارغ = سداد كامل
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return { amount: undefined, error: 'مبلغ غير صحيح' };
    return { amount: n, error: null };
  }, [amountStr]);

  const placeholderText = remainingBalance > 0
    ? `الرصيد المتبقي: ${remainingBalance.toLocaleString('ar-SA')} ر.س — اتركه فارغاً للسداد الكامل`
    : 'اتركه فارغاً للسداد الكامل';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تأكيد سداد</DialogTitle>
          <DialogDescription>
            أدخل مبلغ السداد (اختياري للسداد الكامل) وحدد تاريخ السداد.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirm-payment-method-select">وسيلة السداد</label>
            <div className="grid grid-cols-3 gap-2" data-testid="confirm-payment-dialog-method-select">
              {[
                { value: 'cash', label: 'نقد', sub: 'حساب 003', color: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' },
                { value: 'bank', label: 'بنك / تحويل', sub: 'حساب 004', color: 'border-sky-500/60 bg-sky-500/10 text-sky-300' },
                { value: 'pos',  label: 'نقاط بيع',   sub: 'حساب 006', color: 'border-violet-500/60 bg-violet-500/10 text-violet-300' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`rounded-xl border-2 px-2 py-2.5 text-center transition-all ${
                    paymentMethod === opt.value
                      ? opt.color + ' font-semibold'
                      : 'border-slate-600 bg-slate-800/40 text-slate-300 hover:border-slate-500'
                  }`}
                  data-testid={`confirm-payment-method-${opt.value}`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
            {/* hidden select for test compatibility */}
            <select
              id="confirm-payment-method-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="sr-only"
              data-testid="confirm-payment-dialog-method-select"
            >
              <option value="cash">نقد</option>
              <option value="bank">بنك</option>
              <option value="pos">نقاط بيع</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">مبلغ السداد (اختياري)</label>
            <Input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder={placeholderText}
              inputMode="decimal"
            />
            {parsed.error && <p className="text-sm text-red-600">{parsed.error}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">تاريخ السداد</label>
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirm-payment-dialog-receipt-input">إرفاق إيصال (اختياري)</label>
            <input
              id="confirm-payment-dialog-receipt-input"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setReceiptFile(file);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              data-testid="confirm-payment-dialog-receipt-input"
            />
            {receiptFile ? (
              <div className="text-xs text-emerald-700" data-testid="confirm-payment-dialog-receipt-name">✓ {receiptFile.name}</div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || encodingReceipt || !!parsed.error}
            data-testid="confirm-payment-dialog-submit"
          >
            {loading || encodingReceipt ? 'جارٍ التنفيذ...' : 'تأكيد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentDialog;
