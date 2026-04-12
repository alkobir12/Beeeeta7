import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Copy, GripVertical, Link2, PencilLine, Save, Undo2, Redo2, Settings2, Trash2, X, ClipboardPaste } from 'lucide-react';

export const LiquidCanvasOverlay = ({
  active,
  blocks = [],
  selectedBlockId,
  onToggle,
  onSelectBlock,
  onReorder,
  onCopyBlock,
  onPasteBlock,
  canPaste,
  positions = {},
  onPositionChange,
  onInlineEdit,
  onHideBlock,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  availableSources = [],
  onBindBlock,
  onOpenBuilder,
}) => {
  const [rects, setRects] = useState([]);
  const [bindTarget, setBindTarget] = useState('');

  const selectedBlock = useMemo(() => blocks.find((block) => block.testid === selectedBlockId) || null, [blocks, selectedBlockId]);

  useEffect(() => {
    if (!active) {
      setRects([]);
      return undefined;
    }

    const computeRects = () => {
      const nextRects = blocks.map((block) => {
        const element = document.querySelector(`[data-testid="${block.testid}"]`);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          testid: block.testid,
          rect,
          text: block.text,
        };
      }).filter(Boolean);
      setRects(nextRects);
    };

    computeRects();
    window.addEventListener('scroll', computeRects, true);
    window.addEventListener('resize', computeRects);
    const timer = window.setInterval(computeRects, 900);
    return () => {
      window.removeEventListener('scroll', computeRects, true);
      window.removeEventListener('resize', computeRects);
      window.clearInterval(timer);
    };
  }, [active, blocks]);

  useEffect(() => {
    setBindTarget('');
  }, [selectedBlockId]);

  if (!active) {
    return (
      <div className="fixed bottom-36 left-4 z-[76] lg:bottom-40 lg:left-6" data-testid="liquid-canvas-overlay-controls">
        <button type="button" onClick={onToggle} className="inline-flex h-12 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-4 text-sm font-semibold text-zinc-900 shadow-xl shadow-black/10 backdrop-blur-xl" data-testid="liquid-canvas-toggle-button">
          <Settings2 size={16} className="text-cyan-600" /> Canvas
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[76]" data-testid="liquid-canvas-overlay-controls">
      {rects.map((item, index) => {
        const selected = item.testid === selectedBlockId;
        return (
          <div
            key={item.testid}
            className="pointer-events-auto fixed"
            style={{ top: Math.max(8, item.rect.top - 18), left: Math.max(8, item.rect.left + 8) }}
            data-testid={`liquid-canvas-handle-${index}`}
          >
            <button
              type="button"
              onClick={() => onSelectBlock(item.testid)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] shadow-lg backdrop-blur-xl ${selected ? 'border-cyan-300 bg-cyan-400 text-zinc-950' : 'border-zinc-200 bg-white/90 text-zinc-700'}`}
            >
              <GripVertical size={12} />
              <span className="max-w-[120px] truncate">{item.text || 'بلوك'}</span>
            </button>
          </div>
        );
      })}

      <div className="pointer-events-auto fixed bottom-24 left-1/2 z-[77] flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-3 shadow-2xl shadow-black/15 backdrop-blur-2xl" data-testid="liquid-canvas-bottom-toolbar">
        <button type="button" onClick={onUndo} disabled={!canUndo} className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 disabled:opacity-40" data-testid="liquid-canvas-undo-button"><Undo2 size={14} /></button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 disabled:opacity-40" data-testid="liquid-canvas-redo-button"><Redo2 size={14} /></button>
        <button type="button" onClick={onOpenBuilder} className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700" data-testid="liquid-canvas-open-builder-button">اللوحة</button>
        <button type="button" onClick={onSave} className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950" data-testid="liquid-canvas-save-button"><Save size={14} /> حفظ</button>
        <button type="button" onClick={onToggle} className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700" data-testid="liquid-canvas-close-button">إغلاق</button>
      </div>

      {selectedBlock ? (
        <div className="pointer-events-auto fixed right-4 top-4 z-[77] w-[min(92vw,360px)] rounded-[28px] border border-zinc-200 bg-white/95 p-4 shadow-2xl shadow-black/15 backdrop-blur-2xl" data-testid="liquid-canvas-selected-block-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">البلوك المحدد</p>
              <p className="mt-1 text-xs text-zinc-500">{selectedBlock.text || selectedBlock.testid}</p>
            </div>
            <button type="button" onClick={() => onSelectBlock('')} className="rounded-full border border-zinc-200 p-2 text-zinc-600">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onCopyBlock(selectedBlock.testid)} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-700" data-testid="liquid-canvas-copy-block-button"><Copy size={13} className="mx-auto mb-1" />نسخ</button>
            <button type="button" onClick={() => onPasteBlock(selectedBlock.testid)} disabled={!canPaste} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-700 disabled:opacity-40" data-testid="liquid-canvas-paste-block-button"><ClipboardPaste size={13} className="mx-auto mb-1" />لصق</button>
            <button type="button" onClick={() => onHideBlock(selectedBlock.testid)} className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700" data-testid="liquid-canvas-hide-block-button"><Trash2 size={13} className="mx-auto mb-1" />إخفاء</button>
          </div>

          <div className="mt-3 rounded-[20px] border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="mb-2 font-medium text-zinc-800">التعديل الحي</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onInlineEdit(selectedBlock.testid, selectedBlock.text || '')} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700" data-testid="liquid-canvas-inline-edit-button"><PencilLine size={12} className="inline ml-1" />تعديل النص</button>
              <button type="button" onClick={() => onPositionChange(selectedBlock.testid, positions?.[selectedBlock.testid] || { left: 0, top: 0 })} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700" data-testid="liquid-canvas-move-block-button"><ArrowUpRight size={12} className="inline ml-1" />حرّك بالسحب</button>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border border-zinc-200 bg-zinc-50 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-800">ربط هذا البلوك</p>
            <div className="flex gap-2">
              <select value={bindTarget} onChange={(event) => setBindTarget(event.target.value)} className="flex-1 rounded-[16px] border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 outline-none" data-testid="liquid-canvas-bind-select">
                <option value="">اختر مصدرًا...</option>
                {availableSources.slice(0, 40).map((source, index) => <option key={`${source.testid}-${index}`} value={source.testid}>{source.text || source.testid}</option>)}
              </select>
              <button type="button" onClick={() => bindTarget && onBindBlock(selectedBlock.testid, bindTarget)} className="rounded-[16px] bg-violet-600 px-4 py-2 text-xs font-semibold text-white" data-testid="liquid-canvas-bind-button"><Link2 size={12} className="inline ml-1" />ربط</button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">يمكنك أيضًا الضغط مرتين على أي بلوك لتعديل نصه مباشرة، أو سحب البلوك مع الضغط على Alt لتحريكه.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};