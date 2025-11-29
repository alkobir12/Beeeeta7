import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Building2, Plus } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BusinessAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', currency: 'SAR' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const res = await axios.get(`${API_URL}/biz-accounts`);
    setAccounts(res.data || []);
  };

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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الحسابات والفروع</h1>
            <p className="text-gray-500 mt-1">إدارة الفروع وحسابات الأعمال</p>
          </div>
        </div>

        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-6 text-blue-600">
            <Plus size={20} />
            <h3 className="font-bold text-gray-900">إضافة فرع جديد</h3>
          </div>
          <form onSubmit={addAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input className="apple-input" placeholder="الاسم" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
            <input className="apple-input" placeholder="الكود" value={form.code} onChange={e=>setForm({...form, code: e.target.value})} required />
            <input className="apple-input" placeholder="العملة" value={form.currency} onChange={e=>setForm({...form, currency: e.target.value})} />
            <button type="submit" className="apple-button">حفظ</button>
          </form>
        </div>

        <div className="grid gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className={`apple-card p-5 flex items-center justify-between ${!acc.isActive && 'opacity-60'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{acc.name}</h3>
                  <p className="text-sm text-gray-500">{acc.code} • {acc.currency}</p>
                </div>
              </div>
              <button 
                onClick={() => toggleActive(acc)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  acc.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {acc.isActive ? 'تعطيل' : 'تفعيل'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default BusinessAccounts;
