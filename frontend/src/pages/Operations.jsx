import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import CanvaCard from '../components/CanvaCard';
import DraggableGrid from '../components/DraggableGrid';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Operations = () => {
  const { t, i18n } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [parts, setParts] = useState([]);
  const [services, setServices] = useState([]);
  const [ops, setOps] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ accountId: '', type: 'purchase', partnerType: 'supplier', partnerName: '', items: [], paymentMethod: 'cash', notes: '', receiptFile: null });
  const [item, setItem] = useState({ itemType: 'part', itemId: '', name: '', quantity: 1, price: 0, category: '' });

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

    // CEO Embedded
    items.push({
      id: 'ceo',
      render: () => (
        <CanvaCard title={t('operations.ceoPanelTitle')}>
          <CeoFilters accounts={accounts} onChange={()=>{}} />
          <div className="h-4" />
          <CeoSection accounts={accounts} ops={ops} />
        </CanvaCard>
      )
    });

    // KPIs
    items.push({
      id: 'kpis',
      render: () => (
        <CanvaCard title={t('operations.quickKpisTitle')} className="canva-accent-blue border-2">
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2 canva-accent-emerald">
                <CardContent className="p-6">
                  <div className="text-sm text-emerald-700 font-semibold">{t('operations.todaySales')}</div>
                  <div className="text-3xl font-bold text-emerald-900 mt-2">{analytics.today.sales.toFixed(2)} ر.س</div>
                </CardContent>
              </Card>
              <Card className="border-2 canva-accent-blue">
                <CardContent className="p-6">
                  <div className="text-sm text-blue-700 font-semibold">{t('operations.weekSales')}</div>
                  <div className="text-3xl font-bold text-blue-900 mt-2">{analytics.week.sales.toFixed(2)} ر.س</div>
                </CardContent>
              </Card>
              <Card className="border-2 canva-accent-purple">
                <CardContent className="p-6">
                  <div className="text-sm text-purple-700 font-semibold">{t('operations.monthSales')}</div>
                  <div className="text-3xl font-bold text-purple-900 mt-2">{analytics.month.sales.toFixed(2)} ر.س</div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">لا توجد بيانات</div>
          )}
        </CanvaCard>
      )
    });

    // Accounts Summary
    if (analytics && analytics.accountsSummary && analytics.accountsSummary.length > 0) {
      items.push({
        id: 'accounts-summary',
        render: () => (
          <CanvaCard title={t('operations.branchesAnalyticsTitle')} className="border-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.accountsSummary.map(acc => (
                <Card key={acc.id} className="border-2 hover:shadow-md transition">
                  <CardHeader className="pb-2"><CardTitle className="text-base">{acc.name}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span>الأسبوع: {acc.weekSales.toFixed(0)}</span>
                      <span className={acc.weekProfit>=0? 'text-emerald-700':'text-rose-700'}>
                        {acc.weekProfit.toFixed(0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CanvaCard>
        )
      });
    }

    // Quick item add
    items.push({
      id: 'quick-item',
      render: () => (
        <CanvaCard title={t('operations.addItemTitle')} className="border-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={item.itemType} onValueChange={v=>setItem({...item, itemType: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="part">{t('operations.itemTypePart')}</SelectItem>
                <SelectItem value="service">{t('operations.itemTypeService')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Selector by id depends on type */}
            {item.itemType === 'part' ? (
              <Select value={item.itemId} onValueChange={v=>{ const it = parts.find(p=>p.id===v); setItem({...item, itemId: v, name: it?.name || '', price: it?.sellingPrice || it?.price || 0}); }}>
                <SelectTrigger><SelectValue placeholder={t('operations.selectPartOptional')} /></SelectTrigger>
                <SelectContent>
                  {parts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={item.itemId} onValueChange={v=>{ const s = services.find(s=>s.id===v); setItem({...item, itemId: v, name: s?.name || '', price: s?.price || 0}); }}>
                <SelectTrigger><SelectValue placeholder={t('operations.selectServiceOptional')} /></SelectTrigger>
                <SelectContent>
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Input placeholder={t('operations.customNamePlaceholder')} value={item.name} onChange={e=> setItem({...item, name: e.target.value})} />
            <Input type="number" placeholder={t('operations.quantityPlaceholder')} value={item.quantity} onChange={e=> setItem({...item, quantity: Number(e.target.value) || 0})} />
            <Input type="number" placeholder={t('operations.pricePlaceholder')} value={item.price} onChange={e=> setItem({...item, price: Number(e.target.value) || 0})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <Input placeholder="تصنيف (اختياري)" value={item.category} onChange={e=> setItem({...item, category: e.target.value})} />
            {item.itemType === 'part' ? (
              <Button type="button" variant="outline" onClick={async ()=>{
                if(!item.name){ alert('أدخل اسم القطعة'); return; }
                try{
                  const res = await axios.post(`${API_URL}/parts`, { partNumber: `P-${Date.now()}`, name: item.name, category: item.category || 'عام', purchasePrice: item.price || 0, sellingPrice: item.price || 0, quantity: item.quantity || 1 });
                  const list = await axios.get(`${API_URL}/parts`);
                  setParts(list.data || []);
                  setItem(prev=>({...prev, itemId: res.data.id}));
                }catch(e){ alert('تعذر حفظ القطعة'); }
              }}>حفظ القطعة في قاعدة البيانات</Button>
            ) : (
              <Button type="button" variant="outline" onClick={async ()=>{
                if(!item.name){ alert('أدخل اسم الخدمة'); return; }
                try{
                  const res = await axios.post(`${API_URL}/services`, { name: item.name, price: item.price || 0, category: item.category || 'عام', duration: 30 });
                  const list = await axios.get(`${API_URL}/services`);
                  setServices(list.data || []);
                  setItem(prev=>({...prev, itemId: res.data.id}));
                }catch(e){ alert('تعذر حفظ الخدمة'); }
              }}>حفظ الخدمة في قاعدة البيانات</Button>
            )}
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={addItem}>إضافة للبنود</Button>
          </div>

          {form.items.length>0 && (
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-2 text-right">النوع</th>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-right">الكمية</th>
                    <th className="p-2 text-right">السعر</th>
                    <th className="p-2 text-right">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx)=> (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{it.itemType==='part'?'قطعة':'خدمة'}</td>
                      <td className="p-2">{it.name}</td>
                      <td className="p-2">{it.quantity}</td>
                      <td className="p-2">{it.price}</td>
                      <td className="p-2">{(Number(it.quantity)*Number(it.price)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right mt-2 font-bold">الإجمالي: {subtotal.toFixed(2)} ر.س</div>
            </div>
          )}
        </CanvaCard>
      )
    });

    // Create Operation form
    items.push({
      id: 'create-op',
      render: () => (
        <CanvaCard title="إنشاء عملية" className="border-2">
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

            {form.paymentMethod === 'transfer' && (
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <Label className="text-sm font-semibold text-blue-800 mb-2 block">📎 إرفاق إيصال التحويل البنكي</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e)=>{ const file=e.target.files?.[0]; if(file){ setForm({...form, receiptFile:file}); }}} />
                {form.receiptFile && (<p className="text-xs text-green-700 mt-2">✅ تم اختيار: {form.receiptFile.name}</p>)}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-bold text-slate-800">الإجمالي: {subtotal.toFixed(2)} ر.س</div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">حفظ العملية</Button>
            </div>
          </form>
        </CanvaCard>
      )
    });

    // Recent Ops
    items.push({
      id: 'recent-ops',
      render: () => (
        <CanvaCard title="آخر العمليات" className="border-2">
          <div className="space-y-3">
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
          </div>
        </CanvaCard>
      )
    });

    return items;
  }, [accounts, ops, analytics, parts, services, item, form.items]);

  return (
    <Layout>
      <div className="min-h-screen" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="container mx-auto p-6 max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">{t('operations.title')}</h1>

          <DraggableGrid items={gridItems} storageKey="operations_cards_order" columns="grid-cols-1" />
        </div>
      </div>
    </Layout>
  );
};

// CEO Embedded Components (unchanged)
const CeoFilters = ({ accounts, onChange }) => {
  const [range, setRange] = useState('month');
  const [accountId, setAccountId] = useState('all');
  useEffect(()=>{ onChange && onChange({range, accountId}); }, [range, accountId]);
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
          {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
        </SelectContent>
      </Select>
      <div className="text-slate-500 text-sm flex items-center">اختر الفترة والفرع لتحليل سريع</div>
    </div>
  );
};

const CeoSection = ({ accounts, ops }) => {
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

export default Operations;
