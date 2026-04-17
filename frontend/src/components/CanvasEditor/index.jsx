import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSimpleHistory } from '../../hooks/useSimpleHistory';
import { useClipboard } from '../../hooks/useClipboard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { HistoryTimeline } from './HistoryTimeline';
import PreviewFrame from './PreviewFrame';
import PropertyPanel from './PropertyPanel';
import BlockSidebar from './BlockSidebar';
import Toolbar from './Toolbar';
import { LayersPanel } from './LayersPanel';
import { AlignmentToolbar } from './AlignmentToolbar';
import { ExportImportDialog } from './ExportImportDialog';
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
  const latestCurrentRef = useRef(current);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [touchedIds, setTouchedIds] = useState({});
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(false);
  const { writeClipboard, readClipboard, cloneWithNewId } = useClipboard();

  useEffect(() => {
    latestCurrentRef.current = current;
  }, [current]);

  useEffect(() => {
    reset(pageData);
    setSelectedId(null);
    setSelectedIds([]);
    setTouchedIds({});
  }, [pageData, reset]);

  useEffect(() => {
    onSelectionChange?.(selectedId || '');
  }, [selectedId, onSelectionChange]);

  const selectSingle = (blockId) => {
    setSelectedId(blockId);
    setSelectedIds([blockId]);
    setMobilePanelOpen(true);
  };

  const toggleMultiSelect = (blockId) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(blockId);
      const next = exists ? prev.filter((id) => id !== blockId) : [...prev, blockId];
      if (next.length === 1) setSelectedId(next[0]);
      if (!next.length) setSelectedId(null);
      return next;
    });
  };

  const updateBlock = (blockId, updates) => {
    const exists = current.blocks.some((block) => block.id === blockId);
    const nextBlocks = exists
      ? current.blocks.map((block) => block.id === blockId ? { ...block, ...updates } : block)
      : [...current.blocks, {
        id: blockId,
        type: 'text',
        name: blockId,
        title: updates?.title || blockId,
        content: updates?.content || '',
        liquidTemplate: '',
        styles: updates?.styles || {},
        image: updates?.image || '',
        link: updates?.link || '',
      }];
    const newData = {
      ...current,
      blocks: nextBlocks,
    };
    latestCurrentRef.current = newData;
    push(newData);
    setTouchedIds((prev) => ({ ...prev, [blockId]: true }));
  };

  const applyStylePatch = (blockId, stylePatch = {}) => {
    const target = current.blocks.find((block) => block.id === blockId);
    updateBlock(blockId, { styles: { ...(target?.styles || {}), ...stylePatch } });
  };

  const applyStyleForSelection = (stylePatch = {}) => {
    const targets = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    targets.forEach((id) => applyStylePatch(id, stylePatch));
  };

  const copySelected = () => {
    if (!selectedId) return;
    const target = latestCurrentRef.current.blocks.find((block) => block.id === selectedId);
    if (!target) return;
    writeClipboard(target);
  };

  const pasteBlock = () => {
    const source = readClipboard();
    if (!source) return;
    const clone = cloneWithNewId(source);
    if (!clone) return;
    const nextData = {
      ...latestCurrentRef.current,
      blocks: [...latestCurrentRef.current.blocks, clone],
    };
    latestCurrentRef.current = nextData;
    push(nextData);
    setSelectedId(clone.id);
    setTouchedIds((prev) => ({ ...prev, [clone.id]: true }));
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const target = latestCurrentRef.current.blocks.find((block) => block.id === selectedId);
    if (!target) return;
    const clone = cloneWithNewId(target);
    if (!clone) return;
    const nextData = {
      ...latestCurrentRef.current,
      blocks: [...latestCurrentRef.current.blocks, clone],
    };
    latestCurrentRef.current = nextData;
    push(nextData);
    setSelectedId(clone.id);
    setTouchedIds((prev) => ({ ...prev, [clone.id]: true }));
  };

  const deleteSelected = () => {
    const targets = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    if (!targets.length) return;
    const targetSet = new Set(targets);
    const nextBlocks = latestCurrentRef.current.blocks.filter((block) => !targetSet.has(block.id));
    const nextData = { ...latestCurrentRef.current, blocks: nextBlocks };
    latestCurrentRef.current = nextData;
    push(nextData);
    setSelectedId(null);
    setSelectedIds([]);
  };

  const importPageData = (parsed) => {
    const importedBlocks = Array.isArray(parsed?.blocks)
      ? parsed.blocks.map((block, idx) => ({
        id: block.id || `imported-${idx + 1}`,
        type: block.type || 'text',
        name: block.name || block.title || block.id || `عنصر ${idx + 1}`,
        title: block.title || block.name || `عنصر ${idx + 1}`,
        content: block.content || '',
        liquidTemplate: block.liquidTemplate || '',
        styles: block.styles || {},
        image: block.image || '',
        link: block.link || '',
      }))
      : [];
    if (!importedBlocks.length) return;
    const nextData = {
      ...latestCurrentRef.current,
      blocks: importedBlocks,
    };
    latestCurrentRef.current = nextData;
    push(nextData);
    setSelectedId(importedBlocks[0]?.id || null);
  };

  useKeyboardShortcuts({
    onSave: () => onSave(latestCurrentRef.current, {
      touchedIds: Object.keys(touchedIds),
      selectedId,
      selectedSnapshot: latestCurrentRef.current.blocks.find((block) => block.id === selectedId) || null,
    }),
    onPublish: () => onPublish?.(latestCurrentRef.current, {
      touchedIds: Object.keys(touchedIds),
      selectedId,
      selectedSnapshot: latestCurrentRef.current.blocks.find((block) => block.id === selectedId) || null,
    }),
    onUndo: undo,
    onRedo: redo,
    onCopy: copySelected,
    onPaste: pasteBlock,
    onDuplicate: duplicateSelected,
    onDelete: deleteSelected,
    onDeselect: () => { setSelectedId(null); setSelectedIds([]); },
    onToggleShortcuts: () => setShowShortcuts((v) => !v),
  });

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
    selectSingle(nextId);
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
    setSelectedIds([]);
  };

  return (
    <div className="canvas-editor" data-testid="canvas-editor-root">
      <Toolbar
        deviceMode={deviceMode}
        onDeviceChange={setDeviceMode}
        onSave={() => onSave(latestCurrentRef.current, {
          touchedIds: Object.keys(touchedIds),
          selectedId,
          selectedSnapshot: latestCurrentRef.current.blocks.find((block) => block.id === selectedId) || null,
        })}
        onPublish={() => onPublish?.(latestCurrentRef.current, {
          touchedIds: Object.keys(touchedIds),
          selectedId,
          selectedSnapshot: latestCurrentRef.current.blocks.find((block) => block.id === selectedId) || null,
        })}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCopy={copySelected}
        onPaste={pasteBlock}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onToggleShortcuts={() => setShowShortcuts((v) => !v)}
        liveSyncEnabled={liveSyncEnabled}
        onToggleLiveSync={() => setLiveSyncEnabled((v) => !v)}
        extraRightSlot={<ExportImportDialog pageData={latestCurrentRef.current} onImport={importPageData} />}
      />

      <div className="editor-layout">
        <BlockSidebar blocks={blocks} selectedId={selectedId} onSelect={selectSingle} />

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
                liveSyncEnabled={liveSyncEnabled}
              />
            </SortableContext>
          </DndContext>
        </div>

        <div className={`right-panel ${mobilePanelOpen ? 'mobile-open' : 'mobile-collapsed'}`} data-testid="canvas-editor-right-panel">
          <AlignmentToolbar selectedBlock={selectedBlock} selectedIds={selectedIds} onStyleChangeForSelection={applyStyleForSelection} />
          <PropertyPanel block={selectedBlock} onChange={updateBlock} onDeselect={() => { setSelectedId(null); setSelectedIds([]); }} />
          <LayersPanel
            blocks={blocks}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={selectSingle}
            onToggleMultiSelect={toggleMultiSelect}
            onToggleVisibility={(blockId, hidden) => applyStylePatch(blockId, { display: hidden ? '' : 'none' })}
            onToggleLock={(blockId, locked) => updateBlock(blockId, { locked: !locked })}
          />
          <HistoryTimeline history={history.map((item, i) => ({ id: String(i), timestamp: Date.now() - (history.length - i) * 1000, data: item, label: i === 0 ? 'بداية التصميم' : `تعديل ${i}`, type: i === 0 ? 'initial' : 'content' }))} currentStateId={currentStateId} onJumpTo={handleJumpTo} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobilePanelOpen((v) => !v)}
        className="mobile-inspector-toggle"
        data-testid="canvas-editor-mobile-inspector-toggle"
      >
        {mobilePanelOpen ? 'إخفاء اللوحة' : 'إظهار اللوحة'}
      </button>

      {showShortcuts ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" data-testid="canvas-editor-shortcuts-modal">
          <div className="w-[min(92vw,520px)] rounded-2xl border border-white/10 bg-[#0f172a] p-5 text-white">
            <h3 className="text-sm font-bold mb-3">اختصارات لوحة المفاتيح</h3>
            <ul className="space-y-2 text-xs text-white/80" data-testid="canvas-editor-shortcuts-list">
              <li>Ctrl/Cmd + S: حفظ</li>
              <li>Ctrl/Cmd + Shift + S: نشر</li>
              <li>Ctrl/Cmd + Z / Y: تراجع / إعادة</li>
              <li>Ctrl/Cmd + C / V / D: نسخ / لصق / تكرار</li>
              <li>Delete: حذف العنصر المحدد</li>
              <li>Shift + ?: فتح/إغلاق هذه اللوحة</li>
            </ul>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setShowShortcuts(false)} className="rounded border border-white/20 px-3 py-1 text-xs" data-testid="canvas-editor-shortcuts-close-button">إغلاق</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CanvasEditor;