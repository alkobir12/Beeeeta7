import React from 'react';
import { AlertTriangle, Calendar, FileText, User } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './ui/alert-dialog';

const fmtDate = (dateLike, isRTL) => {
  try {
    const d = new Date(dateLike);
    return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
  } catch {
    return '-';
  }
};

export default function OperationDeleteConfirmDialog({
  open,
  onOpenChange,
  operation,
  isRTL,
  t,
  onConfirm,
  isLoading,
}) {
  const total = Number(operation?.total || 0).toFixed(2);
  const typeLabel = operation?.type === 'sale'
    ? t('operations.sale')
    : operation?.type === 'purchase'
      ? t('operations.purchase')
      : (operation?.type || '-');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        dir={isRTL ? 'rtl' : 'ltr'}
        className="border-0 p-0 bg-transparent"
      >
        <div
          className="rounded-[28px] overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 12% 18%, rgba(239,68,68,0.22), transparent 52%), radial-gradient(circle at 88% 78%, rgba(168,85,247,0.18), transparent 55%), rgba(255,255,255,0.06)',
            border: '1px solid rgba(244,63,94,0.25)',
            boxShadow: '0 40px 140px rgba(2,6,23,0.9)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <AlertDialogHeader className="px-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                  <AlertTriangle className="text-rose-200" size={22} />
                </div>
                <div>
                  <AlertDialogTitle className="text-slate-50 text-lg font-bold">
                    {t('common.confirm_delete') || 'تأكيد الحذف'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-200/70 text-sm mt-1">
                    {t('common.delete_warning') || 'سيتم حذف العملية نهائيًا ولا يمكن التراجع.'}
                  </AlertDialogDescription>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-extrabold text-slate-50 tabular-nums">{total}</div>
                <div className="text-xs text-slate-200/70">{t('common.currency') || ''}</div>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="px-6 pb-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-300/70 mb-1">
                  <User size={14} />
                  <span>{t('operations.customerName') || t('operations.partner_name') || 'العميل'}</span>
                </div>
                <div className="text-sm font-semibold text-slate-50 truncate">{operation?.partnerName || '-'}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-300/70 mb-1">
                  <FileText size={14} />
                  <span>{t('operations.operationType') || 'نوع العملية'}</span>
                </div>
                <div className="text-sm font-semibold text-slate-50 truncate">{typeLabel}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-300/70 mb-1">
                  <Calendar size={14} />
                  <span>{t('operations.operationDateLabel') || t('operations.date') || 'التاريخ'}</span>
                </div>
                <div className="text-sm font-semibold text-slate-50 truncate">
                  {fmtDate(operation?.date || operation?.op_date || operation?.createdAt, isRTL)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-xs text-slate-300/70 mb-1">{t('operations.total') || 'الإجمالي'}</div>
                <div className="text-sm font-semibold text-slate-50 tabular-nums">{total} {t('operations.SAR') || ''}</div>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="px-6 pb-6 gap-2 sm:gap-3 sm:justify-end">
            <AlertDialogCancel className="apple-button-secondary" disabled={isLoading}>
              {t('common.cancel') || 'إلغاء'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 px-4 rounded-lg bg-rose-500/90 hover:bg-rose-500 text-white text-sm font-medium disabled:opacity-50"
              onClick={(e) => {
                e.preventDefault();
                onConfirm?.();
              }}
              disabled={isLoading}
            >
              {isLoading ? (t('common.loading') || '...') : (t('common.delete') || 'حذف نهائي')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
