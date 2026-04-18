import React from 'react';

const LayerRow = ({ block, selected, multiSelected, onSelect, onToggleMultiSelect, onToggleVisibility, onToggleLock }) => {
  const hidden = block?.styles?.display === 'none';
  const locked = Boolean(block?.locked);
  return (
    <div
      className={`layers-panel-row ${selected ? 'selected' : ''}`}
      data-testid={`layers-panel-row-${block.id}`}
    >
      <input
        type="checkbox"
        checked={multiSelected}
        onChange={() => onToggleMultiSelect(block.id)}
        className="h-3.5 w-3.5"
        data-testid={`layers-panel-multiselect-${block.id}`}
      />
      <button type="button" onClick={() => onSelect(block.id)} className="layers-panel-select" data-testid={`layers-panel-select-${block.id}`}>
        {block.title || block.name || block.id}
      </button>
      <button
        type="button"
        onClick={() => onToggleVisibility(block.id, hidden)}
        className="layers-panel-action"
        data-testid={`layers-panel-visibility-${block.id}`}
      >
        {hidden ? 'إظهار' : 'إخفاء'}
      </button>
      <button
        type="button"
        onClick={() => onToggleLock(block.id, locked)}
        className="layers-panel-action"
        data-testid={`layers-panel-lock-${block.id}`}
      >
        {locked ? 'فتح' : 'قفل'}
      </button>
    </div>
  );
};

export const LayersPanel = ({ blocks = [], selectedId, selectedIds = [], onSelect, onToggleMultiSelect, onToggleVisibility, onToggleLock }) => (
  <div className="layers-panel-root" data-testid="layers-panel-root">
    <div className="layers-panel-title">الطبقات</div>
    <div className="layers-panel-list" data-testid="layers-panel-list">
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
      )) : <div className="layers-panel-empty" data-testid="layers-panel-empty">لا توجد عناصر</div>}
    </div>
  </div>
);
