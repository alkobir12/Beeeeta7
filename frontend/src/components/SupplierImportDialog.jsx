import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api/suppliers-ext';

export default function SupplierImportDialog({ open, onOpenChange, supplier, workshopId = 'finmodule-sync' }) {
  const [step, setStep]         = useState(1); // 1=رفع، 2=خريطة، 3=نتيجة
  const [headers, setHeaders]   = useState([]);
  const [preview, setPreview]   = useState([]);
  const [filename, setFilename] = useState('');
  const [mapping, setMapping]   = useState({ name_col: null, amount_col: null, date_col: null, type_col: null });
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState([]);

  const reset = () => { setStep(1); setHeaders([]); setPreview([]); setFilename(''); setResult(null); setErrors([]); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await axios.post(`${API}/import/preview`, fd);
      const d = r.data?.data || {};
      setHeaders(d.headers || []);
      setPreview(d.preview_rows || []);
      setFilename(d.filename || file.name);
      setErrors(d.errors || []);
      if (!d.errors?.length) setStep(2);
    } catch (e) {
      setErrors([e?.response?.data?.detail || 'فشل قراءة الملف']);
    } finally { setLoading(false); }
  };

  const executeImport = async () => {
    if (mapping.amount_col === null) { alert('يجب تحديد عمود المبلغ'); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/import/execute`, {
        rows: preview,
        mapping,
        supplier_name: supplier?.name || '',
        supplier_id: supplier?.id || '',
        workshop_id: workshopId,
      });
      setResult(r.data?.data);
      setStep(3);
    } catch (e) {
      alert(e?.response?.data?.detail || 'فشل الاستيراد');
    } finally { setLoading(false); }
  };

  const FIELD_LABELS = { name_col: 'اسم المورد', amount_col: 'المبلغ *', date_col: 'التاريخ', type_col: 'النوع (credit/debit)' };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>استيراد بيانات الموردين — {supplier?.name || 'عام'}</DialogTitle>
        </DialogHeader>

        {/* خطوات */}
        <div className="flex gap-0 mb-4">
          {[['1','رفع الملف'],['2','خريطة الأعمدة'],['3','النتيجة']].map(([n,l]) => (
            <div key={n} className={`flex-1 text-center py-1.5 text-xs border-b-2 transition-colors ${
              step === +n ? 'border-sky-500 text-sky-300 font-bold' : 'border-slate-700 text-slate-500'}`}>{l}</div>
          ))}
        </div>

        {/* الخطوة 1: رفع الملف */}
        {step === 1 && (
          <div className="space-y-4">
            <label className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
              loading ? 'border-slate-600 opacity-50' : 'border-sky-500/40 hover:border-sky-400'}`}
              data-testid="import-file-drop-zone">
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} disabled={loading} />
              <span className="text-3xl mb-2">📂</span>
              <span className="text-sm text-slate-300 font-medium">اسحب الملف هنا أو اضغط للاختيار</span>
              <span className="text-xs text-slate-500 mt-1">CSV, Excel (.xlsx, .xls)</span>
            </label>
            {loading && <div className="text-center text-sm text-sky-300 animate-pulse">جارٍ تحليل الملف...</div>}
            {errors.length > 0 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 space-y-1">
                {errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* الخطوة 2: خريطة الأعمدة */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400 mb-2">
              ملف: <span className="text-slate-200 font-medium">{filename}</span> —
              عدد الأعمدة: {headers.length} — معاينة: {preview.length} صف
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <select value={mapping[field] ?? ''}
                    onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value === '' ? null : +e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                    data-testid={`import-mapping-${field}`}>
                    <option value="">— اختر عمود —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `العمود ${i+1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {/* معاينة */}
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-[10px]">
                <thead><tr>{headers.map((h,i) => (
                  <th key={i} className="bg-slate-800 px-2 py-1.5 text-slate-300 whitespace-nowrap">{h||`col${i}`}</th>
                ))}</tr></thead>
                <tbody>{preview.slice(0,5).map((row,i) => (
                  <tr key={i} className="border-t border-slate-800">{row.map((cell,j) => (
                    <td key={j} className="px-2 py-1 text-slate-400 whitespace-nowrap max-w-[100px] truncate">{cell}</td>
                  ))}</tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* الخطوة 3: النتيجة */}
        {step === 3 && result && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center">
                <div className="text-2xl font-bold text-green-300">{result.imported}</div>
                <div className="text-xs text-slate-400 mt-1">صف نجح</div>
              </div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center">
                <div className="text-2xl font-bold text-red-300">{result.failed}</div>
                <div className="text-xs text-slate-400 mt-1">صف فشل</div>
              </div>
            </div>
            {result.failed_rows?.length > 0 && (
              <div className="rounded-lg bg-red-500/8 border border-red-500/20 p-3 space-y-1">
                <div className="text-xs font-bold text-red-300">أخطاء:</div>
                {result.failed_rows.map((f, i) => (
                  <div key={i} className="text-[10px] text-red-400">صف {f.row}: {f.error}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2 gap-2">
          {step === 2 && (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>رجوع</Button>
              <Button onClick={executeImport} disabled={mapping.amount_col === null || loading}
                className="bg-sky-600 hover:bg-sky-700 text-white"
                data-testid="import-execute-btn">
                {loading ? 'جارٍ الاستيراد...' : `استيراد (${preview.length} صف)`}
              </Button>
            </>
          )}
          {step === 3 && <Button onClick={reset} className="bg-sky-600 hover:bg-sky-700 text-white">استيراد آخر</Button>}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
