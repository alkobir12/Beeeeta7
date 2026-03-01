import React from 'react';

export const InventoryFiltersPanel = ({
  searchQuery,
  selectedCategory,
  selectedBrand,
  stockStatus,
  categories,
  brands,
  categoryStats,
  outOfStockCount,
  lowStockCount,
  onSearchChange,
  onCategoryChange,
  onBrandChange,
  onStockStatusChange,
  onResetFilters,
  onCategoryQuickFilter,
  onOutFilter,
  onLowFilter,
}) => {
  return (
    <>
      <div className="filter-bar mb-6" data-testid="parts-filter-bar">
        <input
          className="filter-input flex-1"
          placeholder="🔍 بحث عن قطعة..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="parts-search-input"
        />
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          data-testid="parts-category-filter"
        >
          <option value="">كل الفئات</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedBrand}
          onChange={(e) => onBrandChange(e.target.value)}
          data-testid="parts-brand-filter"
        >
          <option value="">كل الماركات</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={stockStatus}
          onChange={(e) => onStockStatusChange(e.target.value)}
          data-testid="parts-stock-filter"
        >
          <option value="">كل الحالات</option>
          <option value="good">مخزون جيد</option>
          <option value="low">منخفض المخزون</option>
          <option value="out">نافد</option>
        </select>
        <button
          className="px-4 py-2 rounded-lg bg-white/10 text-white"
          onClick={onResetFilters}
          data-testid="parts-reset-filters"
        >
          إعادة تعيين
        </button>
      </div>

      <div className="glass-card p-4 mb-6" data-testid="inventory-category-panel">
        <h3 className="text-lg font-semibold mb-3" data-testid="inventory-category-panel-title">📊 تصنيف المخزون</h3>
        <div className="space-y-2" data-testid="inventory-category-panel-list">
          {categoryStats.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onCategoryQuickFilter(cat.name)}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-lg px-3 py-2"
              data-testid={`inventory-category-${cat.name}`}
            >
              <span className="text-white">{cat.name}</span>
              <span className="text-xs text-slate-300">{cat.count} قطع • {cat.low} منخفض</span>
            </button>
          ))}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={onOutFilter}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-lg px-3 py-2"
              data-testid="inventory-filter-out"
            >
              <span className="text-white">القطع النافدة</span>
              <span className="text-xs text-red-300" data-testid="inventory-filter-out-count">{outOfStockCount}</span>
            </button>
            <button
              onClick={onLowFilter}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-lg px-3 py-2"
              data-testid="inventory-filter-low"
            >
              <span className="text-white">القطع منخفضة المخزون</span>
              <span className="text-xs text-yellow-300" data-testid="inventory-filter-low-count">{lowStockCount}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
