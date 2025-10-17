import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';

const API_URL = (import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL) + '/api';

const Users = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', role: 'technician', active: true });
  const [editingId, setEditingId] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(data || []);
    } catch (e) {}
  };

  useEffect(() => { fetchUsers(); }, []);

  const submit = async () => {
    try {
      setLoading(true);
      const payload = { ...form };
      const res = await fetch(`${API_URL}/users${editingId ? '/' + editingId : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'failed');
      toast({ title: editingId ? 'تم التعديل' : 'تم الإضافة' });
      setForm({ name: '', phone: '', role: 'technician', active: true });
      setEditingId(null);
      fetchUsers();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر حفظ المستخدم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const edit = (u) => {
    setEditingId(u.id);
    setForm({ name: u.name || '', phone: u.phone || '', role: u.role || 'technician', active: u.active !== false });
  };

  const remove = async (id) => {
    if (!window.confirm('حذف المستخدم؟')) return;
    try {
      const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      toast({ title: 'تم الحذف' });
      fetchUsers();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر حذف المستخدم', variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6" dir="rtl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>المستخدمون</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div>
                <Label>الاسم</Label>
                <Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              </div>
              <div>
                <Label>الجوال</Label>
                <Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="9665xxxxxxxx" />
              </div>
              <div>
                <Label>الدور</Label>
                <select className="w-full border rounded p-2" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                  <option value="admin">مدير</option>
                  <option value="manager">مشرف</option>
                  <option value="technician">فني</option>
                </select>
              </div>
              <div className="flex items-end"><Button onClick={submit} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">{editingId ? 'تعديل' : 'إضافة'}</Button></div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border p-2">الاسم</th>
                    <th className="border p-2">الجوال</th>
                    <th className="border p-2">الدور</th>
                    <th className="border p-2">نشط</th>
                    <th className="border p-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="border p-2">{u.name || '-'}</td>
                      <td className="border p-2">{u.phone}</td>
                      <td className="border p-2">{u.role}</td>
                      <td className="border p-2">{u.active === false ? 'لا' : 'نعم'}</td>
                      <td className="border p-2 space-x-2 space-x-reverse">
                        <Button variant="outline" onClick={()=>edit(u)}>تعديل</Button>
                        <Button variant="destructive" onClick={()=>remove(u.id)}>حذف</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Users;
