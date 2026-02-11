import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Save, X, Printer, Trash2, Car, CreditCard, FileText } from 'lucide-react';

const formatDateTime = (dateLike, isRTL) => {
  try {
    const d = new Date(dateLike);
    const dateStr = d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
    const timeStr = d.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '-';
  }
};

export default function OperationCard({
  operation,
  isRTL,
  t,
  accounts,
  onPrint,
  onDelete,
  onViewVehicle,
  onConfirmCreditPayment,
  onUpdateItems,
  isSaving,
  isDeleting,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [itemsDraft, setItemsDraft] = useState([]);

  useEffect(() => {
    if (editing) {
      setItemsDraft(Array.isArray(operation.items) ? operation.items.map((it) => ({ ...it })) : []);
    }
  }, [editing, operation.items]);

  const account = useMemo(
    () => (accounts || []).find((a) => (a.id || a.code) === operation.accountId),
    [accounts, operation.accountId]
  );

  const fromToText = useMemo(() => {
    const fromText = account ? (account.name_ar || account.name || account.code) : (t('operations.account') || t('common.details'));
    const toText = operation.partnerName || '-';
    return `${fromText} → ${toText}`;
  }, [account, operation.partnerName, t]);

  const itemsView = editing ? itemsDraft : (operation.items || []);
  const totalDraft = useMemo(() => {
    const items = itemsView || [];
    return items.reduce((sum, it) => sum + (Number(it.quantity || 1) * Number(it.price || 0)), 0);
  }, [itemsView]);

  const typeLabel = operation.type === 'sale'
    ? t('operations.sale')
    : operation.type === 'purchase'
      ? t('operations.purchase')
      : (operation.type || '-');

  const typePill = operation.type === 'sale'
    ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
    : 'bg-rose-500/10 text-rose-200 border border-rose-500/20';

  const scopePill = (operation.scope === 'workshop' || (!operation.scope && !operation.vehicleId))
    ? 'bg-slate-500/10 text-slate-200 border border-slate-500/20'
    : 'bg-sky-500/10 text-sky-200 border border-sky-500/20';

  const cardBackground = 'radial-gradient(circle at 12% 18%, rgba(168,85,247,0.20), transparent 52%), radial-gradient(circle at 88% 78%, rgba(99,102,241,0.16), transparent 55%), rgba(255,255,255,0.06)';
  const cardBorder = 'rgba(168,85,247,0.22)';

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="dash-widget-shell"
      style={{
        background: cardBackground,
        border: `1px solid ${cardBorder}`,
        boxShadow: expanded ? '0 32px 120px rgba(2,6,23,0.85), 0 0 0 1px rgba(168,85,247,0.22)' : '0 18px 60px rgba(2,6,23,0.65)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: expanded ? 'scale(1.01)' : 'scale(1)',
      }}
      data-expanded={expanded ? 'true' : 'false'}
      onClick={() => setExpanded((v) => !v)}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* decorative dots */}
      <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
        <span className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="w-1 h-1 rounded-full bg-gray-400" />
      </div>

      {/* Header row */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${typePill}`}>{typeLabel}</span>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-medium ${scopePill}`}
                title={operation.scope === 'workshop' || (!operation.scope && !operation.vehicleId)
                  ? t('operations.scopeWorkshop')
                  : t('operations.scopeVehicle')}
              >
                {(operation.scope === 'workshop' || (!operation.scope && !operation.vehicleId))
                  ? (t('operations.scopeWorkshop') || 'ورشة')
                  : (t('operations.scopeVehicle') || 'مركبة')}
              </span>
              {operation.invoiceNumber ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/5 text-slate-200 border border-white/10">
                  {operation.invoiceNumber}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-50">
                <FileText size={16} className="text-slate-200/80" />
                <span className="text-sm sm:text-base font-semibold truncate">{operation.partnerName || '-'}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-200/80 text-xs sm:text-sm">
                <CreditCard size={14} />
                <span className="truncate">{operation.paymentMethod || '-'}</span>
                <span className="mx-1 opacity-40">•</span>
                <span className="truncate">{formatDateTime(operation.date || operation.op_date || operation.createdAt, isRTL)}</span>
              </div>

              <div className="text-[11px] sm:text-xs text-slate-200/70 truncate">{fromToText}</div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-50 tabular-nums">
              {Number(editing ? totalDraft : (operation.total || 0)).toFixed(2)}
            </div>
            <div className="text-xs text-slate-200/70">{t('common.currency') || ''}</div>

            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10"
              onClick={(e) => {
                stop(e);
                setExpanded((v) => !v);
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{t('common.details') || 'التفاصيل'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4" onClick={stop}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!editing ? (
            <button
              type="button"
              className="apple-button-secondary h-9 px-3 text-xs"
              onClick={() => {
                setExpanded(true);
                setEditing(true);
              }}
              disabled={isSaving || isDeleting}
            >
              <span className="inline-flex items-center gap-2">
                <Pencil size={14} />
                {t('common.edit') || 'تعديل'}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="apple-button h-9 px-3 text-xs"
                onClick={async () => {
                  await onUpdateItems(operation.id, itemsDraft);
                  setEditing(false);
                }}
                disabled={isSaving}
              >
                <span className="inline-flex items-center gap-2">
                  <Save size={14} />
                  {isSaving ? (t('common.loading') || '...') : (t('common.save') || 'حفظ')}
                </span>
              </button>
              <button
                type="button"
                className="apple-button-secondary h-9 px-3 text-xs"
                onClick={() => {
                  setEditing(false);
                  setItemsDraft(Array.isArray(operation.items) ? operation.items.map((it) => ({ ...it })) : []);
                }}
                disabled={isSaving}
              >
                <span className="inline-flex items-center gap-2">
                  <X size={14} />
                  {t('common.cancel') || 'إلغاء'}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            className="apple-button-secondary h-9 px-3 text-xs"
            onClick={() => onPrint(operation)}
            disabled={isSaving || isDeleting}
          >
            <span className="inline-flex items-center gap-2">
              <Printer size={14} />
              {t('common.print') || 'طباعة'}
            </span>
          </button>

          {operation.vehicleId ? (
            <button
              type="button"
              className="apple-button-secondary h-9 px-3 text-xs"
              onClick={() => onViewVehicle(operation)}
              disabled={isSaving || isDeleting}
            >
              <span className="inline-flex items-center gap-2">
                <Car size={14} />
                {t('common.view') || 'عرض'}
              </span>
            </button>
          ) : null}

          {operation.paymentMethod === 'credit' ? (
            <button
              type="button"
              className="apple-button-secondary h-9 px-3 text-xs"
              onClick={() => onConfirmCreditPayment(operation)}
              disabled={isSaving || isDeleting}
            >
              {t('operations.confirm_credit_payment') || 'تأكيد السداد'}
            </button>
          ) : null}

          <button
            type="button"
            className="h-9 px-3 text-xs rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 transition-colors"
            onClick={() => onDelete(operation)}
            disabled={isDeleting}
            title={t('common.delete') || 'حذف'}
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 size={14} />
              {isDeleting ? (t('common.loading') || '...') : (t('common.delete') || 'حذف')}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Details */}
      {expanded ? (
        <div className="px-5 pb-5">
          {operation.notes ? (
            <div className="mb-3 bg-slate-950/50 rounded-2xl px-4 py-3 border border-slate-800/70">
              <div className="text-[11px] text-slate-300/80 mb-1">{t('common.notes') || 'ملاحظات'}</div>
              <div className="text-sm text-slate-50/90 whitespace-pre-wrap">{operation.notes}</div>
            </div>
          ) : null}

          <div className="bg-slate-950/50 rounded-2xl border border-slate-800/70 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/70">
              <div className="text-sm font-semibold text-slate-50">{t('operations.items') || 'البنود'}</div>
              <div className="text-xs text-slate-300/80 tabular-nums">
                {t('common.total') || 'الإجمالي'}: {Number(totalDraft).toFixed(2)} {t('common.currency') || ''}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-300/80">
                  <tr>
                    <th className="p-3 text-right font-medium">{t('vehicle.itemName') || t('operations.itemName') || 'البند'}</th>
                    <th className="p-3 text-right font-medium w-[120px]">{t('operations.qty') || t('vehicle.quantity') || 'الكمية'}</th>
                    <th className="p-3 text-right font-medium w-[140px]">{t('common.price') || t('operations.price') || 'السعر'}</th>
                    <th className="p-3 text-right font-medium w-[140px]">{t('common.total') || 'الإجمالي'}</th>
                    {editing ? <th className="p-3 w-[70px]" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(itemsView || []).map((it, idx) => {
                    const lineTotal = Number(it.quantity || 1) * Number(it.price || 0);
                    return (
                      <tr key={`${operation.id}-item-${idx}`}>
                        <td className="p-3">
                          {editing ? (
                            <input
                              className="apple-input h-9 text-sm"
                              value={it.name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setItemsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                              }}
                            />
                          ) : (
                            <div className="text-slate-50/90 font-medium truncate">{it.name || it.description || '-'}</div>
                          )}
                        </td>
                        <td className="p-3">
                          {editing ? (
                            <input
                              type="number"
                              className="apple-input h-9 text-sm"
                              value={Number(it.quantity || 1)}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setItemsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x)));
                              }}
                            />
                          ) : (
                            <div className="text-slate-50/80 tabular-nums">{Number(it.quantity || 1)}</div>
                          )}
                        </td>
                        <td className="p-3">
                          {editing ? (
                            <input
                              type="number"
                              className="apple-input h-9 text-sm"
                              value={Number(it.price || 0)}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setItemsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, price: v } : x)));
                              }}
                            />
                          ) : (
                            <div className="text-slate-50/80 tabular-nums">{Number(it.price || 0).toFixed(2)}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="text-slate-50 tabular-nums font-semibold">{Number(lineTotal).toFixed(2)}</div>
                        </td>
                        {editing ? (
                          <td className="p-3">
                            <button
                              type="button"
                              className="text-rose-200 hover:text-rose-100"
                              onClick={() => setItemsDraft((prev) => prev.filter((_, i) => i !== idx))}
                              title={t('common.delete') || 'حذف'}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}

                  {(itemsView || []).length === 0 ? (
                    <tr>
                      <td colSpan={editing ? 5 : 4} className="p-4 text-center text-slate-300/70">
                        {t('operations.noItems') || t('operations.no_items') || '-'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {editing ? (
              <div className="px-4 py-3 border-t border-slate-800/70 flex justify-end">
                <button
                  type="button"
                  className="apple-button-secondary h-9 px-3 text-xs"
                  onClick={() => setItemsDraft((prev) => ([...prev, { name: '', quantity: 1, price: 0 }]))}
                  disabled={isSaving}
                >
                  {t('common.add') || 'إضافة'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
