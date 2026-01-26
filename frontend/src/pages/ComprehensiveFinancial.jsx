import React, { useState, useEffect } from 'react';
import { Scale, TrendingUp, Banknote, BarChart3, RefreshCw, Calendar, Download } from 'lucide-react';
import FinancialCard from '../components/FinancialCard';
import { financeAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useTheme } from '../contexts/ThemeContext';

const ComprehensiveFinancial = () => {
  const { themeName } = useTheme();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('balance');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);

  const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';

  useEffect(() => {
    fetchAllData();
  }, [startDate, endDate]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [bsRes, isRes, cfRes, tbRes] = await Promise.all([
        financeAPI.getBalanceSheet({ workshop_id: workshopId }),
        financeAPI.getIncomeStatement({ 
          workshop_id: workshopId, 
          start_date: startDate, 
          end_date: endDate 
        }),
        financeAPI.getCashFlow({ 
          workshop_id: workshopId, 
          start_date: startDate, 
          end_date: endDate 
        }),
        financeAPI.getTrialBalance({ workshop_id: workshopId })
      ]);

      setBalanceSheet(bsRes.data?.data || null);
      setIncomeStatement(isRes.data?.data || null);
      setCashFlow(cfRes.data?.data || null);
      
      // Trial Balance من تقرير ميزان المراجعة الحقيقي
      const tbData = tbRes.data?.data || tbRes.data || {};
      setTrialBalance(tbData.accounts || []);
      
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const bsTotals = balanceSheet?.totals || { assets: 0, liabilities: 0, equity: 0 };
  const isTotals = incomeStatement?.totals || { revenue: 0, expenses: 0, net_income: 0 };
  const cfData = cashFlow || {};
  
  const isBalanced = Math.abs(bsTotals.assets - (bsTotals.liabilities + bsTotals.equity)) < 0.01;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl" style={{
      backgroundColor: 'var(--bg-primary)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <Scale size={32} className="text-blue-500" />
            القوائم المالية الشاملة
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            الميزانية، الدخل، التدفقات، وميزان المراجعة في مكان واحد
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)'
          }}>
            <Calendar size={18} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-0 outline-none text-sm w-32"
              style={{ color: 'var(--text-primary)' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-0 outline-none text-sm w-32"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={fetchAllData}
            className="p-2.5 rounded-lg transition-colors flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            <RefreshCw size={18} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'balance', label: 'الميزانية العمومية', icon: Scale },
          { key: 'income', label: 'قائمة الدخل', icon: TrendingUp },
          { key: 'cashflow', label: 'التدفقات النقدية', icon: Banknote },
          { key: 'trial', label: 'ميزان المراجعة', icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key 
                ? 'bg-blue-600 text-white shadow-lg' 
                : ''
            }`}
            style={activeTab !== tab.key ? {
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)'
            } : {}}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Balance Sheet Tab */}
      {activeTab === 'balance' && (
        <div className="space-y-6">
          {/* Balance Check */}
          <FinancialCard
            title={isBalanced ? 'الميزانية متوازنة ✓' : 'الميزانية غير متوازنة'}
            subtitle="معادلة الميزانية"
            icon={Scale}
            variant={isBalanced ? 'success' : 'danger'}
            expandable={false}
            details={[
              { label: 'الأصول', value: formatCurrency(bsTotals.assets) },
              { label: 'الخصوم + حقوق الملكية', value: formatCurrency(bsTotals.liabilities + bsTotals.equity) },
              { label: 'الفرق', value: formatCurrency(Math.abs(bsTotals.assets - (bsTotals.liabilities + bsTotals.equity))), valueColor: isBalanced ? 'text-emerald-400' : 'text-red-400' }
            ]}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FinancialCard
              title={formatCurrency(bsTotals.assets)}
              subtitle="إجمالي الأصول"
              icon={Scale}
              variant="default"
              details={
                balanceSheet?.sections?.assets?.slice(0, 5).map(acc => ({
                  label: acc.name,
                  value: formatCurrency(acc.balance)
                })) || []
              }
            />

            <FinancialCard
              title={formatCurrency(bsTotals.liabilities)}
              subtitle="إجمالي الخصوم"
              icon={TrendingUp}
              variant="warning"
              details={
                balanceSheet?.sections?.liabilities?.slice(0, 5).map(acc => ({
                  label: acc.name,
                  value: formatCurrency(acc.balance),
                  valueColor: 'text-red-400'
                })) || []
              }
            />

            <FinancialCard
              title={formatCurrency(bsTotals.equity)}
              subtitle="حقوق الملكية"
              icon={Banknote}
              variant="success"
              details={
                balanceSheet?.sections?.equity?.slice(0, 5).map(acc => ({
                  label: acc.name,
                  value: formatCurrency(acc.balance),
                  valueColor: 'text-emerald-400'
                })) || []
              }
            />
          </div>
        </div>
      )}

      {/* Income Statement Tab */}
      {activeTab === 'income' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FinancialCard
            title={formatCurrency(isTotals.revenue)}
            subtitle="إجمالي الإيرادات"
            icon={TrendingUp}
            trend="up"
            trendValue="+15%"
            variant="success"
            details={
              Object.entries(incomeStatement?.details?.revenue_by_account || {}).slice(0, 4).map(([code, data]) => ({
                label: data.name || `حساب ${code}`,
                value: formatCurrency(data.amount || 0)
              }))
            }
          />

          <FinancialCard
            title={formatCurrency(isTotals.expenses)}
            subtitle="إجمالي المصروفات"
            icon={TrendingUp}
            trend="down"
            variant="warning"
            details={
              Object.entries(incomeStatement?.details?.expenses_by_account || {}).slice(0, 4).map(([code, data]) => ({
                label: data.name || `حساب ${code}`,
                value: formatCurrency(data.amount || 0),
                valueColor: 'text-red-400'
              }))
            }
          />

          <FinancialCard
            title={formatCurrency(isTotals.net_income)}
            subtitle="صافي الدخل"
            icon={TrendingUp}
            trend={isTotals.net_income >= 0 ? 'up' : 'down'}
            variant={isTotals.net_income >= 0 ? 'success' : 'danger'}
            details={[
              { label: 'الإيرادات', value: formatCurrency(isTotals.revenue) },
              { label: 'المصروفات', value: formatCurrency(isTotals.expenses), valueColor: 'text-red-400' },
              { label: 'صافي الدخل', value: formatCurrency(isTotals.net_income), valueColor: isTotals.net_income >= 0 ? 'text-emerald-400' : 'text-red-400' }
            ]}
          />

          <FinancialCard
            title={`${isTotals.revenue > 0 ? ((isTotals.net_income / isTotals.revenue) * 100).toFixed(1) : '0'}%`}
            subtitle="هامش الربح الصافي"
            icon={BarChart3}
            variant={isTotals.revenue > 0 && (isTotals.net_income / isTotals.revenue) > 0.2 ? 'success' : 'warning'}
            expandable={false}
          />
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FinancialCard
            title={formatCurrency(cfData.operating_activities?.net_operating_cash || 0)}
            subtitle="الأنشطة التشغيلية"
            icon={Banknote}
            trend={(cfData.operating_activities?.net_operating_cash || 0) >= 0 ? 'up' : 'down'}
            variant={(cfData.operating_activities?.net_operating_cash || 0) >= 0 ? 'success' : 'danger'}
            details={[
              { label: 'النقد من العملاء', value: formatCurrency(cfData.operating_activities?.cash_from_customers || 0) },
              { label: 'النقد للموردين', value: formatCurrency(cfData.operating_activities?.cash_to_suppliers || 0), valueColor: 'text-red-400' }
            ]}
          />

          <FinancialCard
            title={formatCurrency(cfData.investing_activities?.net_investing_cash || 0)}
            subtitle="الأنشطة الاستثمارية"
            icon={TrendingUp}
            variant="default"
            details={[
              { label: 'شراء معدات', value: formatCurrency(cfData.investing_activities?.equipment_purchases || 0), valueColor: 'text-red-400' }
            ]}
          />

          <FinancialCard
            title={formatCurrency(cfData.financing_activities?.net_financing_cash || 0)}
            subtitle="الأنشطة التمويلية"
            icon={Banknote}
            variant="warning"
            details={[
              { label: 'قروض جديدة', value: formatCurrency(cfData.financing_activities?.new_loans || 0), valueColor: 'text-emerald-400' }
            ]}
          />

          <FinancialCard
            title={formatCurrency(cfData.ending_cash || 0)}
            subtitle="رصيد النقد النهائي"
            icon={Banknote}
            variant="success"
            details={[
              { label: 'رصيد البداية', value: formatCurrency(cfData.beginning_cash || 0) },
              { label: 'صافي التغير', value: formatCurrency(cfData.net_change_in_cash || 0), valueColor: (cfData.net_change_in_cash || 0) >= 0 ? 'text-emerald-400' : 'text-red-400' }
            ]}
          />
        </div>
      )}

      {/* Trial Balance Tab */}
      {activeTab === 'trial' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            ميزان المراجعة
          </h2>
          
          {trialBalance && trialBalance.length > 0 ? (
            <div className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-500 to-indigo-600">
                    <tr>
                      <th className="px-4 py-3 text-right text-white font-semibold">رمز الحساب</th>
                      <th className="px-4 py-3 text-right text-white font-semibold">اسم الحساب</th>
                      <th className="px-4 py-3 text-right text-white font-semibold">مدين</th>
                      <th className="px-4 py-3 text-right text-white font-semibold">دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.map((account, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50/5" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {account.code}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {account.name || account.name_ar}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {account.type === 'asset' ? 'أصول' : 
                           account.type === 'liability' ? 'خصوم' :
                           account.type === 'equity' ? 'حقوق ملكية' :
                           account.type === 'revenue' ? 'إيرادات' : 'مصروفات'}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold" style={{ 
                          color: account.balance >= 0 ? 'var(--text-primary)' : '#ef4444'
                        }}>
                          {formatCurrency(Math.abs(account.balance || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900/20 font-bold">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right" style={{ color: 'var(--text-primary)' }}>
                        الإجمالي
                      </td>
                      <td className="px-4 py-3 font-mono text-lg" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(trialBalance.reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto mb-4 text-slate-400" />
              <p style={{ color: 'var(--text-secondary)' }}>لا توجد حسابات في ميزان المراجعة</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComprehensiveFinancial;
