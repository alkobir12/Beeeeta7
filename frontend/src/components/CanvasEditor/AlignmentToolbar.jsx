import React from 'react';

const Btn = ({ label, testId, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="alignment-toolbar-button"
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
    <div className="alignment-toolbar" data-testid="alignment-toolbar-root">
      <span className="alignment-toolbar-selection" data-testid="alignment-toolbar-selection-count">{selectedIds.length > 1 ? `تحديد متعدد: ${selectedIds.length}` : 'عنصر واحد'}</span>
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
