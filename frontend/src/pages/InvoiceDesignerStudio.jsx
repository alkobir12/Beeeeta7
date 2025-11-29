import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FileDown, Save, Printer, Plus, Type, Image as ImageIcon, Table, Trash2, Settings, Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const GRID_SIZE = 10;

const DATABASE_FIELDS = {
  workshop: [{ key: 'WORKSHOP_NAME', label: 'اسم الورشة' }, { key: 'COMPANY_CR', label: 'سجل تجاري' }, { key: 'COMPANY_TAX', label: 'رقم ضريبي' }],
  customer: [{ key: 'CUSTOMER_NAME', label: 'اسم العميل' }, { key: 'CUSTOMER_CR', label: 'سجل العميل' }, { key: 'CUSTOMER_TAX', label: 'ضريبي العميل' }],
  invoice: [{ key: 'INVOICE_NO', label: 'رقم الفاتورة' }, { key: 'DATE', label: 'التاريخ' }]
};

const TABLE_COLUMNS = [
  { key: 'description', label: 'المادة', visible: true, w: 250 }, { key: 'qty', label: 'الكمية', visible: true, w: 60 },
  { key: 'unit', label: 'الوحدة', visible: true, w: 60 }, { key: 'price', label: 'الإفرادي', visible: true, w: 80 },
  { key: 'total', label: 'الإجمالي', visible: true, w: 80 }, { key: 'notes', label: 'ملاحظات', visible: false, w: 120 }
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
  const [workshopData, setWorkshopData] = useState({ WORKSHOP_NAME: '', COMPANY_CR: '', COMPANY_TAX: '' });
  const canvasRef = useRef(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/invoice-templates`);
      setTemplates(res.data || []);
    } catch (err) { console.error(err); }
  };

  const createNewTemplate = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/invoice-templates/create-blank`, { name: `فاتورة ${new Date().toLocaleDateString('ar-SA')}`, rows: 40, cols: 10 });
      await loadTemplates();
      setCurrentTemplate(res.data);
      setElements([]);
    } catch (err) { alert('❌ فشل الإنشاء'); } finally { setLoading(false); }
  };

  const addElement = (type, props = {}) => {
    const el = { id: Date.now() + Math.random(), type, x: 50, y: 50 + elements.length * 35, w: 200, h: 30, ...props };
    setElements([...elements, el]);
    setSelectedElement(el.id);
  };

  const updateElement = (id, updates) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    const clicked = [...elements].reverse().find(el => x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h);
    if (clicked) {
      setSelectedElement(clicked.id);
      setDragging({ id: clicked.id, startX: x, startY: y, elX: clicked.x, elY: clicked.y });
    } else {
      setSelectedElement(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const dx = x - dragging.startX;
    const dy = y - dragging.startY;
    updateElement(dragging.id, {
      x: Math.max(0, Math.round((dragging.elX + dx) / GRID_SIZE) * GRID_SIZE),
      y: Math.max(0, Math.round((dragging.elY + dy) / GRID_SIZE) * GRID_SIZE)
    });
  };

  const handleMouseUp = () => setDragging(null);
  const selectedEl = elements.find(e => e.id === selectedElement);

  return (
    
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">مصمم الفواتير</h1>
          <div className="flex gap-2">
            <button onClick={createNewTemplate} className="apple-button-secondary text-xs h-8 px-3 flex items-center gap-1"><Plus size={14}/> جديد</button>
            <button className="apple-button text-xs h-8 px-3 flex items-center gap-1"><Save size={14}/> حفظ</button>
          </div>
        </div>

        <div className="flex h-[calc(100vh-60px)]">
          {/* Sidebar */}
          <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">إضافة عناصر</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addElement('text', { text: 'نص جديد', fontSize: 14, color: '#000' })} className="p-2 border rounded hover:bg-gray-50 text-xs flex flex-col items-center gap-1"><Type size={16}/> نص</button>
                  <button onClick={() => addElement('image', { w: 100, h: 100 })} className="p-2 border rounded hover:bg-gray-50 text-xs flex flex-col items-center gap-1"><ImageIcon size={16}/> صورة</button>
                  <button onClick={() => addElement('table', { w: 700, h: 200, columns: TABLE_COLUMNS })} className="p-2 border rounded hover:bg-gray-50 text-xs flex flex-col items-center gap-1 col-span-2"><Table size={16}/> جدول الأصناف</button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">حقول البيانات</h3>
                <div className="space-y-1">
                  {[...DATABASE_FIELDS.workshop, ...DATABASE_FIELDS.customer, ...DATABASE_FIELDS.invoice].map(f => (
                    <button key={f.key} onClick={() => addElement('text', { text: f.label, binding: f.key, fontSize: 14 })} className="w-full text-right text-xs p-2 hover:bg-gray-50 rounded flex items-center gap-2">
                      <Plus size={12} className="text-blue-500"/> {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 bg-gray-100 p-8 overflow-auto flex justify-center">
            <div 
              ref={canvasRef}
              className="bg-white shadow-xl relative"
              style={{ width: A4_WIDTH * zoom, height: A4_HEIGHT * zoom, transformOrigin: 'top center' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {elements.map(el => (
                <div
                  key={el.id}
                  className={`absolute cursor-move ${selectedElement === el.id ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'}`}
                  style={{
                    left: el.x * zoom, top: el.y * zoom, width: el.w * zoom, height: el.h * zoom,
                    fontSize: (el.fontSize || 14) * zoom, color: el.color
                  }}
                >
                  {el.type === 'text' ? (el.binding ? `{${el.text}}` : el.text) : 
                   el.type === 'image' ? <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400"><ImageIcon/></div> :
                   el.type === 'table' ? <div className="w-full h-full border border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-500">جدول الأصناف</div> : null}
                </div>
              ))}
            </div>
          </div>

          {/* Properties Panel */}
          <div className="w-64 bg-white border-r border-gray-200 p-4">
            {selectedEl ? (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2">خصائص العنصر</h3>
                {selectedEl.type === 'text' && (
                  <>
                    <div><label className="text-xs block mb-1">النص</label><input className="apple-input h-8 text-xs" value={selectedEl.text} onChange={e => updateElement(selectedEl.id, { text: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs block mb-1">حجم الخط</label><input type="number" className="apple-input h-8 text-xs" value={selectedEl.fontSize} onChange={e => updateElement(selectedEl.id, { fontSize: parseInt(e.target.value) })} /></div>
                      <div><label className="text-xs block mb-1">اللون</label><input type="color" className="w-full h-8" value={selectedEl.color} onChange={e => updateElement(selectedEl.id, { color: e.target.value })} /></div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs block mb-1">X</label><input type="number" className="apple-input h-8 text-xs" value={Math.round(selectedEl.x)} onChange={e => updateElement(selectedEl.id, { x: parseInt(e.target.value) })} /></div>
                  <div><label className="text-xs block mb-1">Y</label><input type="number" className="apple-input h-8 text-xs" value={Math.round(selectedEl.y)} onChange={e => updateElement(selectedEl.id, { y: parseInt(e.target.value) })} /></div>
                  <div><label className="text-xs block mb-1">العرض</label><input type="number" className="apple-input h-8 text-xs" value={Math.round(selectedEl.w)} onChange={e => updateElement(selectedEl.id, { w: parseInt(e.target.value) })} /></div>
                  <div><label className="text-xs block mb-1">الارتفاع</label><input type="number" className="apple-input h-8 text-xs" value={Math.round(selectedEl.h)} onChange={e => updateElement(selectedEl.id, { h: parseInt(e.target.value) })} /></div>
                </div>
                <button onClick={() => { setElements(elements.filter(e => e.id !== selectedEl.id)); setSelectedElement(null); }} className="w-full py-2 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 size={14}/> حذف العنصر</button>
              </div>
            ) : (
              <div className="text-center text-gray-400 text-xs mt-10">حدد عنصراً لتعديل خصائصه</div>
            )}
          </div>
        </div>
      </div>
    
  );
};

export default InvoiceDesignerStudio;
