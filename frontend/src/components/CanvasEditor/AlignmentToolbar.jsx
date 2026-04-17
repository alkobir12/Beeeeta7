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

export const AlignmentToolbar = ({ selectedBlock, onStyleChange }) => {
  if (!selectedBlock?.id) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2" data-testid="alignment-toolbar-root">
      <Btn label="يمين" testId="alignment-toolbar-align-right" onClick={() => onStyleChange(selectedBlock.id, { textAlign: 'right' })} />
      <Btn label="وسط" testId="alignment-toolbar-align-center" onClick={() => onStyleChange(selectedBlock.id, { textAlign: 'center' })} />
      <Btn label="يسار" testId="alignment-toolbar-align-left" onClick={() => onStyleChange(selectedBlock.id, { textAlign: 'left' })} />
      <Btn label="تمدد" testId="alignment-toolbar-stretch" onClick={() => onStyleChange(selectedBlock.id, { width: '100%' })} />
      <Btn label="Padding +" testId="alignment-toolbar-padding-plus" onClick={() => onStyleChange(selectedBlock.id, { padding: '16px' })} />
      <Btn label="Padding -" testId="alignment-toolbar-padding-minus" onClick={() => onStyleChange(selectedBlock.id, { padding: '8px' })} />
      <Btn label="Gap موحد" testId="alignment-toolbar-spacing-even" onClick={() => onStyleChange(selectedBlock.id, { margin: '8px 0' })} />
    </div>
  );
};
