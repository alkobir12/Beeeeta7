import React, { useEffect, useState } from 'react';
import { Users, Shield, Trash2, Edit, Plus, Check } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const DEFAULT_PERMISSIONS = {
  canViewDashboard: true, canManageVehicles: true, canManageCustomers: true,
  canManageParts: false, canManageServices: false, canViewReports: true,
  canManageFinance: false, canManageUsers: false, canAccessCEO: false, canManageSettings: false
};

const ROLE_PRESETS = {
  admin: { canViewDashboard: true, canManageVehicles: true, canManageCustomers: true, canManageParts: true, canManageServices: true, canViewReports: true, canManageFinance: true, canManageUsers: true, canAccessCEO: true, canManageSettings: true },
  manager: { canViewDashboard: true, canManageVehicles: true, canManageCustomers: true, canManageParts: true, canManageServices: true, canViewReports: true, canManageFinance: true, canManageUsers: false, canAccessCEO: true, canManageSettings: false },
  technician: { canViewDashboard: true, canManageVehicles: true, canManageCustomers: false, canManageParts: false, canManageServices: false, canViewReports: false, canManageFinance: false, canManageUsers: false, canAccessCEO: false, canManageSettings: false },
  employee: { canViewDashboard: true, canManageVehicles: false, canManageCustomers: true, canManageParts: false, canManageServices: false, canViewReports: false, canManageFinance: false, canManageUsers: false, canAccessCEO: false, canManageSettings: false }
};

const PERMISSIONS_LABELS = {
  canViewDashboard: 'عرض لوحة التحكم', canManageVehicles: 'إدارة المركبات', canManageCustomers: 'إدارة العملاء',
  canManageParts: 'إدارة المخزون', canManageServices: 'إدارة الخدمات', canViewReports: 'عرض التقارير',
  canManageFinance: 'المالية والحسابات', canManageUsers: 'إدارة المستخدمين', canAccessCEO: 'لوحة المدير', canManageSettings: 'الإعدادات'
};

const UsersManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', role: 'employee', permissions: { ...DEFAULT_PERMISSIONS }, isActive: true
  });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(data || []);
    } catch (e) { console.error(e); }
  };

  const handleRoleChange = (role) => {
    setForm({ ...form, role, permissions: ROLE_PRESETS[role] || DEFAULT_PERMISSIONS });
  };

  const togglePermission = (key) => {
    setForm({ ...form, permissions: { ...form.permissions, [key]: !form.permissions[key] } });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/users${editingId ? '/' + editingId : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('فشل الحفظ');
      toast({ title: 'تم الحفظ', description: 'تم حفظ بيانات المستخدم بنجاح' });
      resetForm();
      fetchUsers();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الحفظ', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', phone: '', email: '', role: 'employee', permissions: { ...DEFAULT_PERMISSIONS }, isActive: true });
    setEditingId(null);
    setShowModal(false);
  };

  const editUser = (user) => {
    setForm({
      name: user.name || '', phone: user.phone || '', email: user.email || '',
      role: user.role || 'employee', permissions: user.permissions || DEFAULT_PERMISSIONS,
      isActive: user.isActive !== false
    });
    setEditingId(user.id);
    setShowModal(true);
  };

  const deleteUser = async (id) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      toast({ title: 'تم الحذف', description: 'تم حذف المستخدم' });
      fetchUsers();
    } catch (e) { toast({ title: 'خطأ', variant: 'destructive' }); }
  };

  return (
    
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">المستخدمين والصلاحيات</h1>
            <p className="text-gray-500 mt-1">إدارة فريق العمل وتحديد الصلاحيات</p>
          </div>
          <button onClick={() => setShowModal(true)} className="apple-button flex items-center gap-2">
            <Plus size={18} />
            <span>مستخدم جديد</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(user => (
            <div key={user.id} className="apple-card p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{user.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                      user.role === 'technician' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'admin' ? 'مدير نظام' : user.role === 'manager' ? 'مدير' : user.role === 'technician' ? 'فني' : 'موظف'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => editUser(user)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Edit size={16} /></button>
                  <button onClick={() => deleteUser(user.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
              
              <div className="space-y-1 text-sm text-gray-500 mb-4">
                <p>{user.phone}</p>
                <p>{user.email}</p>
              </div>

              <div className="pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-2">الصلاحيات:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(user.permissions || {}).filter(([_, v]) => v).slice(0, 4).map(([key]) => (
                    <span key={key} className="text-[10px] bg-gray-50 px-2 py-1 rounded text-gray-600 border border-gray-100">
                      {PERMISSIONS_LABELS[key]}
                    </span>
                  ))}
                  {Object.values(user.permissions || {}).filter(v => v).length > 4 && (
                    <span className="text-[10px] bg-gray-50 px-2 py-1 rounded text-gray-400">+ المزيد</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{editingId ? 'تعديل مستخدم' : 'مستخدم جديد'}</h2>
              </div>
              <form onSubmit={submit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">الاسم *</label>
                    <input required className="apple-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">رقم الجوال *</label>
                    <input required className="apple-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                    <input type="email" className="apple-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">الدور الوظيفي</label>
                    <select className="apple-input" value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                      <option value="employee">موظف</option>
                      <option value="technician">فني</option>
                      <option value="manager">مدير</option>
                      <option value="admin">مدير نظام</option>
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Shield size={16} />
                    الصلاحيات
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(PERMISSIONS_LABELS).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${form.permissions[key] ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                          {form.permissions[key] && <Check size={12} className="text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={form.permissions[key]} onChange={() => togglePermission(key)} />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={resetForm} className="flex-1 apple-button-secondary">إلغاء</button>
                  <button type="submit" disabled={loading} className="flex-1 apple-button">حفظ</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    
  );
};

export default UsersManagement;
