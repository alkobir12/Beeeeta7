import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, Tag, Clock } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { resolveBackendBase } from '../utils/backendBase';

const API_URL = `${resolveBackendBase()}/api`;

const ServicesManagement = () => {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', price: 0, duration: 30 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/services`);
      setServices(res.data || []);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await axios.put(`${API_URL}/services/${editingService.id}`, form);
        toast({ title: "تم التحديث", description: "تم تحديث الخدمة بنجاح" });
      } else {
        await axios.post(`${API_URL}/services`, form);
        toast({ title: "تم الإضافة", description: "تم إضافة الخدمة بنجاح" });
      }
      setShowModal(false);
      setEditingService(null);
      setForm({ name: '', category: '', price: 0, duration: 30 });
      load();
    } catch (e) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await axios.delete(`${API_URL}/services/${id}`);
      load();
    } catch (e) { console.error(e); }
  };

  const openModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setForm({
        name: service.name,
        category: service.category,
        price: service.price,
        duration: service.duration
      });
    } else {
      setEditingService(null);
      setForm({ name: '', category: '', price: 0, duration: 30 });
    }
    setShowModal(true);
  };

  const categories = ['all', ...new Set(services.map(s => s.category))];
  const filtered = services.filter(s => (category === 'all' || s.category === category) && s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الخدمات والأسعار</h1>
            <p className="text-gray-500 mt-1">إدارة قائمة الخدمات وأسعارها</p>
          </div>
          <button onClick={() => openModal()} className="apple-button flex items-center gap-2">
            <Plus size={18} />
            <span>خدمة جديدة</span>
          </button>
        </div>

        <div className="apple-card p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              className="apple-input pr-10"
              placeholder="بحث عن خدمة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="apple-input w-full sm:w-48"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'كل الفئات' : c}</option>)}
          </select>
        </div>

        <div className="grid gap-3">
          {filtered.map(service => (
            <div key={service.id} className="apple-card p-4 flex items-center justify-between group hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                  {service.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{service.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Tag size={12} /> {service.category}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {service.duration} دقيقة</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <span className="font-bold text-gray-900 text-lg">{Number(service.price).toFixed(2)} <span className="text-xs font-normal text-gray-500">ر.س</span></span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openModal(service)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(service.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{editingService ? 'تعديل خدمة' : 'إضافة خدمة جديدة'}</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">اسم الخدمة</label>
                  <input required className="apple-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">الفئة</label>
                  <input required className="apple-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">السعر (ر.س)</label>
                    <input type="number" className="apple-input" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">المدة (دقيقة)</label>
                    <input type="number" className="apple-input" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 apple-button-secondary">إلغاء</button>
                  <button type="submit" className="flex-1 apple-button">حفظ</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    
  );
};

export default ServicesManagement;