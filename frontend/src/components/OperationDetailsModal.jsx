import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';

const OperationDetailsModal = ({
  open,
  onOpenChange,
  operation,
  accounts,
  t,
  isRTL,
  onPrint,
  onViewVehicle,
  onDelete,
}) => {
  if (!operation) return null;

  const account = accounts.find((a) => (a.id || a.code) === operation.accountId);
  const fromText = account ? (account.name_ar || account.name || account.code) : t('operations.account');
  const toText = operation.partnerName || '-';

  const opDate = new Date(operation.date || operation.op_date || operation.createdAt);
  const dateStr = opDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
  const timeStr = opDate.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>
              {t('print.invoice_number')}: {operation.invoiceNumber || '-'}
            </span>
            <span className="text-sm text-slate-500">
              {dateStr} {timeStr}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('operations.operationType')}</div>
              <div className="font-semibold">{operation.type || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('operations.total')}</div>
              <div className="font-bold">{Number(operation.total || 0).toFixed(2)} {t('common.currency')}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('operations.from_to')}</div>
              <div className="font-semibold">{fromText} → {toText}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('operations.paymentMethod')}</div>
              <div className="font-semibold">{operation.paymentMethod || '-'}</div>
            </div>
          </div>

          {operation.notes && (
            <div className="text-sm">
              <div className="text-xs text-slate-500 mb-1">{t('operations.notes')}</div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3">{operation.notes}</div>
            </div>
          )}

          <div>
            <div className="text-xs text-slate-500 mb-2">{t('operations.items')}</div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="col-span-7">{t('operations.item_name')}</div>
                <div className="col-span-2 text-right">{t('operations.qty')}</div>
                <div className="col-span-3 text-right">{t('operations.price')}</div>
              </div>
              {(operation.items || []).map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-t border-slate-100">
                  <div className="col-span-7 truncate">{it.name || it.description || '-'}</div>
                  <div className="col-span-2 text-right">{Number(it.quantity || 1)}</div>
                  <div className="col-span-3 text-right">{Number(it.price || 0).toFixed(2)}</div>
                </div>
              ))}
              {(operation.items || []).length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-500">-</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <button className="apple-button-secondary" onClick={onPrint}>
              {t('print.print')}
            </button>
            {operation.vehicleId && (
              <button className="apple-button-secondary" onClick={onViewVehicle}>
                {t('buttons.view')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="apple-button-secondary" onClick={() => onOpenChange(false)}>
              {t('buttons.close')}
            </button>
            <button className="apple-button-secondary text-red-600" onClick={onDelete}>
              {t('buttons.delete')}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OperationDetailsModal;
