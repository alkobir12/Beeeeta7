import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ApprovalPublic = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/approvals/public/${token}`);
      setData(res.data);
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
      await axios.post(`${API_URL}/approvals/public/${token}/respond`, null, { params: { status, name, notes } });
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
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">{error || 'حدث خطأ'}</div>;
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

            <div className="grid grid-cols-1 gap-3">
              <Input placeholder="اسمك" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="ملاحظات (اختياري)" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button disabled={sending || data.status !== 'pending'} onClick={() => respond('approved')} className="bg-green-600 hover:bg-green-700">موافقة</Button>
              <Button disabled={sending || data.status !== 'pending'} variant="destructive" onClick={() => respond('rejected')}>رفض</Button>
            </div>

            <div className="text-sm text-slate-500">الحالة الحالية: {data.status === 'pending' ? 'بانتظار الرد' : data.status === 'approved' ? 'تمت الموافقة' : 'تم الرفض'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApprovalPublic;
