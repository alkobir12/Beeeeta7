import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { History, Zap, Database, Globe, Table, FileSpreadsheet, Download, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

export default function References(){
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // search | excel

  const [showHistory, setShowHistory] = useState(false);
  const [historyProvider, setHistoryProvider] = useState('');
  const [historyItems, setHistoryItems] = useState([]);

  // Excel Browser State
  const [excelData, setExcelData] = useState([]);
  const [excelSheets, setExcelSheets] = useState([]);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');

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

  // Load sample Excel data
  useEffect(() => {
    // Sample electrical reference data
    const sampleData = [
      { component: 'بطارية', voltage: '12.6V', amperage: '45-70A', location: 'صندوق المحرك', notes: 'فحص الشحن كل 6 أشهر' },
      { component: 'دينمو', voltage: '13.8-14.4V', amperage: '80-120A', location: 'جانب المحرك', notes: 'فحص الحزام والتوصيلات' },
      { component: 'حساس O2', voltage: '0.1-0.9V', amperage: '-', location: 'أنبوب العادم', notes: 'استبدال كل 100,000 كم' },
      { component: 'MAF', voltage: '0-5V', amperage: '-', location: 'مجرى الهواء', notes: 'تنظيف دوري' },
      { component: 'فيوز رئيسي', voltage: '12V', amperage: '100-150A', location: 'صندوق الفيوزات', notes: 'التحقق من التآكل' },
    ];
    setExcelData(sampleData);
    setExcelSheets(['المكونات الكهربائية', 'الحساسات', 'نظام الوقود']);
  }, []);

  const filteredData = excelData.filter(row =>
    searchFilter === '' || Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchFilter.toLowerCase())
    )
  );

  const exportToExcel = () => {
    alert('جاري التصدير... (Excel Export)');
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="search">
                <Zap className="w-4 h-4 ml-2" />
                البحث الذكي
              </TabsTrigger>
              <TabsTrigger value="excel">
                <FileSpreadsheet className="w-4 h-4 ml-2" />
                متصفح Excel
              </TabsTrigger>
            </TabsList>

            {/* Search Tab */}
            <TabsContent value="search">
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
            </TabsContent>

            {/* Excel Browser Tab */}
            <TabsContent value="excel">
              <Card className="shadow-xl border-2 border-blue-100">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      متصفح المراجع الفنية
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/30" onClick={exportToExcel}>
                        <Download className="w-4 h-4 ml-1" />
                        تصدير Excel
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Sheet Tabs */}
                  <div className="flex gap-1 p-2 bg-slate-50 border-b">
                    {excelSheets.map((sheet, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant={currentSheet === idx ? 'default' : 'ghost'}
                        onClick={() => setCurrentSheet(idx)}
                        className="text-xs"
                      >
                        <Table className="w-3 h-3 ml-1" />
                        {sheet}
                      </Button>
                    ))}
                  </div>

                  {/* Search/Filter Bar */}
                  <div className="p-3 bg-white border-b">
                    <div className="flex gap-2">
                      <Search className="w-5 h-5 text-slate-400 mt-2" />
                      <Input
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="ابحث في البيانات..."
                        className="flex-1"
                      />
                      {searchFilter && (
                        <Button variant="ghost" onClick={() => setSearchFilter('')}>
                          مسح
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Data Table */}
                  <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-600 text-white sticky top-0 z-10">
                        <tr>
                          <th className="p-3 text-right border-l border-blue-500">#</th>
                          <th className="p-3 text-right border-l border-blue-500">المكون</th>
                          <th className="p-3 text-right border-l border-blue-500">الجهد</th>
                          <th className="p-3 text-right border-l border-blue-500">التيار</th>
                          <th className="p-3 text-right border-l border-blue-500">الموقع</th>
                          <th className="p-3 text-right">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                            <td className="p-3 border-l font-semibold text-slate-600">{idx + 1}</td>
                            <td className="p-3 border-l font-semibold">{row.component}</td>
                            <td className="p-3 border-l text-blue-700 font-bold">{row.voltage}</td>
                            <td className="p-3 border-l text-slate-600">{row.amperage}</td>
                            <td className="p-3 border-l text-slate-600">{row.location}</td>
                            <td className="p-3 text-xs text-slate-500">{row.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredData.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <Database className="w-16 h-16 mx-auto mb-3 opacity-30" />
                        <p>لا توجد نتائج</p>
                      </div>
                    )}
                  </div>

                  {/* Footer Stats */}
                  <div className="p-3 bg-slate-50 border-t text-xs text-slate-600 flex justify-between">
                    <span>الصف {excelSheets[currentSheet]}</span>
                    <span>{filteredData.length} من {excelData.length} صف</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

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
