import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSimpleHistory } from '../../hooks/useSimpleHistory';
import { HistoryTimeline } from './HistoryTimeline';
import PreviewFrame from './PreviewFrame';
import PropertyPanel from './PropertyPanel';
import BlockSidebar from './BlockSidebar';
import Toolbar from './Toolbar';
import './CanvasEditor.css';

const makeRenderedContent = (block) => {
  if (block.type === 'image') {
    const src = block.image || '';
    return src ? `<img src="${src}" alt="${block.title || ''}" style="width:100%;height:auto;border-radius:inherit;display:block;" />` : '<div style="padding:24px;text-align:center;color:#9ca3af;">صورة</div>';
  }
  if (block.type === 'button') {
    return `<a href="${block.link || '#'}" style="display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:12px;background:#111827;color:white;text-decoration:none;">${block.title || block.content || 'زر'}</a>`;
  }
  return `
    <div style="padding:16px;border-radius:16px;background:linear-gradient(180deg,#ffffff 0%, #f8fafc 100%);min-height:72px;display:flex;align-items:flex-start;justify-content:flex-start;color:#0f172a;line-height:1.8;">
      <div>
        <div style="font-weight:700;margin-bottom:6px;">${block.title || block.name || 'بلوك'}</div>
        <div>${block.content || block.title || block.name || ''}</div>
      </div>
    </div>
  `;
};

const stylesObjectToText = (styles = {}) => Object.entries(styles).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `${key}:${value}`).join(';');

const CanvasEditor = ({ pageData, onSave, onPublish, onSelectionChange }) => {
  const { current, push, undo, redo, reset, canUndo, canRedo, history, index, jumpTo } = useSimpleHistory(pageData);
  const [selectedId, setSelectedId] = useState(null);
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [touchedIds, setTouchedIds] = useState({});

  useEffect(() => {
    reset(pageData);
    setSelectedId(null);
    setTouchedIds({});
  }, [pageData, reset]);

  useEffect(() => {
    onSelectionChange?.(selectedId || '');
  }, [selectedId, onSelectionChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const newData = e.shiftKey ? redo() : undo();
        if (newData) push(newData, 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, push]);

  const updateBlock = (blockId, updates) => {
    const newData = {
      ...current,
      blocks: current.blocks.map((block) => block.id === blockId ? { ...block, ...updates } : block),
    };
    push(newData);
    setTouchedIds((prev) => ({ ...prev, [blockId]: true }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = current.blocks.findIndex((block) => block.id === active.id);
      const newIndex = current.blocks.findIndex((block) => block.id === over.id);
      const newBlocks = arrayMove(current.blocks, oldIndex, newIndex);
      push({ ...current, blocks: newBlocks });
    }
  };

  const selectedBlock = current.blocks.find((block) => block.id === selectedId) || null;
  const blocks = useMemo(() => current.blocks.map((block) => ({
    ...block,
    renderedContent: makeRenderedContent(block),
    stylesText: stylesObjectToText(block.styles),
  })), [current.blocks]);

  const previewCustomization = useMemo(() => {
    const labels = {};
    const contents = {};
    const styles = {};
    const assets = {};
    blocks.forEach((block) => {
      labels[block.id] = block.title || '';
      contents[block.id] = block.content || '';
      styles[block.id] = block.styles || {};
      assets[block.id] = { src: block.image || '', href: block.link || '' };
    });
    return {
      labels,
      contents,
      styles,
      assets,
      hidden: {},
      block_order: blocks.map((block) => block.id),
      positions: {},
    };
  }, [blocks]);

  const currentStateId = history[index]?.id || String(index);

  const handlePreviewSelect = (blockId) => {
    const nextId = String(blockId || '').trim();
    if (!nextId) return;
    setSelectedId(nextId);
    if (current.blocks.some((block) => block.id === nextId)) return;
    const injectedBlock = {
      id: nextId,
      type: 'text',
      name: nextId,
      title: nextId,
      content: '',
      liquidTemplate: '',
      styles: {},
      image: '',
      link: '',
    };
    push({
      ...current,
      blocks: [...current.blocks, injectedBlock],
    });
  };

  const handleJumpTo = (stateId) => {
    const nextState = jumpTo(Number(stateId));
    if (!nextState) return;
    setSelectedId(null);
  };

  return (
    <div className="canvas-editor" data-testid="canvas-editor-root">
      <Toolbar
        deviceMode={deviceMode}
        onDeviceChange={setDeviceMode}
        onSave={() => onSave(current, { touchedIds: Object.keys(touchedIds) })}
        onPublish={() => onPublish?.(current, { touchedIds: Object.keys(touchedIds) })}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="editor-layout">
        <BlockSidebar blocks={blocks} selectedId={selectedId} onSelect={setSelectedId} />

        <div className={`canvas-area ${deviceMode}`} data-testid="canvas-editor-center-area">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <PreviewFrame
                blocks={blocks}
                deviceMode={deviceMode}
                selectedId={selectedId}
                onSelect={handlePreviewSelect}
                previewSrc={current?.settings?.previewSrc}
                customization={previewCustomization}
              />
            </SortableContext>
          </DndContext>
        </div>

        <div className="right-panel" data-testid="canvas-editor-right-panel">
          <PropertyPanel block={selectedBlock} onChange={updateBlock} onDeselect={() => setSelectedId(null)} />
          <HistoryTimeline history={history.map((item, i) => ({ id: String(i), timestamp: Date.now() - (history.length - i) * 1000, data: item, label: i === 0 ? 'بداية التصميم' : `تعديل ${i}`, type: i === 0 ? 'initial' : 'content' }))} currentStateId={currentStateId} onJumpTo={handleJumpTo} />
        </div>
      </div>
    </div>
  );
};

export default CanvasEditor;