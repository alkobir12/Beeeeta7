import React, { useEffect, useRef, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

// A4 canvas size approx at 96dpi
const A4_WIDTH = 794; // px
const A4_HEIGHT = 1123; // px

const defaultPage = { size: 'A4', orientation: 'portrait', bg: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' };

const makeId = () => Math.random().toString(36).slice(2, 9);

const defaultNewElement = (type) => {
  const id = makeId();
  if (type === 'text') return { id, type, name: `نص ${id}`, x: 40, y: 60, w: 300, h: 40, text: 'نص تجريبي', fontSize: 18, bold: false, align: 'right', color: '#111827', rtl: true };
  if (type === 'image') return { id, type, name: `صورة ${id}`, x: 40, y: 20, w: 140, h: 60, src: '', fit: 'contain' };
  if (type === 'itemsTable') return { id, type, name: `جدول البنود ${id}`, x: 30, y: 200, w: 730, h: 240, headerBg: '#f1f5f9', headerColor: '#0f172a', cols: [
    { key: 'description', label: 'الوصف', w: 360 },
    { key: 'qty', label: 'الكمية', w: 80 },
    { key: 'price', label: 'سعر الوحدة', w: 120 },
    { key: 'total', label: 'الإجمالي', w: 120 },
  ], itemsBinding: 'ITEMS' };
  if (type === 'line') return { id, type, name: `خط ${id}`, x: 30, y: 160, w: 730, h: 2, color: '#e2e8f0' };
  if (type === 'note') return { id, type, name: `ملاحظة ${id}`, x: 30, y: 460, w: 730, h: 80, text: 'ملاحظات:', fontSize: 14, color: '#374151' };
  return { id, type, name: `${type} ${id}`, x: 40, y: 40, w: 200, h: 40 };
};

const hitTest = (e, rect) => {
  const x = e.nativeEvent.offsetX;
  const y = e.nativeEvent.offsetY;
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
};

const InvoiceTemplateStudio = () => {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [grid, setGrid] = useState([]);
  const [mapping, setMapping] = useState({ WORKSHOP_NAME: '', CUSTOMER_NAME: '', VEHICLE_PLATE: '', TOTAL: '' });
  const [itemsConfig, setItemsConfig] = useState({ anchor: '{{ITEMS}}', columns: { description: '', qty: '', price: '', total: '' } });
  const [importUrl, setImportUrl] = useState('');
  const fileRef = useRef();

  // Designer state
  const [tab, setTab] = useState('studio'); // studio | designer
  const [elements, setElements] = useState([]); // absolute elements on canvas
  const [schema, setSchema] = useState([]); // DB fields: [{name,type}]
  const [page, setPage] = useState(defaultPage);
  const [selectedElId, setSelectedElId] = useState(null);
  const [dragging, setDragging] = useState(null); // {id, dx, dy, startX, startY}
  const canvasRef = useRef();
  const [zoom, setZoom] = useState(1);

  useEffect(()=>{ loadTemplates(); },[]);

  useEffect(()=>{
    if (selected) {
      // hydrate designer from selected
      setElements(selected.elements || []);
      setSchema(selected.schema || []);
      setPage(selected.page || defaultPage);
      setGrid((selected.preview || []).map(r => r.map(c => (c === null || c === undefined) ? '' : String(c))));
    }
  }, [selected?.id]);

  const loadTemplates = async () => {
    try{
      const res = await axios.get(`${API_URL}/invoice-templates`);
      setTemplates(res.data || []);
    }catch(e){ console.error(e); }
  };

  const importFromUrl = async () => {
    if(!importUrl) return;
    try{
      const res = await axios.post(`${API_URL}/invoice-templates/import-url`, { url: importUrl });
      await loadTemplates();
      setSelected(res.data);
    }catch(e){ alert('فشل الاستيراد من الرابط'); }
  };

  const createBlank = async () => {
    const res = await axios.post(`${API_URL}/invoice-templates/create-blank`, { name: 'قالب فارغ' });
    await loadTemplates();
    setSelected(res.data);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post(`${API_URL}/invoice-templates/import`, form, { headers:{'Content-Type':'multipart/form-data'} });
    await loadTemplates();
    setSelected(res.data);
  };

  const handleSelect = async (tpl) => {
    setSelected(tpl);
  };

  const addRow = () => setGrid([...grid, Array(grid[0]?.length || 10).fill('')]);
  const addCol = () => setGrid(grid.map(r => [...r, '']));

  const saveGrid = async () => {
    if(!selected) return;
    await axios.post(`${API_URL}/invoice-templates/${selected.id}/save-json`, { grid, mapping, items: itemsConfig });
    await axios.post(`${API_URL}/invoice-templates/${selected.id}/auto-save`, { grid, mapping, itemsConfig });
    alert('تم الحفظ وإنشاء/تحديث نموذج "فاتوره" تلقائياً');
  };

  // ---------- Apply design to grid ----------
  const applyDesignToGrid = async () => {
    if (!selected) return;
    // heuristic cell size
    const cellW = 100; // px per col
    const cellH = 32;  // px per row
    let g = grid && grid.length ? grid.map(r => [...r]) : [];
    const ensureSize = (rows, cols) => {
      const curRows = g.length;
      const curCols = g[0]?.length || 0;
      for (let r=curRows; r<rows; r++) g.push(Array(Math.max(cols, curCols||10)).fill(''));
      for (let r=0; r<g.length; r++) {
        for (let c=g[r].length; c<cols; c++) g[r].push('');
      }
    };
    // place text bindings
    elements.forEach(el => {
      if (el.type === 'text') {
        const r = Math.max(0, Math.round(el.y / cellH));
        const c = Math.max(0, Math.round(el.x / cellW));
        ensureSize(r+1, c+1);
        const val = el.binding ? `{{${el.binding}}}` : (el.text || '');
        g[r][c] = val;
      }
    });
    // ensure items anchor and template row for itemsTable
    const table = elements.find(e => e.type==='itemsTable');
    if (table) {
      const r = Math.max(0, Math.round(table.y / cellH));
      const c = Math.max(0, Math.round(table.x / cellW));
      const colsCount = Math.max(4, table.cols?.length || 4);
      ensureSize(r+2, c+colsCount);
      // anchor
      g[r][c] = '{{ITEMS}}';
      // template row values
      const tRow = r+1;
      for (let i=0; i<colsCount; i++) {
        const col = table.cols?.[i];
        const key = col?.key || `col${i+1}`;
        g[tRow][c+i] = `{{ITEMS.${key}}}`;
      }
    }
    setGrid(g);
    try{
      await axios.post(`${API_URL}/invoice-templates/${selected.id}/save-json`, { grid: g, mapping, items: itemsConfig });
      await axios.post(`${API_URL}/invoice-templates/${selected.id}/auto-save`, { grid: g, mapping, itemsConfig, elements, schema, page });
      alert('تم تطبيق التصميم على الشبكة وحفظه');
    }catch(e){ alert('تعذر تطبيق التصميم على الشبكة'); }
  };

  const saveMapping = async () => {
    if(!selected) return;
    await axios.post(`${API_URL}/invoice-templates/${selected.id}/update-mapping`, { mapping, items: itemsConfig });
    alert('تم حفظ الربط والحقول');
  };

  const saveAsNamed = async () => {
    if(!selected) return;
    const name = window.prompt('أدخل اسم الفاتورة الجديدة', 'فاتوره');
    if(!name) return;
    const sample = {
      WORKSHOP_NAME: mapping.WORKSHOP_NAME || 'ورشة الخليج',
      CUSTOMER_NAME: mapping.CUSTOMER_NAME || 'عميل',
      VEHICLE_PLATE: mapping.VEHICLE_PLATE || 'س ع د 1234',
      TOTAL: mapping.TOTAL || '0.00',
      ITEMS: [ { description:'-', qty: 1, price: 0, total: 0 } ]
    };
    const res = await axios.post(`${API_URL}/invoice-templates/${selected.id}/save-named`, {
      name,
      grid,
      mapping,
      itemsConfig,
      elements,
      schema,
      page,
      data: sample
    });
    await loadTemplates();
    setSelected(res.data);
    alert('تم إنشاء وحفظ قالب جديد بالاسم المحدد');
  };

  const downloadFilled = async () => {
    if(!selected) return;
    const data = {
      WORKSHOP_NAME: 'ورشة الخليج',
      CUSTOMER_NAME: 'عميل تجريبي',
      VEHICLE_PLATE: 'س ع د 1234',
      TOTAL: '1500.00',
      ITEMS: [
        { description: 'زيت محرك', qty: 1, price: 200, total: 200 },
        { description: 'فلتر زيت', qty: 1, price: 50, total: 50 }
      ]
    };
    const resp = await fetch(`${API_URL}/print/invoice-xlsx`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ templateId: selected.id, data }) });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'invoice.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Designer: elements ops ----------
  const addElement = (type) => {
    const el = defaultNewElement(type);
    setElements(prev => [...prev, el]);
    setSelectedElId(el.id);
    autoSaveDebounced({ elements: [...elements, el] });
  };

  const removeElement = (id) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedElId === id) setSelectedElId(null);
    autoSaveDebounced({ elements: elements.filter(e => e.id !== id) });
  };

  const updateElement = (id, patch) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    autoSaveDebounced({ elements: elements.map(e => e.id === id ? { ...e, ...patch } : e) });
  };

  const moveLayer = (id, dir) => {
    setElements(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx === -1) return prev;
      const arr = [...prev];
      const swapWith = dir === 'up' ? Math.max(0, idx - 1) : Math.min(prev.length - 1, idx + 1);
      [arr[idx], arr[swapWith]] = [arr[swapWith], arr[idx]];
      autoSaveDebounced({ elements: arr });
      return arr;
    });
  };

  // ---------- Auto save (debounced) ----------
  const debounceRef = useRef();
  const autoSaveDebounced = (partial={}) => {
    if (!selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const payload = { elements, schema, page, ...partial };
    debounceRef.current = setTimeout(async ()=>{
      try{
        await axios.post(`${API_URL}/invoice-templates/${selected.id}/auto-save`, payload);
      }catch(e){ /* silent */ }
    }, 600);
  };

  // ---------- Canvas interactions ----------
  const onCanvasMouseDown = (e) => {
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - bounds.left) / zoom;
    const cy = (e.clientY - bounds.top) / zoom;
    // check topmost element
    const rev = [...elements].reverse();
    const found = rev.find(el => cx >= el.x && cx <= el.x + el.w && cy >= el.y && cy <= el.y + el.h);
    if (found) {
      setSelectedElId(found.id);
      setDragging({ id: found.id, startX: cx, startY: cy, ox: found.x, oy: found.y });
    } else {
      setSelectedElId(null);
    }
  };
  const onCanvasMouseMove = (e) => {
    if (!dragging || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - bounds.left) / zoom;
    const cy = (e.clientY - bounds.top) / zoom;
    const dx = cx - dragging.startX;
    const dy = cy - dragging.startY;
    updateElement(dragging.id, { x: Math.max(0, Math.min(A4_WIDTH-10, Math.round(dragging.ox + dx))), y: Math.max(0, Math.min(A4_HEIGHT-10, Math.round(dragging.oy + dy))) });
  };
  const onCanvasMouseUp = () => setDragging(null);

  // ---------- Properties panel helpers ----------
  const selEl = useMemo(()=> elements.find(e => e.id === selectedElId) || null, [selectedElId, elements]);

  const cleanupEmpty = async (purge=false) => {
    const r = await axios.post(`${API_URL}/invoice-templates/cleanup-empty?purge=${purge}`);
    alert(`تمت العملية. مؤرشف: ${r.data.archived}، محذوف: ${r.data.deleted}`);
    await loadTemplates();
  };

  return (
    <Layout>
      <div className="container mx-auto p-6" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">استوديو قوالب الفواتير (Excel)</h1>
            {selected && (
              <div className="mt-1 text-sm">
                <span className={`px-2 py-1 rounded ${selected.isDefault ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {selected.isDefault ? 'القالب الافتراضي' : 'قالب عادي'}
                </span>
                <span className="mx-2 text-slate-400">•</span>
                <span className="text-slate-500">الصيغة: {selected.format?.toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <label>
              <Button asChild className="bg-green-600 hover:bg-green-700 cursor-pointer"><span>استيراد قالب</span></Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.html,.htm,.docx,.pdf" className="hidden" onChange={handleImport} />
            </label>
            <div className="flex items-center gap-2">
              <Input value={importUrl} onChange={e=>setImportUrl(e.target.value)} placeholder="أدخل رابط نموذج للاستيراد" className="w-72" />
              <Button onClick={importFromUrl} variant="outline">استيراد من رابط</Button>
              <Button onClick={createBlank} variant="outline">قالب فارغ</Button>
              <Button onClick={()=>cleanupEmpty(false)} variant="outline">تنظيف النماذج الخالية</Button>
            </div>
            <Button onClick={saveGrid} className="bg-blue-600 hover:bg-blue-700">حفظ كـ Excel</Button>
            <Button onClick={saveMapping} className="bg-purple-600 hover:bg-purple-700">حفظ الربط</Button>
            <Button onClick={saveAsNamed} className="bg-amber-600 hover:bg-amber-700">حفظ باسم فاتوره</Button>
            <Button onClick={downloadFilled} className="bg-emerald-600 hover:bg-emerald-700">توليد فاتورة</Button>
          </div>
        </div>

        <Tabs defaultValue="designer" value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="designer">مصمم A4</TabsTrigger>
            <TabsTrigger value="studio">محرر الشبكة</TabsTrigger>
          </TabsList>

          {/* Designer A4 */}
          <TabsContent value="designer">
            {!selected && (
              <Card className="mb-6"><CardContent className="p-4 text-slate-600">اختر قالبًا أو أنشئ قالبًا فارغًا للبدء.</CardContent></Card>
            )}
            {selected && (
              <div className="grid grid-cols-12 gap-4">
                {/* Left palette */}
                <div className="col-span-3">
                  <Card className="bg-gradient-to-b from-slate-50 to-white">
                    <CardHeader><CardTitle>العناصر المتاحة</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={()=>addElement('text')}>نص</Button>
                        <Button variant="outline" onClick={()=>addElement('image')}>صورة/شعار</Button>
                        <Button variant="outline" onClick={()=>addElement('itemsTable')}>جدول البنود</Button>
                        <Button variant="outline" onClick={()=>addElement('line')}>خط فاصل</Button>
                        <Button variant="outline" onClick={()=>addElement('note')}>ملاحظة</Button>
                      </div>
                      <div className="mt-4">
                        <Label className="block mb-2">حقول القالب (قاعدة البيانات)</Label>
                        <div className="space-y-2 max-h-40 overflow-auto">
                          {schema.map((f, i)=> (
                            <div key={i} className="flex items-center gap-2">
                              <Input value={f.name} onChange={(e)=>{ const s=[...schema]; s[i]={...s[i], name:e.target.value}; setSchema(s); autoSaveDebounced({schema:s}); }} className="flex-1" />
                              <select className="border rounded px-2 py-1 text-sm" value={f.type} onChange={(e)=>{ const s=[...schema]; s[i]={...s[i], type:e.target.value}; setSchema(s); autoSaveDebounced({schema:s}); }}>
                                <option value="text">نص</option>
                                <option value="number">رقم</option>
                                <option value="date">تاريخ</option>
                              </select>
                              <Button size="sm" variant="destructive" onClick={()=>{ const s=schema.filter((_,idx)=>idx!==i); setSchema(s); autoSaveDebounced({schema:s}); }}>حذف</Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={()=>{ const s=[...schema, {name:`FIELD_${schema.length+1}`, type:'text'}]; setSchema(s); autoSaveDebounced({schema:s}); }}>+ حقل</Button>
                          <Button size="sm" variant="outline" onClick={async ()=>{ await axios.post(`${API_URL}/invoice-templates/${selected.id}/design`, { elements, schema, page }); alert('تم حفظ التصميم'); }}>حفظ التصميم</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Canvas */}
                <div className="col-span-6">
                  <Card className="overflow-hidden">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>لوح A4</span>
                        <div className="flex items-center gap-2">
                          <Label>تكبير</Label>
                          <input type="range" min="0.6" max="1.4" step="0.05" value={zoom} onChange={(e)=>setZoom(parseFloat(e.target.value))} />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full flex justify-center">
                        <div
                          ref={canvasRef}
                          onMouseDown={onCanvasMouseDown}
                          onMouseMove={onCanvasMouseMove}
                          onMouseUp={onCanvasMouseUp}
                          className="relative shadow-2xl border bg-white"
                          style={{ width: A4_WIDTH*zoom, height: A4_HEIGHT*zoom, background: page.bg, transformOrigin:'top left' }}
                        >
                          {/* Grid pattern */}
                          <div className="absolute inset-0" style={{ backgroundImage:'linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)', backgroundSize:`20px 20px` }} />
                          {/* Elements */}
                          {elements.map(el => (
                            <div key={el.id}
                              className={`absolute ${selectedElId===el.id? 'ring-2 ring-blue-500': 'ring-1 ring-slate-200'}`}
                              style={{ left: el.x*zoom, top: el.y*zoom, width: el.w*zoom, height: el.h*zoom, background: el.type==='note'? '#fff' : 'transparent' }}
                              onMouseDown={(e)=>{ e.stopPropagation(); setSelectedElId(el.id); }}
                            >
                              {el.type==='text' && (
                                <div className="w-full h-full p-2" style={{ color: el.color, fontWeight: el.bold? '700':'400', fontSize: (el.fontSize||16)*zoom, textAlign: el.align||'right', direction: el.rtl? 'rtl':'ltr' }}>
                                  {el.text || 'نص'}
                                </div>
                              )}
                              {el.type==='image' && (
                                <div className="w-full h-full bg-white/40 flex items-center justify-center">
                                  {el.src? (<img alt="img" src={el.src} className="w-full h-full object-contain" />) : (<span className="text-xs text-slate-500">صورة</span>)}
                                </div>
                              )}
                              {el.type==='itemsTable' && (
                                <div className="w-full h-full bg-white">
                                  <div className="flex w-full" style={{ background: el.headerBg}}>
                                    {el.cols.map((c,idx)=> (
                                      <div key={idx} className="px-2 py-1 text-xs font-semibold" style={{ width: c.w*zoom, color: el.headerColor}}>{c.label}</div>
                                    ))}
                                  </div>
                                  <div className="p-2 text-xs text-slate-600">مصدر البنود: {{}}{el.itemsBinding}</div>
                                </div>
                              )}
                              {el.type==='line' && (
                                <div className="w-full h-full" style={{ background: el.color }} />
                              )}
                              {el.type==='note' && (
                                <div className="w-full h-full p-2 text-sm" style={{ color: el.color }}>{el.text}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right properties / layers */}
                <div className="col-span-3 space-y-4">
                  <Card>
                    <CardHeader><CardTitle>خصائص العنصر</CardTitle></CardHeader>
                    <CardContent>
                      {!selEl && <div className="text-slate-500 text-sm">حدّد عنصراً من اللوح</div>}
                      {selEl && (
                        <div className="space-y-2">
                          <Input value={selEl.name||''} onChange={(e)=>updateElement(selEl.id, { name: e.target.value })} placeholder="اسم العنصر" />
                          <div className="grid grid-cols-4 gap-2">
                            <div><Label>X</Label><Input type="number" value={selEl.x} onChange={(e)=>updateElement(selEl.id, { x: parseInt(e.target.value||0) })} /></div>
                            <div><Label>Y</Label><Input type="number" value={selEl.y} onChange={(e)=>updateElement(selEl.id, { y: parseInt(e.target.value||0) })} /></div>
                            <div><Label>W</Label><Input type="number" value={selEl.w} onChange={(e)=>updateElement(selEl.id, { w: parseInt(e.target.value||0) })} /></div>
                            <div><Label>H</Label><Input type="number" value={selEl.h} onChange={(e)=>updateElement(selEl.id, { h: parseInt(e.target.value||0) })} /></div>
                          </div>
                          {selEl.type==='text' && (
                            <>
                              <Textarea value={selEl.text||''} onChange={(e)=>updateElement(selEl.id,{text:e.target.value})} placeholder="النص" />
                              <div className="grid grid-cols-3 gap-2">
                                <div><Label>حجم</Label><Input type="number" value={selEl.fontSize||16} onChange={(e)=>updateElement(selEl.id,{fontSize:parseInt(e.target.value||16)})} /></div>
                                <div><Label>محاذاة</Label>
                                  <select className="border rounded px-2 py-1 w-full" value={selEl.align||'right'} onChange={(e)=>updateElement(selEl.id,{align:e.target.value})}>
                                    <option value="right">يمين</option>
                                    <option value="center">وسط</option>
                                    <option value="left">يسار</option>
                                  </select>
                                </div>
                                <div><Label>لون</Label><Input type="color" value={selEl.color||'#111827'} onChange={(e)=>updateElement(selEl.id,{color:e.target.value})} /></div>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!selEl.bold} onChange={(e)=>updateElement(selEl.id,{bold:e.target.checked})} />عريض</label>
                                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!selEl.rtl} onChange={(e)=>updateElement(selEl.id,{rtl:e.target.checked})} />RTL</label>
                              </div>
                              <div>
                                <Label>ربط بحقل</Label>
                                <select className="border rounded px-2 py-1 w-full" value={selEl.binding||''} onChange={(e)=>updateElement(selEl.id,{binding:e.target.value})}>
                                  <option value="">— غير مربوط —</option>
                                  {schema.map((f,i)=>(<option key={i} value={f.name}>{`{{${f.name}}}`}</option>))}
                                  <option value="CUSTOMER_NAME">{{`{{CUSTOMER_NAME}}`}}</option>
                                  <option value="VEHICLE_PLATE">{{`{{VEHICLE_PLATE}}`}}</option>
                                  <option value="INVOICE_NO">{{`{{INVOICE_NO}}`}}</option>
                                  <option value="DATE">{{`{{DATE}}`}}</option>
                                  <option value="TOTAL">{{`{{TOTAL}}`}}</option>
                                </select>
                              </div>
                            </>
                          )}
                          {selEl.type==='image' && (
                            <>
                              <Label>رابط الصورة/الشعار</Label>
                              <Input value={selEl.src||''} onChange={(e)=>updateElement(selEl.id,{src:e.target.value})} placeholder="https://..." />
                            </>
                          )}
                          {selEl.type==='itemsTable' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div><Label>لون الهيدر</Label><Input type="color" value={selEl.headerBg||'#f1f5f9'} onChange={(e)=>updateElement(selEl.id,{headerBg:e.target.value})} /></div>
                                <div><Label>لون النص</Label><Input type="color" value={selEl.headerColor||'#0f172a'} onChange={(e)=>updateElement(selEl.id,{headerColor:e.target.value})} /></div>
                              </div>
                              <div className="mt-2 space-y-1">
                                <Label>الأعمدة</Label>
                                {selEl.cols?.map((c,idx)=> (
                                  <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                                    <Input className="col-span-3" value={c.label} onChange={(e)=>{
                                      const cols=[...selEl.cols]; cols[idx]={...cols[idx], label:e.target.value}; updateElement(selEl.id,{cols});
                                    }} />
                                    <Input className="col-span-2" value={c.key} onChange={(e)=>{ const cols=[...selEl.cols]; cols[idx]={...cols[idx], key:e.target.value}; updateElement(selEl.id,{cols}); }} />
                                    <Input className="col-span-2" type="number" value={c.w} onChange={(e)=>{ const cols=[...selEl.cols]; cols[idx]={...cols[idx], w: parseInt(e.target.value||60)}; updateElement(selEl.id,{cols}); }} />
                                  </div>
                                ))}
                                <Button size="sm" onClick={()=>{ updateElement(selEl.id,{ cols:[...selEl.cols,{key:`col${selEl.cols.length+1}`,label:'عمود',w:80}] }); }}>+ عمود</Button>
                              </div>
                              <div className="mt-2">
                                <Label>مصدر العناصر</Label>
                                <Input value={selEl.itemsBinding||'ITEMS'} onChange={(e)=>updateElement(selEl.id,{itemsBinding:e.target.value})} />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>العناصر المضافة</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {elements.length===0 && <div className="text-slate-500 text-sm">لا توجد عناصر.</div>}
                      {elements.map(el => (
                        <div key={el.id} className={`p-2 border rounded flex items-center justify-between ${selectedElId===el.id? 'bg-blue-50 border-blue-300':'bg-white'}`}>
                          <div className="truncate" onClick={()=>setSelectedElId(el.id)}>{el.name || `${el.type} (${el.id})`}</div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={()=>moveLayer(el.id,'up')}>↑</Button>
                            <Button size="sm" variant="outline" onClick={()=>moveLayer(el.id,'down')}>↓</Button>
                            <Button size="sm" variant="destructive" onClick={()=>removeElement(el.id)}>حذف</Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Grid editor */}
          <TabsContent value="studio">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle>القوالب</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[60vh] overflow-auto">
                    {templates.map(t => (
                      <div key={t.id} className={`p-3 border rounded cursor-pointer ${selected?.id===t.id?'bg-blue-50 border-blue-300':'hover:bg-slate-50'}`} onClick={()=>handleSelect(t)}>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.format?.toUpperCase()} • {t.fields?.length||0} حقول</div>
                      </div>
                    ))}
                    {templates.length===0 && (
                      <div className="text-sm text-slate-500">لا توجد قوالب بعد، قم بالاستيراد أولاً.</div>
                    )}
                    {templates.length>0 && (
                      <div className="mt-4 text-right">
                        <Button variant="destructive" onClick={async ()=>{ if(!selected){ alert('اختر قالباً أولاً'); return; } const mode = window.prompt('اكتب soft للأرشفة أو hard للحذف النهائي', 'soft'); if(!mode) return; try{ if(mode==='hard'){ await axios.delete(`${API_URL}/invoice-templates/${selected.id}/hard`);} else { await axios.delete(`${API_URL}/invoice-templates/${selected.id}`);} setSelected(null); await loadTemplates(); } catch(e){ alert(e?.response?.data?.detail || 'تعذر تنفيذ الحذف'); } }}>حذف القالب المحدد</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>إعدادات الحقول وربط البنود</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>WORKSHOP_NAME</Label>
                      <Input value={mapping.WORKSHOP_NAME} onChange={e=>setMapping({...mapping, WORKSHOP_NAME: e.target.value})} placeholder="A1 أو {{WORKSHOP_NAME}}" />
                    </div>
                    <div>
                      <Label>CUSTOMER_NAME</Label>
                      <Input value={mapping.CUSTOMER_NAME} onChange={e=>setMapping({...mapping, CUSTOMER_NAME: e.target.value})} placeholder="B3 أو {{CUSTOMER_NAME}}" />
                    </div>
                    <div>
                      <Label>VEHICLE_PLATE</Label>
                      <Input value={mapping.VEHICLE_PLATE} onChange={e=>setMapping({...mapping, VEHICLE_PLATE: e.target.value})} placeholder="C5 أو {{VEHICLE_PLATE}}" />
                    </div>
                    <div>
                      <Label>TOTAL</Label>
                      <Input value={mapping.TOTAL} onChange={e=>setMapping({...mapping, TOTAL: e.target.value})} placeholder="E10 أو {{TOTAL}}" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>مرساة البنود (صف يحتوي {'{{ITEMS}}'})</Label>
                    <Input value={itemsConfig.anchor} onChange={e=>setItemsConfig({...itemsConfig, anchor: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <Label>عمود الوصف</Label>
                      <Input value={itemsConfig.columns.description} onChange={e=>setItemsConfig({...itemsConfig, columns:{...itemsConfig.columns, description: e.target.value}})} placeholder="مثل D" />
                    </div>
                    <div>
                      <Label>عمود الكمية</Label>
                      <Input value={itemsConfig.columns.qty} onChange={e=>setItemsConfig({...itemsConfig, columns:{...itemsConfig.columns, qty: e.target.value}})} placeholder="مثل E" />
                    </div>
                    <div>
                      <Label>عمود السعر</Label>
                      <Input value={itemsConfig.columns.price} onChange={e=>setItemsConfig({...itemsConfig, columns:{...itemsConfig.columns, price: e.target.value}})} placeholder="مثل F" />
                    </div>
                    <div>
                      <Label>عمود الإجمالي</Label>
                      <Input value={itemsConfig.columns.total} onChange={e=>setItemsConfig({...itemsConfig, columns:{...itemsConfig.columns, total: e.target.value}})} placeholder="مثل G" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button onClick={async ()=>{ await axios.post(`${API_URL}/invoice-templates/${selected.id}/update-mapping`, { mapping, items: itemsConfig }); alert('تم حفظ الربط'); }} className="bg-purple-600 hover:bg-purple-700">حفظ الربط</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>المحرّر الشبكي (مبسّط)</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-sm">
                      <tbody>
                        {grid.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="border p-1">
                                <input className="w-40 px-1 text-sm" value={cell} onChange={(e)=>{ const g = [...grid]; g[rIdx][cIdx] = e.target.value; setGrid(g); }} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" onClick={addRow}>+ صف</Button>
                    <Button variant="outline" onClick={addCol}>+ عمود</Button>
                  </div>
                  <div className="mt-4">
                    <Label>ملاحظات القالب</Label>
                    <Textarea placeholder="اكتب ملاحظات للفرق..."/>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default InvoiceTemplateStudio;
