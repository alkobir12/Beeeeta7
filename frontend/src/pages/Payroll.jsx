import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import axios from 'axios';
import { Users, Wallet, Plus } from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Payroll = () => {
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [currentEmp, setCurrentEmp] = useState(null);
  const [form, setForm] = useState({ month: '', basicSalary: '', bonus: 0, deductions: 0, advances: 0, notes: '' });

  const load = async () => {
    try {
      setLoading(true);
      const [empRes, salRes] = await Promise.all([
        axios.get(`${API_URL}/employees`, { params: { active_only: true } }),
        axios.get(`${API_URL}/salaries`)
      ]);
      setEmployees(empRes.data || []);
      setSalaries(salRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openPay = (emp) => {
    setCurrentEmp(emp);
    setForm({ month: new Date().toISOString().slice(0,7), basicSalary: emp.salary, bonus: 0, deductions: 0, advances: 0, notes: '' });
    setShowPayForm(true);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    const totalPaid = Number(form.basicSalary) + Number(form.bonus) - Number(form.deductions) - Number(form.advances);
    const payload = { 
      employeeId: currentEmp.id,
      employeeName: currentEmp.name,
      month: form.month,
      basicSalary: Number(form.basicSalary),
      bonus: Number(form.bonus),
      deductions: Number(form.deductions),
      advances: Number(form.advances),
      totalPaid,
      notes: form.notes
    };
    await axios.post(`${API_URL}/salaries`, payload);
    setShowPayForm(false);
    setCurrentEmp(null);
    await load();
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" dir="rtl">جاري التحميل...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">مسيرات الرواتب</h1>
              <p className="text-slate-600">إدارة رواتب الموظفين والسلف</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50">
                <CardTitle className="flex items-center gap-2"><Users size={20}/> الموظفون</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-bold">{emp.name}</div>
                        <div className="text-sm text-slate-500">{emp.role} • {emp.phone}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="text-sm text-slate-500">الراتب</div>
                          <div className="font-bold text-green-600">{Number(emp.salary).toFixed(2)} ر.س</div>
                        </div>
                        <Button onClick={() => openPay(emp)} className="bg-green-600 hover:bg-green-700"><Wallet size={16} className="ml-2"/>دفع</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-purple-50">
                <CardTitle>أحدث الدفعات</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {salaries.slice(0,8).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-bold">{p.employeeName}</div>
                        <div className="text-sm text-slate-500">{p.month}</div>
                      </div>
                      <div className="font-bold text-blue-700">{Number(p.totalPaid).toFixed(2)} ر.س</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {showPayForm && (
            <Card className="shadow-lg border-2 border-blue-200 mb-8">
              <CardHeader>
                <CardTitle>دفع راتب - {currentEmp?.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={submitPay} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2">
                    <Label>الشهر</Label>
                    <Input value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} required />
                  </div>
                  <div>
                    <Label>الأساسي</Label>
                    <Input type="number" value={form.basicSalary} onChange={e => setForm({ ...form, basicSalary: e.target.value })} required />
                  </div>
                  <div>
                    <Label>حوافز</Label>
                    <Input type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} />
                  </div>
                  <div>
                    <Label>خصومات</Label>
                    <Input type="number" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} />
                  </div>
                  <div>
                    <Label>سلف</Label>
                    <Input type="number" value={form.advances} onChange={e => setForm({ ...form, advances: e.target.value })} />
                  </div>
                  <div className="md:col-span-6">
                    <Label>ملاحظات</Label>
                    <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <div className="md:col-span-6 flex gap-2">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">حفظ</Button>
                    <Button type="button" variant="outline" onClick={() => { setShowPayForm(false); setCurrentEmp(null); }}>إلغاء</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Payroll;
