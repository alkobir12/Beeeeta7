import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { FileText, Plus, Edit, Trash2, Download, Upload, Eye } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

const Templates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'invoice',
    content: '', // textarea binds to content; we map to html when saving
    styles: ''
  });

  const defaultTemplates = {
    invoice: {
      name: 'فاتورة بيع',
      type: 'invoice',
      content: `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>*{font-family:'Arial',sans-serif;}body{padding:40px}table{width:100%;border-collapse:collapse;margin:30px 0}th{background:#2563eb;color:#fff;padding:15px;text-align:right}td{padding:15px;border-bottom:1px solid #e2e8f0;text-align:right}</style></head><body><h1>{{WORKSHOP_NAME}}</h1><h2>فاتورة رقم: {{INVOICE_NUMBER}}</h2><table><thead><tr><th>الخدمة/القطعة</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{{ITEMS_LIST}}</tbody></table><div>الإجمالي: {{TOTAL}}</div></body></html>`
    },
    diagnosis: {
      name: 'تقرير تشخيص',
      type: 'diagnosis',
      content: `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"></head><body><h1>تقرير التشخيص</h1><table><thead><tr><th>البند</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{{ITEMS_LIST}}</tbody></table></body></html>`
    },
    quote: {
      name: 'عرض سعر',
      type: 'quote',
      content: `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"></head><body><h1>عرض سعر</h1><table><thead><tr><th>البند</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{{QUOTE_ITEMS}}</tbody></table></body></html>`
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/templates`);
      const list = response.data || [];
      setTemplates(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      // Fallback to defaults in-memory (not persisted)
      setTemplates([
        { id: 'tmp-1', ...defaultTemplates.invoice },
        { id: 'tmp-2', ...defaultTemplates.diagnosis },
        { id: 'tmp-3', ...defaultTemplates.quote }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Make default for its type (requires real DB id)
  const makeDefault = async (templateId) => {
    try {
      await axios.post(`${API_URL}/templates/${templateId}/make-default`);
      toast({ title: 'تم التفعيل', description: 'تم جعل هذا النموذج افتراضياً لنوعه' });
      fetchTemplates();
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'تعذر جعل النموذج افتراضياً (تأكد أن النموذج محفوظ وليس مؤقتاً)', variant: 'destructive' });
    }
  };

  // Apply template HTML to all types and activate them
  const applyToAll = async (templateId) => {
    try {
      await axios.post(`${API_URL}/templates/${templateId}/apply-to-all`);
      toast({ title: 'تم التطبيق', description: 'تم تطبيق هذا النموذج على جميع الأنواع' });
      fetchTemplates();
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'تعذر تطبيق النموذج على جميع الأنواع (تأكد أن النموذج محفوظ وليس مؤقتاً)', variant: 'destructive' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        html: formData.content, // map textarea to backend 'html'
        isActive: true
      };
      if (editingTemplate && editingTemplate.id && !String(editingTemplate.id).startsWith('tmp-')) {
        await axios.put(`${API_URL}/templates/${editingTemplate.id}`, payload);
        toast({ title: 'نجح', description: 'تم تحديث النموذج بنجاح' });
      } else {
        await axios.post(`${API_URL}/templates`, payload);
        toast({ title: 'نجح', description: 'تم إضافة النموذج بنجاح' });
      }
      setShowEditor(false);
      setEditingTemplate(null);
      setFormData({ name: '', type: 'invoice', content: '', styles: '' });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({ title: 'خطأ', description: 'فشل في حفظ النموذج', variant: 'destructive' });
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      type: template.type || 'invoice',
      content: template.html || template.content || '',
      styles: template.styles || ''
    });
    setShowEditor(true);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا النموذج؟')) return;
    try {
      await axios.delete(`${API_URL}/templates/${templateId}`);
      toast({ title: 'نجح', description: 'تم حذف النموذج بنجاح' });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: 'خطأ', description: 'فشل في حذف النموذج', variant: 'destructive' });
    }
  };

  const handleExport = (template) => {
    const exportObj = {
      name: template.name,
      type: template.type,
      html: template.html || template.content || ''
    };
    const dataStr = JSON.stringify(exportObj, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_${template.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'نجح', description: 'تم تصدير النموذج بنجاح' });
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const payload = {
          name: imported.name || 'نموذج مستورد',
          type: imported.type || 'invoice',
          html: imported.html || imported.content || ''
        };
        const res = await axios.post(`${API_URL}/templates`, payload);
        toast({ title: 'نجح', description: 'تم استيراد النموذج وحفظه' });
        fetchTemplates();
      } catch (error) {
        toast({ title: 'خطأ', description: 'فشل في استيراد النموذج', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const handlePreview = (template) => {
    const html = template.html || template.content || '';
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(html);
      previewWindow.document.close();
    }
  };

  const loadDefaultTemplate = (type) => {
    const template = defaultTemplates[type];
    setFormData({ name: template.name, type: template.type, content: template.content, styles: template.styles || '' });
    setShowEditor(true);
  };

  const getTypeLabel = (type) => {
    const types = { invoice: 'فاتورة', diagnosis: 'تشخيص', quote: 'عرض سعر', receipt: 'سند قبض' };
    return types[type] || type;
  };

  const getTypeBadgeColor = (type) => {
    const colors = { invoice: 'bg-blue-100 text-blue-700', diagnosis: 'bg-red-100 text-red-700', quote: 'bg-purple-100 text-purple-700', receipt: 'bg-amber-100 text-amber-700' };
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">إدارة النماذج</h1>
              <p className="text-slate-600">نماذج الفواتير والتقارير والعروض</p>
            </div>
            <div className="flex gap-2">
              <label htmlFor="import-template">
                <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" asChild>
                  <span><Upload size={20} className="ml-2" />استيراد نموذج</span>
                </Button>
                <input id="import-template" type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              <Button onClick={async ()=>{ try{ const res = await axios.get(`${API_URL}/templates/mechanic-default`, { params: { t: 'invoice' } }); const html = res.data?.html || ''; setShowEditor(true); setEditingTemplate(null); setFormData({ name: 'نموذج جديد (ميكانيكا)', type: 'invoice', content: html, styles: '' }); } catch(e){ setShowEditor(true); setEditingTemplate(null); setFormData({ name: '', type: 'invoice', content: defaultTemplates.invoice.content, styles: '' }); } }} className="bg-blue-600 hover:bg-blue-700">
                <Plus size={20} className="ml-2" />نموذج جديد
              </Button>
            </div>
          </div>

          {showEditor && (
            <Card className="mb-6 shadow-lg border-2 border-blue-200">
              <CardHeader className="bg-blue-50"><CardTitle>{editingTemplate ? 'تعديل النموذج' : 'نموذج جديد'}</CardTitle></CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>اسم النموذج *</Label>
                      <Input value={formData.name} onChange={(e)=>setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div>
                      <Label>نوع النموذج *</Label>
                      <select value={formData.type} onChange={(e)=>setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-md" required>
                        <option value="invoice">فاتورة</option>
                        <option value="diagnosis">تشخيص</option>
                        <option value="quote">عرض سعر</option>
                        <option value="receipt">سند قبض</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>محتوى النموذج (HTML) *</Label>
                    <Textarea value={formData.content} onChange={(e)=>setFormData({...formData, content: e.target.value})} rows={15} className="font-mono text-sm" required />
                    <p className="text-xs text-slate-500 mt-2">المتغيرات المتاحة: {'{{WORKSHOP_NAME}}'}, {'{{CUSTOMER_NAME}}'}, {'{{VEHICLE_PLATE}}'} ...</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">{editingTemplate ? 'تحديث' : 'حفظ'}</Button>
                    <Button type="button" variant="outline" onClick={()=>{ setShowEditor(false); setEditingTemplate(null); setFormData({ name: '', type: 'invoice', content: '', styles: '' }); }}>إلغاء</Button>
                    <Button type="button" variant="outline" onClick={()=>handlePreview({ html: formData.content })} className="mr-auto"><Eye size={16} className="ml-2" />معاينة</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <Card key={template.id} className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="bg-gradient-to-l from-slate-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge className={getTypeBadgeColor(template.type)}>{getTypeLabel(template.type)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={()=>handlePreview(template)} className="flex-1"><Eye size={16} className="ml-1"/>معاينة</Button>
                    <Button size="sm" variant="outline" onClick={()=>handleEdit(template)} className="flex-1"><Edit size={16} className="ml-1"/>تعديل</Button>
                    <Button size="sm" variant="outline" onClick={()=>makeDefault(template.id)}>اجعله افتراضياً</Button>
                    <Button size="sm" variant="outline" onClick={()=>applyToAll(template.id)}>تطبيق على كل الأنواع</Button>
                    <Button size="sm" variant="outline" onClick={()=>handleExport(template)}><Download size={16}/></Button>
                    <Button size="sm" variant="destructive" onClick={()=>handleDelete(template.id)}><Trash2 size={16}/></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && !showEditor && (
            <Card className="shadow-md"><CardContent className="p-12 text-center"><FileText className="mx-auto text-slate-300 mb-4" size={64}/><p className="text-slate-500 text-lg">لا توجد نماذج</p></CardContent></Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Templates;
