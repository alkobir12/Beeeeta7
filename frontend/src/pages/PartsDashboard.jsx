import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getMonthLabel = (date) => date.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });

const PartsDashboard = () => {
  const [operations, setOperations] = useState([]);
  const [parts, setParts] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [opsRes, partsRes] = await Promise.all([
          axios.get(`${API_URL}/operations`),
          axios.get(`${API_URL}/parts`)
        ]);
        setOperations(opsRes.data || []);
        setParts(partsRes.data || []);
      } catch (error) {
        setOperations([]);
        setParts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const partOperations = useMemo(() => {
    return operations.filter(op => (op.items || []).some(item => item.itemType === 'part' || item.type === 'part'));
  }, [operations]);

  const filteredOperations = useMemo(() => {
    return partOperations.filter(op => {
      if (typeFilter !== 'all' && op.type !== typeFilter) return false;
      if (scopeFilter !== 'all' && op.scope !== scopeFilter) return false;
      return true;
    });
  }, [partOperations, typeFilter, scopeFilter]);

  const totals = useMemo(() => {
    const sales = partOperations.filter(op => op.type === 'sale');
    const purchases = partOperations.filter(op => op.type === 'purchase');
    const totalSales = sales.reduce((sum, op) => sum + Number(op.total || 0), 0);
    const totalPurchases = purchases.reduce((sum, op) => sum + Number(op.total || 0), 0);
    const openInvoices = sales.filter(op => op.paymentMethod === 'credit').length;
    const pendingOrders = purchases.filter(op => op.paymentMethod === 'credit').length;
    return { totalSales, totalPurchases, openInvoices, pendingOrders };
  }, [partOperations]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - idx, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: getMonthLabel(date),
        sales: 0,
        purchases: 0,
      };
    }).reverse();

    partOperations.forEach(op => {
      if (!op.date) return;
      const date = new Date(op.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = months.find(m => m.key === key);
      if (!bucket) return;
      if (op.type === 'sale') bucket.sales += Number(op.total || 0);
      if (op.type === 'purchase') bucket.purchases += Number(op.total || 0);
    });

    return months;
  }, [partOperations]);

  if (loading) {
    return (
      <div className="p-8 text-slate-300" data-testid="parts-dashboard-loading">جارٍ التحميل...</div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="parts-dashboard-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">لوحة تحكم القطع</h1>
          <p className="text-slate-400">عرض عمليات البيع والشراء والطلبات المرتبطة بالقطع</p>
        </div>
        <div className="flex gap-3">
          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            data-testid="parts-dashboard-type-filter"
          >
            <option value="all">كل العمليات</option>
            <option value="sale">مبيعات قطع</option>
            <option value="purchase">مشتريات قطع</option>
          </select>
          <select
            className="filter-select"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            data-testid="parts-dashboard-scope-filter"
          >
            <option value="all">كل النطاقات</option>
            <option value="vehicle">مركبة</option>
            <option value="workshop">ورشة</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#33b5e5' }}>
          <p className="text-sm text-slate-300">إجمالي المبيعات</p>
          <p className="text-2xl font-bold text-white" data-testid="parts-dashboard-total-sales">{totals.totalSales.toLocaleString()} ر.س</p>
        </div>
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ff8800' }}>
          <p className="text-sm text-slate-300">إجمالي المشتريات</p>
          <p className="text-2xl font-bold text-white" data-testid="parts-dashboard-total-purchases">{totals.totalPurchases.toLocaleString()} ر.س</p>
        </div>
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ffbb33' }}>
          <p className="text-sm text-slate-300">فواتير مفتوحة</p>
          <p className="text-2xl font-bold text-white" data-testid="parts-dashboard-open-invoices">{totals.openInvoices}</p>
        </div>
        <div className="glass-card p-5 border-t-4" style={{ borderColor: '#ff4444' }}>
          <p className="text-sm text-slate-300">طلبات شراء معلقة</p>
          <p className="text-2xl font-bold text-white" data-testid="parts-dashboard-pending-orders">{totals.pendingOrders}</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold text-white mb-3">تحليل المبيعات والمشتريات (آخر 6 أشهر)</h2>
        <div className="space-y-3">
          {monthlyTrend.map(month => (
            <div key={month.key} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
              <div className="text-slate-300">{month.label}</div>
              <div className="md:col-span-3">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div className="h-full" style={{ width: `${Math.min((month.sales / (totals.totalSales || 1)) * 100, 100)}%`, background: '#33b5e5' }} />
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${Math.min((month.purchases / (totals.totalPurchases || 1)) * 100, 100)}%`, background: '#ff8800' }} />
                </div>
                <div className="text-xs text-slate-400 mt-1">مبيعات: {month.sales.toLocaleString()} ر.س | مشتريات: {month.purchases.toLocaleString()} ر.س</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold text-white mb-3">آخر عمليات القطع</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm text-right">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">التاريخ</th>
                <th className="py-2">النوع</th>
                <th className="py-2">النطاق</th>
                <th className="py-2">الطرف</th>
                <th className="py-2">الإجمالي</th>
                <th className="py-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map(op => (
                <tr key={op.id} className="border-t border-white/10 text-slate-200" data-testid={`parts-dashboard-operation-${op.id}`}>
                  <td className="py-2">{op.date || op.createdAt || '-'}</td>
                  <td className="py-2">{op.type === 'sale' ? 'بيع' : op.type === 'purchase' ? 'شراء' : op.type}</td>
                  <td className="py-2">{op.scope === 'vehicle' ? 'مركبة' : 'ورشة'}</td>
                  <td className="py-2">{op.partnerName || '-'}</td>
                  <td className="py-2">{Number(op.total || 0).toLocaleString()} ر.س</td>
                  <td className="py-2">
                    <span className="px-2 py-1 rounded-full text-xs" style={{
                      background: op.paymentMethod === 'credit' ? '#ffbb3320' : '#00C85120',
                      color: op.paymentMethod === 'credit' ? '#ffbb33' : '#00C851'
                    }}>
                      {op.paymentMethod === 'credit' ? 'بانتظار الدفع' : 'مدفوع'}
                    </span>
                  </td>
                </tr>
              ))}
              {!filteredOperations.length && (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-slate-400">لا توجد عمليات</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PartsDashboard;