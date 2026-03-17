import React from 'react';

const QuickPrintDialog = ({
  open,
  title = 'إجراء الطباعة',
  description = 'اختر طريقة الإخراج المطلوبة.',
  onClose,
  onPrint,
  onWhatsApp,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="quick-print-dialog">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-center">
        <h3 className="text-lg font-bold text-white" data-testid="quick-print-dialog-title">{title}</h3>
        <p className="mt-2 text-sm text-slate-300" data-testid="quick-print-dialog-description">{description}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
            data-testid="quick-print-action-print"
          >
            طباعة فورية
          </button>
          <button
            type="button"
            onClick={onWhatsApp}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"
            data-testid="quick-print-action-whatsapp"
          >
            إرسال PDF عبر واتس اب
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200"
            data-testid="quick-print-action-cancel"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickPrintDialog;