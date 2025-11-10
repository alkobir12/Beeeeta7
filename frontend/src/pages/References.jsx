import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { Download, Upload, Search, Zap, Database } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const References = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dtcRefs, setDtcRefs] = useState([]);
  const [elecRefs, setElecRefs] = useState([]);

  useEffect(() => {
    loadReferences();
  }, []);

  const loadReferences = async () => {
    try {
      const [dtcRes, elecRes] = await Promise.all([
        axios.get(`${API_URL}/references/dtc`),
        axios.get(`${API_URL}/references/electrical`)
      ]);
      setDtcRefs(dtcRes.data.references || []);
      setElecRefs(elecRes.data.references || []);
    } catch (e) {
      console.error('Error loading references:', e);
    }
  };

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: 'أدخل سؤالك', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/references/electrical/smart-search`, { query: searchQuery });
      setSearchResult(res.data);
      toast({ title: '✅ تم البحث', description: `وجدنا ${res.data.count} مطابقة` });
    } catch (e) {
      toast({ title: 'خطأ', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_URL}/references/import-excel`, formData);
      toast({ title: '✅ تم الاستيراد', description: `DTC: ${res.data.imported.dtc}, كهرباء: ${res.data.imported.electrical}` });
      loadReferences();
    } catch (e) {
      toast({ title: 'خطأ في الاستيراد', variant: 'destructive' });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const downloadExcelProgram = () => {
    window.open(`${API_URL}/references/download-excel-program`, '_blank');
    toast({ title: '📥 جاري التحميل', description: 'برنامج Excel للبحث' });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Database className="text-godaddy-green" size={40} />
                  <h1 className="text-4xl font-bold text-godaddy-black">المراجع الفنية</h1>
                </div>
                <p className="text-godaddy-gray text-lg">الجهد الكهربائي وأكواد الأعطال</p>
              </div>
              <Button onClick={downloadExcelProgram} className="btn-godaddy-primary">
                <Download className="ml-2" size={20} />
                تحميل برنامج Excel
              </Button>
            </div>
          </div>

          {/* Smart Search */}
          <Card className="card-godaddy mb-6">
            <CardHeader className="bg-gradient-to-l from-green-50">
              <CardTitle className="flex items-center gap-2">
                <Zap className="text-godaddy-green" />
                بحث ذكي عن الجهد الكهربائي
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-3 mb-4">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSmartSearch()} placeholder="مثال: جهد حساس الهواء في الوضع الطبيعي؟ كم جهد البطارية؟" className="input-godaddy flex-1 text-lg" />
                <Button onClick={handleSmartSearch} disabled={loading} className="btn-godaddy-primary px-8">{loading ? '⏳' : 'بحث'}</Button>
              </div>
              {searchResult && (
                <div className="space-y-4">
                  <Card className="border-2 border-godaddy-green">
                    <CardContent className="p-6 bg-green-50">
                      <h3 className="font-bold text-lg mb-3 text-godaddy-black">📋 الإجابة:</h3>
                      <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-godaddy-black">{searchResult.answer}</pre>
                    </CardContent>
                  </Card>
                  {searchResult.matches && searchResult.matches.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {searchResult.matches.map((match, idx) => (
                        <Card key={idx} className="border-2 border-blue-200">
                          <CardContent className="p-5">
                            <h4 className="font-bold text-lg mb-3">{match.componentAr}</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between p-2 bg-green-100 rounded">
                                <span>الجهد الطبيعي:</span>
                                <span className="font-bold text-green-700">{match.voltageNormal} {match.unit}</span>
                              </div>
                              <div className="flex justify-between p-2 bg-blue-50 rounded">
                                <span>النطاق:</span>
                                <span className="font-bold">{match.voltageMin} - {match.voltageMax} {match.unit}</span>
                              </div>
                              <div className="p-2 bg-amber-50 rounded">
                                <span className="font-semibold">القياس: </span>
                                <span>{match.measurementMethod}</span>
                              </div>
                              <div className="text-xs text-gray-600">💡 {match.notes}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Excel */}
          <Card className="card-godaddy mb-6">
            <CardHeader className="bg-gradient-to-l from-blue-50">
              <CardTitle>📥 استيراد مراجع من Excel</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                <Upload className="mx-auto text-godaddy-green mb-3" size={40} />
                <Label htmlFor="excel-upload" className="cursor-pointer">
                  <p className="font-semibold mb-2">اضغط لاختيار ملف Excel</p>
                  <p className="text-sm text-gray-600">يجب أن يحتوي: DTC Codes, Electrical Components</p>
                </Label>
                <Input id="excel-upload" type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-godaddy">
              <CardContent className="p-6 text-center">
                <div className="text-5xl font-bold text-godaddy-green mb-2">{dtcRefs.length}</div>
                <div className="text-godaddy-gray">كود عطل (DTC)</div>
              </CardContent>
            </Card>
            <Card className="card-godaddy">
              <CardContent className="p-6 text-center">
                <div className="text-5xl font-bold text-godaddy-green mb-2">{elecRefs.length}</div>
                <div className="text-godaddy-gray">مكون كهربائي</div>
              </CardContent>
            </Card>
            <Card className="card-godaddy">
              <CardContent className="p-6 text-center">
                <div className="text-5xl font-bold text-godaddy-green mb-2">{new Set(dtcRefs.map(d => d.vehicle)).size}</div>
                <div className="text-godaddy-gray">سيارة</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default References;
