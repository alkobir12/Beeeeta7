import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';

const API_URL = (((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.REACT_APP_BACKEND_URL) ? import.meta.env.REACT_APP_BACKEND_URL : (process.env.REACT_APP_BACKEND_URL || '')) + '/api').replace('//api','/api');

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('request'); // request | verify
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [whatsAppLink, setWhatsAppLink] = useState('');

  const requestOtp = async () => {
    if (!phone.trim()) {
      toast({ title: 'رقم الجوال مطلوب', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'failed');
      setToken(data.token);
      setWhatsAppLink(data.whatsappDeeplink);
      setStep('verify');
      // Try to open WhatsApp deeplink
      try {
        window.open(data.whatsappDeeplink, '_blank', 'noopener,noreferrer');
      } catch (e) {}
      toast({ title: 'تم إرسال الرمز', description: 'تحقق من الواتساب لإكمال الدخول' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر إرسال الرمز', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!code.trim()) {
      toast({ title: 'أدخل رمز التحقق', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'failed');
      // Save session
      localStorage.setItem('session', JSON.stringify(data.session));
      localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: 'تم الدخول', description: 'مرحباً بك' });
      navigate('/');
    } catch (e) {
      toast({ title: 'خطأ', description: 'الرمز غير صحيح أو منتهي', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyWhatsApp = () => {
    if (!whatsAppLink) return;
    try {
      navigator.clipboard.writeText(whatsAppLink);
      toast({ title: 'تم النسخ', description: 'تم نسخ رابط رسالة الواتساب' });
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center" dir="rtl">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-center">تسجيل الدخول برقم الجوال</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {step === 'request' && (
            <>
              <div>
                <Label>رقم الجوال (مع كود الدولة)</Label>
                <Input placeholder="9665xxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} />
              </div>
              <Button onClick={requestOtp} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">إرسال رمز عبر الواتساب</Button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div>
                <Label>أدخل رمز التحقق</Label>
                <Input placeholder="6 أرقام" value={code} onChange={e=>setCode(e.target.value)} />
              </div>
              <Button onClick={verifyOtp} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">تحقق وتسجيل الدخول</Button>
              <div className="flex gap-2 justify-between mt-2 text-sm">
                <Button variant="outline" onClick={()=>{ try{ window.open(whatsAppLink,'_blank','noopener'); }catch(e){} }}>فتح الواتساب</Button>
                <Button variant="ghost" onClick={copyWhatsApp}>نسخ رابط الرسالة</Button>
                <Button variant="ghost" onClick={()=> setStep('request')}>إعادة الإرسال</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
