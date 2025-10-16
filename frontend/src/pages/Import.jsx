import React, { useState } from 'react';
import axios from 'axios';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API_URL = (import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL) + '/api';

const Import = () => {
  const [custFile, setCustFile] = useState(null);
  const [servFile, setServFile] = useState(null);
  const [custResult, setCustResult] = useState(null);
  const [servResult, setServResult] = useState(null);
  const [loadingCust, setLoadingCust] = useState(false);
  const [loadingServ, setLoadingServ] = useState(false);
  const [errorCust, setErrorCust] = useState('');
  const [errorServ, setErrorServ] = useState('');

  const uploadCustomers = async () => {
    if (!custFile) return;
    setLoadingCust(true); setErrorCust(''); setCustResult(null);
    try {
      const fd = new FormData();
      fd.append('file', custFile);
      const { data } = await axios.post(`${API_URL}/import/customers/csv`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCustResult(data);
    } catch (e) {
      setErrorCust('فشل استيراد العملاء');
    } finally {
      setLoadingCust(false);
    }
  };

  const uploadServices = async () => {
    if (!servFile) return;
    setLoadingServ(true); setErrorServ(''); setServResult(null);
    try {
      const fd = new FormData();
      fd.append('file', servFile);
      const { data } = await axios.post(`${API_URL}/import/services/csv`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setServResult(data);
    } catch (e) {
      setErrorServ('فشل استيراد الخدمات');
    } finally {
      setLoadingServ(false);
    }
  };

  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">الاستيراد</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-2">استيراد العملاء (CSV)</h2>
          <p className="text-sm text-slate-600 mb-3">الترويسة المطلوبة: name,phone,email,address</p>
          <input type="file" accept=".csv" onChange={(e) => setCustFile(e.target.files?.[0] || null)} />
          <div className="mt-3 flex gap-2">
            <Button onClick={uploadCustomers} disabled={!custFile || loadingCust} className="bg-blue-600 hover:bg-blue-700">رفع واستيراد</Button>
            {loadingCust && <span className="text-sm text-slate-500">جاري الرفع...</span>}
          </div>
          {errorCust && <div className="text-red-600 text-sm mt-2">{errorCust}</div>}
          {custResult && <div className="text-green-700 text-sm mt-2">تم الإنشاء: {custResult.created}</div>}
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-2">استيراد الخدمات (CSV)</h2>
          <p className="text-sm text-slate-600 mb-3">الترويسة المطلوبة: name,category,price,duration</p>
          <input type="file" accept=".csv" onChange={(e) => setServFile(e.target.files?.[0] || null)} />
          <div className="mt-3 flex gap-2">
            <Button onClick={uploadServices} disabled={!servFile || loadingServ} className="bg-blue-600 hover:bg-blue-700">رفع واستيراد</Button>
            {loadingServ && <span className="text-sm text-slate-500">جاري الرفع...</span>}
          </div>
          {errorServ && <div className="text-red-600 text-sm mt-2">{errorServ}</div>}
          {servResult && <div className="text-green-700 text-sm mt-2">تم الإنشاء: {servResult.created}</div>}
        </Card>
      </div>
    </div>
  );
};

export default Import;
