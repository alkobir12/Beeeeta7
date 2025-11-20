import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim()) {
      toast({ title: t('common.error'), description: i18n.language==='ar'?'الاسم مطلوب':'Name is required', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);

      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) {
        // نقرأ الـ body مرة واحدة فقط لتفادي خطأ Response body is already used
        const msg = await response.text().catch(() => '');
        throw new Error(msg || `Server error ${response.status}`);
      }
      const users = await response.json();

      const user = users.find(u => (u.name || '').toLowerCase() === name.trim().toLowerCase());

      if (!user) {
        toast({ title: t('common.error'), description: i18n.language==='ar'?'مستخدم غير موجود':'User not found', variant: 'destructive' });
        return;
      }

      if (user.isActive === false) {
        toast({ title: t('common.error'), description: i18n.language==='ar'?'هذا الحساب معطل':'This account is disabled', variant: 'destructive' });
        return;
      }

      const session = { 
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        permissions: user.permissions || {},
        loginTime: new Date().toISOString()
      };

      // تخزين الجلسة في localStorage (توافقية مع الكود القديم)
      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('user', JSON.stringify(user));

      // تخزين الجلسة أيضًا في كوكي بسيط (7 أيام)
      try {
        document.cookie = `session=${encodeURIComponent(JSON.stringify(session))}; max-age=${60 * 60 * 24 * 7}; path=/`;
      } catch (e) {
        console.warn('Failed to set session cookie', e);
      }

      try {
        await fetch(`${API_URL}/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastLogin: new Date().toISOString() })
        });
      } catch (_) {}

      toast({ 
        title: t('common.welcome'),
        description: `${user.name}`
      });
      navigate('/');
    } catch (e) {
      console.error('Login error:', e);
      toast({ title: t('common.error'), description: i18n.language==='ar'?'فشل في تسجيل الدخول':'Login failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{i18n.language==='ar'?'تسجيل الدخول':'Sign In'}</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="text-lg">{i18n.language==='ar'?'الاسم':'Name'}</Label>
            <Input 
              placeholder={i18n.language==='ar'?'أدخل اسمك':'Enter your name'} 
              value={name} 
              onChange={e=>setName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-lg py-6"
              autoFocus
            />
          </div>
          <Button 
            onClick={handleLogin} 
            disabled={loading} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
          >
            {i18n.language==='ar'?'دخول':'Sign In'}
          </Button>
          <p className="text-sm text-slate-500 text-center mt-4">
            {i18n.language==='ar'?'نظام إدارة الورش - دخول مباشر':'Workshop Management System - Direct Login'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
