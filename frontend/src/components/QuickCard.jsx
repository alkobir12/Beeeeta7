import React from 'react';

/**
 * بطاقة سريعة لعرض مؤشر/تنبيه بشكل مختصر.
 * تُستخدم في صفحة /ai-financial.
 */
export default function QuickCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default', // default | success | warning | danger
  onClick,
  className = '',
}) {
  const variants = {
    default: {
      ring: 'ring-slate-800/60',
      bg: 'bg-slate-950/60',
      icon: 'text-sky-400',
      badge: 'bg-sky-500/10 text-sky-200 border-sky-500/20',
    },
    success: {
      ring: 'ring-emerald-600/20',
      bg: 'bg-slate-950/60',
      icon: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
    },
    warning: {
      ring: 'ring-orange-600/20',
      bg: 'bg-slate-950/60',
      icon: 'text-orange-400',
      badge: 'bg-orange-500/10 text-orange-200 border-orange-500/20',
    },
    danger: {
      ring: 'ring-red-600/20',
      bg: 'bg-slate-950/60',
      icon: 'text-red-400',
      badge: 'bg-red-500/10 text-red-200 border-red-500/20',
    },
  };

  const v = variants[variant] || variants.default;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right rounded-2xl border border-slate-800/70 ${v.bg} ring-1 ${v.ring} p-4 hover:bg-slate-950/70 transition-colors ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${className}`}
      disabled={!onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-400 mb-1 truncate">{title}</div>
          <div className="text-base sm:text-lg font-semibold text-slate-100 truncate">{value}</div>
          {subtitle ? (
            <div className="text-xs text-slate-400 mt-1 truncate">{subtitle}</div>
          ) : null}
        </div>

        {Icon ? (
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${v.badge}`}>
            <Icon size={18} className={v.icon} />
          </div>
        ) : null}
      </div>
    </button>
  );
}
