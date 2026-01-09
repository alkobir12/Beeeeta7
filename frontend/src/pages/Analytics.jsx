import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, Car, Calendar, ArrowRight, BarChart3 } from 'lucide-react';
import { statsAPI, transactionAPI, vehicleAPI } from '../services/api';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';

const Analytics = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState({ transactions: [], summary: { income: 0, expenses: 0, profit: 0 } });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, transRes, vehiclesRes] = await Promise.all([
        statsAPI.getStats(),
        transactionAPI.getAll(),
        vehicleAPI.getAll()
      ]);
      setStats(statsRes.data);
      // Handle transactions - API returns array directly
      const transData = Array.isArray(transRes.data) ? transRes.data : [];
      setTransactions({ 
        transactions: transData, 
        summary: { 
          income: transData.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0),
          expenses: transData.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0),
          profit: 0
        } 
      });
      setVehicles(vehiclesRes.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      
    );
  }

  const cashFlow = stats.thisMonth.income - stats.thisMonth.expenses;
  const statusData = [
    { name: 'تشخيص', value: vehicles.filter(v => v.status === 'diagnosis').length, color: '#3b82f6' },
    { name: 'تعميد', value: vehicles.filter(v => v.status === 'quotation').length, color: '#f59e0b' },
    { name: 'إصلاح', value: vehicles.filter(v => v.status === 'repair').length, color: '#ef4444' },
    { name: 'جاهز', value: vehicles.filter(v => v.status === 'ready').length, color: '#10b981' },
  ];
  const financialData = [
    { name: 'المبيعات', amount: stats.thisMonth.income },
    { name: 'المصروفات', amount: stats.thisMonth.expenses },
    { name: 'الربح', amount: stats.thisMonth.profit },
  ];
  const recentTrans = transactions.transactions.slice(0, 7).reverse();
  const transChartData = recentTrans.map(t => ({
    date: new Date(t.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
    income: t.type === 'income' ? t.amount : 0,
    expense: t.type === 'expense' ? t.amount : 0,
  }));

  return (
    
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">التحليلات</h1>
            <p className="text-gray-500 mt-1">نظرة شاملة على أداء الورشة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="apple-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">المبيعات (شهري)</p>
                <p className="text-2xl font-bold text-green-600">{stats.thisMonth.income.toLocaleString()} ر.س</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <DollarSign size={20} />
              </div>
            </div>
          </div>
          <div className="apple-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">المصروفات (شهري)</p>
                <p className="text-2xl font-bold text-red-600">{stats.thisMonth.expenses.toLocaleString()} ر.س</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <ShoppingCart size={20} />
              </div>
            </div>
          </div>
          <div className="apple-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">صافي الربح</p>
                <p className="text-2xl font-bold text-blue-600">{stats.thisMonth.profit.toLocaleString()} ر.س</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>
          <div className="apple-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">السيولة النقدية</p>
                <p className="text-2xl font-bold text-purple-600">{cashFlow.toLocaleString()} ر.س</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                <Wallet size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="apple-card p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">توزيع المركبات</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="apple-card p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">نظرة مالية</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="apple-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">آخر المعاملات</h3>
            <button className="text-sm text-blue-600 hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {transactions.transactions.slice(0, 5).map((t, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t.description}</p>
                    <p className="text-xs text-gray-500">{t.category}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString('ar-SA')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    
  );
};

export default Analytics;
