import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Phone, Mail, MapPin, Trash2, Edit } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Suppliers = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', contactPerson: '', phone: '', email: '', address: '', city: '', category: '', rating: 5.0
  });

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/suppliers`);
      setSuppliers(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/suppliers`, formData);
      toast({ title: "تم الإضافة", description: "تم إضافة المورد بنجاح" });
      setShowModal(false);
      setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '', city: '', category: '', rating: 5.0 });
      fetchSuppliers();
    } catch (error) {
      toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" });
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الموردين</h1>
            <p className="text-gray-500 mt-1">إدارة قائمة الموردين</p>
          </div>
          <button onClick={() => setShowModal(true)} className="apple-button flex items-center gap-2">
            <Plus size={18} />
            <span>مورد جديد</span>
          </button>
        </div>

        <div className="apple-card p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              className="apple-input pr-10"
              placeholder="بحث عن مورد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map(supplier => (
              <div key={supplier.id} className="apple-card p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{supplier.name}</h3>
                      <p className="text-xs text-gray-500">{supplier.category || 'عام'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {supplier.contactPerson && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">المسؤول:</span>
                      <span>{supplier.contactPerson}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    <span dir="ltr">{supplier.phone}</span>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  {(supplier.city || supplier.address) && (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <span>{[supplier.city, supplier.address].filter(Boolean).join(' - ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">إضافة مورد جديد</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">اسم المورد *</label>
                    <input required className="apple-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">رقم الجوال *</label>
                    <input required className="apple-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">المسؤول</label>
                    <input className="apple-input" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">المدينة</label>
                    <input className="apple-input" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                  <input type="email" className="apple-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">العنوان</label>
                  <input className="apple-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">التصنيف</label>
                  <input className="apple-input" placeholder="مثال: قطع غيار، زيوت" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
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
    </Layout>
  );
};

export default Suppliers;
