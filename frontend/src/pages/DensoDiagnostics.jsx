import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Search, Activity, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const DensoDiagnostics = () => {
  const [partNumber, setPartNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Mock Database for Denso Injectors
  const injectorDB = {
    '095000-6250': {
      model: 'Toyota Hilux / Fortuner 1KD-FTV',
      resistance: '0.85 - 1.05 Ω',
      pressure: '30 - 160 MPa',
      common_faults: ['Solenoid Valve Failure', 'Nozzle Needle Stuck', 'High Return Flow'],
      steps: [
        'Check resistance across pins 1 & 2 (Cold: 0.85-1.05Ω)',
        'Check insulation to ground (>10MΩ)',
        'Measure return flow at idle (Max 15ml/min)',
        'Inspect nozzle tip for carbon buildup'
      ]
    },
    '095000-7780': {
      model: 'Toyota Land Cruiser 1VD-FTV',
      resistance: '0.85 - 1.05 Ω',
      pressure: '30 - 180 MPa',
      common_faults: ['Command Piston Wear', 'Control Valve Leak'],
      steps: [
        'Check electrical connection tightness',
        'Verify fuel quality (Water contamination is common)',
        'Perform balance test with scanner',
        'Check rail pressure stability'
      ]
    }
  };

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => {
      const data = injectorDB[partNumber.trim()] || null;
      setResult(data);
      setLoading(false);
    }, 500);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
          <Activity className="text-blue-500" />
          تشخيص حاقنات دينسو (Denso Injector Diagnostics)
        </h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>بحث برقم الحاقن (Part Number)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="مثال: 095000-6250"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="text-lg"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading} className="px-8">
                {loading ? 'جاري البحث...' : <Search size={20} />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              أرقام شائعة: 095000-6250 (هايلكس), 095000-7780 (لاندكروزر)
            </p>
          </CardContent>
        </Card>

        {result ? (
          <div className="space-y-6 animate-fade-in">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="text-xl text-green-600">{result.model}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Info size={18} className="text-blue-500" /> المواصفات الفنية
                  </h3>
                  <ul className="space-y-2 text-sm bg-slate-50 p-4 rounded-lg">
                    <li className="flex justify-between">
                      <span>المقاومة (Resistance):</span>
                      <span className="font-bold font-mono">{result.resistance}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>ضغط العمل (Pressure):</span>
                      <span className="font-bold font-mono">{result.pressure}</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-500" /> الأعطال الشائعة
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {result.common_faults.map((fault, i) => (
                      <li key={i}>{fault}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-blue-500" />
                  خطوات الفحص (Diagnosis Steps)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.steps.map((step, index) => (
                    <div key={index} className="flex gap-4 items-start p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-base pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          !loading && partNumber && (
            <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-xl">
              <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-500 opacity-50" />
              <p>لم يتم العثور على معلومات لهذا الرقم.</p>
              <p className="text-sm mt-2">تأكد من كتابة الرقم بالشكل الصحيح (000000-0000)</p>
            </div>
          )
        )}
      </div>
    </Layout>
  );
};

export default DensoDiagnostics;
