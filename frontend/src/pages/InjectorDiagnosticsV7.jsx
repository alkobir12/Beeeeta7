import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Activity, CheckCircle, AlertTriangle, Save, FileText } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InjectorDiagnostics = () => {
  const { toast } = useToast();
  const [engines, setEngines] = useState([]);
  const [selectedEngine, setSelectedEngine] = useState('');
  const [engineSpecs, setEngineSpecs] = useState(null);
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
  }, []);

  useEffect(() => {
    if (selectedEngine) {
      fetchEngineSpecs();
      setResistanceResult(null);
      setVlResult(null);
    }
  }, [selectedEngine]);

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
    } catch (e) {
      console.error(e);
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
        toast({ title: 'تحذير VL Mode ⚠️', description: 'بعض القراءات خارج النطاق', variant: 'destructive' });
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
      
      await axios.post(`${API_URL}/injectors/report`, payload);
      toast({ title: 'تم الحفظ ✅', description: 'تم حفظ تقرير الفحص بنجاح' });
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">فحص حاقنات Denso</h1>
          <p className="text-gray-500 mt-1">نظام التشخيص المتكامل - الإصدار {systemVersion}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <Activity size={20} />
          <span className="font-semibold">Denso System V7</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className={`p-4 rounded-lg ${resistanceResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
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
              <CardTitle className="text-lg">3. اختبار وضع VL (معيار BOSCH EPS815)</CardTitle>
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
                <div className={`p-4 rounded-lg ${vlResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
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
            حفظ التقرير
          </Button>
        </div>

        {/* Right Panel - Specs & Info */}
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

          {!selectedEngine && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-gray-500">اختر محركاً لعرض المواصفات</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default InjectorDiagnostics;
