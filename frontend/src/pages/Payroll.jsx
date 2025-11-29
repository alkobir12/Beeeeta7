import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Users, Wallet, Plus } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Payroll = () => {
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentEmp, setCurrentEmp] = useState(null);
  const [form, setForm] = useState({ month: '', basicSalary: '', bonus: 0, deductions: 0, advances: 0, notes: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [empRes, salRes] = await Promise.all([
        axios.get(`${API_URL}/employees`, { params: { active_only: true } }),
        axios.get(`${API_URL}/salaries`)
      ]);
      setEmployees(empRes.data || []);
      setSalaries(salRes.data || []);
    } finally { setLoading(false); }
  };

  const openPay = (emp) => {
    setCurrentEmp(emp);
    setForm({ month: new Date().toISOString().slice(0,7), basicSalary: emp.salary, bonus: 0, deductions: 0, advances: 0, notes: '' });
    setShowModal(true);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    const totalPaid = Number(form.basicSalary) + Number(form.bonus) - Number(form.deductions) - Number(form.advances);
    await axios.post(`${API_URL}/salaries`, { 
      employeeId: currentEmp.id, employeeName: currentEmp.name, ...form, 
      basicSalary: Number(form.basicSalary), bonus: Number(form.bonus), 
      deductions: Number(form.deductions), advances: Number(form.advances), totalPaid 
    });
    setShowModal(false);
    setCurrentEmp(null);
    await load();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الرواتب</h1>
            <p className="text-gray-500 mt-1">إدارة مسيرات الرواتب والموظفين</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <Users size={20} />
              <h3 className="font-bold text-gray-900">الموظفون</h3>
            </div>
            <div className="space-y-3">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-bold text-gray-900">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.role}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{Number(emp.salary).toLocaleString()} ر.س</span>
                    <button onClick={() => openPay(emp)} className="apple-button-secondary text-xs h-8 px-3">دفع</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-purple-600">
              <Wallet size={20} />
              <h3 className="font-bold text-gray-900">آخر الدفعات</h3>
            </div>
            <div className="space-y-3">
              {salaries.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="font-medium text-gray-900">{p.employeeName}</div>
                    <div className="text-xs text-gray-400">{p.month}</div>
                  </div>
                  <div className="font-bold text-green-600">{Number(p.totalPaid).toLocaleString()} ر.س</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95">
              <h2 className="text-xl font-bold mb-6">دفع راتب - {currentEmp?.name}</h2>
              <form onSubmit={submitPay} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500 block mb-1">الشهر</label><input className="apple-input" value={form.month} onChange={e => setForm({...form, month: e.target.value})} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">الأساسي</label><input type="number" className="apple-input" value={form.basicSalary} onChange={e => setForm({...form, basicSalary: e.target.value})} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">حوافز</label><input type="number" className="apple-input" value={form.bonus} onChange={e => setForm({...form, bonus: e.target.value})} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">خصومات</label><input type="number" className="apple-input" value={form.deductions} onChange={e => setForm({...form, deductions: e.target.value})} /></div>
                </div>
                <div><label className="text-xs text-gray-500 block mb-1">ملاحظات</label><input className="apple-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 apple-button-secondary">إلغاء</button>
                  <button type="submit" className="flex-1 apple-button">تأكيد الدفع</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Payroll;
