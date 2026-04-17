import React from 'react';

const LayerRow = ({ block, selected, multiSelected, onSelect, onToggleMultiSelect, onToggleVisibility, onToggleLock }) => {
  const hidden = block?.styles?.display === 'none';
  const locked = Boolean(block?.locked);
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${selected ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}
      data-testid={`layers-panel-row-${block.id}`}
    >
      <input
        type="checkbox"
        checked={multiSelected}
        onChange={() => onToggleMultiSelect(block.id)}
        className="h-3.5 w-3.5"
        data-testid={`layers-panel-multiselect-${block.id}`}
      />
      <button type="button" onClick={() => onSelect(block.id)} className="flex-1 text-right text-xs text-white/90 truncate" data-testid={`layers-panel-select-${block.id}`}>
        {block.title || block.name || block.id}
      </button>
      <button
        type="button"
        onClick={() => onToggleVisibility(block.id, hidden)}
        className="text-[10px] rounded border border-white/15 px-2 py-1"
        data-testid={`layers-panel-visibility-${block.id}`}
      >
        {hidden ? 'إظهار' : 'إخفاء'}
      </button>
      <button
        type="button"
        onClick={() => onToggleLock(block.id, locked)}
        className="text-[10px] rounded border border-white/15 px-2 py-1"
        data-testid={`layers-panel-lock-${block.id}`}
      >
        {locked ? 'فتح' : 'قفل'}
      </button>
    </div>
  );
};

export const LayersPanel = ({ blocks = [], selectedId, selectedIds = [], onSelect, onToggleMultiSelect, onToggleVisibility, onToggleLock }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid="layers-panel-root">
    <div className="text-xs font-semibold text-white/80 mb-2">الطبقات</div>
    <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="layers-panel-list">
      {blocks.length ? blocks.map((block) => (
        <LayerRow
          key={block.id}
          block={block}
          selected={selectedId === block.id}
          multiSelected={selectedIds.includes(block.id)}
          onSelect={onSelect}
          onToggleMultiSelect={onToggleMultiSelect}
          onToggleVisibility={onToggleVisibility}
          onToggleLock={onToggleLock}
        />
      )) : <div className="text-xs text-white/50" data-testid="layers-panel-empty">لا توجد عناصر</div>}
    </div>
  </div>
);
