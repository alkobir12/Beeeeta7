import React, { memo } from 'react';
import { AlertTriangle, Edit, Image as ImageIcon, Trash2 } from 'lucide-react';

const PartInventoryCard = memo(({ part, onSell, onRestock, onEdit, onDelete }) => {
  const statusColor = part.quantity === 0 ? '#ff4444' : part.quantity <= part.minQuantity ? '#ffbb33' : '#00C851';
  const statusText = part.quantity === 0 ? 'نافد' : part.quantity <= part.minQuantity ? 'منخفض' : 'جيد';
  const stockPercent = Math.min((part.quantity / Math.max(part.minQuantity, 1)) * 100, 100);

  return (
    <div data-testid={`part-card-${part.id}`} className="glass-card p-0 overflow-hidden group transition-all" style={{ borderColor: statusColor }}>
      <div className="h-40 bg-white/5 relative" data-testid={`part-card-image-wrapper-${part.id}`}>
        {part.image ? (
          <img src={part.image} alt={part.name} className="w-full h-full object-cover" data-testid={`part-card-image-${part.id}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400" data-testid={`part-card-image-placeholder-${part.id}`}>
            <ImageIcon size={40} />
          </div>
        )}
        <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm" style={{ background: `${statusColor}30`, color: statusColor }} data-testid={`part-card-status-badge-${part.id}`}>
          <AlertTriangle size={12} />
          <span>{statusText}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-white truncate" title={part.name} data-testid={`part-card-name-${part.id}`}>{part.name}</h3>
            <p className="text-xs text-slate-400 font-mono" data-testid={`part-card-number-${part.id}`}>{part.partNumber || '-'}</p>
          </div>
          <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-200" data-testid={`part-card-category-${part.id}`}>{part.category || '-'}</span>
        </div>

        <div className="space-y-1 text-sm mb-4" data-testid={`part-card-prices-${part.id}`}>
          <div className="flex justify-between">
            <span className="text-slate-400">الكمية</span>
            <span className="font-medium text-white" data-testid={`part-card-quantity-${part.id}`}>{part.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">سعر الشراء</span>
            <span className="text-white" data-testid={`part-card-purchase-price-${part.id}`}>{part.purchasePrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">سعر البيع</span>
            <span className="font-bold text-emerald-300" data-testid={`part-card-selling-price-${part.id}`}>{part.sellingPrice}</span>
          </div>
        </div>

        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3" data-testid={`part-card-stock-progress-${part.id}`}>
          <div className="h-full" style={{ width: `${stockPercent}%`, background: statusColor }} />
        </div>

        <div className="flex gap-2 pt-2 border-t border-white/10 flex-wrap" data-testid={`part-card-actions-${part.id}`}>
          <button
            onClick={() => onSell(part)}
            className="flex-1 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid={`part-sell-${part.id}`}
          >
            بيع
          </button>
          <button
            onClick={() => onRestock(part)}
            className="flex-1 py-2 text-sm text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid={`part-restock-${part.id}`}
          >
            شراء
          </button>
          <button
            onClick={() => onEdit(part)}
            className="flex-1 py-2 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid={`part-edit-${part.id}`}
          >
            <Edit size={14} /> تعديل
          </button>
          <button
            onClick={() => onDelete(part.id)}
            className="flex-1 py-2 text-sm text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid={`part-delete-${part.id}`}
          >
            <Trash2 size={14} /> حذف
          </button>
        </div>
      </div>
    </div>
  );
});

PartInventoryCard.displayName = 'PartInventoryCard';

export const PartInventoryGrid = ({ loading, parts, onSell, onRestock, onEdit, onDelete }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12" data-testid="parts-grid-loading">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="parts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {parts.map((part) => (
        <PartInventoryCard
          key={part.id}
          part={part}
          onSell={onSell}
          onRestock={onRestock}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
