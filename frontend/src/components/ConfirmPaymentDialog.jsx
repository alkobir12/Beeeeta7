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

  // Reset fields when dialog opens
  // (Avoid useEffect reset to satisfy strict lint rules)
  const handleOpenChange = (v) => {
    if (v) {
      setAmountStr('');
      setDateStr(todayISO());
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تأكيد سداد</DialogTitle>
          <DialogDescription>
            أدخل مبلغ السداد (اختياري للسداد الكامل) وحدد تاريخ السداد.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              onConfirm({ amount: parsed.amount, date: dateStr || todayISO() });
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
