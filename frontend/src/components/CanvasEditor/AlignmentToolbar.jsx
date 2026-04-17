import React from 'react';

const Btn = ({ label, testId, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px]"
    data-testid={testId}
  >
    {label}
  </button>
);

export const AlignmentToolbar = ({ selectedBlock, selectedIds = [], onStyleChangeForSelection }) => {
  const hasSelection = Boolean(selectedBlock?.id || selectedIds.length);
  if (!hasSelection) return null;

  const apply = (stylePatch) => onStyleChangeForSelection?.(stylePatch);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2" data-testid="alignment-toolbar-root">
      <span className="text-[10px] text-cyan-200 px-1" data-testid="alignment-toolbar-selection-count">{selectedIds.length > 1 ? `تحديد متعدد: ${selectedIds.length}` : 'عنصر واحد'}</span>
      <Btn label="يمين" testId="alignment-toolbar-align-right" onClick={() => apply({ textAlign: 'right' })} />
      <Btn label="وسط" testId="alignment-toolbar-align-center" onClick={() => apply({ textAlign: 'center' })} />
      <Btn label="يسار" testId="alignment-toolbar-align-left" onClick={() => apply({ textAlign: 'left' })} />
      <Btn label="تمدد" testId="alignment-toolbar-stretch" onClick={() => apply({ width: '100%' })} />
      <Btn label="Padding +" testId="alignment-toolbar-padding-plus" onClick={() => apply({ padding: '16px' })} />
      <Btn label="Padding -" testId="alignment-toolbar-padding-minus" onClick={() => apply({ padding: '8px' })} />
      <Btn label="Gap موحد" testId="alignment-toolbar-spacing-even" onClick={() => apply({ margin: '8px 0' })} />
    </div>
  );
};
