import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

const InvoiceTemplateStudio = () => {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [grid, setGrid] = useState([]); // simple 2D array as our grid model
  const [mapping, setMapping] = useState({ WORKSHOP_NAME: '', CUSTOMER_NAME: '', VEHICLE_PLATE: '', TOTAL: '' });
  const [itemsConfig, setItemsConfig] = useState({ anchor: '{{ITEMS}}', columns: { description: '', qty: '', price: '', total: '' } });
  const fileRef = useRef();

  useEffect(()=>{ loadTemplates(); },[]);

  const loadTemplates = async () => {
    try{
      const res = await axios.get(`${API_URL}/invoice-templates`);
      setTemplates(res.data || []);
    }catch(e){ console.error(e); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post(`${API_URL}/invoice-templates/import`, form, { headers:{'Content-Type':'multipart/form-data'} });
    await loadTemplates();
    const created = res.data;
    setSelected(created);
    // try to map preview into grid
    const prev = created.preview || [];
    setGrid(prev.map(r => r.map(c => (c === null || c === undefined) ? '' : String(c))));
  };

  const handleSelect = async (tpl) => {
    setSelected(tpl);
    setGrid((tpl.preview || []).map(r => r.map(c => (c === null || c === undefined) ? '' : String(c))));
  };

  const addRow = () => setGrid([...grid, Array(grid[0]?.length || 10).fill('')]);
  const addCol = () => setGrid(grid.map(r => [...r, '']));

  const saveGrid = async () => {
    if(!selected) return;
    await axios.post(`${API_URL}/invoice-templates/${selected.id}/save-json`, { grid });
    alert('تم حفظ القالب كـ Excel');
  };

  const saveMapping = async () => {
    if(!selected) return;
    await axios.post(`${API_URL}/invoice-templates/${selected.id}/update-mapping`, { mapping, items: itemsConfig });
    alert('تم حفظ الربط والحقول');
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
    const a = document.createElement('a');
    a.href = url; a.download = 'invoice.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">استوديو قوالب الفواتير (Excel)</h1>
          <div className="flex gap-2">
            <label>
              <Button asChild className="bg-green-600 hover:bg-green-700 cursor-pointer"><span>استيراد قالب</span></Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.html,.htm,.docx,.pdf" className="hidden" onChange={handleImport} />
            </label>
            <Button onClick={saveGrid} className="bg-blue-600 hover:bg-blue-700">حفظ كـ Excel</Button>
            <Button onClick={downloadFilled} className="bg-emerald-600 hover:bg-emerald-700">توليد فاتورة من القالب</Button>
          </div>
        </div>

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
              </div>
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
                <Label>مرساة البنود (صف يحتوي {{ITEMS}})</Label>
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
                <Button onClick={saveMapping} className="bg-purple-600 hover:bg-purple-700">حفظ الربط</Button>
              </div>
            </CardContent>
          </Card>

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
                            <input
                              className="w-40 px-1 text-sm"
                              value={cell}
                              onChange={(e)=>{
                                const g = [...grid]; g[rIdx][cIdx] = e.target.value; setGrid(g);
                              }}
                            />
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
      </div>
    </Layout>
  );
};

export default InvoiceTemplateStudio;
