import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableBlock = ({ block, selected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`block-item ${selected ? 'selected' : ''}`}
      onClick={() => onSelect?.(block.id)}
      onPointerDown={() => {
        onSelect?.(block.id);
        if (navigator?.vibrate) navigator.vibrate(12);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect?.(block.id);
      }}
      data-testid={`canvas-editor-block-item-${block.id}`}
    >
      <span className="icon">{block.icon || '◼'}</span>
      <div className="min-w-0 flex-1">
        <span className="name block truncate">{block.name || block.title || 'بلوك'}</span>
        <span className="text-[10px] text-white/60">{block.category || 'نص'}</span>
      </div>
    </div>
  );
};

const BlockSidebar = ({ blocks = [], selectedId, onSelect }) => {
  return (
    <div className="block-sidebar" data-testid="canvas-editor-block-sidebar">
      <h4>البلوكات</h4>
      {blocks.map((block) => <SortableBlock key={block.id} block={block} selected={selectedId === block.id} onSelect={onSelect} />)}
    </div>
  );
};

export default BlockSidebar;