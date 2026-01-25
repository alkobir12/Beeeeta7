import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, FileText, ShoppingCart, CreditCard, User, Building2, Car, Clock, RefreshCw, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FloatingAIAssistant from '../components/FloatingAIAssistant';
import { financeAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const { t, i18n } = useTranslation();
  const { themeName } = useTheme();
  const isLight = themeName === 'light' || themeName === 'dashPro';
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [visits, setVisits] = useState([]);
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const [form, setForm] = useState({ 
    accountId: '', 
    vehicleId: '',
    visitId: '',
    // scope: يحدد هل العملية مرتبطة بمركبة أم عملية عامة للورشة
    scope: 'vehicle', // 'vehicle' | 'workshop'
    type: 'purchase', 
    partnerType: 'supplier', 
    partnerName: '', 
    items: [], 
    paymentMethod: 'cash', 
    notes: '',
    paymentReceipt: null
  });
  const [item, setItem] = useState({ 
    itemType: 'part', 
    itemId: '', 
    name: '', 
    quantity: 1, 
    price: 0 
  });

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const vehicleIdFromUrl = searchParams.get('vehicleId');
  const vehiclePlateFromUrl = searchParams.get('plate');

  const load = useCallback(async (showLoading = false) => {
    if (!isMountedRef.current) return;
    try {
      if (showLoading) setLoading(true);
      else setIsRefreshing(true);
      
      const operationsUrl = vehicleIdFromUrl 
        ? `${API_URL}/operations?vehicle_id=${vehicleIdFromUrl}` 
        : `${API_URL}/operations`;

      const [chartAccRes, partsRes, servicesRes, opsRes, vehRes] = await Promise.all([
        financeAPI.getChartOfAccounts(),
        axios.get(`${API_URL}/parts`),
        axios.get(`${API_URL}/services`),
        axios.get(operationsUrl),
        axios.get(`${API_URL}/vehicles`)
      ]);
      
      // 🔧 الإصلاح: استخراج البيانات بشكل آمن
      let accountsData = [];
      
      console.log('Chart Accounts API Response:', chartAccRes);
      
      if (chartAccRes?.data) {
        // الحالة 1: {success: true, data: [...]}
        if (chartAccRes.data.success && Array.isArray(chartAccRes.data.data)) {
          accountsData = chartAccRes.data.data;
        }
        // الحالة 2: المصفوفة مباشرة {data: [...]}
        else if (Array.isArray(chartAccRes.data.data)) {
          accountsData = chartAccRes.data.data;
        }
        // الحالة 3: مصفوفة مباشرة
        else if (Array.isArray(chartAccRes.data)) {
          accountsData = chartAccRes.data;
        }
        // الحالة 4: {accounts: [...]}
        else if (chartAccRes.data.accounts && Array.isArray(chartAccRes.data.accounts)) {
          accountsData = chartAccRes.data.accounts;
        }
      }
      
      console.log('Extracted Accounts:', accountsData);
      
      setAccounts(accountsData || []);
      setParts(partsRes.data || []);
      setServices(servicesRes.data || []);
      setOps(opsRes.data || []);
      setVehicles(vehRes.data || []);

      // إذا تم استدعاء الصفحة لمركبة محددة، نربط الفورم بهذه المركبة تلقائياً
      if (vehicleIdFromUrl) {
        setForm(prev => ({ ...prev, vehicleId: vehicleIdFromUrl }));
        
        // Load visits for this vehicle
        const visitsRes = await axios.get(`${API_URL}/vehicles/${vehicleIdFromUrl}/visits`);
        setVisits(visitsRes.data || []);
        
        // Set current visit if exists
        const activeVisit = visitsRes.data?.find(v => v.status === 'in_progress');
        if (activeVisit) {
          setForm(prev => ({ ...prev, visitId: activeVisit.id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [vehicleIdFromUrl]);

  useEffect(() => { load(true); }, [load]);

  const addItem = () => {
    if (!item.name && !item.itemId) return;
    const total = Number(item.quantity) * Number(item.price);
    setForm(prev => ({ ...prev, items: [...prev.items, { ...item, total }] }));
    setItem({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0 });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      // 1) إنشاء العملية التشغيلية
      const opRes = await axios.post(`${API_URL}/operations`, { ...form });
      const op = opRes.data;

      // 2) حساب إجمالي العملية من العناصر
      const total = subtotal;

      // 3) إيجاد الحسابات المحاسبية من دليل الحسابات السعودي
      const findAccountByCode = (code) => accounts.find((a) => a.code === code);

      const customerAccount = findAccountByCode('113'); // العملاء
      const supplierAccount = findAccountByCode('211'); // الموردين
      const serviceRevenueAccount = findAccountByCode('411'); // إيرادات صيانة السيارات
      const partsPurchaseAccount = findAccountByCode('514'); // شراء قطع الغيار

      // 4) بناء القيد المحاسبي وفقًا لنوع العملية
      const journalPayload = {
        entry_date: new Date().toISOString(),
        description:
          form.type === 'sale'
            ? `عملية بيع - ${form.partnerName || ''}`
            : `عملية شراء - ${form.partnerName || ''}`,
        reference: op?.id || null,
        lines: [],
      };

      if (form.type === 'sale' && customerAccount && serviceRevenueAccount) {
        journalPayload.lines = [
          {
            account_id: customerAccount.id,
            debit_amount: total,
            credit_amount: 0,
          },
          {
            account_id: serviceRevenueAccount.id,
            debit_amount: 0,
            credit_amount: total,
          },
        ];
      } else if (form.type === 'purchase' && partsPurchaseAccount && supplierAccount) {
        journalPayload.lines = [
          {
            account_id: partsPurchaseAccount.id,
            debit_amount: total,
            credit_amount: 0,
          },
          {
            account_id: supplierAccount.id,
            debit_amount: 0,
            credit_amount: total,
          },
        ];
      }

      // 5) إرسال القيد إلى نظام المحاسبة إذا تم تجهيز السطور
      if (journalPayload.lines.length === 2) {
        await financeAPI.createJournalEntry(journalPayload);
      } else {
        console.warn('لم يتم العثور على الحسابات المناسبة لإنشاء القيد المحاسبي');
      }

      // 6) إعادة ضبط النموذج وتحديث القائمة
      setForm({
        accountId: '',
        vehicleId: vehicleIdFromUrl || '',
        visitId: '',
        scope: vehicleIdFromUrl ? 'vehicle' : 'workshop',
        type: 'purchase',
        partnerType: 'supplier',
        partnerName: '',
        items: [],
        paymentMethod: 'cash',
        notes: '',
        paymentReceipt: null
      });
      await load();
    } catch (e) {
      console.error('Failed to save operation and journal entry:', e);
    }
  };

  const subtotal = form.items.reduce((s, it) => s + Number(it.total || 0), 0);

  // Theme-based styles
  const styles = {
    bg: isLight ? '#f8fafc' : '#0f172a',
    cardBg: isLight ? '#ffffff' : '#1e293b',
    cardBorder: isLight ? '#e2e8f0' : '#334155',
    textPrimary: isLight ? '#1e293b' : '#f1f5f9',
    textSecondary: isLight ? '#64748b' : '#94a3b8',
    textMuted: isLight ? '#94a3b8' : '#64748b',
    inputBg: isLight ? '#ffffff' : '#1e293b',
    inputBorder: isLight ? '#e2e8f0' : '#334155',
    hoverBg: isLight ? '#f1f5f9' : '#334155',
    tableBg: isLight ? '#f8fafc' : '#1e293b',
  };

  return (
    <div 
      className={`max-w-7xl mx-auto space-y-8 p-4 min-h-screen ${isRTL ? 'rtl' : 'ltr'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: styles.bg }}
    >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: styles.textPrimary }}>{t('operations.title')}</h1>
          <p className="mt-1" style={{ color: styles.textSecondary }}>{t('operations.subtitle')}</p>
        </div>

        {/* Create Operation Card */}
        <div 
          className="rounded-2xl p-6"
          style={{ 
            backgroundColor: styles.cardBg,
            border: `1px solid ${styles.cardBorder}`
          }}
        >
          <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${styles.cardBorder}` }}>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Plus size={20} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: styles.textPrimary }}>{t('operations.new_operation')}</h2>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* تصنيف العملية: مركبة / ورشة عامة */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">تصنيف العملية</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select
                    className="apple-input pr-10"
                    value={form.scope}
                    onChange={(e) => {
                      const scope = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        scope,
                        // إذا كانت عملية ورشة، نجعل المركبة والزيارة اختيارية
                        vehicleId: scope === 'workshop' ? '' : prev.vehicleId,
                        visitId: scope === 'workshop' ? '' : prev.visitId,
                      }));
                      if (scope === 'workshop') {
                        setVisits([]);
                      }
                    }}
                  >
                    <option value="vehicle">عملية مركبة</option>
                    <option value="workshop">عملية ورشة عامة</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('operations.account')}</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.accountId} 
                    onChange={e => setForm({ ...form, accountId: e.target.value })}
                  >
                    <option value="">{t('operations.select_account')}</option>
                    {/* 🔧 الإصلاح: تحقق من أن accounts مصفوفة قبل استخدام .map() */}
                    {Array.isArray(accounts) ? (
                      accounts.length > 0 ? (
                        accounts.map(a => (
                          <option key={a.id || a.code} value={a.id || a.code}>
                            {a.name_ar || a.name || a.code}
                          </option>
                        ))
                      ) : (
                        <option value="">لا توجد حسابات</option>
                      )
                    ) : (
                      <option value="">جاري تحميل الحسابات...</option>
                    )}
                  </select>
                </div>
              </div>

              {/* اختيار المركبة (يظهر فقط عندما يكون التصنيف = مركبة) */}
              {form.scope === 'vehicle' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('operations.vehicle')}</label>
                  <div className="relative">
                    <Car className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                      className="apple-input pr-10"
                      value={form.vehicleId} 
                      onChange={async (e) => {
                        const vehicleId = e.target.value;
                        setForm({ ...form, vehicleId, visitId: '' });
                        
                        // Load visits for selected vehicle
                        if (vehicleId) {
                          try {
                            const res = await axios.get(`${API_URL}/vehicles/${vehicleId}/visits`);
                            setVisits(res.data || []);
                            // Auto-select current visit if exists
                            const activeVisit = res.data?.find(v => v.status === 'in_progress');
                            if (activeVisit) {
                              setForm(prev => ({ ...prev, visitId: activeVisit.id }));
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        } else {
                          setVisits([]);
                        }
                      }}
                    >
                      <option value="">{t('operations.select_vehicle')}...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber} - {v.brand} {v.model}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* زيارة المركبة / التاريخ (أيضًا فقط في حالة مركبة) */}
              {form.scope === 'vehicle' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('operations.date')}</label>
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                      className="apple-input pr-10"
                      value={form.visitId || ''} 
                      onChange={e => setForm({ ...form, visitId: e.target.value })}
                      disabled={!form.vehicleId}
                    >
                      <option value="">---</option>
                      {visits.map(v => (
                        <option key={v.id} value={v.id}>
                          {new Date(v.entryDate || v.entry_date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')} 
                          {v.status === 'in_progress' ? ` (${t('status.in_progress')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('operations.operation_type')}</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.type} 
                    onChange={e => setForm({ ...form, type: e.target.value, partnerType: e.target.value === 'purchase' ? 'supplier' : 'customer' })}
                  >
                    <option value="purchase">{"Purchase"}</option>
                    <option value="sale">{"Sale"}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {/* TODO: يمكن لاحقًا توحيد هذا القسم أو إزالته إذا أصبح مكررًا مع حقل الحساب في الأعلى */}
                <label className="text-sm font-medium text-gray-700">{"Account"}</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.accountId || ''} 
                    onChange={e => setForm({ ...form, accountId: e.target.value })}
                  >
                    <option value="">{"Select Account"}</option>
                    {accounts.filter(acc => 
                      !acc.parent_id && !acc.parentId
                    ).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {form.partnerType === 'supplier' ? "Supplier Name" : "Customer Name"}
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    className="apple-input pr-10"
                    placeholder={"Name"} 
                    value={form.partnerName} 
                    onChange={e => setForm({ ...form, partnerName: e.target.value })} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{"Payment Method"}</label>
                <div className="relative">
                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.paymentMethod} 
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                  >
                    <option value="cash">{"Cash"}</option>
                    <option value="card">{"Card"}</option>
                    <option value="transfer">{"Transfer"}</option>
                    <option value="credit">{"Credit"}</option>
                  </select>
                </div>
              </div>

              {/* رفع إيصال الدفع */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  📎 إيصال الدفع (اختياري)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setForm({ ...form, paymentReceipt: file });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {form.paymentReceipt && (
                  <p className="text-xs text-green-600">✓ {form.paymentReceipt.name}</p>
                )}
              </div>
            </div>

            {/* Items Section */}
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-4">{"Add Items"}</label>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">{"Type"}</label>
                  <select 
                    className="apple-input h-9 text-sm"
                    value={item.itemType} 
                    onChange={e=>setItem({...item, itemType: e.target.value})}
                  >
                    <option value="part">{"Part"}</option>
                    <option value="service">{"Service"}</option>
                  </select>
                </div>
                
                <div className="md:col-span-4">
                  <label className="text-xs text-gray-500 mb-1 block">{"Items"}</label>
                  {item.itemType === 'part' ? (
                    <select 
                      className="apple-input h-9 text-sm"
                      value={item.itemId} 
                      onChange={e => { 
                        const it = parts.find(p=>p.id===e.target.value); 
                        setItem({...item, itemId: e.target.value, name: it?.name || '', price: it?.sellingPrice || 0}); 
                      }}
                    >
                      <option value="">{"Select Part"}</option>
                      {parts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : (
                    <select 
                      className="apple-input h-9 text-sm"
                      value={item.itemId} 
                      onChange={e => { 
                        const s = services.find(s=>s.id===e.target.value); 
                        setItem({...item, itemId: e.target.value, name: s?.name || '', price: s?.price || 0}); 
                      }}
                    >
                      <option value="">{"Select Service"}</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">{"Qty"}</label>
                  <input 
                    type="number" 
                    className="apple-input h-9 text-sm"
                    value={item.quantity} 
                    onChange={e=> setItem({...item, quantity: Number(e.target.value) || 0})} 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">{"Price"}</label>
                  <input 
                    type="number" 
                    className="apple-input h-9 text-sm"
                    value={item.price} 
                    onChange={e=> setItem({...item, price: Number(e.target.value) || 0})} 
                  />
                </div>

                <div className="md:col-span-2">
                  <button 
                    type="button" 
                    onClick={addItem}
                    className="apple-button w-full h-9 flex items-center justify-center gap-1 bg-gray-900 hover:bg-black"
                  >
                    <Plus size={16} />
                    <span>{"Add"}</span>
                  </button>
                </div>
              </div>

              {/* Items Table */}
              {form.items.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-3 text-right font-medium">{"Type"}</th>
                        <th className="p-3 text-right font-medium">{"Name"}</th>
                        <th className="p-3 text-right font-medium">{"Qty"}</th>
                        <th className="p-3 text-right font-medium">{"Price"}</th>
                        <th className="p-3 text-right font-medium">{"Total"}</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.items.map((it, idx)=> (
                        <tr key={idx}>
                          <td className="p-3 text-gray-600">{it.itemType==='part'? "Part" : "Service"}</td>
                          <td className="p-3 font-medium text-gray-900">{it.name}</td>
                          <td className="p-3 text-gray-600">{it.quantity}</td>
                          <td className="p-3 text-gray-600">{it.price}</td>
                          <td className="p-3 font-medium text-gray-900">{(Number(it.quantity)*Number(it.price)).toFixed(2)}</td>
                          <td className="p-3 text-left">
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = [...form.items];
                                newItems.splice(idx, 1);
                                setForm({...form, items: newItems});
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold text-gray-900">
                      <tr>
                        <td colSpan="4" className="p-3 text-left">{"Total"}:</td>
                        <td className="p-3 text-[#0071E3]">{subtotal.toFixed(2)} {"SAR"}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={form.items.length === 0}
                className="apple-button w-full sm:w-auto px-8 py-2 text-base"
              >
                {"Save"}
              </button>
            </div>
          </form>
        </div>

        {/* Recent Operations */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <FileText size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{"Recent Operations"}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="p-4 text-right font-medium">{"Date"}</th>
                  <th className="p-4 text-right font-medium">{"Operation Type"}</th>
                  <th className="p-4 text-right font-medium">{"Partner"}</th>
                  <th className="p-4 text-right font-medium">{"Items"}</th>
                  <th className="p-4 text-right font-medium">{"Total"}</th>
                  <th className="p-4 text-right font-medium">{"Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ops.map(op => (
                  <tr 
                    key={op.id} 
                    onClick={() => {
                      if (op.vehicleId) {
                        navigate(`/vehicle/${op.vehicleId}`);
                      }
                    }}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    <td className="p-4 text-gray-600">{new Date(op.date || op.op_date || op.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        op.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {op.type === 'sale' ? t('operations.sale') : t('operations.purchase')}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{op.partnerName || '-'}</td>
                    <td className="p-4 text-gray-500">{op.items?.length || 0}</td>
                    <td className="p-4 font-bold text-gray-900">{Number(op.total).toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (op.vehicleId) {
                              navigate(`/vehicle/${op.vehicleId}`);
                            }
                          }}
                          className="apple-button-secondary text-xs h-8 px-3"
                          disabled={!op.vehicleId}
                          title={t('quick_actions.details')}
                        >
                          {t('buttons.view')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(t('common.confirm_delete'))) return;
                            try {
                              await axios.delete(`${API_URL}/operations/${op.id}`);
                              await load();
                            } catch (e) {
                              console.error('Failed to delete operation:', e);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-2"
                          title={t('buttons.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      
      {/* المساعد المالي الذكي */}
      <FloatingAIAssistant context="operations" contextData={{ operations: ops, accounts }} />
    </div>
  );
};

export default Operations;
