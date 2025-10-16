import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { BarChart3, Sparkles, Plus, Target } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CEO = () => {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [form, setForm] = useState({ name: '', code: '', currency: 'SAR' });

  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({ period: new Date().toISOString().slice(0,7), incomeTarget: 0, expenseTarget: 0, notes: '' });

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

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadBudgets(selectedAcc); }, [selectedAcc]);

  const addAccount = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/biz-accounts`, { ...form, isActive: true });
    setForm({ name: '', code: '', currency: 'SAR' });
    await loadAccounts();
  };

  const toggleActive = async (acc) => {
    await axios.put(`${API_URL}/biz-accounts/${acc.id}`, { isActive: !acc.isActive });
    await loadAccounts();
  };

  const saveBudget = async (e) => {
    e.preventDefault();
    if (!selectedAcc) return;
    await axios.post(`${API_URL}/budgets`, { accountId: selectedAcc, ...budgetForm });
    setBudgetForm({ period: new Date().toISOString().slice(0,7), incomeTarget: 0, expenseTarget: 0, notes: '' });
    await loadBudgets(selectedAcc);
  };

  const askAI = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/ceo/ai-analysis`, null, { params: { question: 'كيف يبدو أداء الورشة هذا الشهر؟', account_id: selectedAcc || undefined }});
      setAnswer(res.data.response);
      setMetrics(res.data.metrics);
    } catch (e) {
      setAnswer('تعذر جلب التحليل الآن.');
    } finally {
      setLoading(false);
    }
  };

  const activeBudget = budgets.find(b => b.period === (new Date().toISOString().slice(0,7))) || null;

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">لوحة المدير التنفيذي</h1>
              <p className="text-slate-600">إدارة الفروع والميزانيات والتحليلات الذكية</p>
            </div>
          </div>

          {/* Accounts Management */}
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
              <CardTitle className="flex items-center gap-2"><Plus size={18}/> الحسابات/الفروع</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={addAccount} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input placeholder="الاسم" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required/>
                <Input placeholder="الكود" value={form.code} onChange={e=>setForm({...form, code: e.target.value})} required/>
                <Input placeholder="العملة" value={form.currency} onChange={e=>setForm({...form, currency: e.target.value})} />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">إضافة</Button>
                <Select value={selectedAcc} onValueChange={setSelectedAcc}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفرع للتحليل" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </form>
              <div className="space-y-2">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between p-3 rounded border">
                    <div>
                      <div className="font-bold">{acc.name}</div>
                      <div className="text-sm text-slate-500">{acc.code} • {acc.currency}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={acc.isActive ? 'default' : 'secondary'}>{acc.isActive ? 'مفعل' : 'معطّل'}</Badge>
                      <Button variant="outline" onClick={()=>toggleActive(acc)}>{acc.isActive ? 'تعطيل' : 'تفعيل'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Budgets */}
          <Card className="mb-6 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-yellow-50 to-transparent">
              <CardTitle className="flex items-center gap-2"><Target size={18}/> الميزانيات</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={saveBudget} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input type="month" value={budgetForm.period} onChange={e => setBudgetForm({ ...budgetForm, period: e.target.value })} />
                <Input type="number" placeholder="هدف الإيرادات" value={budgetForm.incomeTarget} onChange={e => setBudgetForm({ ...budgetForm, incomeTarget: e.target.value })} />
                <Input type="number" placeholder="هدف المصروفات" value={budgetForm.expenseTarget} onChange={e => setBudgetForm({ ...budgetForm, expenseTarget: e.target.value })} />
                <Input placeholder="ملاحظات" value={budgetForm.notes} onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })} />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!selectedAcc}>حفظ الميزانية</Button>
              </form>

              <div className="space-y-2">
                {budgets.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded border">
                    <div>
                      <div className="font-bold">{b.period}</div>
                      <div className="text-sm text-slate-500">هدف الإيرادات: {Number(b.incomeTarget).toFixed(2)} • هدف المصروفات: {Number(b.expenseTarget).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Metrics & AI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50">
                <CardTitle>الإيرادات</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-green-700">{metrics ? metrics.revenue.toLocaleString() : 0} ر.س</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-red-50">
                <CardTitle>المصروفات</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-red-700">{metrics ? metrics.expenses.toLocaleString() : 0} ر.س</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50">
                <CardTitle>الربح</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-blue-700">{metrics ? metrics.profit.toLocaleString() : 0} ر.س</div>
                {activeBudget && (
                  <div className="mt-4 text-sm text-slate-600">
                    <div>مقارنة مع الميزانية ({activeBudget.period}):</div>
                    <div>تحقق الإيرادات: {metrics ? (metrics.revenue / (activeBudget.incomeTarget || 1) * 100).toFixed(1) : 0}%</div>
                    <div>تحقق المصروفات: {metrics ? (metrics.expenses / (activeBudget.expenseTarget || 1) * 100).toFixed(1) : 0}%</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 size={20} /> تحليل AI {selectedAcc ? `— ${accounts.find(a=>a.id===selectedAcc)?.name || ''}` : ''}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Button onClick={askAI} className="bg-purple-600 hover:bg-purple-700 mb-4" disabled={loading}>
                <Sparkles size={18} className="ml-2" />
                {loading ? 'جاري التحليل...' : 'تحليل ذكي (AI)'}
              </Button>
              {answer ? (
                <div className="prose prose-slate rtl text-slate-800 whitespace-pre-wrap leading-8">
                  {answer}
                </div>
              ) : (
                <div className="text-slate-500">اختر فرعًا (اختياري) ثم اضغط تحليل ذكي لعرض توصيات المدير التنفيذي.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CEO;
