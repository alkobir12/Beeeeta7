import React from 'react';

export const InventoryStatsCards = ({
  partsCount,
  lowStockCount,
  outOfStockCount,
  inventoryValue,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" data-testid="inventory-stats-cards">
      <div className="glass-card p-5 border-t-4" style={{ borderColor: '#33b5e5' }} data-testid="inventory-stat-total-parts">
        <p className="text-sm text-slate-300 mb-1">إجمالي القطع</p>
        <p className="text-2xl font-bold text-white" data-testid="inventory-stat-total-parts-value">{partsCount}</p>
      </div>
      <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ffbb33' }} data-testid="inventory-stat-low-stock">
        <p className="text-sm text-slate-300 mb-1">منخفضة المخزون</p>
        <p className="text-2xl font-bold text-white" data-testid="inventory-stat-low-stock-value">{lowStockCount}</p>
      </div>
      <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ff4444' }} data-testid="inventory-stat-out-of-stock">
        <p className="text-sm text-slate-300 mb-1">نافدة</p>
        <p className="text-2xl font-bold text-white" data-testid="inventory-stat-out-of-stock-value">{outOfStockCount}</p>
      </div>
      <div className="glass-card p-5 border-t-4" style={{ borderColor: '#00C851' }} data-testid="inventory-stat-value">
        <p className="text-sm text-slate-300 mb-1">قيمة المخزون</p>
        <p className="text-2xl font-bold text-white" data-testid="inventory-stat-value-amount">{Number(inventoryValue || 0).toLocaleString()} ر.س</p>
      </div>
    </div>
  );
};
