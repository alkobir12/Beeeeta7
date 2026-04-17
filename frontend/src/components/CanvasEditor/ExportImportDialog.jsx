import React, { useRef, useState } from 'react';

export const ExportImportDialog = ({ pageData, onImport }) => {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(pageData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `moltbot-${pageData?.id || 'page'}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportHtml = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${pageData?.name || 'MoltBot Export'}</title></head><body>${(pageData?.blocks || []).map((b) => `<section data-testid="${b.id}"><h3>${b.title || ''}</h3><div>${b.content || ''}</div></section>`).join('')}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `moltbot-${pageData?.id || 'page'}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const triggerImport = () => fileInputRef.current?.click();

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      onImport?.(parsed);
      setOpen(false);
    } catch (_error) {
      // silent fail; handled by parent toast if needed
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="relative" data-testid="export-import-root">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded border border-white/15 bg-white/5 px-3 py-1 text-xs" data-testid="export-import-toggle-button">
        تصدير / استيراد
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onFileChange} data-testid="export-import-file-input" />
      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#0c1324] p-3 shadow-2xl z-30" data-testid="export-import-menu">
          <button type="button" onClick={exportJson} className="w-full text-right rounded border border-white/15 bg-white/5 px-3 py-2 text-xs mb-2" data-testid="export-json-button">تصدير JSON</button>
          <button type="button" onClick={exportHtml} className="w-full text-right rounded border border-white/15 bg-white/5 px-3 py-2 text-xs mb-2" data-testid="export-html-button">تصدير HTML</button>
          <button type="button" onClick={triggerImport} className="w-full text-right rounded border border-white/15 bg-white/5 px-3 py-2 text-xs" data-testid="import-json-button">استيراد JSON</button>
        </div>
      ) : null}
    </div>
  );
};
