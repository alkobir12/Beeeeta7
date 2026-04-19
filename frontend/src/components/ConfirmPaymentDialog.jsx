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

// amount: number | undefined (undefined => full amount)
// date: ISO YYYY-MM-DD
const ConfirmPaymentDialog = ({ open, onOpenChange, onConfirm, loading = false }) => {
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Reset fields when dialog opens
  // (Avoid useEffect reset to satisfy strict lint rules)
  const handleOpenChange = (v) => {
    if (v) {
      setAmountStr('');
      setDateStr(todayISO());
      setPaymentMethod('cash');
    }
    onOpenChange(v);
  };

  const parsed = useMemo(() => {
    const raw = amountStr.trim();
    if (!raw) return { amount: undefined, error: null };
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return { amount: undefined, error: 'مبلغ غير صحيح' };
    return { amount: n, error: null };
  }, [amountStr]);

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
            <select
              id="confirm-payment-method-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
              data-testid="confirm-payment-dialog-method-select"
            >
              <option value="cash">نقد</option>
              <option value="bank">تحويل/بطاقة/بنك</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">مبلغ السداد (اختياري)</label>
            <Input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="اتركه فارغاً للسداد الكامل"
              inputMode="decimal"
            />
            {parsed.error && <p className="text-sm text-red-600">{parsed.error}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">تاريخ السداد</label>
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
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
            onClick={() => {
              if (parsed.error) return;
              onConfirm({ amount: parsed.amount, date: dateStr || todayISO(), paymentMethod });
            }}
            disabled={loading || !!parsed.error}
            data-testid="confirm-payment-dialog-submit"
          >
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentDialog;
