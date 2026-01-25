import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * بطاقة مالية متقدمة مستوحاة من التصميم الذي أرسلته
 * تستخدم Tailwind + CSS مخصص في index.css (className: finance-card)
 */
export default function FinanceGradientCard({
  title,
  amount,
  change,
  isPositiveChange = true,
  comparisonText,
  chartData = [],
  tags = [],
  buttonText,
  icon,
  onButtonClick,
}) {
  const safeChart = chartData && chartData.length
    ? chartData
    : [
        { day: 'S', value: 30, percentage: '5%', isPositive: true },
        { day: 'M', value: 80, percentage: '-1.7%', isPositive: false },
        { day: 'T', value: 50, percentage: '2.3%', isPositive: true },
        { day: 'W', value: 85, percentage: '-3.8%', isPositive: false },
        { day: 'T', value: 70, percentage: '6.3%', isPositive: true },
        { day: 'F', value: 80, percentage: '-2.3%', isPositive: false },
        { day: 'S', value: 60, percentage: '2.0%', isPositive: true },
      ];

  return (
    <div className="finance-card theme-light">
      <div className="finance-card-inner">
        <div className="finance-card-bg">
          <div className="finance-card-header flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <p className="finance-card-title">{title}</p>
              {comparisonText && (
                <p className="finance-card-sub text-xs mt-1">{comparisonText}</p>
              )}
            </div>
            <div className="finance-card-icon">
              {icon}
            </div>
          </div>

          <div className="flex items-end justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="finance-card-amount">{amount}</span>
              {typeof change === 'string' && change.trim() !== '' && (
                <span
                  className={`finance-card-change inline-flex items-center gap-1 text-xs ${
                    isPositiveChange ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {isPositiveChange ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {change}
                </span>
              )}
            </div>
          </div>

          {tags && tags.length > 0 && (
            <div className="finance-card-tags mb-2 flex flex-wrap justify-end gap-1 text-[11px]">
              {tags.map((tag, i) => (
                <span key={i}>{tag}</span>
              ))}
            </div>
          )}

          <div className="finance-card-chart mb-3">
            {safeChart.map((item, idx) => (
              <div
                key={`${item.day}-${idx}`}
                className="finance-card-bar"
                style={{
                  height: `${item.value}px`,
                  backgroundColor: item.isPositive ? 'var(--color-white)' : 'var(--color-red)',
                }}
              >
                <div
                  className={`finance-card-bar-value ${
                    item.isPositive ? '' : 'text-red-300'
                  }`}
                >
                  {item.percentage}
                </div>
                <div className="finance-card-bar-label">{item.day}</div>
              </div>
            ))}
          </div>

          {buttonText && (
            <button
              type="button"
              className="finance-card-button"
              onClick={onButtonClick}
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
