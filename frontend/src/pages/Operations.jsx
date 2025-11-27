import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import CanvaCard from '../components/CanvaCard';
import DraggableGrid from '../components/DraggableGrid';
import { useNavigate } from 'react-router-dom';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const [accounts, setAccounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [services, setServices] = useState([]);
  const [ops, setOps] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '', receiptFile: null });
  const [item, setItem] = useState({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0, category: '' });

  const navigate = useNavigate();

  const load = async () => {
    const [accRes, partsRes, servicesRes, opsRes, analyticsRes] = await Promise.all([
      axios.get(`${API_URL}/biz-accounts`),
      axios.get(`${API_URL}/parts`),
      axios.get(`${API_URL}/services`),
      axios.get(`${API_URL}/operations`),
      axios.get(`${API_URL}/operations/analytics/summary`)
    ]);
    setAccounts(accRes.data || []);
    setParts(partsRes.data || []);
    setServices(servicesRes.data || []);
    setOps(opsRes.data || []);
    setAnalytics(analyticsRes.data || null);
  };

  useEffect(() => { load(); }, []);

  const addItem = () => {
    if (!item.name && !item.itemId) return;
    const total = Number(item.quantity) * Number(item.price);
    setForm(prev => ({ ...prev, items: [...prev.items, { ...item, total }] }));
    setItem({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0, category: '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/operations`, { ...form });
    setForm({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '' });
    await load();
  };

  const subtotal = form.items.reduce((s, it) => s + Number(it.total || 0), 0);

  // Build draggable cards
  const gridItems = useMemo(() => {
    const items = [];

    // Create Operation form (Standard View)
    items.push({
      id: 'create-op',
      render: () => (
        <Card className="shadow-md">
          <CardHeader className="bg-slate-50">
            <CardTitle>إنشاء عملية جديدة</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>الفرع</Label>
                  <Select value={form.accountId} onValueChange={v => setForm({ ...form, accountId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع العملية</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, partnerType: v === 'purchase' ? 'supplier' : 'customer' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">شراء (مصروفات)</SelectItem>
                      <SelectItem value="sale">بيع (إيرادات)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{form.partnerType === 'supplier' ? 'اسم المورد' : 'اسم العميل'}</Label>
                  <Input placeholder="الاسم..." value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} />
                </div>
                <div>
                  <Label>طريقة الدفع</Label>
                  <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">كاش</SelectItem>
                      <SelectItem value="card">شبكة</SelectItem>
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                      <SelectItem value="credit">آجل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items Section */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <Label className="mb-2 block font-semibold">إضافة بنود</Label>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-1">
                    <Label className="text-xs">النوع</Label>
                    <Select value={item.itemType} onValueChange={v=>setItem({...item, itemType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="part">قطعة غيار</SelectItem>
                        <SelectItem value="service">خدمة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">البند</Label>
                    {item.itemType === 'part' ? (
                      <Select value={item.itemId} onValueChange={v=>{ const it = parts.find(p=>p.id===v); setItem({...item, itemId: v, name: it?.name || '', price: it?.sellingPrice || it?.price || 0}); }}>
                        <SelectTrigger><SelectValue placeholder="اختر قطعة..." /></SelectTrigger>
                        <SelectContent>
                          {parts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={item.itemId} onValueChange={v=>{ const s = services.find(s=>s.id===v); setItem({...item, itemId: v, name: s?.name || '', price: s?.price || 0}); }}>
                        <SelectTrigger><SelectValue placeholder="اختر خدمة..." /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">الكمية</Label>
                    <Input type="number" value={item.quantity} onChange={e=> setItem({...item, quantity: Number(e.target.value) || 0})} />
                  </div>
                  <div>
                    <Label className="text-xs">السعر</Label>
                    <Input type="number" value={item.price} onChange={e=> setItem({...item, price: Number(e.target.value) || 0})} />
                  </div>
                  <div>
                    <Button type="button" className="w-full bg-slate-800 hover:bg-slate-900" onClick={addItem}>إضافة +</Button>
                  </div>
                </div>

                {/* Items Table */}
                {form.items.length > 0 && (
                  <div className="mt-4 bg-white rounded border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-2 text-right">النوع</th>
                          <th className="p-2 text-right">الاسم</th>
                          <th className="p-2 text-right">الكمية</th>
                          <th className="p-2 text-right">السعر</th>
                          <th className="p-2 text-right">الإجمالي</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((it, idx)=> (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="p-2">{it.itemType==='part'?'قطعة':'خدمة'}</td>
                            <td className="p-2">{it.name}</td>
                            <td className="p-2">{it.quantity}</td>
                            <td className="p-2">{it.price}</td>
                            <td className="p-2">{(Number(it.quantity)*Number(it.price)).toFixed(2)}</td>
                            <td className="p-2 text-left">
                              <Button size="sm" variant="ghost" className="text-red-500 h-6 w-6 p-0" onClick={() =>{
                                const newItems = [...form.items];
                                newItems.splice(idx, 1);
                                setForm({...form, items: newItems});
                              }}>×</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold">
                        <tr>
                          <td colSpan="4" className="p-2 text-left">الإجمالي الكلي:</td>
                          <td className="p-2">{subtotal.toFixed(2)} ر.س</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-8" disabled={form.items.length === 0}>
                  حفظ العملية
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )
    });

    // Recent Ops Table (Standard View)
    items.push({
      id: 'recent-ops',
      render: () => (
        <Card className="shadow-md mt-6">
          <CardHeader>
            <CardTitle>سجل العمليات الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">النوع</th>
                    <th className="p-3 text-right">الطرف</th>
                    <th className="p-3 text-right">البنود</th>
                    <th className="p-3 text-right">الإجمالي</th>
                    <th className="p-3 text-right">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.map(op => (
                    <tr key={op.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">{new Date(op.date).toLocaleDateString('ar-SA')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${op.type === 'sale' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {op.type === 'sale' ? 'بيع' : 'شراء'}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{op.partnerName}</td>
                      <td className="p-3 text-slate-500">{op.items?.length || 0} بند</td>
                      <td className="p-3 font-bold">{Number(op.total).toFixed(2)}</td>
                      <td className="p-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const res = await axios.get(`${API_URL}/operations/${op.id}`);
                            const o = res.data;
                            alert(`تفاصيل العملية:\nالنوع: ${o.type}\nالشريك: ${o.partnerName || '-'}\nالإجمالي: ${o.total}`);
                          }}
                        >
                          عرض
                        </Button>
                        {op.type === 'sale' && op.vehicleId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-500 text-blue-700"
                            onClick={() => navigate(`/print?type=invoice&vehicleId=${op.vehicleId}`)}
                          >
                            فاتورة للمركبة
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )
    });

    return items;
  }, [accounts, ops, analytics, parts, services, item, form.items, navigate]);

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">إدارة العمليات والمبيعات</h1>

          <DraggableGrid items={gridItems} storageKey="operations_cards_order" columns="grid-cols-1" />
        </div>
      </div>
    </Layout>
  );
};

export default Operations;
