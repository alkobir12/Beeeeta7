import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomerReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ customerId: '', accountId: '', amount: 0, paymentMethod: 'cash', notes: '' });
  const [filters, setFilters] = useState({ customerId: 'all', accountId: 'all' });

  const load = async () => {
    const params = {};
    if (filters.customerId && filters.customerId !== 'all') params.customer_id = filters.customerId;
    if (filters.accountId && filters.accountId !== 'all') params.account_id = filters.accountId;
    
    const [receiptsRes, customersRes, accountsRes] = await Promise.all([
      axios.get(`${API_URL}/customer-receipts`, { params }),
      axios.get(`${API_URL}/customers`),
      axios.get(`${API_URL}/biz-accounts`)
    ]);
    setReceipts(receiptsRes.data || []);
    setCustomers(customersRes.data || []);
    setAccounts(accountsRes.data || []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [filters]);

  const addReceipt = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/customer-receipts`, { ...form });
    setForm({ customerId: '', accountId: '', amount: 0, paymentMethod: 'cash', notes: '' });
    await load();
  };

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-5xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">إيصالات العملاء</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>إضافة إيصال</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={addReceipt} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Select value={form.customerId} onValueChange={v => setForm({ ...form, customerId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.accountId} onValueChange={v => setForm({ ...form, accountId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="المبلغ" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">كاش</SelectItem>
                    <SelectItem value="card">شبكة</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">حفظ</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>فلترة الإيصالات</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-3">
                <Select value={filters.customerId} onValueChange={v => setFilters({ ...filters, customerId: v })}>
                  <SelectTrigger><SelectValue placeholder="فلترة بالعميل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.accountId} onValueChange={v => setFilters({ ...filters, accountId: v })}>
                  <SelectTrigger><SelectValue placeholder="فلترة بالفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قائمة الإيصالات</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {receipts.map(receipt => (
                <div key={receipt.id} className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="font-bold">{customers.find(c => c.id === receipt.customerId)?.name || 'عميل غير معروف'}</div>
                    <div className="text-sm text-slate-500">{new Date(receipt.date).toLocaleString('ar-SA')} • {receipt.paymentMethod}</div>
                  </div>
                  <div className="font-bold text-green-700">{Number(receipt.amount).toFixed(2)} ر.س</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerReceipts;