import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BusinessAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', currency: 'SAR' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/biz-accounts`);
      setAccounts(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addAccount = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/biz-accounts`, { ...form, isActive: true });
    setForm({ name: '', code: '', currency: 'SAR' });
    await load();
  };

  const toggleActive = async (acc) => {
    await axios.put(`${API_URL}/biz-accounts/${acc.id}`, { isActive: !acc.isActive });
    await load();
  };

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">الحسابات/الفروع</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>إضافة فرع</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={addAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input placeholder="الاسم" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} required />
                <Input placeholder="الكود (مثال: MAIN-001)" value={form.code} onChange={(e)=>setForm({ ...form, code: e.target.value })} required />
                <Input placeholder="العملة" value={form.currency} onChange={(e)=>setForm({ ...form, currency: e.target.value })} />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">حفظ</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {accounts.map(acc => (
              <Card key={acc.id} className={`${acc.isActive ? '' : 'opacity-70'} border-slate-200`}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-slate-800">{acc.name}</div>
                    <div className="text-slate-500 text-sm">{acc.code} • {acc.currency}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => toggleActive(acc)}>{acc.isActive ? 'تعطيل' : 'تفعيل'}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BusinessAccounts;
