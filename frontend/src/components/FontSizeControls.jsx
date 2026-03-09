import React from 'react';
import { Type } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const FONT_OPTIONS = [
  { key: 'small', label: 'A-' },
  { key: 'medium', label: 'A' },
  { key: 'large', label: 'A+' },
];

export const FontSizeControls = ({ compact = false, testIdPrefix = 'font-size' }) => {
  const { fontSize, changeFontSize } = useTheme();

  return (
    <div
      className={`flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/6 backdrop-blur-xl ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
      data-testid={`${testIdPrefix}-controls`}
    >
      <div className="flex items-center gap-2 text-slate-200">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <Type size={15} />
        </span>
        {!compact && (
          <div>
            <p className="text-[11px] text-slate-400">حجم الخط</p>
            <p className="text-xs text-white">الموقع بالكامل</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 rounded-full bg-black/20 p-1">
        {FONT_OPTIONS.map((option) => {
          const active = fontSize === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => changeFontSize(option.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition-all ${active ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              data-testid={`${testIdPrefix}-${option.key}-button`}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
