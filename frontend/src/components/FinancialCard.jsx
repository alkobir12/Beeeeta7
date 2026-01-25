import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Info } from 'lucide-react';

/**
 * مكون بطاقة مالية قابلة للتوسع
 * يستخدم لعرض المعلومات المالية بتصميم عصري وقابل للتفاعل
 */
const FinancialCard = ({
  title,
  value,
  subtitle,
  icon: Icon = DollarSign,
  trend,
  trendValue,
  details = [],
  variant = 'default', // default, success, warning, danger
  expandable = true,
  onClick,
  className = '',
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const mainValue = value ?? title;

  const variantStyles = {
    default: {
      gradient: 'radial-gradient(circle at 0% 0%, rgba(59,130,246,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)',
      border: 'rgba(15,23,42,0.55)',
      iconBg: 'from-blue-500 to-blue-600'
    },
    success: {
      gradient: 'radial-gradient(circle at 0% 0%, rgba(34,197,94,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(74,222,128,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)',
      border: 'rgba(34,197,94,0.35)',
      iconBg: 'from-emerald-500 to-green-600'
    },
    warning: {
      gradient: 'radial-gradient(circle at 0% 0%, rgba(251,146,60,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(251,191,36,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)',
      border: 'rgba(251,146,60,0.35)',
      iconBg: 'from-orange-400 to-yellow-500'
    },
    danger: {
      gradient: 'radial-gradient(circle at 0% 0%, rgba(239,68,68,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(248,113,113,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)',
      border: 'rgba(239,68,68,0.35)',
      iconBg: 'from-red-500 to-red-600'
    }
  };

  const style = variantStyles[variant];

  const handleCardClick = () => {
    if (expandable) {
      setIsExpanded(!isExpanded);
    }
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`relative rounded-[32px] overflow-hidden transition-all duration-400 ${
        expandable ? 'cursor-pointer' : ''
      } ${className}`}
      style={{
        background: style.gradient,
        border: `1px solid ${style.border}`,
        boxShadow: isExpanded
          ? '0 32px 100px rgba(15,23,42,0.9), 0 0 0 1px rgba(59,130,246,0.3)'
          : '0 24px 70px rgba(15,23,42,0.75)',
        maxHeight: isExpanded ? '600px' : '260px',
        transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease',
        transform: isExpanded ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={handleCardClick}
      onMouseEnter={() => expandable && setIsExpanded(true)}
      onMouseLeave={() => expandable && setIsExpanded(false)}
    >
      {/* النقاط الزخرفية */}
      <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
        <span className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="w-1 h-1 rounded-full bg-gray-400" />
        <span className="w-1 h-1 rounded-full bg-gray-400" />
      </div>

      {/* الترويسة وإعادة تنظيم المعلومات داخل الكرت المالي */}
       <div className="px-6 pt-6 pb-4">
        {/* السطر العلوي: العنوان + الأيقونة */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {subtitle && (
              <p className="text-[11px] text-slate-400 mb-1 font-medium truncate">{subtitle}</p>
            )}
            <h3 className="text-base sm:text-lg font-semibold text-slate-50 leading-snug truncate">
              {title}
            </h3>
          </div>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${style.iconBg} flex items-center justify-center shadow-lg ml-3 flex-shrink-0`}>
            <Icon size={22} className="text-white" />
          </div>
        </div>

        {/* السطر الثاني: القيمة الرئيسية + اتجاه الحركة */}
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div className="flex flex-col">
            <span className="financial-main-value text-xl sm:text-2xl font-extrabold tabular-nums">
              {mainValue}
            </span>
          </div>
          {trend && (
            <div
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                trend === 'up'
                  ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                  : 'text-red-400 border-red-500/40 bg-red-500/10'
              }`}
            >
              {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </div>

      {/* التفاصيل الموسعة */}
      {isExpanded && details.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-slate-950/60 rounded-2xl px-4 py-3 border border-slate-800/80 space-y-3">
            {details.map((detail, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 flex items-center gap-2 font-medium">
                  {detail.icon && <detail.icon size={14} />}
                  {detail.label}
                </span>
                <span className={`font-bold text-base ${detail.valueColor || 'text-slate-100'}`}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* محتوى مخصص */}
      {children && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
};

export default FinancialCard;
