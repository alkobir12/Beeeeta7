import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Activity, CheckCircle, AlertTriangle, Save, FileText, ListChecks, Gauge } from 'lucide-react';
import DraggableGrid from '../components/DraggableGrid';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import { resolveBackendBase } from '../utils/backendBase';

const API_URL = `${resolveBackendBase()}/api`;

const InjectorDiagnostics = () => {
  const { toast } = useToast();
  const [engines, setEngines] = useState([]);
  const [selectedEngine, setSelectedEngine] = useState('');
  const [engineSpecs, setEngineSpecs] = useState(null);
  const [generationInfo, setGenerationInfo] = useState(null);
  const [testSequence, setTestSequence] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [overallStatus, setOverallStatus] = useState(null);
  const [systemVersion, setSystemVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [resistanceResult, setResistanceResult] = useState(null);
  const [vlResult, setVlResult] = useState(null);
  
  const [testData, setTestData] = useState({
    resistance_ohm: '',
    pressure_bar: '',
    duration_us: '',
    return_qty_ml_min: '',
    technician: '',
    notes: ''
  });

  useEffect(() => {
    fetchEngines();
    fetchTestSequence();
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedEngine) {
      fetchEngineSpecs();
      setResistanceResult(null);
      setVlResult(null);
      setOverallStatus(null);
    }
  }, [selectedEngine]);

  useEffect(() => {
    // عند تغيّر نتائج الاختبار، حاول توليد ملخص عام اعتماداً على الرسائل
    if (resistanceResult || vlResult) {
      const allOk = (resistanceResult?.valid ?? true) && (vlResult?.valid ?? true);
      setOverallStatus({
        pass: allOk,
        message_ar: allOk
          ? '✅ جميع القراءات الحالية ضمن النطاق المسموح تقريباً'
          : '❌ توجد ملاحظات في نتائج الاختبارات الحالية، راجع الكروت التفصيلية أدناه.'
      });
    }
  }, [resistanceResult, vlResult]);

  const fetchEngines = async () => {
    try {
      const res = await axios.get(`${API_URL}/injectors/engines`);
      setEngines(res.data.engines || []);
      setSystemVersion(res.data.system_version || '');
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'فشل تحميل بيانات المحركات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchEngineSpecs = async () => {
    try {
      const res = await axios.get(`${API_URL}/injectors/specs/${selectedEngine}`);
      setEngineSpecs(res.data);
      if (res.data?.denso_generation) {
        try {
          const genRes = await axios.get(`${API_URL}/injectors/generation/${res.data.denso_generation}`);
          setGenerationInfo(genRes.data);
        } catch (err) {
          console.error('generation info error', err);
        }
      } else {
        setGenerationInfo(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTestSequence = async () => {
    try {
      const res = await axios.get(`${API_URL}/injectors/test-sequence`);
      setTestSequence(res.data || null);
    } catch (e) {
      console.error('test sequence error', e);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_URL}/injectors/reports`);
      setRecentReports(res.data || []);
    } catch (e) {
      console.error('reports error', e);
    }
  };

  const handleValidateResistance = async () => {
    if (!selectedEngine || !testData.resistance_ohm) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال المقاومة', variant: 'destructive' });
      return;
    }
    setValidating(true);
    try {
      const res = await axios.post(`${API_URL}/injectors/validate/resistance`, {
        engine_id: selectedEngine,
        resistance_ohm: parseFloat(testData.resistance_ohm)
      });
      setResistanceResult(res.data);
      if (res.data.valid) {
        toast({ title: 'اختبار المقاومة ✅', description: 'المقاومة ضمن النطاق المقبول', className: 'bg-green-50 border-green-200' });
      } else {
        toast({ title: 'تحذير ⚠️', description: res.data.message_ar || res.data.message, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل التحقق من المقاومة', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const handleValidateVL = async () => {
    if (!selectedEngine || !testData.pressure_bar || !testData.duration_us || !testData.return_qty_ml_min) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال جميع قراءات VL Mode', variant: 'destructive' });
      return;
    }
    setValidating(true);
    try {
      const res = await axios.post(`${API_URL}/injectors/validate/vl-mode`, {
        engine_id: selectedEngine,
        pressure_bar: parseFloat(testData.pressure_bar),
        duration_us: parseFloat(testData.duration_us),
        return_qty_ml_min: parseFloat(testData.return_qty_ml_min)
      });
      setVlResult(res.data);
      if (res.data.valid) {
        toast({ title: 'اختبار VL Mode ✅', description: 'جميع القراءات ضمن النطاق المقبول', className: 'bg-green-50 border-green-200' });
      } else {
        toast({ title: 'تحذير VL Mode ⚠️', description: 'بعض القراءات خارج النطاق، راجع التفاصيل في الكرت', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل التحقق من VL Mode', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveReport = async () => {
    if (!selectedEngine) {
      toast({ title: 'خطأ', description: 'الرجاء اختيار المحرك', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        engine_id: selectedEngine,
        resistance_ohm: testData.resistance_ohm ? parseFloat(testData.resistance_ohm) : undefined,
        pressure_bar: testData.pressure_bar ? parseFloat(testData.pressure_bar) : undefined,
        duration_us: testData.duration_us ? parseFloat(testData.duration_us) : undefined,
        return_qty_ml_min: testData.return_qty_ml_min ? parseFloat(testData.return_qty_ml_min) : undefined,
        technician: testData.technician,
        notes: testData.notes
      };
      
      const res = await axios.post(`${API_URL}/injectors/report`, payload);
      const saved = res.data;
      toast({ title: 'تم الحفظ ✅', description: 'تم حفظ تقرير الفحص بنجاح' });
      if (saved?.report?.overall_status) {
        setOverallStatus(saved.report.overall_status);
      }
      fetchReports();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل حفظ التقرير', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const sequenceEntries = testSequence ? Object.values(testSequence) : [];

  const selectedEngineData = engines.find((e) => e.id === selectedEngine);
  const stats = {
    engineLabel: selectedEngineData
      ? `${selectedEngineData.label} (${selectedEngineData.cylinders} سلندر)`
      : 'لم يتم اختيار محرك بعد',
    resistanceStatus: resistanceResult
      ? resistanceResult.valid
        ? 'سليم ضمن النطاق'
        : 'به ملاحظة في المقاومة'
      : 'لم يتم فحص المقاومة بعد',
    vlStatus: vlResult
      ? vlResult.valid
        ? 'سليم ضمن النطاق'
        : 'به ملاحظة في VL'
      : 'لم يتم فحص VL بعد',
    totalTests: recentReports.length,
  };

  const metricCards = [
    {
      id: 'engine',
      render: () => (
        <Card className="stat-card group">
          <CardContent className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">المحرك المحدد</p>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate max-w-[220px]">
                {stats.engineLabel}
              </h3>
            </div>
            <div className="p-3 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Activity size={20} />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'resistance',
      render: () => (
        <Card className="stat-card group">
          <CardContent className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">حالة المقاومة</p>
              <h3
                className={`text-base sm:text-lg font-bold ${
                  resistanceResult
                    ? resistanceResult.valid
                      ? 'text-green-700'
                      : 'text-red-700'
                    : 'text-gray-900'
                }`}
              >
                {stats.resistanceStatus}
              </h3>
            </div>
            <div
              className={`p-3 rounded-full transition-colors ${
                resistanceResult
                  ? resistanceResult.valid
                    ? 'bg-green-50 text-green-600 group-hover:bg-green-100'
                    : 'bg-red-50 text-red-600 group-hover:bg-red-100'
                  : 'bg-gray-50 text-gray-500 group-hover:bg-gray-100'
              }`}
            >
              <CheckCircle size={20} />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'vl',
      render: () => (
        <Card className="stat-card group">
          <CardContent className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">حالة VL Mode</p>
              <h3
                className={`text-base sm:text-lg font-bold ${
                  vlResult
                    ? vlResult.valid
                      ? 'text-green-700'
                      : 'text-red-700'
                    : 'text-gray-900'
                }`}
              >
                {stats.vlStatus}
              </h3>
            </div>
            <div
              className={`p-3 rounded-full transition-colors ${
                vlResult
                  ? vlResult.valid
                    ? 'bg-green-50 text-green-600 group-hover:bg-green-100'
                    : 'bg-red-50 text-red-600 group-hover:bg-red-100'
                  : 'bg-gray-50 text-gray-500 group-hover:bg-gray-100'
              }`}
            >
              <Gauge size={20} />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'reports',
      render: () => (
        <Card className="stat-card group">
          <CardContent className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">عدد تقارير الفحص المسجلة</p>
              <h3 className="text-3xl font-bold text-gray-900">{stats.totalTests}</h3>
            </div>
            <div className="p-3 rounded-full bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <FileText size={20} />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'freq',
      render: () => (
        <Card className="stat-card group">
          <CardContent className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">التردد المرجعي (Freq)</p>
              <h3 className="text-xl font-bold text-gray-900">
                {engineSpecs?.vl_mode_parameters?.test_frequency_hz ?? 2} Hz
              </h3>
              <p className="text-xs text-gray-500 mt-1">حسب بيانات Denso لوضع VL</p>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'width',
      render: () => (
        <Card className="stat-card group">
          <CardContent className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">مدة النبضة (Width)</p>
              <h3 className="text-xl font-bold text-gray-900">
                {testData.duration_us || '—'} μs
              </h3>
              {engineSpecs?.vl_mode_parameters && (
                <p className="text-xs text-gray-500 mt-1">
                  الحد الأدنى الطبيعي: {engineSpecs.vl_mode_parameters.duration_min_microseconds} μs
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'count',
      render: () => {
        const freq = engineSpecs?.vl_mode_parameters?.test_frequency_hz || 2;
        const count = parseInt(testData.pulse_count || '0', 10) || 0;
        const totalTime = count && freq ? (count / freq).toFixed(1) : null;
        return (
          <Card className="stat-card group">
            <CardContent className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">عدد النبضات (Count)</p>
                <h3 className="text-xl font-bold text-gray-900">{count || '—'}</h3>
                {totalTime && (
                  <p className="text-xs text-gray-500 mt-1">زمن الاختبار التقريبي: {totalTime} ثانية عند {freq} Hz</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      },
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">فحص حاقنات Denso</h1>
          <p className="text-gray-500 mt-1">نظام التشخيص المتكامل - الإصدار {systemVersion}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <Activity size={20} />
          <span className="font-semibold">Denso System V7</span>
        </div>
      </div>
      {/* Denso quick stats, styled like dashboard cards, now draggable */}
      <DraggableGrid
        items={metricCards}
        storageKey="denso_injector_dashboard_cards"
        columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      />


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.2fr)] xl:gap-8">
        {/* Left Panel - Input Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Engine Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. اختيار المحرك</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>نوع المحرك</Label>
                <Select value={selectedEngine} onValueChange={setSelectedEngine}>
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue placeholder="اختر المحرك..." />
                  </SelectTrigger>
                  <SelectContent>
                    {engines.map((engine) => (
                      <SelectItem key={engine.id} value={engine.id}>
                        {engine.label} - {engine.generation} ({engine.cylinders} أسطوانات)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {engineSpecs && (
                <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="font-semibold text-blue-900 mb-2">مواصفات الحاقن:</div>
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div>• الجيل: {engineSpecs.denso_generation}</div>
                    <div>• ضغط التشغيل: {engineSpecs.injector_specifications.operating_pressure_bar} bar</div>
                    <div>• المقاومة: {engineSpecs.injector_specifications.electrical_resistance_ohm} Ω</div>
                    <div>• فتحات البخاخ: {engineSpecs.injector_specifications.nozzle_holes}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resistance Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. اختبار المقاومة الكهربائية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>المقاومة المقاسة (Ω)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={testData.resistance_ohm}
                    onChange={(e) => setTestData({ ...testData, resistance_ohm: e.target.value })}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleValidateResistance}
                    disabled={validating || !selectedEngine}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    تحقق
                  </Button>
                </div>
              </div>

              {resistanceResult && (
                <div className={`p-4 rounded-lg ${resistanceResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {resistanceResult.valid ? (
                      <CheckCircle className="text-green-600 mt-0.5" size={20} />
                    ) : (
                      <AlertTriangle className="text-red-600 mt-0.5" size={20} />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${resistanceResult.valid ? 'text-green-900' : 'text-red-900'}`}>
                        {resistanceResult.message_ar || resistanceResult.message}
                      </p>
                      {!resistanceResult.valid && resistanceResult.action_ar && (
                        <p className="text-sm mt-2 text-red-800">
                          <strong>الإجراء المطلوب:</strong> {resistanceResult.action_ar}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* VL Mode Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. اختبار وضع VL (معايير Denso الأصلية)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>الضغط (bar)</Label>
                  <Input
                    type="number"
                    step="10"
                    placeholder="1800"
                    value={testData.pressure_bar}
                    onChange={(e) => setTestData({ ...testData, pressure_bar: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>المدة (μs)</Label>
                  <Input
                    type="number"
                    step="10"
                    placeholder="1400"
                    value={testData.duration_us}
                    onChange={(e) => setTestData({ ...testData, duration_us: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>كمية الرجوع (ml/min)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="2.0"
                    value={testData.return_qty_ml_min}
                    onChange={(e) => setTestData({ ...testData, return_qty_ml_min: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              <Button 
                onClick={handleValidateVL}
                disabled={validating || !selectedEngine}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                تحقق من VL Mode
              </Button>

              {vlResult && (
                <div className={`p-4 rounded-lg ${vlResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    {vlResult.valid ? (
                      <CheckCircle className="text-green-600 mt-0.5" size={20} />
                    ) : (
                      <AlertTriangle className="text-red-600 mt-0.5" size={20} />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium whitespace-pre-line ${vlResult.valid ? 'text-green-900' : 'text-red-900'}`}>
                        {vlResult.message_ar || vlResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DataStream comparison card */}
          {(resistanceResult || vlResult) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">5. تيار البيانات ومقارنة القراءات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {resistanceResult && resistanceResult.range && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">المقاومة الكهربائية</span>
                      <span className={`text-xs font-medium ${resistanceResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                        {resistanceResult.valid ? 'ضمن النطاق الطبيعي' : 'خارج النطاق الطبيعي'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs text-gray-700">
                      <div>
                        <div className="text-gray-500">القراءة الحالية</div>
                        <div className="font-mono text-sm">{resistanceResult.measured} Ω</div>
                      </div>
                      <div>
                        <div className="text-gray-500">القيمة الإسمية</div>
                        <div className="font-mono text-sm">{resistanceResult.nominal} Ω</div>
                      </div>
                      <div>
                        <div className="text-gray-500">النطاق الطبيعي</div>
                        <div className="font-mono text-sm">
                          {resistanceResult.range.min.toFixed(2)} – {resistanceResult.range.max.toFixed(2)} Ω
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {vlResult && vlResult.specifications && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">وضع VL (ضغط / زمن / كمية رجوع)</span>
                      <span className={`text-xs font-medium ${vlResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                        {vlResult.valid ? 'ضمن النطاق الطبيعي' : 'توجد ملاحظات على القراءات'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-xs text-gray-700">
                      <div>
                        <div className="text-gray-500">الضغط (bar)</div>
                        <div className="font-mono text-sm">الحالي: {vlResult.readings.pressure_bar}</div>
                        <div className="font-mono text-[11px] text-gray-500">
                          الطبيعي: {vlResult.specifications.test_pressure_bar[0]} – {vlResult.specifications.test_pressure_bar[vlResult.specifications.test_pressure_bar.length - 1]} bar
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500">مدة النبضة (μs)</div>
                        <div className="font-mono text-sm">الحالية: {vlResult.readings.duration_us}</div>
                        <div className="font-mono text-[11px] text-gray-500">
                          الحد الأدنى: {vlResult.specifications.duration_min_microseconds} μs
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500">كمية الرجوع (ml/min)</div>
                        <div className="font-mono text-sm">الحالية: {vlResult.readings.return_qty_ml_min}</div>
                        <div className="font-mono text-[11px] text-gray-500">
                          الحد الأقصى: {vlResult.specifications.return_quantity_max_ml_min} ml/min
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-500 border-t border-gray-200 pt-2 flex flex-wrap gap-4">
                      <span>التردد المرجعي: {vlResult.specifications.test_frequency_hz} Hz (حسب دنسو)</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}


          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. معلومات إضافية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>اسم الفني</Label>
                <Input
                  type="text"
                  placeholder="اسم الفني المسؤول"
                  value={testData.technician}
                  onChange={(e) => setTestData({ ...testData, technician: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <textarea
                  className="w-full mt-2 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="أي ملاحظات إضافية..."
                  value={testData.notes}
                  onChange={(e) => setTestData({ ...testData, notes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={handleSaveReport}
            disabled={!selectedEngine}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
          >
            <Save className="mr-2" size={20} />
            حفظ التقرير وتحديث السجل
          </Button>

          {overallStatus && (
            <Card className="mt-4 border-dashed border-2 border-blue-300 bg-blue-50/60">
              <CardHeader className="flex flex-row items-center gap-2">
                <Gauge className="text-blue-600" size={20} />
                <CardTitle className="text-base">الملخص العام للحالة الحالية</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-sm ${overallStatus.pass ? 'text-green-800' : 'text-red-800'}`}>
                  {overallStatus.message_ar}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Specs, Generations, Sequences, History */}
        <div className="space-y-6">
          {engineSpecs && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">المواصفات الفنية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="font-semibold text-gray-700">الشركة المصنعة</div>
                    <div className="text-gray-600">{engineSpecs.manufacturer}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">طراز المحرك</div>
                    <div className="text-gray-600">{engineSpecs.engine_model}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">السعة</div>
                    <div className="text-gray-600">{engineSpecs.displacement_liters} لتر</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">عدد الأسطوانات</div>
                    <div className="text-gray-600">{engineSpecs.cylinder_count}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">جيل Denso</div>
                    <div className="text-gray-600">{engineSpecs.denso_generation}</div>
                  </div>
                </CardContent>
              </Card>

              {generationInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">معلومات جيل Denso ({engineSpecs.denso_generation})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-gray-700">{generationInfo.description}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="text-xs text-gray-500">نطاق الضغط (bar)</div>
                        <div className="font-mono text-blue-700">
                          {generationInfo.pressure_range.min_bar} - {generationInfo.pressure_range.max_bar}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">نوع الحاقن</div>
                        <div className="text-gray-700">{generationInfo.injection_type}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">المقاومة النموذجية (Ω)</div>
                        <div className="font-mono text-blue-700">
                          {generationInfo.electrical_resistance.typical_ohm} (±{generationInfo.electrical_resistance.tolerance_percent}%)
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">زمن الاستجابة (ms)</div>
                        <div className="font-mono text-gray-700">{generationInfo.response_time_ms}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">مواصفات VL Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="font-semibold text-gray-700">ضغطات الاختبار</div>
                    <div className="text-gray-600">
                      {engineSpecs.vl_mode_parameters.test_pressure_bar.join(', ')} bar
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">المدة الدنيا</div>
                    <div className="text-gray-600">
                      {engineSpecs.vl_mode_parameters.duration_min_microseconds} μs
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">كمية الرجوع القصوى</div>
                    <div className="text-gray-600">
                      {engineSpecs.vl_mode_parameters.return_quantity_max_ml_min} ml/min
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">التردد</div>
                    <div className="text-gray-600">
                      {engineSpecs.vl_mode_parameters.test_frequency_hz} Hz
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">أرقام القطع الأصلية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {engineSpecs.original_part_numbers.map((pn, idx) => (
                    <div key={idx} className="font-mono text-sm bg-gray-50 p-2 rounded border border-gray-200">
                      {pn}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          {sequenceEntries.length > 0 && (
            <Card>
              <CardHeader className="flex items-center gap-2">
                <ListChecks className="text-blue-600" size={18} />
                <CardTitle className="text-lg">تسلسل الفحوصات المقترح (7 خطوات)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {sequenceEntries.map((step, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                    <div className="font-semibold text-gray-800 mb-1">{idx + 1}. {step.name_ar}</div>
                    <p className="text-gray-700 text-xs mb-1">{step.description_ar}</p>
                    <p className="text-gray-600 text-[11px]">الأدوات: {(step.tools_required_ar || []).join('، ')}</p>
                    <p className="text-gray-600 text-[11px] mt-1">معيار النجاح: {step.pass_criteria_ar}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {recentReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">سجل الفحوصات الأخيرة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm max-h-72 overflow-y-auto">
                {recentReports.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-800">{r.report?.engine_info?.model}</span>
                      <span className="text-[11px] text-gray-500">{r.createdAt?.slice(0,16)?.replace('T',' ')}</span>
                    </div>
                    <div className="text-[11px] text-gray-600 mb-1">الفني: {r.technician || 'غير محدد'}</div>
                    <div className={`text-xs ${r.report?.overall_status?.pass ? 'text-green-700' : 'text-red-700'}`}>
                      {r.report?.overall_status?.message_ar}
                    </div>
                    {r.testData?.resistance_ohm && (
                      <div className="text-[11px] text-gray-500 mt-1">المقاومة: {r.testData.resistance_ohm} Ω</div>
                    )}
                    {r.testData?.pressure_bar && (
                      <div className="text-[11px] text-gray-500">VL: {r.testData.pressure_bar} bar / {r.testData.duration_us} μs / {r.testData.return_qty_ml_min} ml/min</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {recentReports.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-gray-500">
                لا يوجد سجل فحوصات بعد. بعد حفظ أول تقرير ستظهر هنا آخر الفحوصات مع إمكانية التوريد/الاستيراد من النظام الخارجي عبر الـ API.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default InjectorDiagnostics;