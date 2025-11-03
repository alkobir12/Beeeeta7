import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { Users, Shield, Trash2, Edit, Plus } from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const DEFAULT_PERMISSIONS = {
  canViewDashboard: true,
  canManageVehicles: true,
  canManageCustomers: true,
  canManageParts: false,
  canManageServices: false,
  canViewReports: true,
  canManageFinance: false,
  canManageUsers: false,
  canAccessCEO: false,
  canManageSettings: false
};

const ROLE_PRESETS = {
  admin: {
    canViewDashboard: true,
    canManageVehicles: true,
    canManageCustomers: true,
    canManageParts: true,
    canManageServices: true,
    canViewReports: true,
    canManageFinance: true,
    canManageUsers: true,
    canAccessCEO: true,
    canManageSettings: true
  },
  manager: {
    canViewDashboard: true,
    canManageVehicles: true,
    canManageCustomers: true,
    canManageParts: true,
    canManageServices: true,
    canViewReports: true,
    canManageFinance: true,
    canManageUsers: false,
    canAccessCEO: true,
    canManageSettings: false
  },
  technician: {
    canViewDashboard: true,
    canManageVehicles: true,
    canManageCustomers: false,
    canManageParts: false,
    canManageServices: false,
    canViewReports: false,
    canManageFinance: false,
    canManageUsers: false,
    canAccessCEO: false,
    canManageSettings: false
  },
  employee: {
    canViewDashboard: true,
    canManageVehicles: false,
    canManageCustomers: true,
    canManageParts: false,
    canManageServices: false,
    canViewReports: false,
    canManageFinance: false,
    canManageUsers: false,
    canAccessCEO: false,
    canManageSettings: false
  }
};

const UsersManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'employee',
    permissions: { ...DEFAULT_PERMISSIONS },
    isActive: true
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(data || []);
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = (role) => {
    setForm({
      ...form,
      role,
      permissions: ROLE_PRESETS[role] || DEFAULT_PERMISSIONS
    });
  };

  const togglePermission = (key) => {
    setForm({
      ...form,
      permissions: {
        ...form.permissions,
        [key]: !form.permissions[key]
      }
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = { ...form };
      
      const res = await fetch(`${API_URL}/users${editingId ? '/' + editingId : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل الحفظ');
      
      toast({
        title: editingId ? 'تم التحديث' : 'تم الإضافة',
        description: `تم ${editingId ? 'تحديث' : 'إضافة'} المستخدم بنجاح`
      });
      
      resetForm();
      fetchUsers();
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e.message || 'تعذر حفظ المستخدم',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      role: 'employee',
      permissions: { ...DEFAULT_PERMISSIONS },
      isActive: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editUser = (user) => {
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || 'employee',
      permissions: user.permissions || DEFAULT_PERMISSIONS,
      isActive: user.isActive !== false
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const deleteUser = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    
    try {
      const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل الحذف');
      
      toast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح' });
      fetchUsers();
    } catch (e) {
      toast({
        title: 'خطأ',
        description: 'تعذر حذف المستخدم',
        variant: 'destructive'
      });
    }
  };

  const PERMISSIONS_LABELS = {
    canViewDashboard: 'عرض لوحة التحكم',
    canManageVehicles: 'إدارة المركبات (تغيير الحالة)',
    canManageCustomers: 'إدارة العملاء',
    canManageParts: 'إدارة قطع الغيار',
    canManageServices: 'إدارة الخدمات',
    canViewReports: 'عرض التقارير',
    canManageFinance: 'إدارة العمليات المالية',
    canManageUsers: 'إدارة المستخدمين',
    canAccessCEO: 'الوصول للوحة المدير',
    canManageSettings: 'إدارة الإعدادات'
  };

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-slate-800">إدارة المستخدمين</h1>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="ml-2" size={18} />
              {showForm ? 'إلغاء' : 'إضافة مستخدم'}
            </Button>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <Card className="mb-6 border-2 border-blue-200">
              <CardHeader className="bg-gradient-to-l from-blue-50">
                <CardTitle>{editingId ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={submit} className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>الاسم *</Label>
                      <Input
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="محمد أحمد"
                        required
                      />
                    </div>
                    <div>
                      <Label>رقم الجوال *</Label>
                      <Input
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="0501234567"
                        required
                      />
                    </div>
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <Label>الدور الوظيفي *</Label>
                    <Select value={form.role} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مدير النظام (جميع الصلاحيات)</SelectItem>
                        <SelectItem value="manager">مدير الورشة</SelectItem>
                        <SelectItem value="technician">فني</SelectItem>
                        <SelectItem value="employee">موظف استقبال</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">
                      ⚡ اختيار الدور يُحدد الصلاحيات تلقائياً (يمكن التعديل أدناه)
                    </p>
                  </div>

                  {/* Permissions */}
                  <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="text-blue-600" size={20} />
                      <h3 className="font-bold text-slate-800">الصلاحيات التفصيلية</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(PERMISSIONS_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-3 p-3 bg-white rounded border hover:bg-blue-50 transition-colors">
                          <Checkbox
                            id={key}
                            checked={form.permissions[key]}
                            onCheckedChange={() => togglePermission(key)}
                          />
                          <label htmlFor={key} className="text-sm cursor-pointer flex-1">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    {/* Quick Presets */}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-slate-600 mb-2">قوالب سريعة:</p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, role: 'technician', permissions: ROLE_PRESETS.technician })}
                        >
                          🔧 فني (مركبات + معرفة فقط)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, role: 'employee', permissions: ROLE_PRESETS.employee })}
                        >
                          👤 موظف (عملاء فقط)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, role: 'manager', permissions: ROLE_PRESETS.manager })}
                        >
                          👔 مدير (كل شيء عدا المستخدمين)
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                      {loading ? 'جاري الحفظ...' : (editingId ? 'تحديث' : 'إضافة')}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Users List */}
          <div className="grid grid-cols-1 gap-4">
            {users.map(user => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                          {user.name?.[0]?.toUpperCase() || 'م'}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-800">{user.name}</h3>
                          <p className="text-sm text-slate-600">{user.phone}</p>
                          {user.email && <p className="text-xs text-slate-500">{user.email}</p>}
                        </div>
                        <div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            user.role === 'admin' ? 'bg-red-100 text-red-700' :
                            user.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'technician' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {user.role === 'admin' ? '👑 مدير النظام' :
                             user.role === 'manager' ? '👔 مدير' :
                             user.role === 'technician' ? '🔧 فني' :
                             '👤 موظف'}
                          </span>
                        </div>
                      </div>

                      {/* Permissions Summary */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(user.permissions || {}).filter(([_, v]) => v).map(([key, _]) => (
                          <span key={key} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            ✓ {PERMISSIONS_LABELS[key]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editUser(user)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUser(user.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {users.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="mx-auto text-slate-300 mb-4" size={64} />
                  <p className="text-slate-500">لا يوجد مستخدمون</p>
                  <p className="text-xs text-slate-400 mt-2">اضغط "إضافة مستخدم" لإنشاء مستخدم جديد</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UsersManagement;
