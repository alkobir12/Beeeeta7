import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ApprovalPublic = () => {
  const { token } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/approvals/public/${token}`);
      setData(res.data);
      setError('');
    } catch (e) {
      setError('رابط غير صحيح أو انتهت صلاحيته');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const respond = async (status) => {
    try {
      setSending(true);
      const formData = new URLSearchParams();
      formData.append('status', status);
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('notes', notes);
      await axios.post(`${API_URL}/approvals/public/${token}/respond`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      await load();
    } catch (e) {
      setError('تعذر إرسال الرد');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">جاري التحميل...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md text-center bg-white shadow rounded p-6">
          <div className="text-lg font-bold mb-2">{error || 'حدث خطأ'}</div>
          <div className="text-slate-500 text-sm">تحقق من أن الرابط صحيح وغير منتهي الصلاحية. إذا استمرت المشكلة تواصل مع الورشة.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50" dir="rtl">
      <div className="container mx-auto p-6 max-w-xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>طلب اعتماد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-bold text-lg">{data.title}</div>
              <div className="text-slate-600">المبلغ: {Number(data.amount).toFixed(2)} ر.س</div>
            </div>

            {/* Display Images */}
            {data.images && data.images.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-sm">صور الأعطال:</div>
                <div className="grid grid-cols-2 gap-2">
                  {data.images.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={img.data} 
                      alt={`صورة ${idx + 1}`} 
                      className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90"
                      onClick={() => window.open(img.data, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <Input placeholder="اسمك" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="الجوال" value={phone} onChange={e => setPhone(e.target.value)} />
              <Input placeholder="ملاحظات (اختياري)" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button disabled={sending || data.status !== 'pending'} onClick={() => respond('approved')} className="bg-green-600 hover:bg-green-700">موافقة</Button>
              <Button disabled={sending || data.status !== 'pending'} variant="destructive" onClick={() => respond('rejected')}>رفض</Button>
              <Button disabled={sending || data.status !== 'pending'} variant="outline" onClick={() => respond('deferred')}>تأجيل</Button>
              <Button disabled={sending || data.status !== 'pending'} variant="outline" onClick={() => respond('requote')}>تسعير أخرى</Button>
            </div>

            <div className="text-sm text-slate-500">
              الحالة الحالية: {data.status === 'pending' ? 'بانتظار الرد' : data.status === 'approved' ? 'تمت الموافقة' : 'تم الرفض'}
              {data.signature && (
                <div className="mt-2 p-2 bg-slate-100 rounded text-xs font-mono break-all">
                  <div className="font-bold mb-1">التوقيع الرقمي:</div>
                  {data.signature}
                  <div className="mt-1 text-slate-400">IP: {data.clientIp}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApprovalPublic;
