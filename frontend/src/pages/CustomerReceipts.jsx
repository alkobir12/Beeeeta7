import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Plus, Filter } from 'lucide-react';
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

  useEffect(() => { load(); }, [filters]);

  const addReceipt = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/customer-receipts`, { ...form });
    setForm({ customerId: '', accountId: '', amount: 0, paymentMethod: 'cash', notes: '' });
    await load();
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إيصالات العملاء</h1>
            <p className="text-gray-500 mt-1">إدارة سندات القبض والمدفوعات</p>
          </div>
        </div>

        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-6 text-blue-600">
            <Plus size={20} />
            <h3 className="font-bold text-gray-900">إضافة إيصال جديد</h3>
          </div>
          <form onSubmit={addReceipt} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="apple-input text-sm" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
              <option value="">اختر العميل</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="apple-input text-sm" value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>
              <option value="">اختر الفرع</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="number" className="apple-input text-sm" placeholder="المبلغ" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <select className="apple-input text-sm" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="cash">كاش</option>
              <option value="card">شبكة</option>
            </select>
            <button type="submit" className="apple-button text-sm">حفظ</button>
          </form>
        </div>

        <div className="apple-card p-4 flex gap-3 items-center">
          <Filter size={18} className="text-gray-400" />
          <select className="apple-input text-sm w-48" value={filters.customerId} onChange={e => setFilters({ ...filters, customerId: e.target.value })}>
            <option value="all">كل العملاء</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="apple-input text-sm w-48" value={filters.accountId} onChange={e => setFilters({ ...filters, accountId: e.target.value })}>
            <option value="all">كل الفروع</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {receipts.map(receipt => (
            <div key={receipt.id} className="apple-card p-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">{customers.find(c => c.id === receipt.customerId)?.name || 'عميل غير معروف'}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(receipt.date).toLocaleString('ar-SA')} • {receipt.paymentMethod === 'cash' ? 'كاش' : 'شبكة'}</div>
              </div>
              <div className="font-bold text-green-600 text-lg">{Number(receipt.amount).toLocaleString()} ر.س</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default CustomerReceipts;
