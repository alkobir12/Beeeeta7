import React, { useEffect, useMemo, useState, memo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  Printer,
  Trash2,
  Car,
  CreditCard,
  FileText,
  Landmark,
} from 'lucide-react';

const formatDateTime = (dateLike, isRTL) => {
  try {
    const d = new Date(dateLike);
    const dateStr = d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US');
    const timeStr = d.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '-';
  }
};

const sanitizeAccountingText = (value = '') => {
  if (!value) return '';
  return String(value)
    .replace(/ACCOUNT_CODE:\s*\S+/gi, '')
    .replace(/ACCOUNTING_TARGET:\s*\S+/gi, '')
    .replace(/ACCOUNTING_SOURCE:\s*\S+/gi, '')
    .replace(/ACCOUNT_NAME:\s*[^|\n]+/gi, '')
    .replace(/ACCOUNT_CLASS:\s*\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const normalizePaymentSourceAccount = (operation = {}, t) => {
  const method = String(operation.paymentMethod || '').toLowerCase();
  if (method === 'cash') return 'حساب الصندوق';
  if (method === 'transfer' || method === 'card') return 'حساب البنك';
  if (method === 'credit') {
    return operation.type === 'sale' ? 'حساب الذمم المدينة' : 'حساب الذمم الدائنة';
  }
  return t('operations.paymentMethod') || 'حساب الدفع';
};

const resolveTargetAccountName = (operation, chartAccount, businessAccount, t) => {
  const notes = String(operation?.notes || '');
  const marker = 'ACCOUNTING_TARGET:';
  const markerIndex = notes.indexOf(marker);
  if (markerIndex >= 0) {
    const parsed = notes.slice(markerIndex + marker.length).split('|')[0].trim();
    if (parsed) return sanitizeAccountingText(parsed) || parsed;
  }
  if (chartAccount) return sanitizeAccountingText(chartAccount.name_ar || chartAccount.name || chartAccount.code) || chartAccount.code;
  if (businessAccount) return sanitizeAccountingText(businessAccount.name || businessAccount.code) || businessAccount.code;
  if (operation.accountingAccountId) return sanitizeAccountingText(operation.accountingAccountId) || operation.accountingAccountId;
  if (operation.accountId) return sanitizeAccountingText(operation.accountId) || operation.accountId;
  return t('operations.account') || 'الحساب';
};

function OperationCard({
  operation,
  isRTL,
  t,
  accounts,
  businessAccounts,
  vehicles,
  onPrint,
  onDelete,
  onViewVehicle,
  onConfirmCreditPayment,
  onUpdateItems,
  isSaving,
  isDeleting,
  expanded,
  onExpandedChange,
}) {
  const isControlled = typeof expanded === 'boolean' && typeof onExpandedChange === 'function';
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [itemsDraft, setItemsDraft] = useState([]);

  const isExpanded = isControlled ? expanded : internalExpanded;
  const setExpandedState = (next) => {
    if (isControlled) {
      onExpandedChange(next);
    } else {
      setInternalExpanded(next);
    }
  };

  useEffect(() => {
    if (editing) {
      setItemsDraft(Array.isArray(operation.items) ? operation.items.map((it) => ({ ...it })) : []);
    }
  }, [editing, operation.items]);

  useEffect(() => {
    if (!isExpanded) {
      setEditing(false);
    }
  }, [isExpanded]);

  const chartAccount = useMemo(() => {
    const all = accounts || [];
    const accId = operation.accountingAccountId || operation.accountId;
    return all.find((a) => (a.id || a.code) === accId);
  }, [accounts, operation.accountId, operation.accountingAccountId]);

  const businessAccount = useMemo(
    () => (businessAccounts || []).find((a) => (a.id || a.code) === operation.accountId),
    [businessAccounts, operation.accountId]
  );

  const vehicle = useMemo(
    () => (vehicles || []).find((v) => v.id === operation.vehicleId),
    [vehicles, operation.vehicleId]
  );

  const journalEntryText = useMemo(() => {
    const fromAccount = sanitizeAccountingText(normalizePaymentSourceAccount(operation, t));
    const toAccount = sanitizeAccountingText(resolveTargetAccountName(operation, chartAccount, businessAccount, t));
    return `قيد محاسبي: من حساب ${fromAccount || t('operations.account') || 'الحساب'} إلى حساب ${toAccount || t('operations.account') || 'الحساب'}`;
  }, [operation, chartAccount, businessAccount, t]);

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

  const isIncome = operation.type === 'sale';
  const typePill = isIncome
    ? 'bg-emerald-500/12 text-emerald-200 border border-emerald-500/25'
    : 'bg-rose-500/12 text-rose-200 border border-rose-500/25';

  const scopePill = (operation.scope === 'workshop' || (!operation.scope && !operation.vehicleId))
    ? 'bg-slate-500/10 text-slate-200 border border-slate-500/20'
    : 'bg-sky-500/10 text-sky-200 border border-sky-500/20';

  const cardBackground = isIncome
    ? 'radial-gradient(circle at 12% 18%, rgba(16,185,129,0.20), transparent 52%), radial-gradient(circle at 88% 78%, rgba(99,102,241,0.12), transparent 55%), rgba(255,255,255,0.05)'
    : 'radial-gradient(circle at 12% 18%, rgba(244,63,94,0.20), transparent 52%), radial-gradient(circle at 88% 78%, rgba(168,85,247,0.12), transparent 55%), rgba(255,255,255,0.05)';

  const cardBorder = isIncome ? 'rgba(16,185,129,0.24)' : 'rgba(244,63,94,0.24)';
  const paymentStatus = (operation.paymentStatus || operation.payment_status || '').toString().toLowerCase();
  const paymentMethod = (operation.paymentMethod || operation.payment_method || '').toString().toLowerCase();
  const hasPaymentStatus = Boolean(paymentStatus || paymentMethod);
  const isCredit = ['unpaid', 'credit', 'deferred', 'partial'].includes(paymentStatus)
    || ['credit', 'deferred'].includes(paymentMethod);
  const paymentBorder = hasPaymentStatus
    ? (isCredit ? 'rgba(244,63,94,0.55)' : 'rgba(16,185,129,0.55)')
    : cardBorder;
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="dash-widget-shell"
      style={{
        background: cardBackground,
        border: `1px solid ${paymentBorder}`,
        boxShadow: isExpanded
          ? `0 22px 72px rgba(2,6,23,0.78), 0 0 0 1px ${paymentBorder}`
          : '0 14px 44px rgba(2,6,23,0.56)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isExpanded ? 'scale(1.003)' : 'scale(1)',
      }}
      data-expanded={isExpanded ? 'true' : 'false'}
      onClick={() => setExpandedState(!isExpanded)}
      dir={isRTL ? 'rtl' : 'ltr'}
      data-testid={`operation-card-${operation.id || operation.invoiceNumber || 'unknown'}`}
    >
      <div className="absolute top-4 left-4 flex flex-col gap-1 opacity-60">
        <span className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="w-1 h-1 rounded-full bg-gray-400" />
      </div>

      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5" data-testid={`operation-card-pills-${operation.id}`}>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${typePill}`}>{typeLabel}</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${scopePill}`}>
                {(operation.scope === 'workshop' || (!operation.scope && !operation.vehicleId))
                  ? (t('operations.scopeWorkshop') || 'ورشة')
                  : (t('operations.scopeVehicle') || 'مركبة')}
              </span>
              {operation.invoiceNumber ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 text-slate-200 border border-white/10" data-testid={`operation-card-invoice-${operation.id}`}>
                  {operation.invoiceNumber}
                </span>
              ) : null}
            </div>

            <div className="mt-2.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-slate-50">
                <FileText size={14} className="text-slate-200/80" />
                <span className="text-sm font-semibold break-words leading-tight" data-testid={`operation-card-partner-${operation.id}`}>
                  {operation.partnerName || '-'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-slate-200/80 text-[11px] sm:text-xs" data-testid={`operation-card-meta-${operation.id}`}>
                <CreditCard size={12} />
                <span className="break-words">{operation.paymentMethod || '-'}</span>
                <span className="mx-1 opacity-40">•</span>
                <span className="break-words">{formatDateTime(operation.date || operation.op_date || operation.createdAt, isRTL)}</span>
              </div>

              <div className="text-[11px] text-slate-200/80 leading-relaxed whitespace-normal break-words" data-testid={`operation-card-journal-entry-${operation.id}`}>
                {journalEntryText}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg sm:text-xl font-extrabold text-slate-50 tabular-nums" data-testid={`operation-card-total-${operation.id}`}>
              {Number(editing ? totalDraft : (operation.total || 0)).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-200/70">{t('common.currency') || ''}</div>

            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10"
              onClick={(e) => {
                stop(e);
                setExpandedState(!isExpanded);
              }}
              data-testid={`operation-card-toggle-${operation.id}`}
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{t('common.details') || 'التفاصيل'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3" onClick={stop}>
        <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid={`operation-card-actions-${operation.id}`}>
          {!editing ? (
            <button
              type="button"
              className="apple-button-secondary h-8 px-2.5 text-[11px]"
              onClick={() => {
                setExpandedState(true);
                setEditing(true);
              }}
              disabled={isSaving || isDeleting}
              data-testid={`operation-card-edit-${operation.id}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Pencil size={12} />
                {t('common.edit') || 'تعديل'}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="apple-button h-8 px-2.5 text-[11px]"
                onClick={async () => {
                  const ok = await onUpdateItems(operation.id, itemsDraft);
                  if (ok) setEditing(false);
                }}
                disabled={isSaving}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Save size={12} />
                  {isSaving ? (t('common.loading') || '...') : (t('common.save') || 'حفظ')}
                </span>
              </button>
              <button
                type="button"
                className="apple-button-secondary h-8 px-2.5 text-[11px]"
                onClick={() => {
                  setEditing(false);
                  setItemsDraft(Array.isArray(operation.items) ? operation.items.map((it) => ({ ...it })) : []);
                }}
                disabled={isSaving}
              >
                <span className="inline-flex items-center gap-1.5">
                  <X size={12} />
                  {t('common.cancel') || 'إلغاء'}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            className="apple-button-secondary h-8 px-2.5 text-[11px]"
            onClick={() => onPrint(operation)}
            disabled={isSaving || isDeleting}
            data-testid={`operation-card-print-${operation.id}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Printer size={12} />
              {t('common.print') || 'طباعة'}
            </span>
          </button>

          {operation.vehicleId ? (
            <button
              type="button"
              className="apple-button-secondary h-8 px-2.5 text-[11px]"
              onClick={() => onViewVehicle(operation)}
              disabled={isSaving || isDeleting}
              data-testid={`operation-card-view-vehicle-${operation.id}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Car size={12} />
                {t('common.view') || 'عرض'}
              </span>
            </button>
          ) : null}

          {operation.paymentMethod === 'credit' ? (
            <button
              type="button"
              className="apple-button-secondary h-8 px-2.5 text-[11px]"
              onClick={() => onConfirmCreditPayment(operation)}
              disabled={isSaving || isDeleting}
            >
              {t('operations.confirm_credit_payment') || 'تأكيد السداد'}
            </button>
          ) : null}

          <button
            type="button"
            className="h-8 px-2.5 text-[11px] rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 transition-colors"
            onClick={() => onDelete(operation)}
            disabled={isDeleting}
            title={t('common.delete') || 'حذف'}
            data-testid={`operation-card-delete-${operation.id}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Trash2 size={12} />
              {isDeleting ? (t('common.loading') || '...') : (t('common.delete') || 'حذف')}
            </span>
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="px-4 pb-4" data-testid={`operation-card-expanded-${operation.id}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
              <div className="text-[10px] text-slate-300/70 mb-1">{t('operations.customerName') || t('operations.partner_name') || 'العميل'}</div>
              <div className="text-xs font-semibold text-slate-50 break-words">{operation.partnerName || '-'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
              <div className="text-[10px] text-slate-300/70 mb-1">{t('operations.operationType') || 'نوع العملية'}</div>
              <div className="text-xs font-semibold text-slate-50 break-words">{typeLabel}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
              <div className="text-[10px] text-slate-300/70 mb-1">{t('operations.operationDateLabel') || t('operations.date') || 'التاريخ'}</div>
              <div className="text-xs font-semibold text-slate-50 break-words">{formatDateTime(operation.date || operation.op_date || operation.createdAt, isRTL)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
              <div className="text-[10px] text-slate-300/70 mb-1">{t('operations.paymentMethod') || 'طريقة الدفع'}</div>
              <div className="text-xs font-semibold text-slate-50 break-words">{operation.paymentMethod || '-'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
              <div className="text-[10px] text-slate-300/70 mb-1">{t('operations.account') || 'الحساب'}</div>
              <div className="text-xs font-semibold text-slate-50 break-words">
                {resolveTargetAccountName(operation, chartAccount, businessAccount, t)}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
              <div className="text-[10px] text-slate-300/70 mb-1">{t('common.total') || 'الإجمالي'}</div>
              <div className="text-xs font-extrabold text-slate-50 tabular-nums">{Number(editing ? totalDraft : (operation.total || 0)).toFixed(2)} {t('common.currency') || ''}</div>
            </div>
          </div>

          <div className="mb-3 bg-slate-950/50 rounded-xl px-3 py-2.5 border border-slate-800/70" data-testid={`operation-card-journal-entry-box-${operation.id}`}>
            <div className="text-[10px] text-slate-300/80 mb-1 flex items-center gap-1">
              <Landmark size={12} />
              <span>القيد المحاسبي</span>
            </div>
            <div className="text-xs text-slate-50/95 whitespace-pre-wrap leading-relaxed">{journalEntryText}</div>
          </div>

          {operation.scope === 'vehicle' && operation.vehicleId ? (
            <div className="mb-3 bg-slate-950/50 rounded-xl px-3 py-2.5 border border-sky-800/50" data-testid={`operation-card-vehicle-details-${operation.id}`}>
              <div className="text-[10px] text-sky-200/90 mb-1">تفاصيل المركبة المرتبطة</div>
              <div className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap">
                {vehicle
                  ? `اللوحة: ${vehicle.plateNumber || vehicle.plate_number || '-'} • ${vehicle.brand || '-'} ${vehicle.model || ''} • العميل: ${vehicle.customerName || vehicle.ownerName || '-'} • رقم الزيارة: ${operation.visitId || '-'}`
                  : `معرّف المركبة: ${operation.vehicleId} • رقم الزيارة: ${operation.visitId || '-'}`}
              </div>
            </div>
          ) : null}

          {operation.notes ? (
            <div className="mb-3 bg-slate-950/50 rounded-xl px-3 py-2.5 border border-slate-800/70">
              <div className="text-[10px] text-slate-300/80 mb-1">{t('common.notes') || 'ملاحظات'}</div>
              <div className="text-xs text-slate-50/90 whitespace-pre-wrap leading-relaxed">{sanitizeAccountingText(operation.notes) || operation.notes}</div>
            </div>
          ) : null}

          <div className="bg-slate-950/50 rounded-xl border border-slate-800/70 overflow-hidden">
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-800/70">
              <div className="text-xs font-semibold text-slate-50">{t('operations.items') || 'البنود'}</div>
              <div className="text-[10px] text-slate-300/80 tabular-nums">
                {t('common.total') || 'الإجمالي'}: {Number(totalDraft).toFixed(2)} {t('common.currency') || ''}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] text-slate-300/80">
                  <tr>
                    <th className="p-2 text-right font-medium">{t('vehicle.itemName') || t('operations.itemName') || 'البند'}</th>
                    <th className="p-2 text-right font-medium w-[95px]">{t('operations.qty') || t('vehicle.quantity') || 'الكمية'}</th>
                    <th className="p-2 text-right font-medium w-[105px]">{t('common.price') || t('operations.price') || 'السعر'}</th>
                    <th className="p-2 text-right font-medium w-[110px]">{t('common.total') || 'الإجمالي'}</th>
                    {editing ? <th className="p-2 w-[60px]" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(itemsView || []).map((it, idx) => {
                    const lineTotal = Number(it.quantity || 1) * Number(it.price || 0);
                    return (
                      <tr key={`${operation.id}-item-${idx}`}>
                        <td className="p-2">
                          {editing ? (
                            <input
                              className="apple-input h-8 text-xs"
                              value={it.name || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setItemsDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                              }}
                            />
                          ) : (
                            <div className="text-slate-50/90 font-medium break-words">{it.name || it.description || '-'}</div>
                          )}
                        </td>
                        <td className="p-2">
                          {editing ? (
                            <input
                              type="number"
                              className="apple-input h-8 text-xs"
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
                        <td className="p-2">
                          {editing ? (
                            <input
                              type="number"
                              className="apple-input h-8 text-xs"
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
                        <td className="p-2">
                          <div className="text-slate-50 tabular-nums font-semibold">{Number(lineTotal).toFixed(2)}</div>
                        </td>
                        {editing ? (
                          <td className="p-2">
                            <button
                              type="button"
                              className="text-rose-200 hover:text-rose-100"
                              onClick={() => setItemsDraft((prev) => prev.filter((_, i) => i !== idx))}
                              title={t('common.delete') || 'حذف'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}

                  {(itemsView || []).length === 0 ? (
                    <tr>
                      <td colSpan={editing ? 5 : 4} className="p-3 text-center text-slate-300/70 text-xs">
                        {t('operations.noItems') || t('operations.no_items') || '-'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {editing ? (
              <div className="px-3 py-2 border-t border-slate-800/70 flex justify-end">
                <button
                  type="button"
                  className="apple-button-secondary h-8 px-2.5 text-[11px]"
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

export default memo(OperationCard);
