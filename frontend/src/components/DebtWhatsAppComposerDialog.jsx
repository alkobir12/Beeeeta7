import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export default function DebtWhatsAppComposerDialog({
  open,
  onOpenChange,
  drafts,
  onUpdateDraft,
  onSendCurrent,
  onSendAll,
}) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!activeId && drafts?.length) {
      setActiveId(drafts[0].id);
    }
    if (activeId && !(drafts || []).some((d) => d.id === activeId) && drafts?.length) {
      setActiveId(drafts[0].id);
    }
  }, [open, drafts, activeId]);

  const activeDraft = useMemo(
    () => (drafts || []).find((d) => d.id === activeId) || (drafts || [])[0],
    [drafts, activeId]
  );

  const hasMany = (drafts || []).length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-slate-950/95 border border-emerald-500/25" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-emerald-200 text-xl">معاينة وتعديل رسائل واتساب</DialogTitle>
          <DialogDescription className="text-slate-300/80">
            يمكنك تعديل نص كل رسالة قبل الإرسال {hasMany ? 'الجماعي' : 'الفردي'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 rounded-xl border border-white/10 bg-white/5 p-3 max-h-[420px] overflow-auto" data-testid="debt-whatsapp-recipient-list">
            <div className="flex items-center gap-2 text-xs text-slate-300 mb-3">
              <Users size={14} />
              <span>المستلمون ({(drafts || []).length})</span>
            </div>
            <div className="space-y-2">
              {(drafts || []).map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className={`w-full text-right rounded-lg px-3 py-2 border transition ${activeDraft?.id === draft.id ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                  onClick={() => setActiveId(draft.id)}
                  data-testid={`debt-whatsapp-recipient-${draft.id}`}
                >
                  <div className="text-sm font-semibold">{draft.name}</div>
                  <div className="text-[11px] opacity-70 ltr text-left">{draft.phone || 'بدون رقم'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3" data-testid="debt-whatsapp-composer-panel">
            {activeDraft ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{activeDraft.name}</p>
                    <p className="text-xs text-slate-400 ltr text-left">{activeDraft.phone || 'لا يوجد رقم واتساب'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${activeDraft.entityType === 'supplier' ? 'bg-amber-500/20 text-amber-200' : 'bg-cyan-500/20 text-cyan-200'}`}>
                    {activeDraft.entityType === 'supplier' ? 'مورد' : 'عميل'}
                  </span>
                </div>

                <textarea
                  value={activeDraft.message || ''}
                  onChange={(e) => onUpdateDraft?.(activeDraft.id, e.target.value)}
                  className="w-full min-h-[250px] rounded-xl border border-white/15 bg-slate-900/60 text-slate-100 p-3 text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  data-testid="debt-whatsapp-message-textarea"
                />

                <div className="mt-3 flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-white/15 text-slate-200 hover:bg-white/10"
                    onClick={() => onOpenChange(false)}
                    data-testid="debt-whatsapp-cancel-button"
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 disabled:opacity-50"
                    onClick={() => onSendCurrent?.(activeDraft)}
                    disabled={!activeDraft.phone}
                    data-testid="debt-whatsapp-send-current-button"
                  >
                    <span className="inline-flex items-center gap-1"><MessageCircle size={14} /> إرسال الحالي</span>
                  </button>
                  {hasMany && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border border-sky-400/40 bg-sky-500/20 text-sky-100"
                      onClick={() => onSendAll?.(drafts)}
                      data-testid="debt-whatsapp-send-all-button"
                    >
                      إرسال الكل ({(drafts || []).filter((d) => d.phone).length})
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="min-h-[220px] flex items-center justify-center text-sm text-slate-400" data-testid="debt-whatsapp-empty-state">
                لا يوجد مستلمون للمعاينة.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
