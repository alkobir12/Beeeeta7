import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  FileDown, Save, Printer, Plus, Type, Image as ImageIcon, 
  Table, Trash2, Settings, Bold, Italic, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const GRID_SIZE = 10;

const DATABASE_FIELDS = {
  workshop: [
    { key: 'WORKSHOP_NAME', label: 'اسم الورشة' },
    { key: 'COMPANY_CR', label: 'سجل تجاري/شركة' },
    { key: 'COMPANY_TAX', label: 'رقم ضريبي/شركة' },
  ],
  customer: [
    { key: 'CUSTOMER_NAME', label: 'اسم العميل' },
    { key: 'CUSTOMER_CR', label: 'سجل تجاري/عميل' },
    { key: 'CUSTOMER_TAX', label: 'رقم ضريبي/عميل' },
  ],
  invoice: [
    { key: 'INVOICE_NO', label: 'رقم الفاتورة' },
    { key: 'DATE', label: 'التاريخ' },
  ]
};

const TABLE_COLUMNS = [
  { key: 'description', label: 'المادة', visible: true, w: 250 },
  { key: 'qty', label: 'الكمية', visible: true, w: 60 },
  { key: 'unit', label: 'الوحدة', visible: true, w: 60 },
  { key: 'price', label: 'الإفرادي', visible: true, w: 80 },
  { key: 'total', label: 'الإجمالي', visible: true, w: 80 },
  { key: 'additions', label: 'إضافات', visible: false, w: 70 },
  { key: 'discount', label: 'حسومات', visible: false, w: 70 },
  { key: 'profit', label: 'الربح التجاري', visible: false, w: 90 },
  { key: 'tax_name', label: 'اسم الضريبة', visible: false, w: 90 },
  { key: 'tax_value', label: 'قيمة الضريبة', visible: false, w: 90 },
  { key: 'with_tax', label: 'السعر مع الضريبة', visible: false, w: 110 },
  { key: 'warehouse', label: 'المستودع', visible: false, w: 80 },
  { key: 'notes', label: 'الملاحظات', visible: false, w: 120 },
];

const InvoiceDesignerStudio = () => {
  const [templates, setTemplates] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  
  const [workshopData, setWorkshopData] = useState({
    WORKSHOP_NAME: '',
    COMPANY_CR: '',
    COMPANY_TAX: '',
  });

  const [showColumnsPanel, setShowColumnsPanel] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/invoice-templates`);
      setTemplates(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const createNewTemplate = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/invoice-templates/create-blank`, {
        name: `فاتورة ${new Date().toLocaleDateString('ar-SA')}`,
        rows: 40,
        cols: 10
      });
      await loadTemplates();
      setCurrentTemplate(res.data);
      setElements([]);
      alert('✅ تم إنشاء القالب');
    } catch (err) {
      alert('❌ فشل الإنشاء');
    } finally {
      setLoading(false);
    }
  };

  const addTextField = (binding, label) => {
    const el = {
      id: Date.now().toString() + Math.random(),
      type: 'text',
      x: 50,
      y: 50 + elements.length * 35,
      w: 250,
      h: 28,
      text: workshopData[binding] || label,
      binding: binding,
      fontSize: 14,
      fontFamily: 'Arial',
      bold: false,
      italic: false,
      color: '#000000',
      align: 'right'
    };
    const newEls = [...elements, el];
    setElements(newEls);
    setSelectedElement(el.id);
    autoSave(newEls);
  };

  const addImageElement = () => {
    const el = {
      id: Date.now().toString() + Math.random(),
      type: 'image',
      x: 600,
      y: 30,
      w: 120,
      h: 120,
      src: '',
      alt: 'لوغو'
    };
    const newEls = [...elements, el];
    setElements(newEls);
    setSelectedElement(el.id);
    autoSave(newEls);
  };

  const addTableElement = () => {
    const el = {
      id: Date.now().toString() + Math.random(),
      type: 'table',
      x: 30,
      y: 400,
      w: 730,
      h: 250,
      columns: TABLE_COLUMNS.filter(c => c.visible),
      headerBg: '#3b82f6',
      headerColor: '#ffffff'
    };
    const newEls = [...elements, el];
    setElements(newEls);
    setSelectedElement(el.id);
    autoSave(newEls);
  };

  const updateElement = (id, updates) => {
    const newElements = elements.map(el => el.id === id ? { ...el, ...updates } : el);
    setElements(newElements);
    
    const element = elements.find(e => e.id === id);
    if (element?.binding && updates.text) {
      setWorkshopData(prev => ({ ...prev, [element.binding]: updates.text }));
    }
    
    autoSave(newElements);
  };

  const deleteElement = (id) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    if (selectedElement === id) setSelectedElement(null);
    autoSave(newElements);
  };

  const handleImageUpload = (e, elementId) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateElement(elementId, { src: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const autoSaveTimeout = useRef(null);
  const autoSave = (els) => {
    if (!currentTemplate) return;
    
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    
    autoSaveTimeout.current = setTimeout(async () => {
      try {
        await axios.post(`${API_URL}/invoice-templates/${currentTemplate.id}/design`, {
          elements: els,
          page: { size: 'A4' },
          workshopData
        });
      } catch (err) {
        console.error('Auto-save failed');
      }
    }, 1000);
  };

  const generateHTMLFromElements = () => {
    let html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial; padding: 20px; }
    .container { position: relative; width: ${A4_WIDTH}px; height: ${A4_HEIGHT}px; margin: 0 auto; background: white; }
  </style>
</head>
<body>
  <div class="container">
`;

    elements.forEach(el => {
      if (el.type === 'text') {
        const value = el.binding ? `{{${el.binding}}}` : el.text;
        html += `    <div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.w}px; font-size: ${el.fontSize}px; color: ${el.color}; text-align: ${el.align}; font-weight: ${el.bold ? 'bold' : 'normal'}; font-style: ${el.italic ? 'italic' : 'normal'};">${value}</div>\n`;
      } else if (el.type === 'image' && el.src) {
        html += `    <img src="${el.src}" style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.w}px; height: ${el.h}px;" />\n`;
      } else if (el.type === 'table') {
        html += `    <table style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.w}px; border-collapse: collapse;">
      <thead style="background: ${el.headerBg}; color: ${el.headerColor};">
        <tr>${el.columns.map(c => `<th style="border: 1px solid #ddd; padding: 6px; text-align: right; font-size: 12px;">${c.label}</th>`).join('')}</tr>
      </thead>
      <tbody>
        {{ITEMS}}
        <tr>${el.columns.map(c => `<td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">{{ITEMS.${c.key}}}</td>`).join('')}</tr>
      </tbody>
    </table>\n`;
      }
    });

    html += `  </div></body></html>`;
    return html;
  };

  const saveTemplate = async () => {
    if (!currentTemplate) return;

    try {
      setLoading(true);
      await axios.post(`${API_URL}/invoice-templates/${currentTemplate.id}/design`, {
        elements,
        page: { size: 'A4' },
        workshopData
      });
      
      const html = generateHTMLFromElements();
      await axios.post(`${API_URL}/templates`, {
        type: 'invoice',
        name: currentTemplate.name,
        content: html,
        isActive: false
      });
      
      alert('✅ تم الحفظ وإضافته إلى نماذج الطباعة تلقائياً');
    } catch (err) {
      alert('❌ فشل الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (selectedElement) {
      const el = elements.find(e => e.id === selectedElement);
      if (el) {
        const handle = 8;
        if (Math.abs(x - (el.x + el.w)) < handle && Math.abs(y - (el.y + el.h)) < handle) {
          setResizing({ id: el.id, startX: x, startY: y, ow: el.w, oh: el.h });
          return;
        }
      }
    }

    const clicked = [...elements].reverse().find(el => 
      x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h
    );

    if (clicked) {
      setSelectedElement(clicked.id);
      setDragging({ id: clicked.id, startX: x, startY: y, elX: clicked.x, elY: clicked.y });
    } else {
      setSelectedElement(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (resizing) {
      const dx = x - resizing.startX;
      const dy = y - resizing.startY;
      updateElement(resizing.id, {
        w: Math.max(50, Math.round((resizing.ow + dx) / GRID_SIZE) * GRID_SIZE),
        h: Math.max(20, Math.round((resizing.oh + dy) / GRID_SIZE) * GRID_SIZE)
      });
    } else if (dragging) {
      const dx = x - dragging.startX;
      const dy = y - dragging.startY;
      updateElement(dragging.id, {
        x: Math.max(0, Math.min(A4_WIDTH - 50, Math.round((dragging.elX + dx) / GRID_SIZE) * GRID_SIZE)),
        y: Math.max(0, Math.min(A4_HEIGHT - 50, Math.round((dragging.elY + dy) / GRID_SIZE) * GRID_SIZE))
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  const selectedEl = elements.find(e => e.id === selectedElement);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50" dir="rtl">
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
          <div className="container mx-auto px-4 py-3">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">مصمم الفواتير</h1>
              <div className="flex gap-2">
                <Button onClick={createNewTemplate} size="sm" className="bg-white text-indigo-600 hover:bg-indigo-50 h-8 text-xs">
                  <Plus className="w-3 h-3 ml-1" /> جديد
                </Button>
                <Button onClick={saveTemplate} disabled={!currentTemplate} size="sm" className="bg-green-500 hover:bg-green-600 h-8 text-xs">
                  <Save className="w-3 h-3 ml-1" /> حفظ
                </Button>
                <Button 
                  onClick={async () => {
                    if (!currentTemplate) return;
                    try {
                      const res = await axios.post(`${API_URL}/print/invoice-xlsx`, {
                        templateId: currentTemplate.id,
                        data: {
                          ...workshopData,
                          CUSTOMER_NAME: 'عميل تجريبي',
                          INVOICE_NO: 'INV-001',
                          DATE: new Date().toLocaleDateString('ar-SA'),
                          TOTAL: '500.00',
                          ITEMS: [{ description: 'خدمة', qty: 1, unit: 'مرة', price: 500, total: 500 }]
                        }
                      }, { responseType: 'blob' });
                      const url = URL.createObjectURL(new Blob([res.data]));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `invoice.xlsx`;
                      a.click();
                      alert('✅ تم التوليد');
                    } catch (err) {
                      alert('❌ فشل');
                    }
                  }}
                  disabled={!currentTemplate} 
                  size="sm" 
                  className="bg-amber-500 hover:bg-amber-600 h-8 text-xs"
                >
                  <Printer className="w-3 h-3 ml-1" /> توليد
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-3 py-3">
          <div className="grid grid-cols-12 gap-2">
            {/* Right Sidebar - Workshop & Add */}
            <div className="col-span-2">
              <Card className="shadow-lg border border-indigo-100 mb-2">
                <CardHeader className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                  <CardTitle className="text-xs">بيانات الورشة</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-1.5">
                  {Object.keys(workshopData).map(key => (
                    <div key={key}>
                      <Label className="text-[9px] text-slate-600">
                        {DATABASE_FIELDS.workshop.find(f => f.key === key)?.label}
                      </Label>
                      <Input
                        value={workshopData[key]}
                        onChange={(e) => {
                          const newData = {...workshopData, [key]: e.target.value};
                          setWorkshopData(newData);
                          setElements(elements.map(el => 
                            el.binding === key ? {...el, text: e.target.value} : el
                          ));
                        }}
                        className="h-6 text-[10px] mt-0.5"
                        placeholder="..."
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-lg border border-purple-100">
                <CardHeader className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <CardTitle className="text-xs">إضافة</CardTitle>
                </CardHeader>
                <CardContent className="p-1.5 space-y-0.5">
                  <Button onClick={addImageElement} variant="outline" size="sm" className="w-full justify-start text-[10px] h-6">
                    <ImageIcon className="w-3 h-3 ml-1" /> لوغو
                  </Button>
                  <Button onClick={addTableElement} variant="outline" size="sm" className="w-full justify-start text-[10px] h-6">
                    <Table className="w-3 h-3 ml-1" /> جدول
                  </Button>
                  
                  <div className="pt-1 border-t space-y-0.5">
                    {[...DATABASE_FIELDS.workshop, ...DATABASE_FIELDS.customer, ...DATABASE_FIELDS.invoice].map(field => (
                      <Button
                        key={field.key}
                        onClick={() => addTextField(field.key, field.label)}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-[9px] h-5 px-1"
                      >
                        <Type className="w-2 h-2 ml-1" /> {field.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Canvas - أكبر */}
            <div className="col-span-8">
              <Card className="shadow-2xl border-2 border-slate-200">
                <CardHeader className="p-2 bg-slate-50 border-b flex flex-row justify-between items-center">
                  <CardTitle className="text-sm">لوح A4</CardTitle>
                  <select 
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="text-[10px] border rounded px-1 py-0.5"
                  >
                    <option value="0.6">60%</option>
                    <option value="0.7">70%</option>
                    <option value="0.85">85%</option>
                    <option value="1">100%</option>
                  </select>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="flex justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3">
                    <div
                      ref={canvasRef}
                      className="bg-white shadow-2xl relative cursor-crosshair border border-slate-300"
                      style={{ 
                        width: A4_WIDTH * zoom, 
                        height: A4_HEIGHT * zoom
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <div className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                          backgroundImage: `
                            repeating-linear-gradient(0deg, transparent, transparent 9px, #cbd5e1 9px, #cbd5e1 10px),
                            repeating-linear-gradient(90deg, transparent, transparent 9px, #cbd5e1 9px, #cbd5e1 10px)
                          `,
                          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
                        }}
                      />

                      {elements.map(el => (
                        <div
                          key={el.id}
                          className={`absolute ${
                            selectedElement === el.id 
                              ? 'ring-2 ring-blue-500 shadow-lg z-10' 
                              : 'hover:ring-1 hover:ring-blue-300'
                          }`}
                          style={{
                            left: el.x * zoom,
                            top: el.y * zoom,
                            width: el.w * zoom,
                            height: el.h * zoom
                          }}
                        >
                          {el.type === 'text' && (
                            <div
                              className="w-full h-full flex items-center px-1"
                              style={{
                                fontSize: el.fontSize * zoom,
                                fontFamily: el.fontFamily,
                                fontWeight: el.bold ? 'bold' : 'normal',
                                fontStyle: el.italic ? 'italic' : 'normal',
                                color: el.color,
                                textAlign: el.align,
                                lineHeight: '1.2'
                              }}
                            >
                              {el.text}
                            </div>
                          )}
                          {el.type === 'image' && (
                            <div 
                              className="w-full h-full border border-dashed border-indigo-300 flex items-center justify-center bg-indigo-50 cursor-pointer"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => handleImageUpload(e, el.id);
                                input.click();
                              }}
                            >
                              {el.src ? (
                                <img src={el.src} alt={el.alt} className="max-w-full max-h-full object-contain" />
                              ) : (
                                <div className="text-center">
                                  <ImageIcon className="w-6 h-6 text-indigo-400 mx-auto" style={{ width: 6*zoom, height: 6*zoom }} />
                                  <p className="text-[8px] text-indigo-600" style={{ fontSize: 8*zoom }}>اضغط لرفع</p>
                                </div>
                              )}
                            </div>
                          )}
                          {el.type === 'table' && (
                            <div className="w-full h-full border border-slate-300 overflow-hidden">
                              <table className="w-full">
                                <thead style={{ background: el.headerBg, color: el.headerColor }}>
                                  <tr>
                                    {el.columns.map((col, i) => (
                                      <th key={i} className="border border-white p-0.5 text-right" style={{ fontSize: 9 * zoom }}>
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    {el.columns.map((col, i) => (
                                      <td key={i} className="border border-slate-200 p-0.5 text-slate-400" style={{ fontSize: 8 * zoom }}>
                                        ---
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                          
                          {selectedElement === el.id && (
                            <div 
                              className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-se-resize"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Left Sidebar - Properties */}
            <div className="col-span-2">
              {selectedEl ? (
                <Card className="shadow-lg border border-green-100">
                  <CardHeader className="p-2 bg-gradient-to-r from-green-500 to-teal-500 text-white">
                    <CardTitle className="text-xs">خصائص</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    {selectedEl.type === 'text' && (
                      <>
                        <div>
                          <Label className="text-[9px]">النص</Label>
                          <Input
                            value={selectedEl.text}
                            onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                            className="h-6 text-[10px] mt-0.5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <Label className="text-[9px]">حجم</Label>
                            <Input
                              type="number"
                              value={selectedEl.fontSize}
                              onChange={(e) => updateElement(selectedEl.id, { fontSize: parseInt(e.target.value) })}
                              className="h-6 text-[10px] mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[9px]">لون</Label>
                            <Input
                              type="color"
                              value={selectedEl.color}
                              onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
                              className="h-6 mt-0.5"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[9px]">خط</Label>
                          <select
                            value={selectedEl.fontFamily}
                            onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                            className="w-full border rounded px-1 py-0.5 text-[10px] mt-0.5"
                          >
                            <option>Arial</option>
                            <option>Times New Roman</option>
                            <option>Courier New</option>
                            <option>Tahoma</option>
                          </select>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={selectedEl.bold ? 'default' : 'outline'}
                            onClick={() => updateElement(selectedEl.id, { bold: !selectedEl.bold })}
                            className="flex-1 h-6"
                          >
                            <Bold className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedEl.italic ? 'default' : 'outline'}
                            onClick={() => updateElement(selectedEl.id, { italic: !selectedEl.italic })}
                            className="flex-1 h-6"
                          >
                            <Italic className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex gap-0.5">
                          <Button size="sm" variant="outline" onClick={() => updateElement(selectedEl.id, { align: 'right' })} className="flex-1 h-6 px-1">
                            <AlignRight className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateElement(selectedEl.id, { align: 'center' })} className="flex-1 h-6 px-1">
                            <AlignCenter className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateElement(selectedEl.id, { align: 'left' })} className="flex-1 h-6 px-1">
                            <AlignLeft className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}

                    {selectedEl.type === 'table' && (
                      <>
                        <div>
                          <Label className="text-[9px]">الأعمدة</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowColumnsPanel(!showColumnsPanel)}
                            className="w-full h-6 text-[10px] mt-0.5"
                          >
                            {selectedEl.columns.length}/13
                          </Button>
                        </div>
                        {showColumnsPanel && (
                          <div className="max-h-40 overflow-y-auto space-y-0.5 border rounded p-1">
                            {TABLE_COLUMNS.map(col => (
                              <label key={col.key} className="flex items-center gap-1 text-[9px] hover:bg-slate-50 p-0.5 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedEl.columns.some(c => c.key === col.key)}
                                  onChange={(e) => {
                                    const newCols = e.target.checked
                                      ? [...selectedEl.columns, col]
                                      : selectedEl.columns.filter(c => c.key !== col.key);
                                    updateElement(selectedEl.id, { columns: newCols });
                                  }}
                                  className="w-2.5 h-2.5"
                                />
                                {col.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-1 pt-1 border-t">
                      <div>
                        <Label className="text-[9px]">X</Label>
                        <Input type="number" value={Math.round(selectedEl.x)} onChange={(e) => updateElement(selectedEl.id, { x: parseInt(e.target.value) })} className="h-6 text-[10px]" />
                      </div>
                      <div>
                        <Label className="text-[9px]">Y</Label>
                        <Input type="number" value={Math.round(selectedEl.y)} onChange={(e) => updateElement(selectedEl.id, { y: parseInt(e.target.value) })} className="h-6 text-[10px]" />
                      </div>
                      <div>
                        <Label className="text-[9px]">عرض</Label>
                        <Input type="number" value={Math.round(selectedEl.w)} onChange={(e) => updateElement(selectedEl.id, { w: parseInt(e.target.value) })} className="h-6 text-[10px]" />
                      </div>
                      <div>
                        <Label className="text-[9px]">طول</Label>
                        <Input type="number" value={Math.round(selectedEl.h)} onChange={(e) => updateElement(selectedEl.id, { h: parseInt(e.target.value) })} className="h-6 text-[10px]" />
                      </div>
                    </div>

                    <Button
                      onClick={() => deleteElement(selectedEl.id)}
                      variant="destructive"
                      size="sm"
                      className="w-full mt-1 h-6 text-[10px]"
                    >
                      <Trash2 className="w-3 h-3 ml-1" /> حذف
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-lg">
                  <CardContent className="p-6 text-center text-slate-400">
                    <Settings className="w-8 h-8 mx-auto mb-1 opacity-30" />
                    <p className="text-[10px]">اختر عنصراً</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoiceDesignerStudio;
