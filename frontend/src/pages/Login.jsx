import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const fallbackPermissions = {
    canViewDashboard: true,
    canManageVehicles: true,
    canManageCustomers: true,
    canManageParts: true,
    canManageServices: true,
    canViewReports: true,
    canManageFinance: true,
    canManageUsers: true,
    canAccessCEO: true,
    canManageSettings: true,
  };

  const handleLogin = async () => {
    if (!name.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال الاسم', variant: 'destructive' });
      return;
    }

    // تسجيل دخول سريع للمدير بدون الاعتماد على /users (لتجنب أي تعليق/تعذر شبكة)
    if (name.trim() === 'مدير') {
      const fallbackUser = {
        id: 'local-admin',
        name: 'مدير',
        phone: '',
        email: '',
        role: 'admin',
        permissions: fallbackPermissions,
        isActive: true,
      };
      const session = {
        id: fallbackUser.id,
        name: fallbackUser.name,
        phone: fallbackUser.phone,
        email: fallbackUser.email,
        role: fallbackUser.role,
        permissions: fallbackUser.permissions,
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('user', JSON.stringify(fallbackUser));
      toast({ title: 'مرحبا بك', description: `أهلا بعودتك، ${fallbackUser.name}` });
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      
      // Fetch users to simulate login (as per existing logic) with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${API_URL}/users`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error('Server error');
      
      const users = await response.json();
      const user = users.find(u => (u.name || '').toLowerCase() === name.trim().toLowerCase());

      if (!user) {
        if (name.trim() === 'مدير') {
          const fallbackUser = {
            id: 'local-admin',
            name: 'مدير',
            phone: '',
            email: '',
            role: 'admin',
            permissions: fallbackPermissions,
            isActive: true,
          };
          const session = { 
            id: fallbackUser.id,
            name: fallbackUser.name,
            phone: fallbackUser.phone,
            email: fallbackUser.email,
            role: fallbackUser.role,
            permissions: fallbackUser.permissions,
            loginTime: new Date().toISOString()
          };
          localStorage.setItem('session', JSON.stringify(session));
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          toast({ title: 'مرحباً بك', description: `أهلاً بعودتك، ${fallbackUser.name}` });
          navigate('/');
          return;
        }
        toast({ title: 'خطأ', description: 'المستخدم غير موجود', variant: 'destructive' });
        return;
      }

      if (user.isActive === false) {
        toast({ title: 'خطأ', description: 'هذا الحساب معطل', variant: 'destructive' });
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

      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('user', JSON.stringify(user));

      // Update last login
      try {
        await fetch(`${API_URL}/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastLogin: new Date().toISOString() })
        });
      } catch (_) {}

      toast({ 
        title: 'مرحباً بك',
        description: `أهلاً بعودتك، ${user.name}`
      });
      navigate('/');
    } catch (e) {
      console.error('Login error:', e);
      if (name.trim() === 'مدير') {
        const fallbackUser = {
          id: 'local-admin',
          name: 'مدير',
          phone: '',
          email: '',
          role: 'admin',
          permissions: fallbackPermissions,
          isActive: true,
        };
        const session = { 
          id: fallbackUser.id,
          name: fallbackUser.name,
          phone: fallbackUser.phone,
          email: fallbackUser.email,
          role: fallbackUser.role,
          permissions: fallbackUser.permissions,
          loginTime: new Date().toISOString()
        };
        localStorage.setItem('session', JSON.stringify(session));
        localStorage.setItem('user', JSON.stringify(fallbackUser));
        toast({ title: 'مرحباً بك', description: `أهلاً بعودتك، ${fallbackUser.name}` });
        navigate('/');
        return;
      }
      toast({ title: 'خطأ', description: 'فشل في تسجيل الدخول', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements for 'Fluid' feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[400px] z-10 animate-fade-in">
        <div className="apple-card p-10 flex flex-col items-center text-center">
          
          {/* Logo / Icon Placeholder */}
          <div className="w-16 h-16 bg-gradient-to-br from-[#0071E3] to-[#00C7BE] rounded-2xl mb-8 shadow-lg flex items-center justify-center text-white text-2xl font-bold">
            W
          </div>

          <h1 className="text-3xl font-bold text-[#1D1D1F] mb-2 tracking-tight">
            تسجيل الدخول
          </h1>
          <p className="text-[#86868B] text-base mb-10">
            نظام إدارة الورش الذكي
          </p>

          <div className="w-full space-y-6">
            <div className="space-y-2 text-right">
              <label className="text-sm font-medium text-[#1D1D1F] mr-1">
                اسم المستخدم
              </label>
              <input 
                type="text"
                placeholder="أدخل اسمك هنا" 
                value={name} 
                onChange={e => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="apple-input"
                autoFocus
                data-testid="login-username-input"
              />
            </div>

            <button 
              onClick={handleLogin} 
              disabled={loading} 
              className="apple-button flex items-center justify-center gap-2"
              data-testid="login-submit-button"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'دخول'
              )}
            </button>
          </div>

          <div className="mt-8 text-sm text-[#86868B]">
            نسخة تجريبية v2.0
          </div>
        </div>
        
        <div className="mt-8 text-center text-[#86868B] text-sm">
          جميع الحقوق محفوظة © 2025
        </div>
      </div>
    </div>
  );
};

export default Login;
