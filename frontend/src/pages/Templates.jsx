import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { FileText, Plus, Edit, Trash2, Download, Upload, Printer, Eye } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Templates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'invoice',
    content: '',
    styles: ''
  });

  const defaultTemplates = {
    invoice: {
      name: 'فاتورة بيع',
      type: 'invoice',
      content: `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * { font-family: 'Arial', sans-serif; }
    body { padding: 40px; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 32px; font-weight: bold; color: #1e40af; margin-bottom: 10px; }
    .company-info { color: #64748b; font-size: 14px; }
    .invoice-title { font-size: 28px; font-weight: bold; color: #1e293b; margin: 30px 0; }
    .info-section { display: flex; justify-content: space-between; margin: 30px 0; }
    .info-box { flex: 1; padding: 20px; background: #f8fafc; border-radius: 8px; margin: 0 10px; }
    .info-label { font-weight: bold; color: #475569; font-size: 14px; }
    .info-value { color: #1e293b; font-size: 16px; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { background: #2563eb; color: white; padding: 15px; text-align: right; font-size: 14px; }
    td { padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    tr:hover { background: #f8fafc; }
    .total-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0; }
    .total-row { display: flex; justify-content: space-between; margin: 15px 0; font-size: 18px; }
    .total-label { color: #475569; font-weight: 600; }
    .total-value { color: #1e293b; font-weight: bold; }
    .grand-total { background: #2563eb; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 2px solid #e2e8f0; padding-top: 30px; }
    .signature-section { display: flex; justify-content: space-around; margin-top: 80px; }
    .signature-box { text-align: center; width: 200px; }
    .signature-line { border-top: 2px solid #64748b; margin-top: 60px; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">{{WORKSHOP_NAME}}</div>
    <div class="company-info">
      العنوان: {{WORKSHOP_ADDRESS}} | الجوال: {{WORKSHOP_PHONE}} | الرقم الضريبي: {{TAX_NUMBER}}
    </div>
  </div>

  <div class="invoice-title">فاتورة رقم: {{INVOICE_NUMBER}}</div>

  <div class="info-section">
    <div class="info-box">
      <div class="info-label">معلومات العميل</div>
      <div class="info-value">{{CUSTOMER_NAME}}</div>
      <div class="info-value">{{CUSTOMER_PHONE}}</div>
    </div>
    <div class="info-box">
      <div class="info-label">معلومات المركبة</div>
      <div class="info-value">{{VEHICLE_PLATE}}</div>
      <div class="info-value">{{VEHICLE_MODEL}}</div>
    </div>
    <div class="info-box">
      <div class="info-label">التاريخ</div>
      <div class="info-value">{{INVOICE_DATE}}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>الخدمة/القطعة</th>
        <th>الصنف</th>
        <th>الوحدة</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      {{ITEMS_LIST}}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <span class="total-label">المجموع الفرعي:</span>
      <span class="total-value">{{SUBTOTAL}} ر.س</span>
    </div>
    <div class="total-row">
      <span class="total-label">الضريبة (15%):</span>
      <span class="total-value">{{TAX_AMOUNT}} ر.س</span>
    </div>
    <div class="grand-total total-row">
      <span class="total-label">الإجمالي النهائي:</span>
      <span class="total-value">{{TOTAL}} ر.س</span>
    </div>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-line">توقيع العميل</div>
    </div>
    <div class="signature-box">
      <div class="signature-line">توقيع المسؤول</div>
    </div>
  </div>

  <div class="footer">
    <p>شكراً لثقتكم بنا | نتطلع لخدمتكم مرة أخرى</p>
    <p>{{WORKSHOP_NAME}} - جميع الحقوق محفوظة</p>
  </div>
</body>
</html>
      `,
      styles: ''
    },
    diagnosis: {
      name: 'تقرير تشخيص',
      type: 'diagnosis',
      content: `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * { font-family: 'Arial', sans-serif; }
    body { padding: 40px; background: #f8fafc; }
    .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 4px solid #ef4444; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 32px; font-weight: bold; color: #dc2626; }
    .report-title { font-size: 28px; font-weight: bold; color: #1e293b; margin: 30px 0; text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; border-radius: 8px; }
    .vehicle-info { background: #fef2f2; padding: 25px; border-radius: 8px; border-right: 4px solid #ef4444; margin: 20px 0; }
    .info-row { display: flex; margin: 10px 0; }
    .info-label { font-weight: bold; color: #991b1b; width: 150px; }
    .info-value { color: #1e293b; flex: 1; }
    .section { margin: 40px 0; }
    .section-title { font-size: 22px; font-weight: bold; color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 10px; margin-bottom: 20px; }
    .problem-item { background: #fff7ed; padding: 20px; margin: 15px 0; border-radius: 8px; border-right: 4px solid #f97316; }
    .problem-title { font-weight: bold; color: #ea580c; font-size: 18px; margin-bottom: 10px; }
    .problem-desc { color: #475569; line-height: 1.8; }
    .severity { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-right: 10px; }
    .severity-high { background: #fee2e2; color: #dc2626; }
    .severity-medium { background: #fed7aa; color: #ea580c; }
    .severity-low { background: #fef3c7; color: #d97706; }
    .recommendation { background: #f0fdf4; padding: 20px; border-radius: 8px; border-right: 4px solid #22c55e; margin: 15px 0; }
    .recommendation-title { font-weight: bold; color: #16a34a; margin-bottom: 10px; }
    .cost-estimate { background: #eff6ff; padding: 25px; border-radius: 8px; border: 2px solid #3b82f6; margin: 30px 0; }
    .cost-row { display: flex; justify-content: space-between; margin: 15px 0; font-size: 18px; }
    .cost-total { background: #1e40af; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .footer { margin-top: 50px; text-align: center; color: #64748b; padding-top: 30px; border-top: 2px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">{{WORKSHOP_NAME}}</div>
      <div style="color: #64748b; margin-top: 10px;">تقرير فحص وتشخيص فني</div>
    </div>

    <div class="report-title">تقرير التشخيص الفني</div>

    <div class="vehicle-info">
      <div class="info-row">
        <span class="info-label">رقم اللوحة:</span>
        <span class="info-value">{{VEHICLE_PLATE}}</span>
      </div>
      <div class="info-row">
        <span class="info-label">نوع المركبة:</span>
        <span class="info-value">{{VEHICLE_MODEL}}</span>
      </div>
      <div class="info-row">
        <span class="info-label">اسم العميل:</span>
        <span class="info-value">{{CUSTOMER_NAME}}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الفحص:</span>
        <span class="info-value">{{DIAGNOSIS_DATE}}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الفني المسؤول:</span>
        <span class="info-value">{{TECHNICIAN_NAME}}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">المشاكل المكتشفة</div>
      {{PROBLEMS_LIST}}
    </div>

    <div class="section">
      <div class="section-title">التوصيات والحلول</div>
      {{RECOMMENDATIONS_LIST}}
    </div>

    <div class="cost-estimate">
      <div style="font-size: 22px; font-weight: bold; color: #1e40af; margin-bottom: 20px;">التكلفة التقديرية</div>
      {{COST_ITEMS}}
      <div class="cost-total">
        <div class="cost-row">
          <span>التكلفة الإجمالية المتوقعة:</span>
          <span style="font-size: 24px;">{{TOTAL_COST}} ر.س</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p><strong>ملاحظة:</strong> هذا التقرير صالح لمدة 30 يوماً من تاريخ الإصدار</p>
      <p>للاستفسار: {{WORKSHOP_PHONE}} | {{WORKSHOP_ADDRESS}}</p>
      <p style="margin-top: 20px; color: #94a3b8;">{{WORKSHOP_NAME}} - نخدمكم بكل ثقة واحترافية</p>
    </div>
  </div>
</body>
</html>
      `,
      styles: ''
    },
    quotation: {
      name: 'عرض سعر',
      type: 'quotation',
      content: `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * { font-family: 'Arial', sans-serif; }
    body { padding: 40px; }
    .header { text-align: center; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .company-name { font-size: 32px; font-weight: bold; }
    .quote-title { font-size: 28px; font-weight: bold; color: #6d28d9; margin: 30px 0; text-align: center; }
    .quote-number { background: #f5f3ff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px dashed #8b5cf6; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
    .info-card { background: #faf5ff; padding: 20px; border-radius: 8px; border-right: 4px solid #8b5cf6; }
    .card-title { font-weight: bold; color: #6d28d9; margin-bottom: 15px; font-size: 16px; }
    .card-item { margin: 8px 0; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { background: #8b5cf6; color: white; padding: 15px; text-align: right; }
    td { padding: 15px; border-bottom: 1px solid #e9d5ff; text-align: right; }
    .item-name { font-weight: 600; color: #1e293b; }
    .item-desc { color: #64748b; font-size: 14px; margin-top: 5px; }
    .price-breakdown { background: #faf5ff; padding: 25px; border-radius: 8px; margin: 30px 0; }
    .price-row { display: flex; justify-content: space-between; margin: 15px 0; font-size: 18px; }
    .price-label { color: #6d28d9; font-weight: 600; }
    .price-value { color: #1e293b; font-weight: bold; }
    .grand-total { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .validity { background: #fef3c7; padding: 20px; border-radius: 8px; border-right: 4px solid #f59e0b; margin: 30px 0; }
    .terms { margin-top: 40px; padding: 25px; background: #f8fafc; border-radius: 8px; }
    .terms-title { font-weight: bold; color: #1e293b; margin-bottom: 15px; font-size: 18px; }
    .terms-list { color: #475569; line-height: 2; }
    .footer { text-align: center; margin-top: 50px; padding-top: 30px; border-top: 2px solid #e9d5ff; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">{{WORKSHOP_NAME}}</div>
    <div style="margin-top: 10px; font-size: 16px;">عرض سعر شامل للخدمات والقطع</div>
  </div>

  <div class="quote-title">عرض السعر</div>

  <div class="quote-number">
    <strong style="color: #6d28d9;">رقم العرض:</strong> {{QUOTE_NUMBER}} | 
    <strong style="color: #6d28d9;">التاريخ:</strong> {{QUOTE_DATE}}
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="card-title">معلومات العميل</div>
      <div class="card-item"><strong>الاسم:</strong> {{CUSTOMER_NAME}}</div>
      <div class="card-item"><strong>الجوال:</strong> {{CUSTOMER_PHONE}}</div>
      <div class="card-item"><strong>البريد:</strong> {{CUSTOMER_EMAIL}}</div>
    </div>
    <div class="info-card">
      <div class="card-title">معلومات المركبة</div>
      <div class="card-item"><strong>اللوحة:</strong> {{VEHICLE_PLATE}}</div>
      <div class="card-item"><strong>الطراز:</strong> {{VEHICLE_MODEL}}</div>
      <div class="card-item"><strong>السنة:</strong> {{VEHICLE_YEAR}}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%">البند</th>
        <th>الصنف</th>
        <th>الوحدة</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      {{QUOTE_ITEMS}}
    </tbody>
  </table>

  <div class="price-breakdown">
    <div class="price-row">
      <span class="price-label">المجموع الفرعي:</span>
      <span class="price-value">{{SUBTOTAL}} ر.س</span>
    </div>
    <div class="price-row">
      <span class="price-label">الخصم:</span>
      <span class="price-value">- {{DISCOUNT}} ر.س</span>
    </div>
    <div class="price-row">
      <span class="price-label">الضريبة (15%):</span>
      <span class="price-value">{{TAX_AMOUNT}} ر.س</span>
    </div>
    <div class="grand-total price-row">
      <span class="price-label">الإجمالي النهائي:</span>
      <span class="price-value" style="font-size: 24px;">{{TOTAL}} ر.س</span>
    </div>
  </div>

  <div class="validity">
    <strong style="color: #d97706;">⏱ صلاحية العرض:</strong> هذا العرض صالح لمدة {{VALIDITY_DAYS}} يوم من تاريخ الإصدار
  </div>

  <div class="terms">
    <div class="terms-title">الشروط والأحكام:</div>
    <div class="terms-list">
      • الأسعار المذكورة شاملة ضريبة القيمة المضافة<br>
      • يتم الدفع نقداً أو بالشبكة عند استلام المركبة<br>
      • قد تتغير الأسعار في حال اكتشاف مشاكل إضافية<br>
      • الورشة غير مسؤولة عن الأغراض الشخصية داخل المركبة<br>
      • يتم الالتزام بمدة التسليم المحددة ما لم تطرأ ظروف استثنائية
    </div>
  </div>

  <div class="footer">
    <p style="font-size: 18px; margin-bottom: 10px;"><strong>للموافقة على العرض، يرجى التواصل معنا</strong></p>
    <p>الجوال: {{WORKSHOP_PHONE}} | العنوان: {{WORKSHOP_ADDRESS}}</p>
    <p style="margin-top: 20px;">{{WORKSHOP_NAME}} - نسعد بخدمتكم</p>
  </div>
</body>
</html>
      `,
      styles: ''
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/templates`);
      const list = response.data || [];
      if (!Array.isArray(list) || list.length === 0) {
        setTemplates([
          { id: '1', ...defaultTemplates.invoice },
          { id: '2', ...defaultTemplates.diagnosis },
          { id: '3', ...defaultTemplates.quotation }
        ]);
      } else {
        setTemplates(list);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      // If no templates, use defaults
      setTemplates([
        { id: '1', ...defaultTemplates.invoice },
        { id: '2', ...defaultTemplates.diagnosis },
        { id: '3', ...defaultTemplates.quotation }
      ]);
    } finally {
      setLoading(false);
    }

  const makeDefault = async (templateId) => {
    try {
      await axios.post(`${API_URL}/templates/${templateId}/make-default`);
      toast({ title: 'تم التفعيل', description: 'تم جعل هذا النموذج افتراضياً لنوعه' });
      fetchTemplates();
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'تعذر جعل النموذج افتراضياً', variant: 'destructive' });
    }
  };

  const applyToAll = async (templateId) => {
    try {
      await axios.post(`${API_URL}/templates/${templateId}/apply-to-all`);
      toast({ title: 'تم التطبيق', description: 'تم تطبيق هذا النموذج على جميع الأنواع' });
      fetchTemplates();
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'تعذر تطبيق النموذج على جميع الأنواع', variant: 'destructive' });
    }
  };

  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await axios.put(`${API_URL}/templates/${editingTemplate.id}`, formData);
        toast({ title: "نجح", description: "تم تحديث النموذج بنجاح" });
      } else {
        await axios.post(`${API_URL}/templates`, formData);
        toast({ title: "نجح", description: "تم إضافة النموذج بنجاح" });
      }
      setShowEditor(false);
      setEditingTemplate(null);
      setFormData({ name: '', type: 'invoice', content: '', styles: '' });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({ title: "خطأ", description: "فشل في حفظ النموذج", variant: "destructive" });
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      content: template.content,
      styles: template.styles || ''
    });
    setShowEditor(true);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا النموذج؟')) return;
    try {
      await axios.delete(`${API_URL}/templates/${templateId}`);
      toast({ title: "نجح", description: "تم حذف النموذج بنجاح" });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: "خطأ", description: "فشل في حذف النموذج", variant: "destructive" });
    }
  };

  const handleExport = (template) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_${template.name}.json`;
    link.click();
    toast({ title: "نجح", description: "تم تصدير النموذج بنجاح" });
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setFormData({
          name: imported.name || '',
          type: imported.type || 'invoice',
          content: imported.content || '',
          styles: imported.styles || ''
        });
        setShowEditor(true);
        toast({ title: "نجح", description: "تم استيراد النموذج بنجاح" });
      } catch (error) {
        toast({ title: "خطأ", description: "فشل في استيراد النموذج", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    // Open in new window
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(template.content);
    previewWindow.document.close();
  };

  const loadDefaultTemplate = (type) => {
    const template = defaultTemplates[type];
    setFormData({
      name: template.name,
      type: template.type,
      content: template.content,
      styles: template.styles
    });
    setShowEditor(true);
  };

  const getTypeLabel = (type) => {
    const types = {
      invoice: 'فاتورة',
      diagnosis: 'تشخيص',
      quotation: 'عرض سعر'
    };
    return types[type] || type;
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      invoice: 'bg-blue-100 text-blue-700',
      diagnosis: 'bg-red-100 text-red-700',
      quotation: 'bg-purple-100 text-purple-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">جاري التحميل...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">إدارة النماذج</h1>
              <p className="text-slate-600">نماذج الفواتير والتقارير والعروض</p>
            </div>
            <div className="flex gap-2">
              <label htmlFor="import-template">
                <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" asChild>
                  <span>
                    <Upload size={20} className="ml-2" />
                    استيراد نموذج
                  </span>
                </Button>
                <input
                  id="import-template"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <Button
                onClick={() => {
                  setShowEditor(true);
                  setEditingTemplate(null);
                  setFormData({ name: '', type: 'invoice', content: '', styles: '' });
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={20} className="ml-2" />
                نموذج جديد
              </Button>
            </div>
          </div>

          {/* Quick Add Default Templates */}
          {templates.length === 0 && (
            <Card className="mb-6 shadow-lg border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 text-blue-900">ابدأ بالنماذج الجاهزة</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => loadDefaultTemplate('invoice')}
                    className="h-auto py-6 bg-blue-600 hover:bg-blue-700"
                  >
                    <div className="text-center">
                      <FileText size={32} className="mx-auto mb-2" />
                      <div className="font-bold">فاتورة بيع</div>
                      <div className="text-xs mt-1 opacity-80">نموذج فاتورة احترافي</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => loadDefaultTemplate('diagnosis')}
                    className="h-auto py-6 bg-red-600 hover:bg-red-700"
                  >
                    <div className="text-center">
                      <FileText size={32} className="mx-auto mb-2" />
                      <div className="font-bold">تقرير تشخيص</div>
                      <div className="text-xs mt-1 opacity-80">تقرير فني مفصل</div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => loadDefaultTemplate('quotation')}
                    className="h-auto py-6 bg-purple-600 hover:bg-purple-700"
                  >
                    <div className="text-center">
                      <FileText size={32} className="mx-auto mb-2" />
                      <div className="font-bold">عرض سعر</div>
                      <div className="text-xs mt-1 opacity-80">عرض سعر شامل</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Editor */}
          {showEditor && (
            <Card className="mb-6 shadow-lg border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle>
                  {editingTemplate ? 'تعديل النموذج' : 'نموذج جديد'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>اسم النموذج *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="مثال: فاتورة بيع احترافية"
                        required
                      />
                    </div>
                    <div>
                      <Label>نوع النموذج *</Label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                        required
                      >
                        <option value="invoice">فاتورة</option>
                        <option value="diagnosis">تشخيص</option>
                        <option value="quotation">عرض سعر</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <Label>محتوى النموذج (HTML) *</Label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({...formData, content: e.target.value})}
                      placeholder="أدخل كود HTML للنموذج..."
                      rows={15}
                      className="font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      المتغيرات المتاحة: {`{{WORKSHOP_NAME}}, {{CUSTOMER_NAME}}, {{VEHICLE_PLATE}}`}, إلخ...
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      {editingTemplate ? 'تحديث' : 'حفظ'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowEditor(false);
                        setEditingTemplate(null);
                        setFormData({ name: '', type: 'invoice', content: '', styles: '' });
                      }}
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handlePreview(formData)}
                      className="mr-auto"
                    >
                      <Eye size={16} className="ml-2" />
                      معاينة
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Templates List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <Card key={template.id} className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="bg-gradient-to-l from-slate-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge className={getTypeBadgeColor(template.type)}>
                      {getTypeLabel(template.type)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(template)}
                      className="flex-1"
                    >
                      <Eye size={16} className="ml-1" />
                      معاينة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(template)}
                      className="flex-1"
                    >
                      <Edit size={16} className="ml-1" />
                      تعديل
                    </Button>
                    <Button size="sm" variant="outline" onClick={()=>makeDefault(template.id)}>
                      اجعله افتراضياً
                    </Button>
                    <Button size="sm" variant="outline" onClick={()=>applyToAll(template.id)}>
                      تطبيق على كل الأنواع
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(template)}
                    >
                      <Download size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && !showEditor && (
            <Card className="shadow-md">
              <CardContent className="p-12 text-center">
                <FileText className="mx-auto text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 text-lg">لا توجد نماذج</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Templates;
