import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Activity, CheckCircle, AlertTriangle, FileText, Printer, Save } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InjectorDiagnostics = () => {
  const { toast } = useToast();
  const [engines, setEngines] = useState({});
  const [selectedEngine, setSelectedEngine] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [report, setReport] = useState(null);
  
  const [testData, setTestData] = useState({
    visual_inspection: 'pass',
    resistance: '',
    leak_test: 'pass',
    opening_pressure: '',
    vl_pressure: '',
    vl_duration: '',
    vl_return: '',
    technician: '',
    notes: ''
  });

  useEffect(() => {
    fetchEngines();
  }, []);

  const fetchEngines = async () => {
    try {
      const res = await axios.get(`${API_URL}/injectors/engines`);
      setEngines(res.data || {});
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'فشل تحميل بيانات المحركات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedEngine) return;
    setValidating(true);
    try {
      const res = await axios.post(`${API_URL}/injectors/validate`, {
        engine_type: selectedEngine,
        pressure: testData.vl_pressure,
        duration: testData.vl_duration,
        return_quantity: testData.vl_return
      });
      setValidationResult(res.data);
      if (res.data.valid) {
        toast({ title: 'اختبار ناجح', description: 'القراءات ضمن المواصفات القياسية', className: 'bg-green-50 border-green-200' });
      } else {
        toast({ title: 'تحذير', description: 'بعض القراءات خارج المدى المسموح', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل التحقق من البيانات', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveReport = async () => {
    if (!selectedEngine) return;
    try {
      const payload = {
        engine_type: selectedEngine,
        ...testData,
        vl_status: validationResult?.valid ? 'ناجح' : 'فاشل',
        recommendations: validationResult?.valid ? 'الحاقن يعمل بشكل جيد.' : 'يرجى مراجعة الأجزاء المعيبة أو استبدال الحاقن.'
      };
      
      const res = await axios.post(`${API_URL}/injectors/report`, payload);
      setReport(res.data);
      toast({ title: 'تم الحفظ', description: 'تم حفظ تقرير الفحص بنجاح' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل حفظ التقرير', variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between pt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">فحص حاقنات Denso</h1>
            <p className="text-gray-500 mt-1">نظام التشخيص المتكامل - الإصدار 7.0</p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
            Denso Integrated System
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="apple-card p-6">
              <div className="flex items-center gap-2 mb-6 text-blue-600">
                <Activity size={20} />
                <h3 className="font-bold text-gray-900">بيانات الاختبار</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">نوع المحرك / الحاقن</Label>
                  <Select value={selectedEngine} onValueChange={setSelectedEngine}>
                    <SelectTrigger className="apple-input">
                      <SelectValue placeholder="اختر المحرك..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(engines).map(([key, data]) => (
                        <SelectItem key={key} value={key}>
                          {data.label} ({data.generation})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEngine && engines[selectedEngine] && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">الجيل:</span>
                      <span className="font-semibold">{engines[selectedEngine].generation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">رقم القطعة:</span>
                      <span className="font-mono">{engines[selectedEngine].part_numbers[0]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ضغط العمل:</span>
                      <span className="font-semibold">{engines[selectedEngine].specifications.pressure}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الفحص البصري</Label>
                    <Select value={testData.visual_inspection} onValueChange={v => setTestData({...testData, visual_inspection: v})}>
                      <SelectTrigger className="apple-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pass">سليم</SelectItem>
                        <SelectItem value="fail">تالف/متآكل</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>اختبار التسريب</Label>
                    <Select value={testData.leak_test} onValueChange={v => setTestData({...testData, leak_test: v})}>
                      <SelectTrigger className="apple-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pass">لا يوجد تسريب</SelectItem>
                        <SelectItem value="fail">يوجد تسريب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>المقاومة (Ω)</Label>
                    <Input type="number" className="apple-input" placeholder="مثال: 0.5" value={testData.resistance} onChange={e => setTestData({...testData, resistance: e.target.value})} />
                  </div>
                  <div>
                    <Label>ضغط الفتح (bar)</Label>
                    <Input type="number" className="apple-input" placeholder="مثال: 1600" value={testData.opening_pressure} onChange={e => setTestData({...testData, opening_pressure: e.target.value})} />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h4 className="font-bold text-gray-800 mb-3">اختبار الحمل الكامل (VL Mode)</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs mb-1 block">الضغط (bar)</Label>
                      <Input type="number" className="apple-input" value={testData.vl_pressure} onChange={e => setTestData({...testData, vl_pressure: e.target.value})} />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">المدة (μs)</Label>
                      <Input type="number" className="apple-input" value={testData.vl_duration} onChange={e => setTestData({...testData, vl_duration: e.target.value})} />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">الإرجاع (ml/min)</Label>
                      <Input type="number" className="apple-input" value={testData.vl_return} onChange={e => setTestData({...testData, vl_return: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>الفني المسؤول</Label>
                  <Input className="apple-input" value={testData.technician} onChange={e => setTestData({...testData, technician: e.target.value})} placeholder="اسم الفني" />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleValidate} disabled={validating} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {validating ? 'جاري التحقق...' : 'تحقق من القراءات'}
                  </Button>
                  <Button onClick={handleSaveReport} variant="outline" className="flex-1">
                    <Save size={18} className="ml-2" /> حفظ التقرير
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-6">
            {/* Validation Result */}
            {validationResult && (
              <div className={`apple-card p-6 border-2 ${validationResult.valid ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
                <div className="flex items-center gap-2 mb-4">
                  {validationResult.valid ? (
                    <CheckCircle className="text-green-600" size={24} />
                  ) : (
                    <AlertTriangle className="text-red-600" size={24} />
                  )}
                  <h3 className={`font-bold ${validationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                    {validationResult.valid ? 'نتائج مقبولة' : 'فشل الاختبار'}
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-gray-200/50 pb-1">
                    <span>الضغط:</span>
                    <span className="font-medium">{validationResult.pressure_status}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200/50 pb-1">
                    <span>المدة:</span>
                    <span className="font-medium">{validationResult.duration_status}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span>الراجع:</span>
                    <span className="font-medium">{validationResult.return_quantity_status}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Saved Report Preview */}
            {report && (
              <div className="apple-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-purple-600">
                    <FileText size={20} />
                    <h3 className="font-bold text-gray-900">التقرير النهائي</h3>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => window.print()}>
                    <Printer size={16} />
                  </Button>
                </div>
                <pre className="bg-slate-50 p-3 rounded border border-slate-200 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  {report.reportText}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InjectorDiagnostics;
