import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

const Templates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'invoice', content: '' });

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/templates`);
      setTemplates(response.data?.templates || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: formData.name, type: formData.type, html: formData.content, isActive: true };
      if (editingTemplate?.id) {
        await axios.put(`${API_URL}/templates/${editingTemplate.id}`, payload);
        toast({ title: 'تم التحديث', description: 'تم تحديث النموذج بنجاح' });
      } else {
        await axios.post(`${API_URL}/templates`, payload);
        toast({ title: 'تم الإضافة', description: 'تم إضافة النموذج بنجاح' });
      }
      setShowEditor(false);
      setEditingTemplate(null);
      setFormData({ name: '', type: 'invoice', content: '' });
      fetchTemplates();
    } catch (error) { toast({ title: 'خطأ', variant: 'destructive' }); }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({ name: template.name || '', type: template.type || 'invoice', content: template.html || template.content || '' });
    setShowEditor(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await axios.delete(`${API_URL}/templates/${id}`);
      toast({ title: 'تم الحذف', description: 'تم حذف النموذج' });
      fetchTemplates();
    } catch (error) { toast({ title: 'خطأ', variant: 'destructive' }); }
  };

  return (
    
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة النماذج</h1>
            <p className="text-gray-500 mt-1">تخصيص نماذج الفواتير والتقارير</p>
          </div>
          <button onClick={() => { setShowEditor(true); setEditingTemplate(null); setFormData({ name: '', type: 'invoice', content: '' }); }} className="apple-button flex items-center gap-2">
            <Plus size={18} />
            <span>نموذج جديد</span>
          </button>
        </div>

        {showEditor && (
          <div className="apple-card p-6 border-2 border-blue-100">
            <h3 className="font-bold text-lg mb-4">{editingTemplate ? 'تعديل النموذج' : 'نموذج جديد'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input className="apple-input" placeholder="اسم النموذج" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                <select className="apple-input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="invoice">فاتورة</option>
                  <option value="diagnosis">تشخيص</option>
                  <option value="quote">عرض سعر</option>
                </select>
              </div>
              <textarea className="apple-input h-64 font-mono text-sm" placeholder="HTML Content..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} required />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowEditor(false)} className="apple-button-secondary">إلغاء</button>
                <button type="submit" className="apple-button">حفظ</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className="apple-card p-5 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{template.name}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{template.type}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-gray-50">
                <button onClick={() => handleEdit(template)} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Edit size={14} /> تعديل
                </button>
                <button onClick={() => handleDelete(template.id)} className="flex-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Trash2 size={14} /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    
  );
};

export default Templates;
