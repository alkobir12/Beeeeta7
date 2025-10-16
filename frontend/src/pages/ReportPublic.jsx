import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReportPublic = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/reports/public/${token}`);
        setData(res.data);
      } catch (e) {
        setError('رابط غير صحيح أو انتهت صلاحيته');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl">جاري التحميل...</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center" dir="rtl">{error || 'حدث خطأ'}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50" dir="rtl">
      <div className="container mx-auto p-6 max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>تقرير تشخيص</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="font-bold text-lg">{data.title}</div>
            <div className="text-slate-700 whitespace-pre-wrap">{data.summary}</div>
            <div className="border-t pt-3">
              {(data.items||[]).length > 0 ? (
                <ul className="list-disc pr-6">
                  {data.items.map((it, idx) => (
                    <li key={idx}>{it.name} — الكمية: {it.qty || it.quantity || 1} — السعر: {Number(it.price||0).toFixed(2)} — الإجمالي: {Number(it.total||0).toFixed(2)}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500">لا توجد عناصر مفصلة</div>
              )}
            </div>
            <div className="font-bold text-blue-800">الإجمالي: {Number(data.total).toFixed(2)} ر.س</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportPublic;
