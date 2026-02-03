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
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

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

  const respond = async () => {
    try {
      setSending(true);
      const formData = new URLSearchParams();
      formData.append('status', 'approved');
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('notes', notes);
      formData.append('otp', otp);

      await axios.post(`${API_URL}/approvals/public/${token}/respond`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      await load();
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message;
      setError(detail || 'تعذر إرسال الرد');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl" data-testid="approval-loading">
        جاري التحميل...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl" data-testid="approval-error">
        <div className="max-w-md text-center bg-white shadow rounded p-6">
          <div className="text-lg font-bold mb-2" data-testid="approval-error-title">{error || 'حدث خطأ'}</div>
          <div className="text-slate-500 text-sm" data-testid="approval-error-message">
            تحقق من أن الرابط صحيح وغير منتهي الصلاحية. إذا استمرت المشكلة تواصل مع الورشة.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50" dir="rtl" data-testid="approval-page">
      <div className="container mx-auto p-6 max-w-xl">
        <Card className="shadow-xl" data-testid="approval-card">
          <CardHeader>
            <CardTitle data-testid="approval-card-title">طلب اعتماد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-bold text-lg" data-testid="approval-request-title">{data.title}</div>
              <div className="text-slate-600" data-testid="approval-request-amount">
                المبلغ: {Number(data.amount).toFixed(2)} ر.س
              </div>
            </div>

            {/* Display Images */}
            {data.images && data.images.length > 0 && (
              <div className="space-y-2" data-testid="approval-images-section">
                <div className="font-semibold text-sm" data-testid="approval-images-title">صور الأعطال:</div>
                <div className="grid grid-cols-2 gap-2">
                  {data.images.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={img.data} 
                      alt={`صورة ${idx + 1}`} 
                      className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90"
                      onClick={() => window.open(img.data, '_blank')}
                      data-testid={`approval-image-${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3" data-testid="approval-form-fields">
              <Input
                placeholder="اسمك"
                value={name}
                onChange={e => setName(e.target.value)}
                data-testid="approval-name-input"
              />
              <Input
                placeholder="الجوال"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                data-testid="approval-phone-input"
              />
              <Input
                placeholder="رمز OTP (الموجود في رسالة الواتساب)"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                inputMode="numeric"
                data-testid="approval-otp-input"
              />
              <Input
                placeholder="ملاحظات (اختياري)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                data-testid="approval-notes-input"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="approval-disclaimer">
              <div className="text-sm font-bold mb-2" data-testid="approval-disclaimer-title">إقرار اعتماد إلكتروني</div>
              <div className="text-sm text-slate-700 leading-7" data-testid="approval-disclaimer-text">
                أُفوِّض السادة / ورشة عبد اللّٰه الكبير بتنفيذ جميع أعمال الإصلاحات اللازمة للمركبة، واي تبعات تظهر بما في ذلك شراء وتركيب كافة قطع الغيار المطلوبة وتجربة المركبه داخل وخارج الورشة.
                <br />
                وأتعهد بسداد كامل المستحقات واستلام المركبة فور الانتهاء من الخدمة، وأُقرّ بعدم مسؤولية الورشة عن أي تبعات ناتجة عن تأخير القطع وغيرها
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700" data-testid="approval-disclaimer-checkbox-label">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  data-testid="approval-disclaimer-checkbox"
                />
                <span data-testid="approval-disclaimer-checkbox-text">أقرّ أنني قرأت الإقرار وأوافق عليه</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2" data-testid="approval-actions">
              <Button
                disabled={sending || data.status !== 'pending' || !otp.trim() || !accepted}
                onClick={respond}
                className="bg-green-600 hover:bg-green-700"
                data-testid="approval-approve-button"
              >
                موافقة
              </Button>
              <div className="text-xs text-slate-500" data-testid="approval-otp-hint">
                لن تتم الموافقة إلا بعد إدخال رمز OTP الصحيح والموافقة على الإقرار.
              </div>
            </div>

            <div className="text-sm text-slate-500" data-testid="approval-status-section">
              <div data-testid="approval-status-text">
                الحالة الحالية: {data.status === 'pending' ? 'بانتظار الرد' : data.status === 'approved' ? 'تمت الموافقة' : 'تم الرفض'}
              </div>
              {data.otp && (
                <div className="mt-2 text-xs text-slate-500" data-testid="approval-otp-preview">
                  رقم OTP (للتأكيد): <span className="font-mono font-bold">{data.otp}</span>
                </div>
              )}
              {data.signature && (
                <div className="mt-2 p-2 bg-slate-100 rounded text-xs font-mono break-all" data-testid="approval-signature-block">
                  <div className="font-bold mb-1" data-testid="approval-signature-title">التوقيع الرقمي:</div>
                  <div data-testid="approval-signature-value">{data.signature}</div>
                  <div className="mt-1 text-slate-400" data-testid="approval-signature-ip">IP: {data.clientIp}</div>
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
