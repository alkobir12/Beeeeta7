import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, User, Car, Wrench, Plus, Check, Search } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { vehicleAPI, serviceAPI, technicianAPI, customerAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { resolveBackendBase } from '../utils/backendBase';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${resolveBackendBase() || ''}/api`.replace('//api', '/api')
);

const NewVehicle = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  
  // Customer Search State
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [existingCustomerId, setExistingCustomerId] = useState(null);

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

  // Fetch Services & Technicians
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

  // Search Customers Live
  useEffect(() => {
    const searchCustomers = async () => {
      if (!customerSearch || customerSearch.length < 2) {
        setCustomerResults([]);
        return;
      }
      try {
        const res = await customerAPI.getAll(); // Ideally use a search API
        const all = res.data || [];
        const filtered = all.filter(c => 
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
          c.phone.includes(customerSearch) ||
          String(c.fileNumber || '').toLowerCase().includes(customerSearch.toLowerCase())
        );
        setCustomerResults(filtered.slice(0, 5));
        setShowCustomerResults(true);
      } catch (e) {
        console.error("Customer search failed", e);
      }
    };
    
    // Debounce
    const timeout = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch]);

  const selectCustomer = (customer) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email || '',
    }));
    setExistingCustomerId(customer.id);
    setCustomerSearch('');
    setShowCustomerResults(false);
    toast({ title: 'تم اختيار العميل', description: `تم اختيار العميل: ${customer.name}` });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plateNumber || !formData.customerName || !formData.customerPhone || !formData.brand) {
      toast({ title: t('common.error'), description: t('forms.required_field'), variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      
      // If customer exists, we might need to update them or just link
      // The backend 'create vehicle' usually creates customer if not found by phone
      // To ensure we link to EXISTING customer ID if selected, we might need logic in backend
      // But standard way: backend looks up by phone. So if phone matches, it links.
      
      const { data: createdVehicle } = await vehicleAPI.create(formData);

      // Create initial visit with selected services
      const items = [];
      (formData.services || []).forEach((name) => {
        items.push({
          itemType: 'service',
          name,
          quantity: 1,
          price: Number(formData.servicePrices?.[name] || 0),
        });
      });

      if (manualServiceName?.trim() && !((formData.services || []).includes(manualServiceName.trim()))) {
        items.push({
          itemType: 'service',
          name: manualServiceName.trim(),
          quantity: 1,
          price: Number(manualServicePrice || 0),
        });
      }

      await fetch(`${API_URL}/vehicles/${createdVehicle.id}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: new Date().toISOString(),
          status: 'in_progress',
          mileage: null,
          technicianId: formData.technicianId || null,
          notes: JSON.stringify({ items, text: formData.notes })
        })
      });

      toast({ title: t('common.success'), description: t('messages.success_saved') });
      
      // Navigate to the NEW vehicle page
      setTimeout(() => navigate(`/vehicle/${createdVehicle.id}`), 800);
      
    } catch (error) {
      console.error(error);
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: 'destructive' });
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
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pt-4 px-4 sm:px-0">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowRight size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">استقبال مركبة جديدة</h1>
          <p className="text-gray-500 mt-1">تسجيل بيانات المركبة والعميل</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-4 sm:px-0">
        
        {/* Customer Info & Search */}
        <div className="apple-card p-6 relative">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <User size={20} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">بيانات العميل</h2>
            </div>
            {existingCustomerId && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                عميل مسجل
              </span>
            )}
          </div>

          {/* Search Box */}
          <div className="mb-6 relative">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                className="apple-input pr-10"
                placeholder="ابحث عن عميل مسجل (الاسم أو الجوال)..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                onFocus={() => { if(customerSearch) setShowCustomerResults(true); }}
              />
            </div>
            
            {showCustomerResults && customerResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                {customerResults.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCustomer(c)}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <div className="font-bold text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500 flex gap-3">
                      <span>📱 {c.phone}</span>
                      {c.email && <span>✉️ {c.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">الاسم *</label>
              <input 
                required 
                className="apple-input" 
                placeholder="اسم العميل" 
                value={formData.customerName} 
                onChange={e => setFormData({...formData, customerName: e.target.value})} 
                readOnly={!!existingCustomerId} // Read only if selected from list
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">رقم الجوال *</label>
              <input 
                required 
                className="apple-input" 
                placeholder="05xxxxxxxx" 
                value={formData.customerPhone} 
                onChange={e => setFormData({...formData, customerPhone: e.target.value})} 
                readOnly={!!existingCustomerId}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">البريد الإلكتروني</label>
              <input 
                type="email" 
                className="apple-input" 
                placeholder="example@mail.com" 
                value={formData.customerEmail} 
                onChange={e => setFormData({...formData, customerEmail: e.target.value})} 
                readOnly={!!existingCustomerId}
              />
            </div>
            {existingCustomerId && (
              <div className="md:col-span-2 flex justify-end">
                <button 
                  type="button" 
                  onClick={() => {
                    setExistingCustomerId(null);
                    setFormData(prev => ({...prev, customerName: '', customerPhone: '', customerEmail: ''}));
                  }}
                  className="text-xs text-red-600 hover:text-red-800 underline"
                >
                  إلغاء الاختيار وإدخال عميل جديد
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Car size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">بيانات المركبة الجديدة</h2>
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
                onClick={async () => {
                  if (!manualServiceName.trim()) return;
                  
                  setFormData(prev => ({ ...prev, services: [...prev.services, manualServiceName] }));
                  if (manualServicePrice) {
                    setFormData(prev => ({ ...prev, servicePrices: {...prev.servicePrices, [manualServiceName]: manualServicePrice} }));
                  }
                  
                  try {
                    await fetch(`${API_URL}/services`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: manualServiceName.trim(),
                        category: 'يدوي',
                        price: parseFloat(manualServicePrice) || 0,
                        duration: 30,
                        active: true
                      })
                    });
                  } catch (err) {
                    console.log('⚠️ Could not save service to database:', err);
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
  );
};

export default NewVehicle;