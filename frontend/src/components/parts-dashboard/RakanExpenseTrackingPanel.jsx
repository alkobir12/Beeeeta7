import React, { useMemo } from 'react';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

export const RakanExpenseTrackingPanel = ({ analytics, selectedCategory = 'all', onSelectCategory }) => {
  const tracking = analytics?.expense_tracking || {};
  const categories = tracking.by_category || [];
  const weekly = tracking.weekly || [];
  const operations = tracking.top_operations || [];

  const filteredOperations = useMemo(() => {
    if (selectedCategory === 'all') return operations;
    return operations.filter((row) => row.category === selectedCategory);
  }, [operations, selectedCategory]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" data-testid="rakan-expense-tracking-panel">
      <div className="glass-card p-4 xl:col-span-2" data-testid="rakan-expense-category-card">
        <h3 className="text-white font-semibold mb-3">تحليل المصروفات حسب الفئة</h3>
        <div className="flex flex-wrap gap-2 mb-3" data-testid="rakan-expense-category-filters">
          <button
            type="button"
            onClick={() => onSelectCategory?.('all')}
            className={`px-3 py-1.5 rounded-full text-xs border ${selectedCategory === 'all' ? 'bg-cyan-500/20 border-cyan-300/50 text-cyan-100' : 'bg-white/5 border-white/10 text-slate-300'}`}
            data-testid="rakan-expense-category-all"
          >
            الكل
          </button>
          {categories.map((row) => (
            <button
              key={row.category}
              type="button"
              onClick={() => onSelectCategory?.(row.category)}
              className={`px-3 py-1.5 rounded-full text-xs border ${selectedCategory === row.category ? 'bg-amber-500/20 border-amber-300/50 text-amber-100' : 'bg-white/5 border-white/10 text-slate-300'}`}
              data-testid={`rakan-expense-category-${row.category}`}
            >
              {row.category_label} ({Number(row.ops_count || 0).toLocaleString('ar-SA')})
            </button>
          ))}
        </div>

        <div className="space-y-2" data-testid="rakan-expense-category-list">
          {categories.map((row) => (
            <div key={row.category} className="rounded-xl bg-white/5 p-3 flex items-center justify-between gap-3" data-testid={`rakan-expense-category-item-${row.category}`}>
              <p className="text-sm text-white">{row.category_label}</p>
              <p className="text-sm text-amber-300">{formatCurrency(row.amount)}</p>
            </div>
          ))}
          {!categories.length && (
            <p className="text-sm text-slate-400" data-testid="rakan-expense-category-empty">لا توجد مصروفات مصنفة في الفترة الحالية.</p>
          )}
        </div>
      </div>

      <div className="glass-card p-4" data-testid="rakan-expense-weekly-card">
        <h3 className="text-white font-semibold mb-3">اتجاه الصرف الأسبوعي</h3>
        <div className="space-y-2" data-testid="rakan-expense-weekly-list">
          {weekly.map((row) => (
            <div key={row.week_start} className="rounded-lg bg-white/5 p-2" data-testid={`rakan-expense-weekly-item-${row.week_start}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">أسبوع {row.week_start}</span>
                <span className="text-amber-300">{formatCurrency(row.amount)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-amber-400/80" style={{ width: `${Math.min(100, Math.max(8, Number(row.amount || 0) / 200))}%` }} />
              </div>
            </div>
          ))}
          {!weekly.length && (
            <p className="text-sm text-slate-400" data-testid="rakan-expense-weekly-empty">لا يوجد بيانات كافية لبناء اتجاه أسبوعي.</p>
          )}
        </div>
      </div>

      <div className="glass-card p-4 xl:col-span-3 overflow-auto" data-testid="rakan-expense-top-operations-card">
        <h3 className="text-white font-semibold mb-3">أعلى عمليات الصرف</h3>
        <table className="w-full text-sm text-right min-w-[860px]">
          <thead className="text-slate-400 border-b border-white/10">
            <tr>
              <th className="py-2">التاريخ</th>
              <th className="py-2">الفئة</th>
              <th className="py-2">الحساب</th>
              <th className="py-2">السبب</th>
              <th className="py-2">الطرف</th>
              <th className="py-2">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperations.map((row) => (
              <tr key={row.id} className="border-b border-white/5 text-slate-200" data-testid={`rakan-expense-op-row-${row.id}`}>
                <td className="py-2">{new Date(row.date).toLocaleDateString('ar-SA')}</td>
                <td className="py-2">{row.category_label}</td>
                <td className="py-2">{row.account_name}</td>
                <td className="py-2">{row.reason || '-'}</td>
                <td className="py-2">{row.partner_name || '-'}</td>
                <td className="py-2 text-amber-300">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {!filteredOperations.length && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400" data-testid="rakan-expense-op-empty">
                  لا توجد عمليات مطابقة للفئة المحددة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
