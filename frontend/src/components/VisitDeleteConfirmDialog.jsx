import React from 'react';
import { AlertTriangle, Calendar, Wrench } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

const fmtDate = (dateLike, isRTL) => {
  try {
    const d = new Date(dateLike);
    return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
  } catch {
    return '-';
  }
};

export default function VisitDeleteConfirmDialog({
  open,
  onOpenChange,
  visit,
  t,
  isRTL,
  isLoading,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="border-0 p-0 bg-transparent">
        <div
          className="rounded-[28px] overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 12% 18%, rgba(244,63,94,0.22), transparent 52%), radial-gradient(circle at 88% 78%, rgba(59,130,246,0.12), transparent 55%), rgba(255,255,255,0.06)',
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
                    {t('visits.delete_warning') || 'سيتم حذف الزيارة نهائيًا وحذف العمليات المرتبطة بها.'}
                  </AlertDialogDescription>
                </div>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="px-6 pb-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-300/70 mb-1">
                  <Wrench size={14} />
                  <span>{t('visits.status') || 'الحالة'}</span>
                </div>
                <div className="text-sm font-semibold text-slate-50 truncate">{visit?.status || '-'}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-300/70 mb-1">
                  <Calendar size={14} />
                  <span>{t('visits.entry_date') || t('vehicle_details.entry_date') || 'تاريخ الدخول'}</span>
                </div>
                <div className="text-sm font-semibold text-slate-50 truncate">
                  {fmtDate(visit?.entryDate || visit?.entry_date || visit?.createdAt || visit?.created_at, isRTL)}
                </div>
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
