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
      
      // Create simple session
      const session = { 
        id: Date.now().toString(), 
        name: name.trim(),
        role: 'admin',
        loginTime: new Date().toISOString()
      };
      
      const user = { 
        id: Date.now().toString(), 
        name: name.trim(), 
        role: 'admin' 
      };
      
      // Save session
      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('user', JSON.stringify(user));
      
      toast({ title: 'تم الدخول', description: `مرحباً ${name.trim()}` });
      navigate('/');
    } catch (e) {
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
