import React, { useRef, useState } from 'react';

export const ExportImportDialog = ({ pageData, onImport }) => {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);

  const templates = [
    {
      id: 'dashboard-kpi-template',
      label: 'قالب KPI Dashboard',
      data: {
        blocks: [
          { id: 'template-kpi-title', title: 'لوحة مؤشرات الأداء', content: 'ملخص سريع للأرقام المهمة', type: 'text', styles: { fontSize: '22px', fontWeight: '700' } },
          { id: 'template-kpi-card-1', title: 'إجمالي المركبات', content: '128', type: 'text', styles: { padding: '14px', borderRadius: '12px', backgroundColor: '#0f172a', color: '#ffffff' } },
          { id: 'template-kpi-card-2', title: 'مركبات تحت الصيانة', content: '34', type: 'text', styles: { padding: '14px', borderRadius: '12px', backgroundColor: '#1e293b', color: '#ffffff' } },
        ],
      },
    },
    {
      id: 'customers-list-template',
      label: 'قالب صفحة العملاء',
      data: {
        blocks: [
          { id: 'template-customers-title', title: 'إدارة العملاء', content: 'بحث، تصفية، وتحديث بيانات العملاء', type: 'text', styles: { fontSize: '20px', fontWeight: '700' } },
          { id: 'template-customers-search', title: 'حقل بحث', content: 'ابحث باسم العميل أو رقم الهاتف', type: 'text', styles: { padding: '12px', border: '1px solid #334155', borderRadius: '10px' } },
          { id: 'template-customers-table', title: 'جدول العملاء', content: 'الاسم | الهاتف | آخر زيارة | الحالة', type: 'text', styles: { padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px' } },
        ],
      },
    },
    {
      id: 'reports-template',
      label: 'قالب صفحة التقارير',
      data: {
        blocks: [
          { id: 'template-reports-title', title: 'التقارير المالية', content: 'تحليل الأداء اليومي والأسبوعي', type: 'text', styles: { fontSize: '20px', fontWeight: '700' } },
          { id: 'template-reports-chart', title: 'مخطط الإيرادات', content: 'منحنى الإيرادات الشهرية', type: 'text', styles: { padding: '16px', backgroundColor: '#0b1220', color: '#e2e8f0', borderRadius: '12px' } },
          { id: 'template-reports-summary', title: 'ملخص', content: 'صافي الدخل | المصروفات | النقد المتاح', type: 'text', styles: { padding: '14px', borderRadius: '10px', backgroundColor: '#eff6ff' } },
        ],
      },
    },
  ];

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
          <div className="mt-3 pt-2 border-t border-white/10" data-testid="template-import-section">
            <div className="text-[11px] text-cyan-200 mb-2">قوالب جاهزة</div>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => { onImport?.(template.data); setOpen(false); }}
                  className="w-full text-right rounded border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  data-testid={`template-import-button-${template.id}`}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
