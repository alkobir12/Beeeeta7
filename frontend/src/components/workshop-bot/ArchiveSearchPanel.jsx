import React from 'react';
import { Loader2, Search } from 'lucide-react';

export const ArchiveSearchPanel = ({
  query,
  onQueryChange,
  onSearch,
  loading = false,
  error = '',
  results = [],
  selectedResult = null,
  onSelectResult,
}) => {
  const latestVisit = selectedResult?.latestVisit;

  return (
    <div className="border-b border-slate-800 bg-slate-900/45 p-3" data-testid="workshop-bot-archive-search-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-100" data-testid="workshop-bot-archive-search-title">
            بحث أرشيفي سريع
          </p>
          <p className="text-[11px] text-slate-400" data-testid="workshop-bot-archive-search-subtitle">
            ابحث باسم العميل أو المركبة أو اللوحة لمعرفة آخر زيارة فورًا
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSearch();
              }
            }}
            placeholder="مثال: ا ر س 7576 أو اسم العميل"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-9 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40"
            data-testid="workshop-bot-archive-search-input"
          />
        </div>
        <button
          type="button"
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="workshop-bot-archive-search-button"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          بحث
        </button>
      </div>

      {!!error && (
        <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200" data-testid="workshop-bot-archive-search-error">
          {error}
        </div>
      )}

      {!!results.length && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="workshop-bot-archive-search-suggestions">
          {results.slice(0, 4).map((item, index) => {
            const active = selectedResult?.vehicle?.id === item?.vehicle?.id;
            return (
              <button
                key={`${item?.vehicle?.id || 'result'}-${index}`}
                type="button"
                onClick={() => onSelectResult(item)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${active ? 'border-cyan-400/40 bg-cyan-500/12 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                data-testid={`workshop-bot-archive-suggestion-${index}`}
              >
                {item?.vehicle?.plateNumber || item?.vehicle?.customerName || `نتيجة ${index + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {selectedResult?.vehicle && (
        <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/8 px-3 py-2.5" data-testid="workshop-bot-archive-search-preview">
          <p className="text-xs font-semibold text-cyan-100" data-testid="workshop-bot-archive-search-preview-title">
            آخر زيارة: {selectedResult.vehicle.plateNumber || selectedResult.vehicle.customerName || 'مطابقة محفوظة'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-200" data-testid="workshop-bot-archive-search-preview-summary">
            {latestVisit?.repairsSummary || 'لا توجد بنود إصلاح مسجلة'}
            {' • '}القيمة: {Number(latestVisit?.totalAmount || 0).toLocaleString('ar-SA')} ر.س
            {' • '}الدفع: {latestVisit?.paymentMethodLabel || 'غير محددة'}
          </p>
        </div>
      )}
    </div>
  );
};
