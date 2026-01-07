import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Activity, AlertTriangle, CheckCircle, Info, Gauge, Zap, Droplets, Settings, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DensoDiagnostics = () => {
  const [engines, setEngines] = useState([]);
  const [selectedEngine, setSelectedEngine] = useState('');
  const [engineDetails, setEngineDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  
  // Test inputs
  const [resistance, setResistance] = useState('');
  const [resistanceResult, setResistanceResult] = useState(null);
  
  const [vlPressure, setVlPressure] = useState('');
  const [vlDuration, setVlDuration] = useState('');
  const [vlReturn, setVlReturn] = useState('');
  const [vlResult, setVlResult] = useState(null);

  useEffect(() => {
    loadEngines();
  }, []);

  const loadEngines = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/injectors/engines`);
      setEngines(data.engines || []);
      setSystemInfo({
        version: data.system_version,
        lastUpdated: data.last_updated
      });
    } catch (error) {
      console.error('Error loading engines:', error);
    }
  };

  const loadEngineDetails = async (engineId) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/injectors/specs/${engineId}`);
      setEngineDetails(data);
      setResistanceResult(null);
      setVlResult(null);
    } catch (error) {
      console.error('Error loading engine details:', error);
      setEngineDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEngineSelect = (engineId) => {
    setSelectedEngine(engineId);
    if (engineId) {
      loadEngineDetails(engineId);
    } else {
      setEngineDetails(null);
    }
  };

  const validateResistance = async () => {
    if (!selectedEngine || !resistance) return;
    try {
      const { data } = await axios.post(`${API_URL}/injectors/validate/resistance`, {
        engine_id: selectedEngine,
        resistance_ohm: parseFloat(resistance)
      });
      setResistanceResult(data);
    } catch (error) {
      console.error('Error validating resistance:', error);
    }
  };

  const validateVLMode = async () => {
    if (!selectedEngine || !vlPressure || !vlDuration || !vlReturn) return;
    try {
      const { data } = await axios.post(`${API_URL}/injectors/validate/vl-mode`, {
        engine_id: selectedEngine,
        pressure: parseFloat(vlPressure),
        duration: parseFloat(vlDuration),
        return_qty: parseFloat(vlReturn)
      });
      setVlResult(data);
    } catch (error) {
      console.error('Error validating VL mode:', error);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Activity className="text-blue-500" />
              نظام تشخيص حاقنات دينسو
            </h1>
            <p className="text-muted-foreground">Denso Injector Diagnostic System</p>
          </div>
          {systemInfo && (
            <div className="text-sm text-muted-foreground bg-card p-3 rounded-lg border">
              <p>الإصدار: {systemInfo.version}</p>
              <p>آخر تحديث: {systemInfo.lastUpdated}</p>
            </div>
          )}
        </div>

        {/* Engine Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={20} />
              اختر المحرك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>نوع المحرك (Engine Type)</Label>
                <Select value={selectedEngine} onValueChange={handleEngineSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المحرك..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(engines || []).map(engine => (
                      <SelectItem key={`engine-${engine.id}`} value={engine.id}>
                        {engine.label} ({engine.displacement}L - {engine.cylinders} سلندر)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {engineDetails && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-3 py-1 rounded-full">
                    الجيل: {engineDetails.denso_generation}
                  </span>
                  <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-3 py-1 rounded-full">
                    {engineDetails.manufacturer}
                  </span>
                  <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-3 py-1 rounded-full">
                    {engineDetails.cylinder_count} سلندر - {engineDetails.displacement_liters}L
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="animate-spin mx-auto text-blue-500 mb-4" size={48} />
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        )}

        {engineDetails && !loading && (
          <div className="space-y-6">
            {/* Specifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info size={20} className="text-blue-500" />
                  المواصفات الفنية للحاقن
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Resistance */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={18} className="text-yellow-500" />
                      <span className="font-semibold">المقاومة (Resistance)</span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-center">
                      {engineDetails.injector_specifications?.electrical_resistance_ohm} Ω
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      ± {engineDetails.injector_specifications?.resistance_tolerance_percent}%
                    </p>
                  </div>

                  {/* Pressure */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge size={18} className="text-red-500" />
                      <span className="font-semibold">ضغط العمل (Pressure)</span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-center">
                      {engineDetails.injector_specifications?.operating_pressure_bar} bar
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      ({engineDetails.injector_specifications?.operating_pressure_mpa} MPa)
                    </p>
                  </div>

                  {/* Return Flow */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Droplets size={18} className="text-blue-500" />
                      <span className="font-semibold">تدفق الإرجاع (VL Max)</span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-center">
                      ≤ {engineDetails.vl_mode_parameters?.return_quantity_max_ml_min} ml/min
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">نوع الحقن</p>
                    <p className="font-semibold text-sm">{engineDetails.injector_specifications?.injection_type}</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">عدد فتحات الرشاش</p>
                    <p className="font-semibold text-sm">{engineDetails.injector_specifications?.nozzle_holes}</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">معدل التدفق</p>
                    <p className="font-semibold text-sm">{engineDetails.injector_specifications?.flow_rate_cc_min} cc/min</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">زاوية الرش</p>
                    <p className="font-semibold text-sm">{engineDetails.injector_specifications?.spray_angle_degrees}°</p>
                  </div>
                </div>

                {/* Part Numbers */}
                {engineDetails.original_part_numbers && (
                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground mb-2">أرقام القطع الأصلية:</p>
                    <div className="flex flex-wrap gap-2">
                      {(engineDetails.original_part_numbers || []).map((pn, i) => (
                        <span key={`pn-${pn}-${i}`} className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-mono">
                          {pn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resistance Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap size={20} className="text-yellow-500" />
                  اختبار المقاومة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>قيمة المقاومة المقاسة (Ω)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="مثال: 0.95"
                      value={resistance}
                      onChange={(e) => setResistance(e.target.value)}
                    />
                  </div>
                  <Button onClick={validateResistance} disabled={!resistance}>
                    <CheckCircle size={18} className="ml-2" />
                    تحقق
                  </Button>
                </div>
                
                {resistanceResult && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    resistanceResult.valid 
                      ? 'bg-green-50 border border-green-200 dark:bg-green-900/20' 
                      : 'bg-red-50 border border-red-200 dark:bg-red-900/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {resistanceResult.valid ? (
                        <CheckCircle className="text-green-600" size={24} />
                      ) : (
                        <AlertTriangle className="text-red-600" size={24} />
                      )}
                      <span className={`font-bold ${resistanceResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                        {resistanceResult.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{resistanceResult.message}</p>
                    {resistanceResult.recommendation && (
                      <p className="text-sm mt-2 font-medium">{resistanceResult.recommendation}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* VL Mode Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge size={20} className="text-red-500" />
                  اختبار VL Mode (وضع التسريب)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>الضغط (MPa)</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="مثال: 80"
                      value={vlPressure}
                      onChange={(e) => setVlPressure(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>المدة (ثانية)</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="مثال: 60"
                      value={vlDuration}
                      onChange={(e) => setVlDuration(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>كمية الإرجاع (ml)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="مثال: 12.5"
                      value={vlReturn}
                      onChange={(e) => setVlReturn(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={validateVLMode} disabled={!vlPressure || !vlDuration || !vlReturn}>
                  <CheckCircle size={18} className="ml-2" />
                  تحقق من النتائج
                </Button>

                {vlResult && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    vlResult.status === 'PASS' 
                      ? 'bg-green-50 border border-green-200 dark:bg-green-900/20' 
                      : vlResult.status === 'WARNING'
                      ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20'
                      : 'bg-red-50 border border-red-200 dark:bg-red-900/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {vlResult.status === 'PASS' ? (
                        <CheckCircle className="text-green-600" size={24} />
                      ) : vlResult.status === 'WARNING' ? (
                        <AlertTriangle className="text-yellow-600" size={24} />
                      ) : (
                        <AlertTriangle className="text-red-600" size={24} />
                      )}
                      <span className={`font-bold ${
                        vlResult.status === 'PASS' ? 'text-green-700' 
                        : vlResult.status === 'WARNING' ? 'text-yellow-700' 
                        : 'text-red-700'
                      }`}>
                        {vlResult.status}
                      </span>
                    </div>
                    {vlResult.details && (
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div>معدل التدفق: <span className="font-mono font-bold">{vlResult.details.flow_rate?.toFixed(2)} ml/min</span></div>
                        <div>الحد الأقصى: <span className="font-mono font-bold">{vlResult.details.max_allowed} ml/min</span></div>
                      </div>
                    )}
                    {vlResult.recommendation && (
                      <p className="text-sm mt-2 font-medium">{vlResult.recommendation}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Diagnostic Steps */}
            {engineDetails.diagnostic_steps && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-500" />
                    خطوات الفحص التفصيلية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(engineDetails.diagnostic_steps || []).map((step, index) => (
                      <div key={`step-${index}`} className="flex gap-4 items-start p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        <p className="text-base pt-1">{step}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Common Faults */}
            {engineDetails.common_faults && (
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle size={20} className="text-orange-500" />
                    الأعطال الشائعة لهذا المحرك
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {engineDetails.common_faults.map((fault, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <AlertTriangle size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                        <span className="text-sm">{fault}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!selectedEngine && !loading && (
          <div className="text-center py-16 bg-card rounded-xl border">
            <Activity size={64} className="mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-xl text-muted-foreground">اختر نوع المحرك للبدء بالتشخيص</p>
            <p className="text-sm text-muted-foreground mt-2">Select an engine type to start diagnostics</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DensoDiagnostics;
