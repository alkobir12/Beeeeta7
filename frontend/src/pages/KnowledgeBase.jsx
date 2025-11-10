import React, { useState, useEffect } from 'react';
import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function KnowledgeBase() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('local'); // local | brave | you | perplexity
  const [results, setResults] = useState([]);
  const [info, setInfo] = useState('');

  const search = async () => {
    try{
      setResults([]); setInfo('');
      if (mode === 'local'){
        const r = await axios.get(`${API}/ai/kb/local-search`, { params: { query, k: 8 } });
        setResults(r.data?.results || []);
        if (r.data?.reason) setInfo(r.data.reason);
      } else if (mode === 'brave'){
        const r = await axios.get(`${API}/search/brave`, { params: { q: query } });
        setResults([r.data]);
        if (!r.data?.ok) setInfo('Brave API غير مفعّل (لا توجد مفاتيح).');
      } else if (mode === 'you'){
        const r = await axios.get(`${API}/search/you`, { params: { q: query } });
        setResults([r.data]);
        if (!r.data?.ok) setInfo('You.com API غير مفعّل (لا توجد مفاتيح).');
      } else if (mode === 'perplexity'){
        const r = await axios.get(`${API}/search/perplexity`, { params: { q: query } });
        setResults([r.data]);
        if (!r.data?.ok) setInfo('Perplexity API غير مفعّل (لا توجد مفاتيح).');
      }
    }catch(e){ setInfo('تعذر تنفيذ البحث.'); }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">قاعدة المعرفة التعليمية</h1>
        <div className="flex gap-2 mb-3">
          <input className="border p-2 rounded w-full" placeholder="اكتب استعلامك..." value={query} onChange={e=>setQuery(e.target.value)} />
          <select className="border p-2 rounded" value={mode} onChange={e=>setMode(e.target.value)}>
            <option value="local">LlamaIndex (محلي)</option>
            <option value="brave">Brave</option>
            <option value="you">You.com</option>
            <option value="perplexity">Perplexity</option>
          </select>
          <button onClick={search} className="px-4 py-2 bg-blue-600 text-white rounded">بحث</button>
        </div>
        {info && <div className="text-sm text-amber-700 mb-3">{info}</div>}
        <div className="space-y-3">
          {results.map((r,idx)=> (
            <div key={idx} className="p-3 border rounded">
              {r.text ? (
                <>
                  <div className="text-slate-800 text-sm whitespace-pre-wrap">{r.text}</div>
                  {r.metadata && <div className="text-xs text-slate-500 mt-1">{JSON.stringify(r.metadata)}</div>}
                </>
              ) : (
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Search, BookOpen, FileText, Upload, Eye, Star, Clock, 
  Download, ChevronRight, Zap, Database, Filter, GitCompare
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const KnowledgeBase = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [dtcCards, setDtcCards] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showReader, setShowReader] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [searchMode, setSearchMode] = useState('smart'); // smart, dtc
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/kb/docs`);
      setDocuments(res.data?.docs || []);
    } catch (e) {
      console.error('Error loading docs:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: 'أدخل كلمة البحث', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      
      // Check if searching for DTC code (P0xxx format)
      const dtcPattern = /^[PCUB][0-9A-F]{4}$/i;
      const isDTCSearch = dtcPattern.test(searchQuery.trim());
      
      if (isDTCSearch || searchMode === 'dtc') {
        // Search for DTC cards
        const res = await axios.post(`${API_URL}/ai/kb/extract-dtc-cards`, {
          query: searchQuery.trim()
        });
        setDtcCards(res.data?.cards || []);
        setSearchResults([]);
        toast({
          title: '🔧 وجدنا بطاقات أعطال',
          description: `${res.data?.count || 0} بطاقة عطل`
        });
      } else {
        // Normal smart search
        const res = await axios.post(`${API_URL}/ai/kb/smart-search`, {
          query: searchQuery,
          limit: 20
        });
        setSearchResults(res.data?.results || []);
        setDtcCards([]);
        toast({
          title: '✅ اكتمل البحث',
          description: `وجدنا ${res.data?.count || 0} نتيجة من ${res.data?.totalMatches || 0} مطابقة`
        });
      }
    } catch (e) {
      console.error('Search error:', e);
      toast({ title: 'خطأ في البحث', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadProgress(true);
      const formData = new FormData();
      formData.append('file', file);

      toast({ title: '⏳ جاري الرفع...', description: 'يتم تحليل الملف بالذكاء الاصطناعي' });

      const res = await axios.post(`${API_URL}/ai/kb/upload-and-analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast({
        title: '✅ تم الرفع والتحليل',
        description: `الملف: ${res.data.filename} - استُخرج ${res.data.extractedLength} حرف`
      });

      loadDocuments();
    } catch (e) {
      toast({ title: 'خطأ في الرفع', description: e.response?.data?.detail || 'فشل', variant: 'destructive' });
    } finally {
      setUploadProgress(false);
      e.target.value = '';
    }
  };

  const openReader = (doc) => {
    setSelectedDoc(doc);
    setShowReader(true);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Database className="text-godaddy-green" size={40} />
              <h1 className="text-4xl font-bold text-godaddy-black">قاعدة المعرفة التعليمية</h1>
            </div>
            <p className="text-godaddy-gray text-lg">مرجعك الشامل للكهرباء والمحركات والتشخيص</p>
          </div>

          <Tabs defaultValue="search" className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
              <TabsTrigger value="search">
                <Search className="ml-2" size={18} />
                البحث
              </TabsTrigger>
              <TabsTrigger value="browse">
                <BookOpen className="ml-2" size={18} />
                تصفح
              </TabsTrigger>
              <TabsTrigger value="compare">
                <GitCompare className="ml-2" size={18} />
                مقارنة
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="ml-2" size={18} />
                رفع ملف
              </TabsTrigger>
            </TabsList>

            {/* Search Tab */}
            <TabsContent value="search">
              <Card className="card-godaddy mb-6">
                <CardHeader className="bg-gradient-to-l from-green-50">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="text-godaddy-green" />
                    البحث الذكي
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex gap-3 mb-4">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="ابحث: كهرباء، P0087، محرك، SCV، فرامل..."
                      className="input-godaddy flex-1 text-lg"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={loading}
                      className="btn-godaddy-primary px-8"
                    >
                      {loading ? '⏳ جاري البحث...' : 'بحث'}
                    </Button>
                  </div>
                  
                  {/* Search Mode Selector */}
                  <div className="flex gap-3 mb-6 p-3 bg-gray-100 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="searchMode"
                        value="smart"
                        checked={searchMode === 'smart'}
                        onChange={(e) => setSearchMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">🔍 بحث ذكي (كلمات)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="searchMode"
                        value="dtc"
                        checked={searchMode === 'dtc'}
                        onChange={(e) => setSearchMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">🔧 بحث أكواد (P0087)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="searchMode"
                        value="letter"
                        checked={searchMode === 'letter'}
                        onChange={(e) => setSearchMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">🔤 بحث بالحرف</span>
                    </label>
                  </div>

                  <div className="mb-6">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="ابحث: كهرباء، محرك، P0087، فرامل، تويوتا..."
                      className="input-godaddy flex-1 text-lg"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={loading}
                      className="btn-godaddy-primary px-8"
                    >
                      {loading ? '⏳ جاري البحث...' : 'بحث'}
                    </Button>
                  </div>
                  
                  <div className="mb-4 text-sm text-godaddy-gray">
                    💡 نصيحة: ابحث عن كود العطل (مثال: P0087) أو كلمة مفتاحية (كهرباء، محرك، SCV)
                  </div>

                  {/* DTC Cards Results */}
                  {dtcCards.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-2xl">🔧</span>
                        <span className="font-semibold text-amber-900">
                          وجدنا {dtcCards.length} بطاقة عطل
                        </span>
                      </div>

                      {dtcCards.map((card, idx) => (
                        <Card key={idx} className="border-2 border-amber-200 hover:border-godaddy-green hover:shadow-lg transition-all">
                          <CardContent className="p-6">
                            {/* DTC Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="px-4 py-2 bg-red-600 text-white font-mono font-bold text-lg rounded-lg">
                                    {card.code}
                                  </span>
                                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                    {card.vehicle}
                                  </span>
                                </div>
                                <h3 className="font-bold text-xl text-godaddy-black mb-1">
                                  {card.name}
                                </h3>
                                <p className="text-xs text-godaddy-gray">
                                  📄 المصدر: {card.source}
                                </p>
                              </div>
                            </div>

                            {/* Causes */}
                            {card.causes && card.causes.length > 0 && (
                              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                                  ⚠️ الأسباب المحتملة:
                                </h4>
                                <ul className="space-y-1">
                                  {card.causes.map((cause, i) => (
                                    <li key={i} className="text-sm text-red-800">
                                      • {cause}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Fixes */}
                            {card.fixes && card.fixes.length > 0 && (
                              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                  🔧 طرق الإصلاح:
                                </h4>
                                <ul className="space-y-1">
                                  {card.fixes.map((fix, i) => (
                                    <li key={i} className="text-sm text-green-800">
                                      ✓ {fix}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Related Issues */}
                            {card.related && card.related.length > 0 && (
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                                <h4 className="font-semibold text-blue-900 mb-2">
                                  🔗 أكواد ذات صلة:
                                </h4>
                                <div className="flex gap-2 flex-wrap">
                                  {card.related.map((code, i) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        setSearchQuery(code);
                                        handleSearch();
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white rounded font-mono text-sm hover:bg-blue-700"
                                    >
                                      {code}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Repair Manual Reference */}
                            <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg mb-4">
                              <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                📚 المرجع الفني (Repair Manual):
                              </h4>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-purple-800 font-medium">
                                    🚗 {card.vehicle}
                                  </p>
                                  <p className="text-xs text-purple-700 mt-1">
                                    📄 {card.repairManual || card.source}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-white"
                                  onClick={() => {
                                    const doc = documents.find(d => d.id === (card.repairManualId || card.sourceId));
                                    if (doc) openReader(doc);
                                  }}
                                >
                                  <BookOpen size={16} className="ml-1" />
                                  افتح المرجع
                                </Button>
                              </div>
                            </div>

                            {/* Read Full Document Button */}
                            <div className="pt-4 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const doc = documents.find(d => d.id === card.sourceId);
                                  if (doc) openReader(doc);
                                }}
                                className="w-full"
                              >
                                <Eye size={16} className="ml-1" />
                                اقرأ المستند الكامل
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Normal Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-godaddy-gray mb-4">
                        <Filter size={16} />
                        <span>وجدنا {searchResults.length} نتيجة</span>
                      </div>

                      {searchResults.map((result, idx) => (
                        <Card key={idx} className="card-godaddy hover:border-godaddy-green cursor-pointer" onClick={() => {
                          const doc = documents.find(d => d.id === result.id);
                          if (doc) openReader(doc);
                        }}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <FileText className="text-godaddy-green flex-shrink-0" size={20} />
                                  <h3 className="font-bold text-lg text-godaddy-black">{result.title}</h3>
                                  <span className="badge-godaddy-success text-xs">{result.type}</span>
                                  {result.relevance && (
                                    <span className="text-xs text-amber-600 flex items-center gap-1">
                                      <Star size={12} fill="currentColor" />
                                      {result.relevance}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-godaddy-gray mb-3">{result.excerpt}</p>
                                {result.keywords && result.keywords.length > 0 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {result.keywords.map((kw, i) => (
                                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                        #{kw}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button size="sm" variant="outline" className="flex-shrink-0">
                                <Eye size={16} className="ml-1" />
                                قراءة
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {searchResults.length === 0 && searchQuery && !loading && (
                    <div className="text-center py-12">
                      <Search className="mx-auto text-gray-300 mb-4" size={64} />
                      <p className="text-godaddy-gray">لا توجد نتائج للبحث "{searchQuery}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Browse Tab */}
            <TabsContent value="browse">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc, idx) => (
                  <Card key={idx} className="card-godaddy hover:border-godaddy-green cursor-pointer" onClick={() => openReader(doc)}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-godaddy-green to-godaddy-green-dark flex items-center justify-center text-white flex-shrink-0">
                          <FileText size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-godaddy-black truncate">{doc.filename}</h3>
                          <p className="text-xs text-godaddy-gray flex items-center gap-2 mt-1">
                            <Clock size={12} />
                            {new Date(doc.uploadedAt).toLocaleDateString('ar-SA')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <span className="badge-godaddy-success text-xs">{doc.type}</span>
                        {doc.subcategory && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {doc.subcategory}
                          </span>
                        )}
                      </div>

                      {doc.summary && (
                        <p className="text-sm text-godaddy-gray mb-3 overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>
                          {doc.summary.slice(0, 100)}...
                        </p>
                      )}

                      <Button size="sm" variant="outline" className="w-full">
                        <Eye size={16} className="ml-1" />
                        قراءة المستند
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {documents.length === 0 && (
                  <div className="col-span-3 text-center py-12">
                    <BookOpen className="mx-auto text-gray-300 mb-4" size={64} />
                    <p className="text-godaddy-gray">لا توجد مستندات. ارفع ملفات من تبويب "رفع ملف"</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Compare Tab */}
            <TabsContent value="compare">
              <Card className="card-godaddy">
                <CardHeader className="bg-gradient-to-l from-purple-50">
                  <CardTitle className="flex items-center gap-2">
                    <GitCompare className="text-purple-600" />
                    مقارنة المستندات
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <Label className="mb-2 block font-semibold">الملف الأول</Label>
                      <select 
                        className="w-full border-2 rounded-lg p-3"
                        onChange={(e) => setFile1(documents.find(d => d.id === e.target.value))}
                      >
                        <option value="">اختر مستند...</option>
                        {documents.map(doc => (
                          <option key={doc.id} value={doc.id}>{doc.filename}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="mb-2 block font-semibold">الملف الثاني</Label>
                      <select 
                        className="w-full border-2 rounded-lg p-3"
                        onChange={(e) => setFile2(documents.find(d => d.id === e.target.value))}
                      >
                        <option value="">اختر مستند...</option>
                        {documents.map(doc => (
                          <option key={doc.id} value={doc.id}>{doc.filename}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <Button
                    onClick={async () => {
                      if (!file1 || !file2) {
                        toast({ title: 'اختر ملفين', variant: 'destructive' });
                        return;
                      }
                      
                      try {
                        setLoading(true);
                        const res = await axios.post(`${API_URL}/ai/kb/compare-files`, {
                          file1_id: file1.id,
                          file2_id: file2.id
                        });
                        
                        setComparisonResult(res.data);
                        toast({ title: '✅ اكتملت المقارنة' });
                      } catch (e) {
                        toast({ title: 'خطأ في المقارنة', variant: 'destructive' });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={!file1 || !file2 || loading}
                    className="btn-godaddy-primary w-full"
                  >
                    {loading ? 'جاري المقارنة...' : 'قارن الملفات'}
                  </Button>
                  
                  {comparisonResult && (
                    <Card className="mt-6 border-2 border-purple-300">
                      <CardContent className="p-6">
                        <h3 className="font-bold text-xl mb-4">نتيجة المقارنة</h3>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
{comparisonResult.comparison}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload">
              <Card className="card-godaddy">
                <CardHeader className="bg-gradient-to-l from-green-50">
                  <CardTitle>رفع مستند جديد</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-godaddy-gray-light rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Upload className="mx-auto text-godaddy-green mb-4" size={48} />
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <p className="text-lg font-semibold text-godaddy-black mb-2">
                          اضغط لاختيار ملف أو اسحبه هنا
                        </p>
                        <p className="text-sm text-godaddy-gray">
                          PDF, DOCX, TXT - حتى 50 MB
                        </p>
                      </Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={handleUpload}
                        className="hidden"
                        disabled={uploadProgress}
                      />
                    </div>

                    {uploadProgress && (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-godaddy-green mx-auto mb-3"></div>
                        <p className="text-godaddy-gray">جاري تحليل الملف بالذكاء الاصطناعي...</p>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">💡 نصائح:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• أدلة السيارات التقنية (Toyota, Nissan, etc.)</li>
                        <li>• كتيبات الكهرباء وخرائط الدوائر</li>
                        <li>• دليل الفحص والإصلاح</li>
                        <li>• مواصفات المحركات والأجزاء</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Document Reader Modal */}
          {showReader && selectedDoc && (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={() => setShowReader(false)}>
              <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Reader Header */}
                <div className="bg-gradient-to-r from-godaddy-black to-godaddy-dark text-white p-6 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-godaddy-green flex items-center justify-center">
                      <BookOpen size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedDoc.filename}</h2>
                      <p className="text-sm text-gray-300 flex items-center gap-3 mt-1">
                        <span className="px-2 py-1 bg-white bg-opacity-20 rounded">{selectedDoc.type}</span>
                        <span>•</span>
                        <span>{new Date(selectedDoc.uploadedAt).toLocaleDateString('ar-SA')}</span>
                        {selectedDoc.vehicle && (
                          <>
                            <span>•</span>
                            <span>🚗 {selectedDoc.vehicle}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setShowReader(false)} className="text-white hover:bg-gray-700 text-2xl px-4">
                    ✕
                  </Button>
                </div>

                {/* Reader Content - Full Professional View */}
                <div className="p-8 overflow-y-auto max-h-[calc(95vh-120px)] bg-gray-50">
                  <div className="max-w-5xl mx-auto">
                    
                    {/* AI Summary Section */}
                    {selectedDoc.summary && (
                      <Card className="mb-6 border-2 border-godaddy-green shadow-lg">
                        <CardHeader className="bg-gradient-to-l from-green-50 to-white">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Zap className="text-godaddy-green" size={24} />
                            الملخص الذكي بالذكاء الاصطناعي
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 bg-white">
                          <div className="prose prose-lg max-w-none text-godaddy-black leading-relaxed">
                            <pre className="whitespace-pre-wrap font-sans text-base leading-loose">
{selectedDoc.summary}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Key Points */}
                    {selectedDoc.keyPoints && selectedDoc.keyPoints.length > 0 && (
                      <Card className="mb-6 shadow-lg">
                        <CardHeader className="bg-gradient-to-l from-blue-50 to-white">
                          <CardTitle className="text-xl">📌 النقاط الرئيسية والمفاهيم</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 bg-white">
                          <div className="grid grid-cols-1 gap-3">
                            {selectedDoc.keyPoints.map((point, i) => (
                              <div key={i} className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-godaddy-green text-white flex items-center justify-center font-bold">
                                  {i + 1}
                                </span>
                                <span className="text-godaddy-black text-base leading-relaxed">{point}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Full Document Content - Professional Reading View */}
                    {selectedDoc.content && (
                      <Card className="mb-6 shadow-lg">
                        <CardHeader className="bg-gradient-to-l from-amber-50 to-white">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <FileText className="text-amber-600" size={24} />
                            قراءة المستند الكامل - عرض احترافي
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 bg-white">
                          {/* Professional Document View */}
                          <div className="bg-white border-2 border-gray-200 rounded-xl p-10 shadow-inner" style={{
                            fontFamily: "'Amiri', 'Traditional Arabic', 'Arial', sans-serif",
                            fontSize: '16px',
                            lineHeight: '2.2',
                            color: '#1a202c'
                          }}>
                            <pre className="whitespace-pre-wrap" style={{
                              fontFamily: 'inherit',
                              fontSize: 'inherit',
                              lineHeight: 'inherit',
                              color: 'inherit',
                              direction: 'rtl',
                              textAlign: 'justify'
                            }}>
{selectedDoc.content}
                            </pre>
                          </div>
                          
                          {/* Document Stats */}
                          <div className="mt-6 pt-6 border-t flex items-center justify-between text-sm text-gray-600">
                            <span>📊 عدد الأحرف: {selectedDoc.content.length.toLocaleString('ar-SA')}</span>
                            <span>📖 الصفحات المقدرة: ~{Math.ceil(selectedDoc.content.length / 2000)}</span>
                            {selectedDoc.accessCount && (
                              <span>👁️ عدد القراءات: {selectedDoc.accessCount}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Keywords & Classification */}
                    {(selectedDoc.keywords && selectedDoc.keywords.length > 0) && (
                      <Card className="shadow-lg">
                        <CardHeader>
                          <CardTitle className="text-lg">🏷️ الكلمات المفتاحية والتصنيف</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="flex flex-wrap gap-2">
                            {selectedDoc.keywords.map((kw, i) => (
                              <span key={i} className="px-4 py-2 bg-godaddy-green text-white rounded-full font-semibold text-sm">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default KnowledgeBase;
