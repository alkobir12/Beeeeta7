import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const [accounts, setAccounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [ops, setOps] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '' });
  const [item, setItem] = useState({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0 });

  const load = async () => {
    const [accRes, partsRes, opsRes, analyticsRes] = await Promise.all([
      axios.get(`${API_URL}/biz-accounts`),
      axios.get(`${API_URL}/parts`),
      axios.get(`${API_URL}/operations`),
      axios.get(`${API_URL}/operations/analytics/summary`)
    ]);
    setAccounts(accRes.data || []);
    setParts(partsRes.data || []);
    setOps(opsRes.data || []);
    setAnalytics(analyticsRes.data || null);
  };

  useEffect(() => { load(); }, []);

  const addItem = () => {
    if (!item.name && !item.itemId) return;
    const total = Number(item.quantity) * Number(item.price);
    setForm(prev => ({ ...prev, items: [...prev.items, { ...item, total }] }));
    setItem({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0 });
  };

  const submit = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/operations`, { ...form });
    setForm({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '' });
    await load();
  };

  const subtotal = form.items.reduce((s, it) => s + Number(it.total || 0), 0);

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-5xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">عمليات الشراء/البيع</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>إنشاء عملية</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select value={form.accountId} onValueChange={v => setForm({ ...form, accountId: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, partnerType: v === 'purchase' ? 'supplier' : 'customer' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">شراء</SelectItem>
                      <SelectItem value="sale">بيع</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder={form.partnerType === 'supplier' ? 'اسم المورد' : 'اسم العميل'} value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} />
                  <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">كاش</SelectItem>
                      <SelectItem value="card">شبكة</SelectItem>
                      <SelectItem value="credit">آجل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Select value={item.itemType} onValueChange={v => setItem({ ...item, itemType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="part">قطعة</SelectItem>
                        <SelectItem value="service">خدمة</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={item.itemId} onValueChange={v => setItem({ ...item, itemId: v, name: (parts.find(p=>p.id===v)?.name || item.name) })}>
                      <SelectTrigger><SelectValue placeholder="اختر قطعة (اختياري)" /></SelectTrigger>
                      <SelectContent>
                        {parts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="الاسم (في حال خدمة/قطعة خارج القائمة)" value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} />
                    <Input type="number" placeholder="الكمية" value={item.quantity} onChange={e => setItem({ ...item, quantity: e.target.value })} />
                    <Input type="number" placeholder="السعر" value={item.price} onChange={e => setItem({ ...item, price: e.target.value })} />
                  </div>
                  <div className="mt-3">
                    <Button type="button" variant="outline" onClick={addItem}>إضافة بند</Button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="font-bold text-slate-800">الإجمالي: {subtotal.toFixed(2)} ر.س</div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">حفظ العملية</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
            <CardContent className="p-6 space-y-3">
              {ops.map(op => (
                <div key={op.id} className="flex items-center justify-between p-3 rounded border hover:bg-slate-50">
                  <div>
                    <div className="font-bold">{op.type === 'purchase' ? 'شراء' : 'بيع'} • {op.partnerName}</div>
                    <div className="text-sm text-slate-500">{new Date(op.date).toLocaleString('ar-SA')} — بنود: {op.items?.length || 0}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-blue-700">{Number(op.total).toFixed(2)} ر.س</div>
                    <Button size="sm" variant="outline" onClick={async ()=>{
                      const res = await axios.get(`${API_URL}/operations/${op.id}`);
                      const o = res.data;
                      alert(`تفاصيل العملية:\nالنوع: ${o.type}\nالشريك: ${o.partnerName || '-'}\nالإجمالي: ${o.total}`);
                    }}>فتح</Button>
                    <Button size="sm" variant="ghost" onClick={async ()=>{
                      const name = prompt('تعديل اسم الشريك', op.partnerName || '');
                      if (name === null) return;
                      await axios.put(`${API_URL}/operations/${op.id}`, { partnerName: name });
                      await load();
                    }}>تعديل</Button>
                  </div>
                </div>
              ))}
            </CardContent>
              <CardTitle>آخر العمليات</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {ops.map(op => (
                <div key={op.id} className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="font-bold">{op.type === 'purchase' ? 'شراء' : 'بيع'} • {op.partnerName}</div>
                    <div className="text-sm text-slate-500">{new Date(op.date).toLocaleString('ar-SA')} — بنود: {op.items?.length || 0}</div>
                  </div>
                  <div className="font-bold text-blue-700">{Number(op.total).toFixed(2)} ر.س</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Operations;
