import React, { useMemo, useState } from 'react';

const SmartGuidance = ({ guides = [], enabled = false, userKey = 'default' }) => {
  const storageKey = `smart-guidance-${userKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const visibleGuides = useMemo(() => {
    if (!enabled) return [];
    return guides
      .filter((guide) => guide?.condition)
      .filter((guide) => !dismissed.includes(guide.id))
      .slice(0, 2);
  }, [enabled, guides, dismissed]);

  const dismissGuide = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  if (!enabled || visibleGuides.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] space-y-3"
      dir="rtl"
      data-testid="smart-guidance"
    >
      {visibleGuides.map((guide) => (
        <div
          key={guide.id}
          className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-lg"
          data-testid={`smart-guidance-card-${guide.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{guide.title}</h4>
              <p className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">{guide.message}</p>
            </div>
            <button
              onClick={() => dismissGuide(guide.id)}
              className="text-xs text-slate-400 hover:text-slate-200"
              data-testid={`smart-guidance-dismiss-${guide.id}`}
            >
              إخفاء
            </button>
          </div>
          {guide.actionLabel && guide.onAction && (
            <button
              onClick={guide.onAction}
              className="mt-3 w-full rounded-xl border border-slate-500/40 bg-slate-800/60 py-2 text-xs text-slate-100"
              data-testid={`smart-guidance-action-${guide.id}`}
            >
              {guide.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default SmartGuidance;
