import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim()) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if user exists by name
      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const response = await fetch(`${API_URL}/users`);
      const resClone = response.clone();
      if (!response.ok) {
        const msg = await resClone.text().catch(()=> '');
        throw new Error(msg || `Server error ${response.status}`);
      }
      const users = await resClone.json();

      // Find user by name (case-insensitive)
      const user = users.find(u => (u.name || '').toLowerCase() === name.trim().toLowerCase());

      if (!user) {
        toast({
          title: 'مستخدم غير موجود',
          description: 'الاسم غير مسجل في النظام. تواصل مع المدير.',
          variant: 'destructive'
        });
        return;
      }

      if (user.isActive === false) {
        toast({
          title: 'حساب معطل',
          description: 'هذا الحساب معطل. تواصل مع المدير.',
          variant: 'destructive'
        });
        return;
      }
      
      // Create session with user data and permissions
      const session = { 
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        permissions: user.permissions || {},
        loginTime: new Date().toISOString()
      };
      
      // Save session
      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update last login (best-effort, ignore errors)
      try {
        await fetch(`${API_URL}/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastLogin: new Date().toISOString() })
        });
      } catch (_) {}
      
      
      toast({ 
        title: 'مرحباً', 
        description: `تم تسجيل دخول ${user.name} - ${user.role === 'admin' ? 'مدير النظام' : user.role === 'technician' ? 'فني' : user.role === 'manager' ? 'مدير' : 'موظف'}` 
      });
      navigate('/');
    } catch (e) {
      console.error('Login error:', e);
      toast({ title: 'خطأ', description: 'فشل في تسجيل الدخول', variant: 'destructive' });
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center" dir="rtl">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">تسجيل الدخول</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="text-lg">الاسم</Label>
            <Input 
              placeholder="أدخل اسمك" 
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
            دخول
          </Button>
          <p className="text-sm text-slate-500 text-center mt-4">
            نظام إدارة الورش - دخول مباشر
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
