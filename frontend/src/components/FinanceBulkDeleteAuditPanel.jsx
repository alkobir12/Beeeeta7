import React from 'react';

const actionLabels = {
  cleanup_keep_debts_only: 'حذف العمليات مع الإبقاء على الذمم',
  reset_all_financial_data: 'إعادة تعيين البيانات المالية',
  delete_all_operations: 'حذف جميع العمليات',
};

const buildItemsSummary = (items = {}) => {
  const parts = Object.entries(items)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const label = {
        operations_deleted: 'العمليات المحذوفة',
        operations_kept: 'العمليات المتبقية',
        journal_entries_deleted: 'القيود المحذوفة',
        chart_of_accounts: 'الحسابات',
        operations: 'العمليات',
        journal_entries: 'القيود',
        invoices: 'الفواتير',
      }[key] || key;
      return `${label}: ${value}`;
    });
  return parts.length ? parts.join(' • ') : 'لا توجد تفاصيل إضافية';
};

export const FinanceBulkDeleteAuditPanel = ({ rows = [], loading = false }) => {
  return (
    <div className="rounded-3xl border border-white/15 bg-slate-950/45 p-4 backdrop-blur-2xl" data-testid="financial-bulk-delete-audit-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <p className="text-sm font-semibold text-slate-100" data-testid="financial-bulk-delete-audit-title">سجل حذف البيانات الجماعي</p>
          <p className="mt-1 text-xs text-slate-400" data-testid="financial-bulk-delete-audit-subtitle">يعرض من نفّذ الحذف، متى تم، وما الذي تأثر.</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100" data-testid="financial-bulk-delete-audit-count">
          {loading ? 'جار التحميل...' : `${rows.length} سجل`}
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400" data-testid="financial-bulk-delete-audit-loading">جار تحميل سجل الحذف...</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400" data-testid="financial-bulk-delete-audit-empty">لا توجد عمليات حذف جماعي مسجلة بعد.</div>
      ) : (
        <div className="mt-4 space-y-3" data-testid="financial-bulk-delete-audit-list">
          {rows.map((row, index) => (
            <div key={row.id || index} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm" data-testid={`financial-bulk-delete-audit-row-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100" data-testid={`financial-bulk-delete-audit-row-action-${index}`}>
                    {actionLabels[row.action] || row.action || 'حذف جماعي'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400" data-testid={`financial-bulk-delete-audit-row-endpoint-${index}`}>
                    {row.source_endpoint || '—'}
                  </p>
                </div>
                <p className="text-xs text-slate-300" data-testid={`financial-bulk-delete-audit-row-date-${index}`}>
                  {row.created_at ? new Date(row.created_at).toLocaleString('ar-SA') : '—'}
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-900/35 p-2" data-testid={`financial-bulk-delete-audit-row-user-${index}`}>
                  <p className="text-[11px] text-slate-400">المنفذ</p>
                  <p className="mt-1 text-slate-100">{row.user?.id || 'system'} • {row.user?.role || 'unknown'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/35 p-2" data-testid={`financial-bulk-delete-audit-row-items-${index}`}>
                  <p className="text-[11px] text-slate-400">العناصر المتأثرة</p>
                  <p className="mt-1 text-slate-100">{buildItemsSummary(row.items)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};