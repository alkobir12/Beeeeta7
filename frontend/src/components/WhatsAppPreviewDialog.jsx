import React from 'react';
import { MessageCircle, FileText } from 'lucide-react';

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

export default function WhatsAppPreviewDialog({ open, onOpenChange, preview, t, isRTL }) {
  const message = preview?.message || '';
  const url = preview?.url || '';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="border-0 p-0 bg-transparent">
        <div
          className="rounded-[28px] overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 12% 18%, rgba(16,185,129,0.22), transparent 52%), radial-gradient(circle at 88% 78%, rgba(59,130,246,0.12), transparent 55%), rgba(255,255,255,0.06)',
            border: '1px solid rgba(16,185,129,0.24)',
            boxShadow: '0 40px 140px rgba(2,6,23,0.9)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <AlertDialogHeader className="px-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <MessageCircle className="text-emerald-200" size={22} />
                </div>
                <div>
                  <AlertDialogTitle className="text-slate-50 text-lg font-bold">
                    {t?.('whatsapp.preview_title') || 'معاينة رسالة واتساب'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-200/70 text-sm mt-1">
                    {t?.('whatsapp.preview_subtitle') || 'قبل الإرسال، راجع نص الرسالة.'}
                  </AlertDialogDescription>
                </div>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="px-6 pb-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-300/70 mb-2">
                <FileText size={14} />
                <span>{t?.('whatsapp.message') || 'نص الرسالة'}</span>
              </div>
              <div className="text-sm text-slate-50 whitespace-pre-wrap leading-relaxed">{message || '-'}</div>
            </div>
          </div>

          <AlertDialogFooter className="px-6 pb-6 gap-2 sm:gap-3 sm:justify-end">
            <AlertDialogCancel className="apple-button-secondary">
              {t?.('common.cancel') || 'إلغاء'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="apple-button h-10 px-4"
              onClick={(e) => {
                e.preventDefault();
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
              }}
              disabled={!url}
            >
              {t?.('whatsapp.send') || 'إرسال'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
