import React, { useEffect, useState } from 'react';
import { Users, Shield, Trash2, Edit, Plus, Check } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { resolveBackendBase } from '../utils/backendBase';
import {
  ROLE_DEFINITIONS,
  MODULE_DEFINITIONS,
  ACTION_LABELS,
  clonePermissions,
  normalizePermissions,
  getRolePermissions,
  getRoleLabel,
} from '../utils/permissions';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${resolveBackendBase() || ''}/api`.replace('//api', '/api')
);

const DEFAULT_ROLE = 'viewer';
const ROLE_OPTIONS = Object.entries(ROLE_DEFINITIONS).map(([key, value]) => ({
  value: key,
  label: value?.name || key,
}));

const UsersManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    role: DEFAULT_ROLE,
    permissions: clonePermissions(getRolePermissions(DEFAULT_ROLE)),
    isActive: true,
    guidanceEnabled: true,
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
    setForm({
      ...form,
      role,
      permissions: clonePermissions(getRolePermissions(role)),
    });
  };

  const togglePermission = (moduleKey, action) => {
    setForm((prev) => {
      const next = clonePermissions(prev.permissions);
      if (!next[moduleKey]) next[moduleKey] = {};
      next[moduleKey][action] = !next[moduleKey][action];
      return { ...prev, permissions: next };
    });
  };

  const getPermissionBadges = (permissions, role) => {
    const normalized = normalizePermissions(permissions, role);
    return MODULE_DEFINITIONS.filter((module) =>
      Object.values(normalized?.[module.key] || {}).some(Boolean)
    ).map((module) => module.label);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (!form.name || !form.username || (!editingId && !form.password)) {
        toast({ title: 'تنبيه', description: 'الاسم واسم الدخول وكلمة المرور مطلوبة', variant: 'destructive' });
        return;
      }
      const payload = { ...form };
      if (editingId && !payload.password) {
        delete payload.password;
      }
      const res = await fetch(`${API_URL}/users${editingId ? '/' + editingId : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
    setForm({
      name: '',
      username: '',
      password: '',
      phone: '',
      email: '',
      role: DEFAULT_ROLE,
      permissions: clonePermissions(getRolePermissions(DEFAULT_ROLE)),
      isActive: true,
      guidanceEnabled: true,
    });
    setEditingId(null);
    setShowModal(false);
  };

  const editUser = (user) => {
    setForm({
      name: user.name || '',
      username: user.username || '',
      password: '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || DEFAULT_ROLE,
      permissions: normalizePermissions(user.permissions, user.role || DEFAULT_ROLE),
      isActive: user.isActive !== false,
      guidanceEnabled: user.guidanceEnabled !== false,
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
          <button onClick={() => setShowModal(true)} className="apple-button flex items-center gap-2" data-testid="users-add-button">
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
                    <h3 className="font-bold text-gray-900" data-testid={`users-card-name-${user.id}`}>{user.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {getRoleLabel(user.role)}
                    </span>
                    {user.guidanceEnabled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-2">إرشادات مفعّلة</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => editUser(user)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" data-testid={`users-card-edit-${user.id}`}><Edit size={16} /></button>
                  <button onClick={() => deleteUser(user.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500" data-testid={`users-card-delete-${user.id}`}><Trash2 size={16} /></button>
                </div>
              </div>
              
              <div className="space-y-1 text-sm text-gray-500 mb-4">
                <p data-testid={`users-card-phone-${user.id}`}>{user.phone}</p>
                <p data-testid={`users-card-email-${user.id}`}>{user.email}</p>
              </div>

              <div className="pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-2">الصلاحيات:</p>
                <div className="flex flex-wrap gap-1">
                  {getPermissionBadges(user.permissions, user.role).slice(0, 4).map((label) => (
                    <span key={label} className="text-[10px] bg-gray-50 px-2 py-1 rounded text-gray-600 border border-gray-100">
                      {label}
                    </span>
                  ))}
                  {getPermissionBadges(user.permissions, user.role).length > 4 && (
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
                    <input required className="apple-input" data-testid="users-name-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">رقم الجوال *</label>
                    <input required className="apple-input" data-testid="users-phone-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">اسم الدخول *</label>
                    <input required className="apple-input" data-testid="users-username-input" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">كلمة المرور {editingId ? '' : '*'}</label>
                    <input type="password" className="apple-input" data-testid="users-password-input" placeholder={editingId ? 'اتركه فارغًا للإبقاء' : ''} value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                    <input type="email" className="apple-input" data-testid="users-email-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">الدور الوظيفي</label>
                    <select className="apple-input" data-testid="users-role-select" value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900">حالة المستخدم</h3>
                      <p className="text-xs text-gray-500">تفعيل أو تعطيل الحساب.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, isActive: !form.isActive })}
                      className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      data-testid="users-active-toggle"
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900">الإرشادات الذكية</h3>
                      <p className="text-xs text-gray-500">تنبيهات خطوة بخطوة لتقليل الأخطاء.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, guidanceEnabled: !form.guidanceEnabled })}
                      className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${form.guidanceEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      data-testid="users-guidance-toggle"
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${form.guidanceEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Shield size={16} />
                    الصلاحيات
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {MODULE_DEFINITIONS.map((module) => (
                      <div key={module.key} className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-700">{module.label}</span>
                          <div className="flex flex-wrap gap-2">
                            {module.actions.map((action) => {
                              const checked = !!form.permissions?.[module.key]?.[action];
                              return (
                                <label
                                  key={`${module.key}-${action}`}
                                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 cursor-pointer hover:border-blue-300"
                                  data-testid={`user-permission-${module.key}-${action}`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                    {checked && <Check size={10} className="text-white" />}
                                  </div>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={checked}
                                    onChange={() => togglePermission(module.key, action)}
                                  />
                                  <span>{ACTION_LABELS[action] || action}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
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