import React from 'react';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;

const renderPoints = (points = []) => {
  if (!points.length) return '-';
  return points
    .slice(0, 4)
    .map((row) => `${formatCurrency(row.price)} (${new Date(row.date).toLocaleDateString('ar-SA')})`)
    .join(' • ');
};

const pctClass = (value) => {
  if (value > 0) return 'text-rose-300';
  if (value < 0) return 'text-emerald-300';
  return 'text-slate-300';
};

export const RakanPriceTimelinePanel = ({ analytics }) => {
  const timeline = analytics?.price_timeline || [];

  return (
    <div className="glass-card p-4 overflow-auto" data-testid="rakan-price-timeline-panel">
      <h2 className="text-white font-semibold mb-3">تتبع تغير الأسعار عبر الزمن</h2>
      <table className="w-full text-sm text-right min-w-[980px]">
        <thead className="text-slate-400 border-b border-white/10">
          <tr>
            <th className="py-2">القطعة</th>
            <th className="py-2">نقاط بيع حديثة</th>
            <th className="py-2">تغير البيع</th>
            <th className="py-2">نقاط شراء حديثة</th>
            <th className="py-2">تغير الشراء</th>
            <th className="py-2">درجة التذبذب</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map((row) => (
            <tr key={row.part_id} className="border-b border-white/5 text-slate-200" data-testid={`parts-control-rakan-trend-row-${row.part_id}`}>
              <td className="py-2 text-white">{row.part_name}</td>
              <td className="py-2">{renderPoints(row.latest_sale_points)}</td>
              <td className={`py-2 ${pctClass(row.sale_change_pct)}`}>
                {formatCurrency(row.sale_change)} ({Number(row.sale_change_pct || 0).toLocaleString('ar-SA')}%)
              </td>
              <td className="py-2">{renderPoints(row.latest_purchase_points)}</td>
              <td className={`py-2 ${pctClass(row.purchase_change_pct)}`}>
                {formatCurrency(row.purchase_change)} ({Number(row.purchase_change_pct || 0).toLocaleString('ar-SA')}%)
              </td>
              <td className="py-2 text-cyan-200">{Number(row.volatility_pct || 0).toLocaleString('ar-SA')}%</td>
            </tr>
          ))}
          {!timeline.length && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-slate-400" data-testid="parts-control-rakan-trend-empty">
                لا توجد بيانات كافية لتتبع الأسعار الزمنية.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
