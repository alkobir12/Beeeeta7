import React, { useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

const API_URL = (import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL) + '/api';

const Import = () => {
  const [active, setActive] = useState('customers');

  // Customers
  const [custFile, setCustFile] = useState(null);
  const [custResult, setCustResult] = useState(null);
  const [custLoading, setCustLoading] = useState(false);
  const [custMode, setCustMode] = useState('skip');

  // Services
  const [servFile, setServFile] = useState(null);
  const [servResult, setServResult] = useState(null);
  const [servLoading, setServLoading] = useState(false);
  const [servMode, setServMode] = useState('skip');

  // Parts
  const [partFile, setPartFile] = useState(null);
  const [partResult, setPartResult] = useState(null);
  const [partLoading, setPartLoading] = useState(false);
  const [partMode, setPartMode] = useState('skip');

  const uploadCsv = async (endpoint, file, mode, setResult, setLoading) => {
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API_URL}${endpoint}?mode=${mode}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
    } catch (e) {
      setResult({ error: 'فشل الرفع' });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">الاستيراد / التوريد</h1>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="customers">العملاء</TabsTrigger>
          <TabsTrigger value="services">الخدمات</TabsTrigger>
          <TabsTrigger value="parts">قطع الغيار</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-2">استيراد العملاء (CSV أو XLSX)</h2>
            <p className="text-sm text-slate-600 mb-3">الترويسة المطلوبة: name,phone,email,address</p>
            <div className="flex items-center gap-2 mb-3">
              <select className="border rounded p-2" value={custMode} onChange={e=>setCustMode(e.target.value)}>
                <option value="skip">تخطي التكرارات</option>
                <option value="update">تحديث الموجود</option>
              </select>
            </div>
            <input type="file" accept=".csv,.xlsx" onChange={(e)=> setCustFile(e.target.files?.[0]||null)} />
            <div className="mt-3 flex gap-2">
              <Button onClick={()=> uploadCsv('/import/customers/csv', custFile, custMode, setCustResult, setCustLoading)} disabled={!custFile || custLoading}>رفع CSV</Button>
              <Button variant="outline" onClick={()=> uploadCsv('/import/customers/xlsx', custFile, custMode, setCustResult, setCustLoading)} disabled={!custFile || custLoading}>رفع XLSX</Button>
              {custLoading && <span className="text-sm text-slate-500">جاري الرفع...</span>}
            </div>
            {custResult && <div className="text-sm mt-2">نتيجة: {JSON.stringify(custResult)}</div>}
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-2">استيراد الخدمات (CSV أو XLSX)</h2>
            <p className="text-sm text-slate-600 mb-3">الترويسة: name,category,price,duration</p>
            <div className="flex items-center gap-2 mb-3">
              <select className="border rounded p-2" value={servMode} onChange={e=>setServMode(e.target.value)}>
                <option value="skip">تخطي التكرارات</option>
                <option value="update">تحديث الموجود</option>
              </select>
            </div>
            <input type="file" accept=".csv,.xlsx" onChange={(e)=> setServFile(e.target.files?.[0]||null)} />
            <div className="mt-3 flex gap-2">
              <Button onClick={()=> uploadCsv('/import/services/csv', servFile, servMode, setServResult, setServLoading)} disabled={!servFile || servLoading}>رفع CSV</Button>
              <Button variant="outline" onClick={()=> uploadCsv('/import/services/xlsx', servFile, servMode, setServResult, setServLoading)} disabled={!servFile || servLoading}>رفع XLSX</Button>
              {servLoading && <span className="text-sm text-slate-500">جاري الرفع...</span>}
            </div>
            {servResult && <div className="text-sm mt-2">نتيجة: {JSON.stringify(servResult)}</div>}
          </Card>
        </TabsContent>

        <TabsContent value="parts">
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-2">استيراد قطع الغيار (CSV أو XLSX)</h2>
            <p className="text-sm text-slate-600 mb-3">الترويسة: name,code,category,price,quantity,unit</p>
            <div className="flex items-center gap-2 mb-3">
              <select className="border rounded p-2" value={partMode} onChange={e=>setPartMode(e.target.value)}>
                <option value="skip">تخطي التكرارات</option>
                <option value="update">تحديث الموجود</option>
              </select>
            </div>
            <input type="file" accept=".csv,.xlsx" onChange={(e)=> setPartFile(e.target.files?.[0]||null)} />
            <div className="mt-3 flex gap-2">
              <Button onClick={()=> uploadCsv('/import/parts/csv', partFile, partMode, setPartResult, setPartLoading)} disabled={!partFile || partLoading}>رفع CSV</Button>
              <Button variant="outline" onClick={()=> uploadCsv('/import/parts/xlsx', partFile, partMode, setPartResult, setPartLoading)} disabled={!partFile || partLoading}>رفع XLSX</Button>
              {partLoading && <span className="text-sm text-slate-500">جاري الرفع...</span>}
            </div>
            {partResult && <div className="text-sm mt-2">نتيجة: {JSON.stringify(partResult)}</div>}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Import;
