import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  FileDown, Save, Printer, Plus, Type, Image as ImageIcon, 
  Table, Trash2, Move, AlignLeft, AlignCenter, AlignRight, Bold, Italic
} from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// حقول قاعدة البيانات الكاملة
const DATABASE_FIELDS = [
  { key: 'WORKSHOP_NAME', label: 'اسم الورشة', category: 'workshop' },
  { key: 'WORKSHOP_ADDRESS', label: 'عنوان الورشة', category: 'workshop' },
  { key: 'WORKSHOP_PHONE', label: 'هاتف الورشة', category: 'workshop' },
  { key: 'WORKSHOP_EMAIL', label: 'إيميل الورشة', category: 'workshop' },
  { key: 'COMPANY_CR', label: 'سجل تجاري/شركة', category: 'workshop' },
  { key: 'COMPANY_TAX', label: 'الرقم الضريبي/شركة', category: 'workshop' },
  
  { key: 'CUSTOMER_NAME', label: 'اسم العميل', category: 'customer' },
  { key: 'CUSTOMER_PHONE', label: 'هاتف العميل', category: 'customer' },
  { key: 'CUSTOMER_EMAIL', label: 'إيميل العميل', category: 'customer' },
  { key: 'CUSTOMER_CR', label: 'سجل تجاري/عميل', category: 'customer' },
  { key: 'CUSTOMER_TAX', label: 'الرقم الضريبي/عميل', category: 'customer' },
  
  { key: 'INVOICE_NO', label: 'رقم الفاتورة', category: 'invoice' },
  { key: 'DATE', label: 'التاريخ', category: 'invoice' },
  { key: 'DUE_DATE', label: 'تاريخ الاستحقاق', category: 'invoice' },
  
  { key: 'VEHICLE_PLATE', label: 'رقم اللوحة', category: 'vehicle' },
  { key: 'VEHICLE_MODEL', label: 'طراز المركبة', category: 'vehicle' },
  { key: 'VEHICLE_YEAR', label: 'سنة الصنع', category: 'vehicle' },
];

// أعمدة الجدول الكاملة
const TABLE_COLUMNS = [
  { key: 'description', label: 'المادة', visible: true },
  { key: 'qty', label: 'الكمية', visible: true },
  { key: 'unit', label: 'الوحدة', visible: true },
  { key: 'price', label: 'الإفرادي', visible: true },
  { key: 'total', label: 'الإجمالي', visible: true },
  { key: 'additions', label: 'إضافات', visible: false },
  { key: 'discount', label: 'حسومات', visible: false },
  { key: 'profit', label: 'الربح التجاري', visible: false },
  { key: 'tax_name', label: 'اسم الضريبة', visible: false },
  { key: 'tax_value', label: 'قيمة الضريبة', visible: false },
  { key: 'with_tax', label: 'السعر مع الضريبة', visible: false },
  { key: 'warehouse', label: 'المستودع', visible: false },
  { key: 'notes', label: 'الملاحظات', visible: false },
];

const InvoiceDesignerStudio = () => {
  // State
  const [templates, setTemplates] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Workshop Data (يتم حفظها وعرضها تلقائياً)
  const [workshopData, setWorkshopData] = useState({
    WORKSHOP_NAME: '',
    WORKSHOP_ADDRESS: '',
    WORKSHOP_PHONE: '',
    COMPANY_CR: '',
    COMPANY_TAX: '',
  });

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // إنشاء قالب جديد
  const createNewTemplate = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/invoice-templates/create-blank`, {
        name: `قالب ${new Date().toLocaleDateString('ar-SA')}`,
        rows: 40,
        cols: 10
      });
      await loadTemplates();
      setCurrentTemplate(res.data);
      setElements([]);
      alert('✅ تم إنشاء القالب');
    } catch (err) {
      alert('❌ فشل الإنشاء: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // إضافة عنصر نصي مع binding
  const addTextField = (binding, label) => {
    const el = {
      id: Date.now().toString(),
      type: 'text',
      x: 50,
      y: 50 + elements.length * 40,
      w: 300,
      h: 30,
      text: workshopData[binding] || label,
      binding: binding,
      fontSize: 16,
      fontFamily: 'Arial',
      bold: false,
      italic: false,
      color: '#000000',
      align: 'right'
    };
    setElements([...elements, el]);
    setSelectedElement(el.id);
  };

  // إضافة صورة/لوغو
  const addImageElement = () => {
    const el = {
      id: Date.now().toString(),
      type: 'image',
      x: 50,
      y: 50,
      w: 150,
      h: 150,
      src: '',
      alt: 'لوغو'
    };
    setElements([...elements, el]);
    setSelectedElement(el.id);
  };

  // رفع صورة
  const handleImageUpload = (e, elementId) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setElements(elements.map(el => 
        el.id === elementId ? { ...el, src: event.target.result } : el
      ));
    };
    reader.readAsDataURL(file);
  };

  // إضافة جدول
  const addTableElement = () => {
    const el = {
      id: Date.now().toString(),
      type: 'table',
      x: 50,
      y: 300,
      w: 700,
      h: 300,
      columns: TABLE_COLUMNS.filter(c => c.visible)
    };
    setElements([...elements, el]);
    setSelectedElement(el.id);
  };

  // تحديث عنصر
  const updateElement = (id, updates) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
    
    // إذا كان العنصر له binding، حدّث workshopData
    const element = elements.find(e => e.id === id);
    if (element?.binding && updates.text) {
      setWorkshopData(prev => ({ ...prev, [element.binding]: updates.text }));
    }
  };

  // حذف عنصر
  const deleteElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  };

  // حفظ القالب
  const saveTemplate = async () => {
    if (!currentTemplate) {
      alert('⚠️ لا يوجد قالب محدد');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_URL}/invoice-templates/${currentTemplate.id}/design`, {
        elements,
        page: { size: 'A4', orientation: 'portrait' },
        workshopData
      });
      alert('✅ تم الحفظ بنجاح');
    } catch (err) {
      alert('❌ فشل الحفظ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // توليد فاتورة
  const generateInvoice = async () => {
    if (!currentTemplate) {
      alert('⚠️ لا يوجد قالب محدد');
      return;
    }

    try {
      setLoading(true);
      
      const invoiceData = {
        ...workshopData,
        CUSTOMER_NAME: 'عميل تجريبي',
        CUSTOMER_PHONE: '0501234567',
        CUSTOMER_CR: 'CR-123456',
        CUSTOMER_TAX: 'TAX-789',
        INVOICE_NO: 'INV-001',
        DATE: new Date().toLocaleDateString('ar-SA'),
        VEHICLE_PLATE: 'س ع د 1234',
        ITEMS: [
          { description: 'تغيير زيت المحرك', qty: 1, unit: 'خدمة', price: 200, total: 200 },
          { description: 'فلتر هواء', qty: 1, unit: 'قطعة', price: 50, total: 50 }
        ],
        SUBTOTAL: '250.00',
        TAX: '37.50',
        TOTAL: '287.50'
      };

      const res = await axios.post(`${API_URL}/print/invoice-xlsx`, {
        templateId: currentTemplate.id,
        data: invoiceData
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('✅ تم التوليد');
    } catch (err) {
      alert('❌ فشل التوليد: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mouse handlers
  const handleCanvasMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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

  const handleCanvasMouseMove = (e) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragging.startX;
    const dy = y - dragging.startY;

    updateElement(dragging.id, {
      x: Math.max(0, Math.min(A4_WIDTH - 50, dragging.elX + dx)),
      y: Math.max(0, Math.min(A4_HEIGHT - 50, dragging.elY + dy))
    });
  };

  const handleCanvasMouseUp = () => {
    setDragging(null);
  };

  const selectedEl = elements.find(e => e.id === selectedElement);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">مصمم الفواتير الاحترافي</h1>
              <p className="text-indigo-100">صمم فاتورتك بسهولة مثل Microsoft Word</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={createNewTemplate} className="bg-white text-indigo-600 hover:bg-indigo-50">
                <Plus className="w-4 h-4 ml-2" /> جديد
              </Button>
              <Button onClick={saveTemplate} disabled={!currentTemplate} className="bg-green-500 hover:bg-green-600">
                <Save className="w-4 h-4 ml-2" /> حفظ
              </Button>
              <Button onClick={generateInvoice} disabled={!currentTemplate} className="bg-amber-500 hover:bg-amber-600">
                <Printer className="w-4 h-4 ml-2" /> توليد
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Right Sidebar - Add Elements */}
          <div className="col-span-3 space-y-4">
            {/* Workshop Info Card */}
            <Card className="shadow-xl border-2 border-indigo-100">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                <CardTitle className="text-lg">معلومات الورشة</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">اسم الورشة</Label>
                  <Input
                    value={workshopData.WORKSHOP_NAME}
                    onChange={(e) => {
                      setWorkshopData({...workshopData, WORKSHOP_NAME: e.target.value});
                      // تحديث جميع العناصر المربوطة
                      setElements(elements.map(el => 
                        el.binding === 'WORKSHOP_NAME' ? {...el, text: e.target.value} : el
                      ));
                    }}
                    placeholder="ورشة الخليج"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">العنوان</Label>
                  <Input
                    value={workshopData.WORKSHOP_ADDRESS}
                    onChange={(e) => setWorkshopData({...workshopData, WORKSHOP_ADDRESS: e.target.value})}
                    placeholder="الرياض، المملكة العربية السعودية"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">الهاتف</Label>
                  <Input
                    value={workshopData.WORKSHOP_PHONE}
                    onChange={(e) => setWorkshopData({...workshopData, WORKSHOP_PHONE: e.target.value})}
                    placeholder="0501234567"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">السجل التجاري</Label>
                  <Input
                    value={workshopData.COMPANY_CR}
                    onChange={(e) => setWorkshopData({...workshopData, COMPANY_CR: e.target.value})}
                    placeholder="CR-123456"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">الرقم الضريبي</Label>
                  <Input
                    value={workshopData.COMPANY_TAX}
                    onChange={(e) => setWorkshopData({...workshopData, COMPANY_TAX: e.target.value})}
                    placeholder="TAX-789012"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Elements Card */}
            <Card className="shadow-xl border-2 border-purple-100">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <CardTitle className="text-lg">إضافة عناصر</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Button 
                  onClick={addImageElement}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <ImageIcon className="w-4 h-4 ml-2" />
                  صورة/لوغو
                </Button>

                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-slate-600 mb-2">حقول الورشة</p>
                  {DATABASE_FIELDS.filter(f => f.category === 'workshop').map(field => (
                    <Button
                      key={field.key}
                      onClick={() => addTextField(field.key, field.label)}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start mb-1 text-xs"
                    >
                      <Type className="w-3 h-3 ml-2" />
                      {field.label}
                    </Button>
                  ))}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-slate-600 mb-2">حقول العميل</p>
                  {DATABASE_FIELDS.filter(f => f.category === 'customer').map(field => (
                    <Button
                      key={field.key}
                      onClick={() => addTextField(field.key, field.label)}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start mb-1 text-xs"
                    >
                      <Type className="w-3 h-3 ml-2" />
                      {field.label}
                    </Button>
                  ))}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-slate-600 mb-2">حقول الفاتورة</p>
                  {DATABASE_FIELDS.filter(f => f.category === 'invoice').map(field => (
                    <Button
                      key={field.key}
                      onClick={() => addTextField(field.key, field.label)}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start mb-1 text-xs"
                    >
                      <Type className="w-3 h-3 ml-2" />
                      {field.label}
                    </Button>
                  ))}
                </div>

                <Button 
                  onClick={addTableElement}
                  variant="outline" 
                  className="w-full justify-start mt-2"
                >
                  <Table className="w-4 h-4 ml-2" />
                  جدول البنود
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Canvas */}
          <div className="col-span-6">
            <Card className="shadow-2xl border-2 border-slate-200">
              <CardHeader className="bg-slate-50 border-b-2">
                <CardTitle>لوح التصميم - A4</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex justify-center bg-slate-100 rounded-xl p-6">
                  <div
                    ref={canvasRef}
                    className="bg-white shadow-2xl relative cursor-move"
                    style={{ width: A4_WIDTH, height: A4_HEIGHT }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                  >
                    {/* Grid */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: `
                          repeating-linear-gradient(0deg, transparent, transparent 19px, #e5e7eb 19px, #e5e7eb 20px),
                          repeating-linear-gradient(90deg, transparent, transparent 19px, #e5e7eb 19px, #e5e7eb 20px)
                        `,
                        backgroundSize: '20px 20px'
                      }}
                    />

                    {/* Elements */}
                    {elements.map(el => (
                      <div
                        key={el.id}
                        className={`absolute transition-all ${
                          selectedElement === el.id 
                            ? 'ring-4 ring-blue-500 shadow-lg' 
                            : 'hover:ring-2 hover:ring-blue-300'
                        }`}
                        style={{
                          left: el.x,
                          top: el.y,
                          width: el.w,
                          height: el.h,
                          cursor: 'move'
                        }}
                      >
                        {el.type === 'text' && (
                          <div
                            className="w-full h-full flex items-center p-2"
                            style={{
                              fontSize: el.fontSize,
                              fontFamily: el.fontFamily,
                              fontWeight: el.bold ? 'bold' : 'normal',
                              fontStyle: el.italic ? 'italic' : 'normal',
                              color: el.color,
                              textAlign: el.align
                            }}
                          >
                            {el.text}
                          </div>
                        )}
                        {el.type === 'image' && (
                          <div className="w-full h-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                            {el.src ? (
                              <img src={el.src} alt={el.alt} className="max-w-full max-h-full object-contain" />
                            ) : (
                              <ImageIcon className="w-12 h-12 text-slate-400" />
                            )}
                          </div>
                        )}
                        {el.type === 'table' && (
                          <div className="w-full h-full border overflow-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-200">
                                <tr>
                                  {el.columns.map((col, i) => (
                                    <th key={i} className="border p-1 text-right">{col.label}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {el.columns.map((col, i) => (
                                    <td key={i} className="border p-1 text-slate-400 text-xs">مثال</td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Left Sidebar - Properties */}
          <div className="col-span-3">
            {selectedEl ? (
              <Card className="shadow-xl border-2 border-green-100">
                <CardHeader className="bg-gradient-to-r from-green-500 to-teal-500 text-white">
                  <CardTitle className="text-lg">خصائص العنصر</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {selectedEl.type === 'text' && (
                    <>
                      <div>
                        <Label className="text-xs">النص</Label>
                        <Input
                          value={selectedEl.text}
                          onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">الحجم</Label>
                          <Input
                            type="number"
                            value={selectedEl.fontSize}
                            onChange={(e) => updateElement(selectedEl.id, { fontSize: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">اللون</Label>
                          <Input
                            type="color"
                            value={selectedEl.color}
                            onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">الخط</Label>
                        <select
                          value={selectedEl.fontFamily}
                          onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                          className="w-full border rounded px-2 py-1 mt-1"
                        >
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Courier New</option>
                          <option value="Tahoma">Tahoma</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={selectedEl.bold ? 'default' : 'outline'}
                          onClick={() => updateElement(selectedEl.id, { bold: !selectedEl.bold })}
                        >
                          <Bold className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedEl.italic ? 'default' : 'outline'}
                          onClick={() => updateElement(selectedEl.id, { italic: !selectedEl.italic })}
                        >
                          <Italic className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateElement(selectedEl.id, { align: 'right' })}>
                          <AlignRight className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateElement(selectedEl.id, { align: 'center' })}>
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateElement(selectedEl.id, { align: 'left' })}>
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}

                  {selectedEl.type === 'image' && (
                    <>
                      <div>
                        <Label className="text-xs">رفع صورة</Label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, selectedEl.id)}
                          className="w-full mt-1 text-xs"
                        />
                      </div>
                    </>
                  )}

                  {selectedEl.type === 'table' && (
                    <>
                      <div>
                        <Label className="text-xs font-semibold">أعمدة الجدول</Label>
                        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                          {TABLE_COLUMNS.map(col => (
                            <label key={col.key} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={selectedEl.columns.some(c => c.key === col.key)}
                                onChange={(e) => {
                                  const newCols = e.target.checked
                                    ? [...selectedEl.columns, col]
                                    : selectedEl.columns.filter(c => c.key !== col.key);
                                  updateElement(selectedEl.id, { columns: newCols });
                                }}
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                    <div>
                      <Label className="text-xs">X</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedEl.x)}
                        onChange={(e) => updateElement(selectedEl.id, { x: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Y</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedEl.y)}
                        onChange={(e) => updateElement(selectedEl.id, { y: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">العرض</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedEl.w)}
                        onChange={(e) => updateElement(selectedEl.id, { w: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">الارتفاع</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedEl.h)}
                        onChange={(e) => updateElement(selectedEl.id, { h: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => deleteElement(selectedEl.id)}
                    variant="destructive"
                    size="sm"
                    className="w-full mt-4"
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    حذف العنصر
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xl">
                <CardContent className="p-12 text-center text-slate-400">
                  <Move className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">اختر عنصراً لتعديل خصائصه</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoiceDesignerStudio;
