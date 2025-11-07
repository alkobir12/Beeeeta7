import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';


const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const [accounts, setAccounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [ops, setOps] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '', receiptFile: null });
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
        <div className="container mx-auto p-6 max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">عمليات الشراء/البيع</h1>

          {/* CEO Embedded Section */}
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle>لوحة المدير التنفيذي (مضمنة داخل العمليات)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Filters */}
              <CeoFilters accounts={accounts} onChange={()=>{}} />
              <CeoSection accounts={accounts} ops={ops} />
            </CardContent>
          </Card>


          {/* Analytics Cards */}
          {analytics && (
            <>
              {/* Main Analytics - 6 Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {/* Today Sales */}
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-700 font-semibold">مبيعات اليوم</p>
                        <p className="text-3xl font-bold text-green-800 mt-2">
                          {analytics.today.sales.toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          {analytics.today.salesCount} عملية بيع
                        </p>
                      </div>
                      <div className="text-5xl">💰</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Week Sales */}
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-700 font-semibold">مبيعات الأسبوع</p>
                        <p className="text-3xl font-bold text-blue-800 mt-2">
                          {analytics.week.sales.toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          {analytics.week.salesCount} عملية بيع
                        </p>
                      </div>
                      <div className="text-5xl">📊</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Month Sales */}
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-700 font-semibold">مبيعات الشهر</p>
                        <p className="text-3xl font-bold text-purple-800 mt-2">
                          {analytics.month.sales.toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          {analytics.month.salesCount} عملية بيع
                        </p>
                      </div>
                      <div className="text-5xl">📈</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Today Expenses */}
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-700 font-semibold">مصروفات اليوم</p>
                        <p className="text-3xl font-bold text-red-800 mt-2">
                          {analytics.today.expenses.toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {analytics.today.expensesCount} عملية شراء
                        </p>
                      </div>
                      <div className="text-5xl">🛒</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Week Expenses */}
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-orange-700 font-semibold">مصروفات الأسبوع</p>
                        <p className="text-3xl font-bold text-orange-800 mt-2">
                          {analytics.week.expenses.toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          {analytics.week.expensesCount} عملية شراء
                        </p>
                      </div>
                      <div className="text-5xl">📦</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Month Expenses */}
                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-700 font-semibold">مصروفات الشهر</p>
                        <p className="text-3xl font-bold text-yellow-800 mt-2">
                          {analytics.month.expenses.toFixed(2)} ر.س
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          {analytics.month.expensesCount} عملية شراء
                        </p>
                      </div>
                      <div className="text-5xl">💳</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Profit Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className={`border-2 ${analytics.today.profit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300' : 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-300'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{color: analytics.today.profit >= 0 ? '#047857' : '#be123c'}}>صافي ربح اليوم</p>
                        <p className="text-3xl font-bold mt-2" style={{color: analytics.today.profit >= 0 ? '#065f46' : '#9f1239'}}>
                          {analytics.today.profit.toFixed(2)} ر.س
                        </p>
                      </div>
                      <div className="text-5xl">{analytics.today.profit >= 0 ? '✅' : '⚠️'}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${analytics.week.profit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300' : 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-300'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{color: analytics.week.profit >= 0 ? '#047857' : '#be123c'}}>صافي ربح الأسبوع</p>
                        <p className="text-3xl font-bold mt-2" style={{color: analytics.week.profit >= 0 ? '#065f46' : '#9f1239'}}>
                          {analytics.week.profit.toFixed(2)} ر.س
                        </p>
                      </div>
                      <div className="text-5xl">{analytics.week.profit >= 0 ? '✅' : '⚠️'}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${analytics.month.profit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300' : 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-300'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{color: analytics.month.profit >= 0 ? '#047857' : '#be123c'}}>صافي ربح الشهر</p>
                        <p className="text-3xl font-bold mt-2" style={{color: analytics.month.profit >= 0 ? '#065f46' : '#9f1239'}}>
                          {analytics.month.profit.toFixed(2)} ر.س
                        </p>
                      </div>
                      <div className="text-5xl">{analytics.month.profit >= 0 ? '✅' : '⚠️'}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Accounts Summary Cards */}
          {analytics && analytics.accountsSummary && analytics.accountsSummary.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4">📊 تحليلات الفروع التفصيلية</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.accountsSummary.map(acc => (
                  <Card key={acc.id} className="border-2 hover:shadow-lg transition-shadow">
                    <CardHeader className="bg-gradient-to-l from-blue-50 to-white pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{acc.name}</span>
                        <span className={`text-sm px-2 py-1 rounded ${acc.monthProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {acc.monthProfit >= 0 ? '↗' : '↘'} {acc.monthProfit.toFixed(0)}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Today */}
                        <div className="p-2 bg-green-50 rounded">
                          <div className="text-xs text-slate-600 mb-1">اليوم:</div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-green-700">مبيعات: {acc.todaySales.toFixed(2)}</span>
                            <span className="text-sm text-red-700">مصروفات: {acc.todayExpenses.toFixed(2)}</span>
                          </div>
                          <div className="text-center mt-1">
                            <span className={`font-bold text-sm ${acc.todayProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              ربح: {acc.todayProfit.toFixed(2)} ر.س
                            </span>
                          </div>
                        </div>

                        {/* Week */}
                        <div className="p-2 bg-blue-50 rounded">
                          <div className="text-xs text-slate-600 mb-1">الأسبوع:</div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-green-700">مبيعات: {acc.weekSales.toFixed(2)}</span>
                            <span className="text-sm text-red-700">مصروفات: {acc.weekExpenses.toFixed(2)}</span>
                          </div>
                          <div className="text-center mt-1">
                            <span className={`font-bold text-sm ${acc.weekProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              ربح: {acc.weekProfit.toFixed(2)} ر.س
                            </span>
                          </div>
                        </div>

                        {/* Month */}
                        <div className="p-2 bg-purple-50 rounded">
                          <div className="text-xs text-slate-600 mb-1">الشهر:</div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-green-700">مبيعات: {acc.monthSales.toFixed(2)}</span>
                            <span className="text-sm text-red-700">مصروفات: {acc.monthExpenses.toFixed(2)}</span>
                          </div>
                          <div className="text-center mt-1">
                            <span className={`font-bold text-sm ${acc.monthProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              ربح: {acc.monthProfit.toFixed(2)} ر.س
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t mt-2">
                          <p className="text-xs text-slate-500 text-center">
                            {acc.monthCount} عملية هذا الشهر
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

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
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                      <SelectItem value="credit">آجل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Receipt Upload for Bank Transfer */}
                {form.paymentMethod === 'transfer' && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <Label className="text-sm font-semibold text-blue-800 mb-2 block">
                      📎 إرفاق إيصال التحويل البنكي
                    </Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setForm({ ...form, receiptFile: file });
                        }
                      }}
                      className="bg-white"
                    />
                    {form.receiptFile && (
                      <p className="text-xs text-green-700 mt-2">
                        ✅ تم اختيار: {form.receiptFile.name}
                      </p>
                    )}
                  </div>
                )}

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

// CEO Embedded Components
const CeoFilters = ({ accounts, onChange }) => {
  const [range, setRange] = useState('month');
  const [accountId, setAccountId] = useState('all');
  useEffect(()=>{
    onChange && onChange({range, accountId});
  }, [range, accountId]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger><SelectValue placeholder="المدى الزمني" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="today">اليوم</SelectItem>
          <SelectItem value="week">الأسبوع</SelectItem>
          <SelectItem value="month">الشهر</SelectItem>
        </SelectContent>
      </Select>
      <Select value={accountId} onValueChange={setAccountId}>
        <SelectTrigger><SelectValue placeholder="كل الفروع" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الفروع</SelectItem>
          {accounts.map(a => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-slate-500 text-sm flex items-center">اختر الفترة والفرع لتحليل سريع</div>
    </div>
  );
};

const CeoSection = ({ accounts, ops }) => {
  // Compute quick KPIs client-side as fallback
  const [activeTab, setActiveTab] = useState('kpis');
  const computeTotals = (ops, type) => ops.filter(o=>o.type===type).reduce((s,o)=>s+Number(o.total||0),0);
  const totalSales = computeTotals(ops,'sale');
  const totalExpenses = computeTotals(ops,'purchase');
  const profit = totalSales - totalExpenses;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="kpis">المؤشرات</TabsTrigger>
        <TabsTrigger value="trends">الترند</TabsTrigger>
        <TabsTrigger value="ask">اسأل CEO</TabsTrigger>
      </TabsList>

      <TabsContent value="kpis">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="text-sm text-green-700">إجمالي المبيعات</div>
              <div className="text-3xl font-bold text-green-800">{totalSales.toFixed(2)} ر.س</div>
            </CardContent>
          </Card>
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4">
              <div className="text-sm text-rose-700">إجمالي المصروفات</div>
              <div className="text-3xl font-bold text-rose-800">{totalExpenses.toFixed(2)} ر.س</div>
            </CardContent>
          </Card>
          <Card className={`border-2 ${profit>=0?'border-emerald-300 bg-emerald-50':'border-rose-300 bg-rose-50'}`}>
            <CardContent className="p-4">
              <div className="text-sm">صافي الربح</div>
              <div className="text-3xl font-bold">{profit.toFixed(2)} ر.س</div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="trends">
        <div className="text-sm text-slate-600">مخططات صغيرة (قريبًا) — سنعرض ترند أسبوعي/شهري للفروع.</div>
      </TabsContent>

      <TabsContent value="ask">
        <CeoAskPanel accounts={accounts} />
      </TabsContent>
    </Tabs>
  );
};

const CeoAskPanel = ({ accounts }) => {
  const [question, setQuestion] = useState('حلل لي الربحية الشهرية لكل فرع واقترح قرارات.');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');

  const run = async () => {
    try {
      setLoading(true);
      setAnswer('');
      const ids = accounts.slice(0,3).map(a=>a.id);
      const res = await axios.post(`${API_URL}/ceo/ai-analysis-multi`, { accountIds: ids, question });
      const txt = res.data?.ai?.answer || res.data?.ai || 'تم التحليل بنجاح. لا يوجد رد ذكي مُمكّن حالياً.';
      setAnswer(JSON.stringify({ totals: res.data?.totals, summary: txt }, null, 2));
    } catch (e) {
      setAnswer('تعذر تنفيذ التحليل الآن.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm">سؤال إلى CEO</Label>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
        <Input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="اكتب سؤالك المالي هنا" />
        <Button onClick={run} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">{loading?'جارٍ التحليل...':'تحليل ذكي'}</Button>
      </div>
      <pre className="p-3 bg-slate-50 border rounded text-xs whitespace-pre-wrap">{answer}</pre>
    </div>
  );
};


// CEO Embedded Components
const CeoSection = ({ accounts, ops }) => {
  // Compute quick KPIs client-side as fallback
  const [activeTab, setActiveTab] = useState('kpis');
  const computeTotals = (ops, type) => ops.filter(o=>o.type===type).reduce((s,o)=>s+Number(o.total||0),0);
  const totalSales = computeTotals(ops,'sale');
  const totalExpenses = computeTotals(ops,'purchase');
  const profit = totalSales - totalExpenses;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="kpis">المؤشرات</TabsTrigger>
        <TabsTrigger value="trends">الترند</TabsTrigger>
      </TabsList>

      <TabsContent value="kpis">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="text-sm text-green-700">إجمالي المبيعات</div>
              <div className="text-3xl font-bold text-green-800">{totalSales.toFixed(2)} ر.س</div>
            </CardContent>
          </Card>
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4">
              <div className="text-sm text-rose-700">إجمالي المصروفات</div>
              <div className="text-3xl font-bold text-rose-800">{totalExpenses.toFixed(2)} ر.س</div>
            </CardContent>
          </Card>
          <Card className={`border-2 ${profit>=0?'border-emerald-300 bg-emerald-50':'border-rose-300 bg-rose-50'}`}>
            <CardContent className="p-4">
              <div className="text-sm">صافي الربح</div>
              <div className="text-3xl font-bold">{profit.toFixed(2)} ر.س</div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="trends">
        <div className="text-sm text-slate-600">مخططات صغيرة (قريبًا) — سنعرض ترند أسبوعي/شهري للفروع.</div>
      </TabsContent>
    </Tabs>
  );
};

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
