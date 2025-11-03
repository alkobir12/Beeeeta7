import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { BarChart3, Sparkles, Plus, Target, TreePine, Layers } from 'lucide-react';
import DialogPortalSafe from '../components/DialogPortalSafe';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Tree = ({ items, onSelect, selectedId }) => {
  const byParent = (parentId) => items.filter(i => (i.parentId || null) === (parentId || null));
  const Node = ({ node }) => {
    const children = byParent(node.id);
    const [open, setOpen] = useState(true);
    return (
      <div className="ml-3">
        <div
          className={`flex items-center gap-2 p-1 rounded cursor-pointer ${selectedId===node.id?'bg-blue-50':'hover:bg-slate-50'}`}
          onClick={() => onSelect(node)}
        >
          {children.length > 0 && (
            <Button size="sm" variant="ghost" onClick={(e)=>{e.stopPropagation(); setOpen(!open);}}>
              {open ? '−' : '+'}
            </Button>
          )}
          <span className="text-sm font-medium">{node.name}</span>
          {node.type !== 'group' && (
            <Badge variant="outline" className="text-[10px]">{node.type}</Badge>
          )}
        </div>
        {open && children.length > 0 && (
          <div className="border-r pr-2 ml-4">
            {children.map(ch => <Node key={ch.id} node={ch} />)}
          </div>
        )}
      </div>
    );
  };
  const roots = byParent(null);
  return <div>{roots.map(r => <Node key={r.id} node={r} />)}</div>;
};

const CEO = () => {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [form, setForm] = useState({ name: '', code: '', currency: 'SAR' });

  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({ period: new Date().toISOString().slice(0,7), incomeTarget: 0, expenseTarget: 0, notes: '' });

  // Chart of Accounts state
  const [acctTree, setAcctTree] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeSummary, setNodeSummary] = useState(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0,7));
  const [aiNodeAnswer, setAiNodeAnswer] = useState('');
  const [seeding, setSeeding] = useState(false);

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

  const loadChart = async (accId) => {
    if (!accId) { setAcctTree([]); return; }
    const res = await axios.get(`${API_URL}/ceo/accounts`, { params: { branch: accId } });
    setAcctTree(res.data?.items || []);
  };

  const loadNodeSummary = async (node) => {
    if (!node) return;
    const res = await axios.get(`${API_URL}/ceo/accounts/${node.id}/summary`, { params: { branch: selectedAcc, period } });
    setNodeSummary(res.data);
  };

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadBudgets(selectedAcc); loadChart(selectedAcc); setSelectedNode(null); setNodeSummary(null); }, [selectedAcc]);
  useEffect(() => { if (selectedNode) loadNodeSummary(selectedNode); }, [period]);

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

  const seedAccounts = async () => {
    if (!selectedAcc) return;
    try {
      setSeeding(true);
      await axios.post(`${API_URL}/ceo/seed-accounts`, null, { params: { account_id: selectedAcc } });
      await loadChart(selectedAcc);
    } finally { setSeeding(false); }
  };

  const analyzeNode = async () => {
    if (!selectedNode) return;
    setAiNodeAnswer('');
    const res = await axios.post(`${API_URL}/ceo/accounts/${selectedNode.id}/ai-analysis`, { question: 'حلّل هذا الحساب وقدّم توصيات مختصرة قابلة للتنفيذ' });
    setAiNodeAnswer(res.data?.analysis || '');
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

          {/* Chart of Accounts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-emerald-50">
                <CardTitle className="flex items-center gap-2"><TreePine size={18}/> شجرة الحسابات</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Button onClick={seedAccounts} disabled={!selectedAcc || seeding} className="bg-emerald-600 hover:bg-emerald-700">{seeding? 'جاري التهيئة...' : 'تهيئة الشجرة للفرع'}</Button>
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-slate-500" />
                    <span className="text-slate-500 text-sm">{acctTree.length} حساب</span>
                  </div>
                </div>
                {acctTree.length === 0 ? (
                  <div className="text-slate-500 text-sm">لم يتم تهيئة الشجرة بعد لهذا الفرع</div>
                ) : (
                  <Tree items={acctTree} onSelect={(n)=>{ setSelectedNode(n); setAiNodeAnswer(''); loadNodeSummary(n); }} selectedId={selectedNode?.id} />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-slate-50">
                <CardTitle>ملخص الحساب</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="w-44" />
                  <Button onClick={analyzeNode} disabled={!selectedNode} className="bg-purple-600 hover:bg-purple-700"><Sparkles size={16} className="ml-2"/>تحليل AI</Button>
                </div>
                {selectedNode ? (
                  <div className="space-y-2">
                    <div className="text-lg font-bold">{selectedNode.name}</div>
                    {nodeSummary ? (
                      <div className="space-y-1 text-sm">
                        <div>الإيرادات: <span className="font-bold text-green-700">{Number(nodeSummary.income).toFixed(2)} ر.س</span></div>
                        <div>المصروفات: <span className="font-bold text-red-700">{Number(nodeSummary.expense).toFixed(2)} ر.س</span></div>
                        <div>الصافي: <span className="font-bold text-blue-700">{Number(nodeSummary.net).toFixed(2)} ر.س</span></div>
                      </div>
                    ) : (
                      <div className="text-slate-500 text-sm">اختر حسابًا لعرض ملخصه</div>
                    )}
                
                    {aiNodeAnswer && (
                      <div className="mt-4 p-3 border rounded bg-purple-50 text-slate-800 whitespace-pre-wrap">{aiNodeAnswer}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">اختر حسابًا من الشجرة</div>
                )}
              </CardContent>
            </Card>
          </div>

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
