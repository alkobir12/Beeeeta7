import React, { useEffect, useState } from 'react';
import { Plus, Target, TreePine, Layers, Sparkles, BarChart3 } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CEO = () => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [form, setForm] = useState({ name: '', code: '', currency: 'SAR' });
  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({ period: new Date().toISOString().slice(0,7), incomeTarget: 0, expenseTarget: 0, notes: '' });

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadBudgets(selectedAcc); }, [selectedAcc]);

  const loadAccounts = async () => {
    const res = await axios.get(`${API_URL}/biz-accounts`);
    setAccounts(res.data || []);
    if (!selectedAcc && (res.data || []).length > 0) setSelectedAcc(res.data[0].id);
  };

  const loadBudgets = async (accId) => {
    if (!accId) { setBudgets([]); return; }
    const res = await axios.get(`${API_URL}/budgets`, { params: { account_id: accId } });
    setBudgets(res.data || []);
  };

  const addAccount = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/biz-accounts`, { ...form, isActive: true });
    setForm({ name: '', code: '', currency: 'SAR' });
    await loadAccounts();
  };

  const saveBudget = async (e) => {
    e.preventDefault();
    if (!selectedAcc) return;
    await axios.post(`${API_URL}/budgets`, { accountId: selectedAcc, ...budgetForm });
    setBudgetForm({ period: new Date().toISOString().slice(0,7), incomeTarget: 0, expenseTarget: 0, notes: '' });
    await loadBudgets(selectedAcc);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">لوحة المدير التنفيذي</h1>
            <p className="text-gray-500 mt-1">إدارة الفروع والميزانيات والتحليلات</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accounts */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <Plus size={20} />
              <h3 className="font-bold text-gray-900">الحسابات والفروع</h3>
            </div>
            <form onSubmit={addAccount} className="space-y-4 mb-6">
              <div className="grid grid-cols-3 gap-3">
                <input className="apple-input text-sm" placeholder="الاسم" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required/>
                <input className="apple-input text-sm" placeholder="الكود" value={form.code} onChange={e=>setForm({...form, code: e.target.value})} required/>
                <input className="apple-input text-sm" placeholder="العملة" value={form.currency} onChange={e=>setForm({...form, currency: e.target.value})} />
              </div>
              <button type="submit" className="apple-button w-full">إضافة فرع</button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {accounts.map(acc => (
                <div key={acc.id} className="flex justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="font-medium">{acc.name}</span>
                  <span className="text-gray-500">{acc.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budgets */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-yellow-600">
              <Target size={20} />
              <h3 className="font-bold text-gray-900">الميزانيات</h3>
            </div>
            <div className="mb-4">
              <select className="apple-input mb-4" value={selectedAcc} onChange={e => setSelectedAcc(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <form onSubmit={saveBudget} className="grid grid-cols-2 gap-3">
                <input type="month" className="apple-input text-sm" value={budgetForm.period} onChange={e => setBudgetForm({ ...budgetForm, period: e.target.value })} />
                <input type="number" className="apple-input text-sm" placeholder="هدف الإيرادات" value={budgetForm.incomeTarget} onChange={e => setBudgetForm({ ...budgetForm, incomeTarget: e.target.value })} />
                <input type="number" className="apple-input text-sm" placeholder="هدف المصروفات" value={budgetForm.expenseTarget} onChange={e => setBudgetForm({ ...budgetForm, expenseTarget: e.target.value })} />
                <button type="submit" className="apple-button text-sm">حفظ</button>
              </form>
            </div>
            <div className="space-y-2">
              {budgets.slice(0, 3).map(b => (
                <div key={b.id} className="p-3 bg-gray-50 rounded-lg text-sm flex justify-between">
                  <span className="font-bold">{b.period}</span>
                  <span className="text-gray-500">هدف: {b.incomeTarget}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
};

export default CEO;
