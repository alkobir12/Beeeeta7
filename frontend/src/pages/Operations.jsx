import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, FileText, ShoppingCart, CreditCard, User, Building2 } from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [services, setServices] = useState([]);
  const [ops, setOps] = useState([]);
  const [form, setForm] = useState({ 
    accountId: '', 
    type: 'purchase', 
    partnerType: 'supplier', 
    partnerName: '', 
    items: [], 
    paymentMethod: 'cash', 
    notes: '' 
  });
  const [item, setItem] = useState({ 
    itemType: 'part', 
    itemId: '', 
    name: '', 
    quantity: 1, 
    price: 0 
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [accRes, partsRes, servicesRes, opsRes] = await Promise.all([
        axios.get(`${API_URL}/biz-accounts`),
        axios.get(`${API_URL}/parts`),
        axios.get(`${API_URL}/services`),
        axios.get(`${API_URL}/operations`)
      ]);
      setAccounts(accRes.data || []);
      setParts(partsRes.data || []);
      setServices(servicesRes.data || []);
      setOps(opsRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const addItem = () => {
    if (!item.name && !item.itemId) return;
    const total = Number(item.quantity) * Number(item.price);
    setForm(prev => ({ ...prev, items: [...prev.items, { ...item, total }] }));
    setItem({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0 });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/operations`, { ...form });
      setForm({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '' });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const subtotal = form.items.reduce((s, it) => s + Number(it.total || 0), 0);

  return (
    
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">العمليات والمبيعات</h1>
          <p className="text-gray-500 mt-1">إدارة الفواتير، المشتريات، وعروض الأسعار</p>
        </div>

        {/* Create Operation Card */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Plus size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">عملية جديدة</h2>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">الفرع / الحساب</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.accountId} 
                    onChange={e => setForm({ ...form, accountId: e.target.value })}
                  >
                    <option value="">اختر الفرع...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">نوع العملية</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.type} 
                    onChange={e => setForm({ ...form, type: e.target.value, partnerType: e.target.value === 'purchase' ? 'supplier' : 'customer' })}
                  >
                    <option value="purchase">شراء (مصروفات)</option>
                    <option value="sale">بيع (إيرادات)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {form.partnerType === 'supplier' ? 'اسم المورد' : 'اسم العميل'}
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    className="apple-input pr-10"
                    placeholder="الاسم..." 
                    value={form.partnerName} 
                    onChange={e => setForm({ ...form, partnerName: e.target.value })} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">طريقة الدفع</label>
                <div className="relative">
                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    className="apple-input pr-10"
                    value={form.paymentMethod} 
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                  >
                    <option value="cash">كاش</option>
                    <option value="card">شبكة</option>
                    <option value="transfer">تحويل بنكي</option>
                    <option value="credit">آجل</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-4">إضافة بنود</label>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">النوع</label>
                  <select 
                    className="apple-input h-9 text-sm"
                    value={item.itemType} 
                    onChange={e=>setItem({...item, itemType: e.target.value})}
                  >
                    <option value="part">قطعة غيار</option>
                    <option value="service">خدمة</option>
                  </select>
                </div>
                
                <div className="md:col-span-4">
                  <label className="text-xs text-gray-500 mb-1 block">البند</label>
                  {item.itemType === 'part' ? (
                    <select 
                      className="apple-input h-9 text-sm"
                      value={item.itemId} 
                      onChange={e => { 
                        const it = parts.find(p=>p.id===e.target.value); 
                        setItem({...item, itemId: e.target.value, name: it?.name || '', price: it?.sellingPrice || 0}); 
                      }}
                    >
                      <option value="">اختر قطعة...</option>
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
                      <option value="">اختر خدمة...</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">الكمية</label>
                  <input 
                    type="number" 
                    className="apple-input h-9 text-sm"
                    value={item.quantity} 
                    onChange={e=> setItem({...item, quantity: Number(e.target.value) || 0})} 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">السعر</label>
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
                    <span>إضافة</span>
                  </button>
                </div>
              </div>

              {/* Items Table */}
              {form.items.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-3 text-right font-medium">النوع</th>
                        <th className="p-3 text-right font-medium">الاسم</th>
                        <th className="p-3 text-right font-medium">الكمية</th>
                        <th className="p-3 text-right font-medium">السعر</th>
                        <th className="p-3 text-right font-medium">الإجمالي</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.items.map((it, idx)=> (
                        <tr key={idx}>
                          <td className="p-3 text-gray-600">{it.itemType==='part'?'قطعة':'خدمة'}</td>
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
                        <td colSpan="4" className="p-3 text-left">الإجمالي الكلي:</td>
                        <td className="p-3 text-[#0071E3]">{subtotal.toFixed(2)} ر.س</td>
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
                حفظ العملية
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
            <h2 className="text-lg font-semibold text-gray-900">سجل العمليات الأخيرة</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="p-4 text-right font-medium">التاريخ</th>
                  <th className="p-4 text-right font-medium">النوع</th>
                  <th className="p-4 text-right font-medium">الطرف</th>
                  <th className="p-4 text-right font-medium">البنود</th>
                  <th className="p-4 text-right font-medium">الإجمالي</th>
                  <th className="p-4 text-right font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ops.map(op => (
                  <tr key={op.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-600">{new Date(op.date).toLocaleDateString('ar-SA')}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        op.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {op.type === 'sale' ? 'بيع' : 'شراء'}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{op.partnerName || '-'}</td>
                    <td className="p-4 text-gray-500">{op.items?.length || 0} بند</td>
                    <td className="p-4 font-bold text-gray-900">{Number(op.total).toFixed(2)}</td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => navigate(`/print?type=invoice&vehicleId=${op.vehicleId}`)}
                        className="apple-button-secondary text-xs h-8 px-3"
                        disabled={!op.vehicleId}
                      >
                        طباعة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    
  );
};

export default Operations;
