import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { History, Zap, Database, Globe } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

export default function References(){
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [historyProvider, setHistoryProvider] = useState('');
  const [historyItems, setHistoryItems] = useState([]);

  const fetchHistory = async (provider='') => {
    try{
      const r = await axios.get(`${API_URL}/search/history`, { params: provider? {provider}: {} });
      setHistoryItems(r.data?.items || []);
    }catch(e){ setHistoryItems([]); }
  };

  const searchElectrical = async () => {
    if (!query.trim()) return;
    try{
      setLoading(true);
      const r = await axios.post(`${API_URL}/references/electrical/smart-search`, { query });
      setResult(r.data);
      await axios.post(`${API_URL}/search/log`, { provider: 'electrical', query, ok: true, mode:'ui', count: (r.data?.matches||[]).length });
    }catch(e){ setResult(null); }
    finally{ setLoading(false); }
  };

  const searchProvider = async (provider) => {
    if (!query.trim()) return;
    try{
      setLoading(true);
      const url = provider==='perplexity'? '/search/perplexity' : provider==='you'? '/search/you' : '/search/brave';
      const r = await axios.get(`${API_URL}${url}`, { params: { q: query } });
      setResult(r.data);
    }catch(e){ setResult({ ok:false, error: 'failed' }); }
    finally{ setLoading(false); }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Database className="text-godaddy-green" size={40} />
                <h1 className="text-3xl font-bold">المراجع الفنية</h1>
              </div>
              <p className="text-godaddy-gray">الجهد الكهربائي وأكواد الأعطال</p>
            </div>
            <Button variant="outline" onClick={async ()=>{ setShowHistory(true); await fetchHistory(historyProvider); }}><History className="ml-2" size={18}/> سجل البحث</Button>
          </div>

          <Card className="card-godaddy mb-4">
            <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="text-godaddy-green"/>بحث كهربائي ذكي</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="مثال: جهد حساس الهواء الطبيعي" className="flex-1" />
                <Button onClick={searchElectrical} disabled={loading}>بحث</Button>
              </div>
              {result && (
                <pre className="whitespace-pre-wrap text-xs bg-slate-50 p-3 rounded border">{JSON.stringify(result, null, 2)}</pre>
              )}
            </CardContent>
          </Card>

          <Card className="card-godaddy">
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="text-blue-600"/>مزودات خارجية (fallback تلقائي)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-2">
                <Button variant="outline" onClick={()=>searchProvider('perplexity')}>Perplexity</Button>
                <Button variant="outline" onClick={()=>searchProvider('you')}>You.com</Button>
                <Button variant="outline" onClick={()=>searchProvider('brave')}>Brave</Button>
              </div>
              {result && (
                <pre className="whitespace-pre-wrap text-xs bg-slate-50 p-3 rounded border">{JSON.stringify(result, null, 2)}</pre>
              )}
            </CardContent>
          </Card>

          {/* Search History Drawer */}
          {showHistory && (
            <div className="fixed inset-0 bg-black/40 z-[60]" onClick={()=>setShowHistory(false)} style={{pointerEvents: 'auto'}}>
              <div className="absolute top-0 left-0 w-full md:w-[520px] h-full bg-white shadow-2xl p-4 overflow-auto" onClick={(e)=>e.stopPropagation()} dir="rtl">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-lg">سجل البحث</div>
                  <Button variant="ghost" onClick={()=>setShowHistory(false)}>إغلاق</Button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Label>المزوّد</Label>
                  <select className="border rounded px-2 py-1" value={historyProvider} onChange={async (e)=>{ setHistoryProvider(e.target.value); await fetchHistory(e.target.value); }}>
                    <option value="">الكل</option>
                    <option value="electrical">electrical</option>
                    <option value="local">local</option>
                    <option value="brave">brave</option>
                    <option value="you">you</option>
                    <option value="perplexity">perplexity</option>
                  </select>
                  <Button size="sm" onClick={async ()=>{ await fetchHistory(historyProvider); }}>تحديث</Button>
                </div>
                <div className="space-y-2 overflow-auto max-h-[70vh] pr-2">
                  {historyItems.map((it, idx)=> (
                    <div key={idx} className="p-2 border rounded bg-white">
                      <div className="text-xs text-slate-500">{it.provider} • {new Date(it.createdAt).toLocaleString('ar-SA')}</div>
                      <div className="font-semibold">{it.query}</div>
                      <div className="text-xs">النتائج: {it.count} • الحالة: {it.ok? 'ناجح':'فشل'}</div>
                    </div>
                  ))}
                  {historyItems.length===0 && <div className="text-sm text-slate-500">لا يوجد سجلات حالياً.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
