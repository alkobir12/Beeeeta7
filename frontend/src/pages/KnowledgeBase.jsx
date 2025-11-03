import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Search, BookOpen, FileText, Upload, Eye, Star, Clock, 
  Download, ChevronRight, Zap, Database, Filter
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
      const res = await axios.post(`${API_URL}/ai/kb/smart-search`, {
        query: searchQuery,
        limit: 20
      });
      setSearchResults(res.data?.results || []);
      toast({
        title: '✅ اكتمل البحث',
        description: `وجدنا ${res.data?.count || 0} نتيجة من ${res.data?.totalMatches || 0} مطابقة`
      });
    } catch (e) {
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
            <TabsList className="grid grid-cols-3 w-full max-w-md mb-6">
              <TabsTrigger value="search">
                <Search className="ml-2" size={18} />
                البحث
              </TabsTrigger>
              <TabsTrigger value="browse">
                <BookOpen className="ml-2" size={18} />
                تصفح
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
                  <div className="flex gap-3 mb-6">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="ابحث عن: كهرباء، محرك، فرامل، تويوتا، 1KD..."
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

                  {/* Search Results */}
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
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowReader(false)}>
              <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Reader Header */}
                <div className="bg-gradient-to-r from-godaddy-black to-godaddy-dark text-white p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen size={28} />
                    <div>
                      <h2 className="text-xl font-bold">{selectedDoc.filename}</h2>
                      <p className="text-sm text-gray-300">
                        {selectedDoc.type} • {new Date(selectedDoc.uploadedAt).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setShowReader(false)} className="text-white hover:bg-gray-700">
                    ✕
                  </Button>
                </div>

                {/* Reader Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                  {/* Summary */}
                  {selectedDoc.summary && (
                    <Card className="mb-6 border-2 border-godaddy-green">
                      <CardHeader className="bg-gradient-to-l from-green-50">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className="text-godaddy-green" size={20} />
                          الملخص الذكي
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5">
                        <p className="text-godaddy-black leading-relaxed whitespace-pre-wrap">
                          {selectedDoc.summary}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Key Points */}
                  {selectedDoc.keyPoints && selectedDoc.keyPoints.length > 0 && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="text-lg">📌 النقاط الرئيسية</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5">
                        <ul className="space-y-2">
                          {selectedDoc.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <ChevronRight className="text-godaddy-green flex-shrink-0 mt-1" size={18} />
                              <span className="text-godaddy-black">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Full Content */}
                  {selectedDoc.content && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">📄 المحتوى الكامل</CardTitle>
                      </CardHeader>
                      <CardContent className="p-5">
                        <div className="bg-gray-50 rounded-lg p-5 max-h-96 overflow-y-auto">
                          <pre className="text-sm text-godaddy-black whitespace-pre-wrap font-sans leading-relaxed">
                            {selectedDoc.content}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  )}
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
