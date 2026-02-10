import React, { useMemo, useState } from 'react';

const GuidanceStepper = ({ title, subtitle, steps = [], enabled = true, storageKey = 'guidance-stepper' }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'collapsed';
    } catch (e) {
      return false;
    }
  });

  const progress = useMemo(() => {
    if (!steps.length) return 0;
    const completed = steps.filter((step) => step.done).length;
    return Math.round((completed / steps.length) * 100);
  }, [steps]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(storageKey, next ? 'collapsed' : 'expanded');
  };

  if (!enabled || steps.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg"
      dir="rtl"
      data-testid="guidance-stepper"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-300">{subtitle}</p>}
        </div>
        <button
          onClick={toggleCollapse}
          className="text-xs text-slate-300 hover:text-white"
          data-testid="guidance-stepper-toggle"
        >
          {collapsed ? 'إظهار' : 'إخفاء'}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 space-y-3">
          <div className="h-1 w-full rounded-full bg-white/10">
            <div
              className="h-1 rounded-full bg-emerald-400 transition-all"
              style={{ width: `${progress}%` }}
              data-testid="guidance-stepper-progress"
            />
          </div>
          <ul className="space-y-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                  step.done
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-200'
                }`}
                data-testid={`guidance-step-${step.id}`}
              >
                <span className="text-sm">{step.done ? '✓' : '•'}</span>
                <div>
                  <div className="font-semibold">{step.title}</div>
                  {step.hint && <div className="mt-1 text-[11px] text-slate-300">{step.hint}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GuidanceStepper;
