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
      className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.28)]"
      dir="rtl"
      data-testid="guidance-stepper"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-950">{title}</h3>
          {subtitle && <p className="mt-1 text-xs font-semibold text-slate-700">{subtitle}</p>}
        </div>
        <button
          onClick={toggleCollapse}
          className="text-xs font-bold text-slate-700 hover:text-slate-950"
          data-testid="guidance-stepper-toggle"
        >
          {collapsed ? 'إظهار' : 'إخفاء'}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 space-y-3">
          <div className="h-1 w-full rounded-full bg-slate-200">
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
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
                data-testid={`guidance-step-${step.id}`}
              >
                <span className="text-sm">{step.done ? '✓' : '•'}</span>
                <div>
                  <div className="font-semibold">{step.title}</div>
                  {step.hint && <div className="mt-1 text-[11px] font-medium text-slate-600">{step.hint}</div>}
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
