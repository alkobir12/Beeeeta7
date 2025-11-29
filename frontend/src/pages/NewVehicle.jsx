import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, User, Car, Wrench, Plus, Check } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { vehicleAPI, serviceAPI, technicianAPI } from '../services/api';
import Layout from '../components/Layout';

const NewVehicle = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [formData, setFormData] = useState({
    plateNumber: '', brand: '', model: '', year: new Date().getFullYear(), color: '', vin: '', fileNumber: '',
    customerName: '', customerPhone: '', customerEmail: '',
    services: [], servicePrices: {}, technicianId: '', notes: ''
  });
  
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [manualServiceName, setManualServiceName] = useState('');
  const [manualServicePrice, setManualServicePrice] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, techniciansRes] = await Promise.all([
        serviceAPI.getAll(),
        technicianAPI.getAll()
      ]);
      setServices(servicesRes.data);
      setTechnicians(techniciansRes.data);
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plateNumber || !formData.customerName || !formData.customerPhone || !formData.brand) {
      toast({ title: 'تنبيه', description: 'الرجاء تعبئة الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      await vehicleAPI.create(formData);
      toast({ title: 'تم بنجاح', description: 'تم استقبال المركبة بنجاح' });
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في إضافة المركبة', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceName) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceName)
        ? prev.services.filter(name => name !== serviceName)
        : [...prev.services, serviceName]
    }));
  };
  
  const categories = ['all', ...new Set(services.map(s => s.category))];
  const filteredServices = services.filter(s => {
    return s.name.toLowerCase().includes(serviceSearch.toLowerCase()) && 
           (selectedCategory === 'all' || s.category === selectedCategory);
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pt-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowRight size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">استقبال مركبة جديدة</h1>
            <p className="text-gray-500 mt-1">تسجيل بيانات المركبة والعميل</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Info */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Car size={20} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">بيانات المركبة</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">رقم اللوحة *</label>
                <input required className="apple-input" placeholder="أ ب ج 1234" value={formData.plateNumber} onChange={e => setFormData({...formData, plateNumber: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">الماركة *</label>
                <input required className="apple-input" placeholder="تويوتا" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">الموديل *</label>
                <input required className="apple-input" placeholder="كامري" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">السنة *</label>
                <input required type="number" className="apple-input" placeholder="2024" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">اللون</label>
                <input className="apple-input" placeholder="أبيض" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">رقم الهيكل (VIN)</label>
                <input className="apple-input" placeholder="اختياري" value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <User size={20} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">بيانات العميل</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">الاسم *</label>
                <input required className="apple-input" placeholder="اسم العميل" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">رقم الجوال *</label>
                <input required className="apple-input" placeholder="05xxxxxxxx" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                <input type="email" className="apple-input" placeholder="example@mail.com" value={formData.customerEmail} onChange={e => setFormData({...formData, customerEmail: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                <Wrench size={20} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">الخدمات المطلوبة</h2>
            </div>

            <div className="flex gap-4 mb-6">
              <input 
                className="apple-input flex-1" 
                placeholder="بحث عن خدمة..." 
                value={serviceSearch} 
                onChange={e => setServiceSearch(e.target.value)} 
              />
              <select 
                className="apple-input w-40" 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">الكل</option>
                {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-2">
              {filteredServices.map(service => {
                const isSelected = formData.services.includes(service.name);
                return (
                  <div 
                    key={service.id} 
                    onClick={() => handleServiceToggle(service.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        <div className="text-xs text-gray-500">{service.category}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <input 
                        type="number" 
                        className="w-20 h-8 rounded-lg border border-blue-200 px-2 text-center text-sm focus:outline-none focus:border-blue-500"
                        placeholder="السعر"
                        onClick={e => e.stopPropagation()}
                        value={formData.servicePrices[service.name] || ''}
                        onChange={e => setFormData({
                          ...formData, 
                          servicePrices: {...formData.servicePrices, [service.name]: e.target.value}
                        })}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Manual Service */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-medium text-gray-900 mb-3">إضافة خدمة يدوية</h3>
              <div className="flex gap-3">
                <input 
                  className="apple-input flex-1 h-10 text-sm" 
                  placeholder="اسم الخدمة" 
                  value={manualServiceName} 
                  onChange={e => setManualServiceName(e.target.value)} 
                />
                <input 
                  className="apple-input w-24 h-10 text-sm" 
                  placeholder="السعر" 
                  type="number"
                  value={manualServicePrice} 
                  onChange={e => setManualServicePrice(e.target.value)} 
                />
                <button 
                  type="button"
                  onClick={() => {
                    if (!manualServiceName.trim()) return;
                    setFormData(prev => ({ ...prev, services: [...prev.services, manualServiceName] }));
                    if (manualServicePrice) {
                      setFormData(prev => ({ ...prev, servicePrices: {...prev.servicePrices, [manualServiceName]: manualServicePrice} }));
                    }
                    setManualServiceName('');
                    setManualServicePrice('');
                  }}
                  className="h-10 w-10 rounded-lg bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="apple-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">تعيين الفني</label>
                <select 
                  className="apple-input" 
                  value={formData.technicianId} 
                  onChange={e => setFormData({...formData, technicianId: e.target.value})}
                >
                  <option value="">اختر الفني المسؤول...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name} - {t.specialty}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">ملاحظات</label>
                <textarea 
                  className="apple-input h-32 py-3 resize-none" 
                  placeholder="ملاحظات إضافية..." 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 apple-button h-14 text-lg font-semibold shadow-lg shadow-blue-500/20"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ واستقبال المركبة'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default NewVehicle;
