import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, Save, Printer } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import PrintPreview from './PrintPreview';

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
  
  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      initializeForm();
    } else {
      // ensure child preview dialog is closed before unmount to avoid portal removeChild errors
      if (previewOpen) setPreviewOpen(false);
    }
  }, [isOpen, documentType]);

  const loadTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/templates`);
      const filtered = res.data.filter(t => t.type === documentType || t.type === 'generic');
      setTemplates(filtered);
      if (filtered.length > 0) {
        setSelectedTemplate(filtered[0].id);
      }
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
    
    // Recalculate item total
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
    const discount = parseFloat(formData.discount)) || 0;
    const taxRate = 0.15; // 15% VAT
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
      if (documentType === 'diagnosis') {
        endpoint = '/diagnosis-cases';
      } else if (documentType === 'invoice') {
        endpoint = '/invoices';
      } else if (documentType === 'quote') {
        endpoint = '/quotes';
      } else if (documentType === 'receipt') {
        endpoint = '/customer-receipts';
        payload.amount = parseFloat(formData.total);
      }

      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      
      toast({ title: 'تم الحفظ', description: 'تم حفظ المستند بنجاح' });
      
      if (onSaved) onSaved(res.data);
      
      // Show preview
      await handlePreview(res.data.id);
      
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل في حفظ المستند', variant: 'destructive' });
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (documentId = null) => {
    try {
      setLoading(true);
      
      // First resolve the template
      if (selectedTemplate) {
        try {
          await axios.post(`${API_URL}/print/resolve-template`, {
            override_type: documentType,
            template_id: selectedTemplate
          });
        } catch (e) {
          console.warn('Template resolution failed, using default');
        }
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
      setPreviewHtml(res.data.html);
      // Open preview; ensure not closing parent simultaneously
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
      // Close child preview first to prevent portal removal race
      if (previewOpen) setPreviewOpen(false);
      // Defer parent close to next tick
      setTimeout(() => onClose?.(false), 0);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              إنشاء {docTitles[documentType]}
            </DialogTitle>
          </DialogHeader>

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

      <PrintPreview 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        title={docTitles[documentType]}
        html={previewHtml} 
      />
    </>
  );
};

export default DocumentFormDialog;
