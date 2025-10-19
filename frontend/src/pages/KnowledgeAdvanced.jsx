import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Upload, Search, FileText, Video, BookOpen, GitCompare, 
  Brain, Lightbulb, Database, Loader2, CheckCircle, AlertCircle 
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const KnowledgeAdvanced = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  
  // Upload & Analysis
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Search & Query
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Comparison
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  
  // Vehicle Comparison
  const [vehicles, setVehicles] = useState([]);
  const [vehicle1, setVehicle1] = useState('');
  const [vehicle2, setVehicle2] = useState('');
  const [vehicleComparison, setVehicleComparison] = useState(null);
  
  // Engine Info
  const [engineQuery, setEngineQuery] = useState('');
  const [engineInfo, setEngineInfo] = useState(null);

  useEffect(() => {
    loadVehicles();
    loadDocuments();
  }, []);

  const loadVehicles = async () => {
    try {
      const res = await axios.get(`${API_URL}/vehicles`);
      setVehicles(res.data || []);
    } catch (e) {
      console.error('Error loading vehicles:', e);
    }
  };

  const loadDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/kb/docs`);
      setUploadedFiles(res.data?.docs || []);
    } catch (e) {
      console.error('Error loading documents:', e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      toast({
        title: "جاري الرفع...",
        description: "يتم تحليل الملف بالذكاء الاصطناعي"
      });

      const response = await axios.post(`${API_URL}/ai/kb/upload-and-analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setAnalysisResult(response.data);
      toast({
        title: "تم التحليل",
        description: "تم رفع وتحليل الملف بنجاح"
      });
      
      loadDocuments();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في رفع أو تحليل الملف",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/ai/kb/smart-search`, {
        query: searchQuery,
        limit: 10
      });

      setSearchResults(response.data.results || []);
      toast({
        title: "اكتمل البحث",
        description: `تم العثور على ${response.data.results?.length || 0} نتيجة`
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في البحث",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompareFiles = async () => {
    if (!file1 || !file2) {
      toast({
        title: "تنبيه",
        description: "اختر ملفين للمقارنة",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file1', file1);
      formData.append('file2', file2);

      const response = await axios.post(`${API_URL}/ai/kb/compare-files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setComparisonResult(response.data);
      toast({
        title: "اكتملت المقارنة",
        description: "تم تحليل الفروقات بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في المقارنة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompareVehicles = async () => {
    // Can compare: vehicle vs vehicle, vehicle vs file, or file vs file
    if ((!vehicle1 && !file1) || (!vehicle2 && !file2)) {
      toast({
        title: "تنبيه",
        description: "اختر مركبتين أو ملفين للمقارنة",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      // If both are files, use file comparison
      if (file1 && file2) {
        const formData = new FormData();
        formData.append('file1', file1);
        formData.append('file2', file2);

        const response = await axios.post(`${API_URL}/ai/kb/compare-files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setVehicleComparison({
          type: 'files',
          ...response.data
        });
      } 
      // If vehicle vs file or both vehicles
      else {
        const formData = new FormData();
        if (file1) formData.append('file1', file1);
        if (file2) formData.append('file2', file2);
        formData.append('vehicle1_id', vehicle1);
        formData.append('vehicle2_id', vehicle2);

        const response = await axios.post(`${API_URL}/ai/kb/compare-vehicles-advanced`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setVehicleComparison(response.data);
      }

      toast({
        title: "اكتملت المقارنة",
        description: "تم تحليل الفروقات بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في المقارنة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEngineQuery = async () => {
    if (!engineQuery.trim()) return;

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/ai/kb/engine-info`, {
        query: engineQuery
      });

      setEngineInfo(response.data);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في الحصول على معلومات المحرك",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">إدارة المعرفة AI المتقدمة</h1>
            <p className="text-slate-600">قراءة، تحليل، بحث، ومقارنة باستخدام الذكاء الاصطناعي</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="upload">رفع وتحليل</TabsTrigger>
              <TabsTrigger value="search">بحث ذكي</TabsTrigger>
              <TabsTrigger value="compare-files">مقارنة ملفات</TabsTrigger>
              <TabsTrigger value="compare-vehicles">مقارنة مركبات</TabsTrigger>
              <TabsTrigger value="engine">معلومات المحرك</TabsTrigger>
            </TabsList>

            {/* Tab 1: Upload & Analysis */}
            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle>رفع وتحليل ملفات (جميع الصيغ)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-800">
                      ✅ الصيغ المدعومة: PDF, Word, Excel, PowerPoint, Video (MP4/MOV/AVI), Images (JPG/PNG)
                    </p>
                  </div>
                  
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <Upload className="mx-auto text-slate-400 mb-4" size={48} />
                    <p className="text-slate-600 mb-4">اسحب ملف هنا أو اضغط للاختيار</p>
                    <p className="text-xs text-slate-500 mb-4">الحد الأقصى: 100 MB لكل ملف</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      onClick={() => document.getElementById('file-upload').click()}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? <Loader2 className="ml-2 animate-spin" size={18} /> : <Upload className="ml-2" size={18} />}
                      اختر ملف
                    </Button>
                  </div>

                  {analysisResult && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="text-green-600 mt-1" size={24} />
                          <div className="flex-1">
                            <h3 className="font-bold text-green-900 mb-2">نتيجة التحليل</h3>
                            <div className="space-y-2 text-sm text-green-800">
                              <p><strong>الملف:</strong> {analysisResult.filename}</p>
                              <p><strong>النوع:</strong> {analysisResult.type}</p>
                              <p><strong>الملخص:</strong></p>
                              <div className="bg-white p-3 rounded border border-green-200 whitespace-pre-wrap">
                                {analysisResult.summary}
                              </div>
                              {analysisResult.keyPoints && (
                                <>
                                  <p className="font-bold mt-3">النقاط الرئيسية:</p>
                                  <ul className="list-disc list-inside space-y-1">
                                    {analysisResult.keyPoints.map((point, idx) => (
                                      <li key={idx}>{point}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div>
                      <h3 className="font-bold text-slate-800 mb-3">الملفات المرفوعة ({uploadedFiles.length})</h3>
                      <div className="space-y-2">
                        {uploadedFiles.slice(0, 10).map((doc, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded border">
                            <FileText className="text-blue-600" size={20} />
                            <div className="flex-1">
                              <p className="font-medium">{doc.title || doc.filename}</p>
                              <p className="text-xs text-slate-500">{doc.type || 'document'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Smart Search */}
            <TabsContent value="search">
              <Card>
                <CardHeader>
                  <CardTitle>بحث ذكي بالذكاء الاصطناعي</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="ابحث عن أي معلومة في قاعدة المعرفة..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAISearch()}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAISearch}
                      disabled={loading || !searchQuery.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-800">النتائج ({searchResults.length})</h3>
                      {searchResults.map((result, idx) => (
                        <Card key={idx} className="border-r-4 border-blue-500">
                          <CardContent className="p-4">
                            <h4 className="font-bold text-slate-800 mb-2">{result.title || `نتيجة ${idx + 1}`}</h4>
                            <p className="text-sm text-slate-600 mb-2">{result.excerpt}</p>
                            {result.relevance && (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <div className="bg-blue-100 px-2 py-1 rounded">
                                  دقة: {(result.relevance * 100).toFixed(0)}%
                                </div>
                                {result.source && <span>المصدر: {result.source}</span>}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Compare Files */}
            <TabsContent value="compare-files">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة بين ملفين (جميع الصيغ)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      📌 الصيغ المدعومة: PDF, Word, Excel, PowerPoint, Video (MP4, MOV, AVI), Images
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <FileText className="mx-auto text-blue-500 mb-3" size={32} />
                      <p className="text-sm text-slate-600 mb-3">الملف الأول</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                        onChange={e => setFile1(e.target.files[0])}
                        className="hidden"
                        id="file1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById('file1').click()}
                      >
                        {file1 ? `✓ ${file1.name}` : 'اختر ملف'}
                      </Button>
                    </div>

                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <FileText className="mx-auto text-green-500 mb-3" size={32} />
                      <p className="text-sm text-slate-600 mb-3">الملف الثاني</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                        onChange={e => setFile2(e.target.files[0])}
                        className="hidden"
                        id="file2"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById('file2').click()}
                      >
                        {file2 ? `✓ ${file2.name}` : 'اختر ملف'}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleCompareFiles}
                    disabled={loading || !file1 || !file2}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? <Loader2 className="ml-2 animate-spin" size={18} /> : <GitCompare className="ml-2" size={18} />}
                    قارن بين الملفين
                  </Button>

                  {comparisonResult && (
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-6">
                        <h3 className="font-bold text-purple-900 mb-4">نتيجة المقارنة</h3>
                        <div className="space-y-4">
                          {comparisonResult.similarities && (
                            <div>
                              <h4 className="font-semibold text-green-700 mb-2">التشابهات:</h4>
                              <div className="bg-white p-3 rounded border">
                                {comparisonResult.similarities}
                              </div>
                            </div>
                          )}
                          {comparisonResult.differences && (
                            <div>
                              <h4 className="font-semibold text-red-700 mb-2">الاختلافات:</h4>
                              <div className="bg-white p-3 rounded border">
                                {comparisonResult.differences}
                              </div>
                            </div>
                          )}
                          {comparisonResult.recommendations && (
                            <div>
                              <h4 className="font-semibold text-blue-700 mb-2">التوصيات:</h4>
                              <div className="bg-white p-3 rounded border">
                                {comparisonResult.recommendations}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 4: Compare Vehicles */}
            <TabsContent value="compare-vehicles">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة بين مركبتين أو ملفاتهما</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium">المركبة الأولى</label>
                      <Select value={vehicle1} onValueChange={setVehicle1}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر مركبة" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plateNumber} - {v.brand} {v.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="border-2 border-dashed rounded-lg p-4">
                        <p className="text-xs text-slate-600 mb-2">أو ارفع ملف/فيديو للمقارنة</p>
                        <input
                          type="file"
                          accept=".pdf,.mp4,.mov,.avi,.doc,.docx"
                          onChange={e => setFile1(e.target.files[0])}
                          className="text-sm"
                        />
                        {file1 && <p className="text-xs text-green-600 mt-1">✓ {file1.name}</p>}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium">المركبة الثانية</label>
                      <Select value={vehicle2} onValueChange={setVehicle2}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر مركبة" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plateNumber} - {v.brand} {v.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="border-2 border-dashed rounded-lg p-4">
                        <p className="text-xs text-slate-600 mb-2">أو ارفع ملف/فيديو للمقارنة</p>
                        <input
                          type="file"
                          accept=".pdf,.mp4,.mov,.avi,.doc,.docx"
                          onChange={e => setFile2(e.target.files[0])}
                          className="text-sm"
                        />
                        {file2 && <p className="text-xs text-green-600 mt-1">✓ {file2.name}</p>}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleCompareVehicles}
                    disabled={loading || (!vehicle1 && !file1) || (!vehicle2 && !file2)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? <Loader2 className="ml-2 animate-spin" size={18} /> : <GitCompare className="ml-2" size={18} />}
                    قارن
                  </Button>

                  {vehicleComparison && (
                    <Card className="bg-indigo-50 border-indigo-200">
                      <CardContent className="p-6">
                        <h3 className="font-bold text-indigo-900 mb-4">نتيجة المقارنة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded border">
                            <h4 className="font-semibold mb-2">المركبة الأولى</h4>
                            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(vehicleComparison.vehicle1, null, 2)}</pre>
                          </div>
                          <div className="bg-white p-4 rounded border">
                            <h4 className="font-semibold mb-2">المركبة الثانية</h4>
                            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(vehicleComparison.vehicle2, null, 2)}</pre>
                          </div>
                        </div>
                        {vehicleComparison.analysis && (
                          <div className="mt-4 bg-white p-4 rounded border">
                            <h4 className="font-semibold mb-2">التحليل:</h4>
                            <p className="whitespace-pre-wrap">{vehicleComparison.analysis}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 5: Engine Info */}
            <TabsContent value="engine">
              <Card>
                <CardHeader>
                  <CardTitle>معلومات المحرك والمركبة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="اسأل عن أي محرك أو مركبة (مثل: Toyota 1KD-FTV)"
                      value={engineQuery}
                      onChange={e => setEngineQuery(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleEngineQuery()}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleEngineQuery}
                      disabled={loading || !engineQuery.trim()}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <Brain size={18} />}
                    </Button>
                  </div>

                  {engineInfo && (
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="text-orange-600 mt-1" size={24} />
                          <div className="flex-1">
                            <h3 className="font-bold text-orange-900 mb-3">المعلومات:</h3>
                            <div className="bg-white p-4 rounded border whitespace-pre-wrap text-sm">
                              {engineInfo.answer || engineInfo.info}
                            </div>
                            {engineInfo.sources && engineInfo.sources.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-orange-800 mb-1">المصادر:</p>
                                <div className="flex flex-wrap gap-2">
                                  {engineInfo.sources.map((src, idx) => (
                                    <span key={idx} className="bg-orange-100 px-2 py-1 rounded text-xs">
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="bg-blue-50">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">أمثلة للاستعلام:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setEngineQuery('ما هي مواصفات محرك Toyota 1KD-FTV؟')}
                        >
                          • ما هي مواصفات محرك Toyota 1KD-FTV؟
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setEngineQuery('الفرق بين محرك V6 و V8')}
                        >
                          • الفرق بين محرك V6 و V8
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setEngineQuery('كيف أفحص صمام SCV في ديزل كومن ريل؟')}
                        >
                          • كيف أفحص صمام SCV في ديزل كومن ريل؟
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setEngineQuery('أسباب تسريب زيت المحرك')}
                        >
                          • أسباب تسريب زيت المحرك
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default KnowledgeAdvanced;
