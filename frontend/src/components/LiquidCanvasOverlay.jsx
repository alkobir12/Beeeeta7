import React, { useEffect } from 'react';
import { Copy, Droplets, ClipboardPaste, X } from 'lucide-react';

export const LiquidCanvasOverlay = ({ active, blocks = [], selectedBlockId, onToggle, onSelectBlock, onReorder, onCopyBlock, onPasteBlock, canPaste }) => {
  useEffect(() => {
    if (!active) return undefined;

    const cleanups = [];
    blocks.forEach((block) => {
      const element = document.querySelector(`[data-testid="${block.testid}"]`);
      if (!element) return;

      const prevOutline = element.style.outline;
      const prevBoxShadow = element.style.boxShadow;
      const prevCursor = element.style.cursor;
      const prevDraggable = element.draggable;

      element.style.outline = block.testid === selectedBlockId ? '2px solid rgba(34,211,238,0.95)' : '1px dashed rgba(34,211,238,0.45)';
      element.style.boxShadow = block.testid === selectedBlockId ? '0 0 0 6px rgba(34,211,238,0.12)' : 'none';
      element.style.cursor = 'grab';
      element.draggable = true;

      const handleClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectBlock(block.testid);
      };
      const handleDragStart = (event) => event.dataTransfer.setData('text/plain', block.testid);
      const handleDragOver = (event) => event.preventDefault();
      const handleDrop = (event) => {
        event.preventDefault();
        onReorder(event.dataTransfer.getData('text/plain'), block.testid);
      };

      element.addEventListener('click', handleClick, true);
      element.addEventListener('dragstart', handleDragStart);
      element.addEventListener('dragover', handleDragOver);
      element.addEventListener('drop', handleDrop);

      cleanups.push(() => {
        element.style.outline = prevOutline;
        element.style.boxShadow = prevBoxShadow;
        element.style.cursor = prevCursor;
        element.draggable = prevDraggable;
        element.removeEventListener('click', handleClick, true);
        element.removeEventListener('dragstart', handleDragStart);
        element.removeEventListener('dragover', handleDragOver);
        element.removeEventListener('drop', handleDrop);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [active, blocks, onReorder, onSelectBlock, selectedBlockId]);

  return (
    <div className="fixed bottom-36 left-4 z-[76] flex flex-col gap-3 lg:bottom-40 lg:left-6" data-testid="liquid-canvas-overlay-controls">
      <button type="button" onClick={onToggle} className={`inline-flex h-12 items-center gap-2 rounded-[20px] border px-4 text-sm font-medium shadow-[0_18px_45px_-20px_rgba(34,211,238,0.5)] backdrop-blur-2xl transition ${active ? 'border-cyan-300/40 bg-cyan-400 text-slate-950' : 'border-cyan-300/20 bg-slate-950/90 text-cyan-50'}`} data-testid="liquid-canvas-toggle-button">
        {active ? <X size={16} /> : <Droplets size={16} />} Canvas
      </button>

      {active && selectedBlockId ? (
        <div className="rounded-[22px] border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-100 shadow-2xl shadow-black/35 backdrop-blur-2xl" data-testid="liquid-canvas-selected-block-panel">
          <p className="mb-2 text-[11px] text-slate-400">البلوك المحدد</p>
          <p className="mb-3 break-all">{selectedBlockId}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onCopyBlock(selectedBlockId)} className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2" data-testid="liquid-canvas-copy-block-button">
              <Copy size={12} /> نسخ
            </button>
            <button type="button" onClick={() => onPasteBlock(selectedBlockId)} disabled={!canPaste} className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 disabled:opacity-50" data-testid="liquid-canvas-paste-block-button">
              <ClipboardPaste size={12} /> لصق
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};