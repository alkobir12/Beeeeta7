import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, Save, Printer, X, Download } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const DocumentFormDialog = ({ 
  isOpen, 
  onClose, 
  documentType, // 'diagnosis', 'invoice', 'quote', 'receipt'
  vehicle,
  onSaved 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [workshopProfile, setWorkshopProfile] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0
  });
  
  // Inline preview (avoid nested Dialog portals)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadWorkshopProfile();
      initializeForm();
    } else {
      // ensure child preview is closed to avoid portal removeChild errors
      if (previewOpen) setPreviewOpen(false);
    }
  }, [isOpen, documentType]);

  const loadWorkshopProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/profile`);
      setWorkshopProfile(res.data);
    } catch (e) {
      console.error('Failed to load workshop profile:', e);
    }
  };

  useEffect(() => {
    // write to iframe when previewOpen and html available
    if (previewOpen && iframeRef.current && previewHtml) {
      try {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        doc.open();
        doc.write(previewHtml);
        doc.close();
      } catch (e) {
        // ignore
      }
    }
  }, [previewOpen, previewHtml]);

  const loadTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/templates`);
      const filtered = res.data.filter(t => t.type === documentType || t.type === 'generic' || t.isActive);
      setTemplates(filtered);
      const active = filtered.find(t => t.isActive && (t.type === documentType));
      if (active) setSelectedTemplate(active.id);
      else if (filtered.length > 0) setSelectedTemplate(filtered[0].id);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const initializeForm = () => {
    const titles = {
      diagnosis: 'تقرير تشخيص المركبة',
      invoice: 'فاتورة',
      quote: 'عرض سعر',
      receipt: 'سند قبض'
    };
    
    setFormData({
      title: titles[documentType] || 'مستند',
      notes: '',
      items: vehicle?.services?.map(s => ({ name: s, quantity: 1, price: 0, total: 0 })) || [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0, total: 0 }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
    recalculateTotals();
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'price') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].price) || 0;
      newItems[index].total = qty * price;
    }
    
    setFormData(prev => ({ ...prev, items: newItems }));
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items = formData.items) => {
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const discount = parseFloat(formData.discount) || 0;
    const taxRate = 0.15;
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * taxRate;
    const total = afterDiscount + tax;
    
    setFormData(prev => ({
      ...prev,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2)
    }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'خطأ', description: 'العنوان مطلوب', variant: 'destructive' });
      return;
    }
    if (formData.items.length === 0) {
      toast({ title: 'خطأ', description: 'أضف بند واحد على الأقل', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        vehicleId: vehicle?.id,
        customerId: vehicle?.customerId,
        title: formData.title,
        notes: formData.notes,
        items: formData.items,
        subtotal: parseFloat(formData.subtotal),
        discount: parseFloat(formData.discount),
        tax: parseFloat(formData.tax),
        total: parseFloat(formData.total),
        templateId: selectedTemplate
      };

      let endpoint = '';
      if (documentType === 'diagnosis') endpoint = '/diagnosis-cases';
      else if (documentType === 'invoice') endpoint = '/invoices';
      else if (documentType === 'quote') endpoint = '/quotes';
      else if (documentType === 'receipt') { endpoint = '/customer-receipts'; payload.amount = parseFloat(formData.total); }

      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      toast({ title: 'تم الحفظ', description: 'تم حفظ المستند بنجاح' });
      if (onSaved) onSaved(res.data);
      await handlePreview();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل في حفظ المستند', variant: 'destructive' });
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    try {
      setLoading(true);
      if (selectedTemplate) {
        try {
          await axios.post(`${API_URL}/print/resolve-template`, { override_type: documentType, template_id: selectedTemplate });
        } catch (e) { /* ignore */ }
      }
      const renderData = {
        override_type: documentType,
        template_id: selectedTemplate,
        data: {
          WORKSHOP_NAME: 'ورشتي',
          WORKSHOP_ADDRESS: 'العنوان الرئيسي',
          WORKSHOP_PHONE: '0553280100',
          WORKSHOP_CITY: 'القصيم',
          TAX_NUMBER: '1131051365',
          CUSTOMER_NAME: vehicle?.customerName,
          CUSTOMER_PHONE: vehicle?.customerPhone,
          CUSTOMER_BALANCE: '0.00',
          VEHICLE_PLATE: vehicle?.plateNumber,
          VEHICLE_MODEL: `${vehicle?.brand || ''} ${vehicle?.model || ''}`,
          VEHICLE_YEAR: vehicle?.year,
          DOCUMENT_TITLE: formData.title,
          DOCUMENT_NOTES: formData.notes,
          FOOTER_NOTES: formData.notes,
          INVOICE_NO: `INV-${Date.now().toString().slice(-6)}`,
          items: formData.items,
          SUBTOTAL: formData.subtotal,
          DISCOUNT: formData.discount,
          TAX: formData.tax,
          TOTAL: formData.total,
          DATE: new Date().toLocaleDateString('ar-SA')
        }
      };
      const res = await axios.post(`${API_URL}/print/render`, renderData);
      setPreviewHtml(res.data.html || res.data?.html || res.data);
      setPreviewOpen(true);
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل في إنشاء المعاينة', variant: 'destructive' });
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const docTitles = {
    diagnosis: 'تقرير التشخيص',
    invoice: 'الفاتورة',
    quote: 'عرض السعر',
    receipt: 'سند القبض'
  };

  const handleDialogOpenChange = (v) => {
    if (!v) {
      if (previewOpen) setPreviewOpen(false);
      setTimeout(() => onClose?.(false), 0);
    }
  };

  const downloadHtml = () => {
    try {
      const blob = new Blob([previewHtml || ''], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitles[documentType] || 'document'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              إنشاء {docTitles[documentType]}
            </DialogTitle>
            <DialogDescription>املأ البيانات المطلوبة</DialogDescription>
          </DialogHeader>

          {/* Inline Preview Overlay */}
          {previewOpen && (
            <div className="fixed inset-0 bg-black/20 z-[60] flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-3 flex items-center justify-between border-b">
                  <div className="font-bold">معاينة — {docTitles[documentType]}</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={downloadHtml}><Download size={16} className="ml-1"/>تحميل HTML</Button>
                    <Button size="sm" onClick={()=>{ try{ const w = iframeRef.current?.contentWindow; w?.focus(); w?.print(); } catch(e){} }}>طباعة</Button>
                    <Button size="sm" variant="destructive" onClick={()=> setPreviewOpen(false)}><X size={16} className="ml-1"/>إغلاق</Button>
                  </div>
                </div>
                <div className="flex-1">
                  <iframe ref={iframeRef} title="doc-preview" style={{width:'100%',height:'100%',border:0}} />
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6 py-4">
            {/* Vehicle Info */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-slate-800 mb-2">{vehicle?.plateNumber}</h3>
              <p className="text-sm text-slate-600">{vehicle?.brand} {vehicle?.model} - {vehicle?.year}</p>
              <p className="text-sm text-slate-600">{vehicle?.customerName}</p>
            </div>

            {/* Template Selection */}
            <div>
              <Label>اختر النموذج</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نموذج الطباعة" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label>العنوان</Label>
              <Input 
                value={formData.title} 
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="عنوان المستند"
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-lg">البنود</Label>
                <Button onClick={addItem} size="sm" variant="outline">
                  <Plus size={16} className="ml-1" />
                  إضافة بند
                </Button>
              </div>

              <div className="space-y-2">
                {formData.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded">
                    <div className="col-span-5">
                      <Label className="text-xs">الاسم</Label>
                      <Input 
                        value={item.name}
                        onChange={e => updateItem(idx, 'name', e.target.value)}
                        placeholder="اسم الخدمة/الجزء"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">الكمية</Label>
                      <Input 
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">السعر</Label>
                      <Input 
                        type="number"
                        value={item.price}
                        onChange={e => updateItem(idx, 'price', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">المجموع</Label>
                      <Input 
                        type="number"
                        value={item.total}
                        disabled
                        className="bg-slate-100"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="font-bold">{formData.subtotal} ر.س</span>
              </div>
              <div className="flex justify-between items-center">
                <span>الخصم:</span>
                <Input 
                  type="number"
                  value={formData.discount}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, discount: e.target.value }));
                    recalculateTotals();
                  }}
                  className="w-32 text-right"
                />
              </div>
              <div className="flex justify-between">
                <span>الضريبة (15%):</span>
                <span className="font-bold">{formData.tax} ر.س</span>
              </div>
              <div className="flex justify-between text-xl border-t pt-2">
                <span className="font-bold">الإجمالي:</span>
                <span className="font-bold text-green-600">{formData.total} ر.س</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>ملاحظات</Label>
              <Textarea 
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                onClick={handleSave} 
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Save size={18} className="ml-2" />
                حفظ وطباعة
              </Button>
              <Button 
                onClick={() => handlePreview()}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <Printer size={18} className="ml-2" />
                معاينة فقط
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentFormDialog;
