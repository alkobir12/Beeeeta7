import React, { useState, useEffect, useMemo } from 'react';
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
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customerDirectory, setCustomerDirectory] = useState([]);
  const [remoteCustomerResults, setRemoteCustomerResults] = useState([]);
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim());
    }, 220);
    return () => clearTimeout(timeout);
  }, [customerSearch]);

  // Fetch Services & Technicians
  const fetchData = async () => {
    try {
      const [servicesRes, techniciansRes, customersRes] = await Promise.allSettled([
        serviceAPI.getAll(),
        technicianAPI.getAll(),
        customerAPI.getAll(),
      ]);
      if (servicesRes.status === 'fulfilled') {
        setServices(Array.isArray(servicesRes.value?.data) ? servicesRes.value.data : []);
      }
      if (techniciansRes.status === 'fulfilled') {
        setTechnicians(Array.isArray(techniciansRes.value?.data) ? techniciansRes.value.data : []);
      }
      if (customersRes.status === 'fulfilled') {
        setCustomerDirectory(Array.isArray(customersRes.value?.data) ? customersRes.value.data : []);
      }
    } catch (error) { console.error(error); }
  };

  const normalizeSearchString = (value) => String(value || '').toLowerCase().trim();

  const normalizeArabicDigits = (value) => String(value || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  const normalizePlateCanonical = (value) => {
    const transliterationMap = {
      ا: 'a', أ: 'a', إ: 'a', آ: 'a', ع: 'a',
      ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
      د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh',
      ص: 's', ض: 'd', ط: 't', ظ: 'z', غ: 'gh',
      ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n',
      ه: 'h', ة: 'h', و: 'w', ي: 'y', ى: 'y',
      p: 'p', v: 'v', g: 'g',
    };
    const cleaned = normalizeArabicDigits(value)
      .toLowerCase()
      .replace(/\s|-/g, '')
      .replace(/[^\u0600-\u06FF0-9a-z]/g, '');
    return Array.from(cleaned).map((char) => transliterationMap[char] || char).join('');
  };

  const normalizePlateSearch = (value) => normalizePlateCanonical(value);
  const readCustomerPlate = (customer) => {
    const candidates = [
      customer?.vehiclePlate,
      customer?.plateNumber,
      customer?.plate,
      customer?.latestVehiclePlate,
    ];
    const first = candidates.find((v) => String(v || '').trim().length > 0);
    return String(first || '').trim();
  };

  const customerSearchIndex = useMemo(() => {
    return (Array.isArray(customerDirectory) ? customerDirectory : []).map((customer) => {
      const plate = readCustomerPlate(customer);
      return {
        customer,
        name: normalizeSearchString(customer?.name),
        phone: String(customer?.phone || '').trim(),
        fileNumber: normalizeSearchString(customer?.fileNumber),
        plateRaw: plate,
        plate: normalizePlateSearch(plate),
        plateCanonical: normalizePlateCanonical(plate),
      };
    });
  }, [customerDirectory]);

  const customerResults = useMemo(() => {
    const q = normalizeSearchString(debouncedCustomerSearch);
    const qPlate = normalizePlateSearch(debouncedCustomerSearch);
    const qPlateCanonical = normalizePlateCanonical(debouncedCustomerSearch);
    if (!q) return [];
    const allowSingleCharacterPlateSearch = q.length === 1;

    const localMatches = customerSearchIndex.filter((entry) => (
      ((q.length >= 2) && entry.name.includes(q))
      || ((q.length >= 2) && entry.phone.includes(normalizeArabicDigits(debouncedCustomerSearch)))
      || ((q.length >= 2) && entry.fileNumber.includes(q))
      || (qPlate && entry.plate.includes(qPlate))
      || (qPlateCanonical && entry.plateCanonical.includes(qPlateCanonical))
      || (allowSingleCharacterPlateSearch && (entry.plate.startsWith(qPlate) || entry.plateCanonical.startsWith(qPlateCanonical)))
    ));

    const combined = [];
    const seen = new Set();
    const pushUnique = (customer) => {
      if (!customer) return;
      const key = String(customer.id || customer.phone || customer.name || Math.random());
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(customer);
    };

    localMatches.forEach((entry) => pushUnique(entry.customer));
    (remoteCustomerResults || []).forEach((entry) => pushUnique(entry));

    return combined.slice(0, 8);
  }, [customerSearchIndex, debouncedCustomerSearch, remoteCustomerResults]);

  useEffect(() => {
    const q = String(customerSearch || '').trim();
    const canShowByLength = q.length >= 2 || (q.length === 1 && customerResults.length > 0);
    setShowCustomerResults(canShowByLength && customerResults.length > 0);
  }, [customerSearch, customerResults]);

  useEffect(() => {
    const tryWarmCustomerDirectory = async () => {
      if ((customerDirectory || []).length > 0) return;
      if (!customerSearch || customerSearch.trim().length < 2) return;
      try {
        const res = await customerAPI.getAll();
        setCustomerDirectory(Array.isArray(res?.data) ? res.data : []);
      } catch {
        // ignore; fallback to empty results
      }
    };
    tryWarmCustomerDirectory();
  }, [customerDirectory, customerSearch]);

  useEffect(() => {
    let active = true;
    const query = String(debouncedCustomerSearch || '').trim();
    if (query.length < 1) {
      setRemoteCustomerResults([]);
      return () => { active = false; };
    }

    const fetchRemoteMatches = async () => {
      try {
        const res = await vehicleAPI.archiveSearch(query, 8);
        if (!active) return;
        const rows = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
        const mapped = rows.map((row, idx) => ({
          id: row.customerId || row.customer_id || row.id || `remote-${idx}`,
          name: row.customerName || row.customer_name || row.name || 'عميل',
          phone: row.customerPhone || row.customer_phone || row.phone || '',
          email: row.customerEmail || row.customer_email || row.email || '',
          vehiclePlate: row.plateNumber || row.plate || row.vehiclePlate || '',
          fileNumber: row.fileNumber || row.file_number || '',
        }));
        setRemoteCustomerResults(mapped);
      } catch {
        if (active) setRemoteCustomerResults([]);
      }
    };

    fetchRemoteMatches();
    return () => { active = false; };
  }, [debouncedCustomerSearch]);

  const selectCustomer = (customer) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email || '',
    }));
    setExistingCustomerId(customer.id);
    setCustomerSearch('');
    setDebouncedCustomerSearch('');
    setRemoteCustomerResults([]);
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
                placeholder="ابحث عن عميل مسجل (الاسم أو الجوال أو رقم اللوحة)..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                onFocus={() => { if(customerSearch) setShowCustomerResults(true); }}
                data-testid="new-vehicle-customer-search-input"
              />
            </div>
            
            {showCustomerResults && customerResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                {customerResults.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => selectCustomer(c)}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                    data-testid={`new-vehicle-customer-search-result-${c.id}`}
                  >
                    <div className="font-bold text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500 flex gap-3">
                      <span>📱 {c.phone}</span>
                      {(c.vehiclePlate || c.plateNumber || c.plate) && <span>🚘 {c.vehiclePlate || c.plateNumber || c.plate}</span>}
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
