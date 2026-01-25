import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Search, RefreshCw, Download, Filter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const GeneralLedger = () => {
  const { themeName } = useTheme();
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchLedger();
  }, [selectedAccount, startDate, endDate]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
      
      // جلب القيود
      const response = await fetch(
        `${API_URL}/finance/journal-entries?workshop_id=${workshopId}&start_date=${startDate}&end_date=${endDate}&limit=1000`
      );
      const data = await response.json();
      
      // تحويل القيود إلى دفتر أستاذ (تجميع حسب الحساب)
      const ledger = {};
      const entries = data.data || [];
      
      entries.forEach(entry => {
        const lines = entry.lines || [];
        lines.forEach(line => {
          const accountCode = line.account || line.account_code;
          const accountName = line.account_name || '';
          
          if (!ledger[accountCode]) {
            ledger[accountCode] = {
              code: accountCode,
              name: accountName,
              transactions: [],
              balance: 0
            };
          }
          
          ledger[accountCode].transactions.push({
            date: entry.date,
            description: entry.description,
            debit: line.debit || 0,
            credit: line.credit || 0,
            source: entry.source
          });
          
          ledger[accountCode].balance += (line.debit || 0) - (line.credit || 0);
        });
      });
      
      setLedgerData(Object.values(ledger));
    } catch (error) {
      console.error('Error fetching ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = selectedAccount === 'all' 
    ? ledgerData 
    : ledgerData.filter(acc => acc.code === selectedAccount);

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
            <BookOpen size={32} className="text-indigo-500" />
            دفتر الأستاذ العام
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            حركة الحسابات من {startDate} إلى {endDate}
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
            onClick={fetchLedger}
            className="p-2.5 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)'
            }}
          >
            <RefreshCw size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Accounts List */}
      <div className="space-y-6">
        {filteredData.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              لا يوجد حركات في دفتر الأستاذ
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              لم يتم العثور على أي حركات في الفترة المحددة
            </p>
          </div>
        ) : (
          filteredData.map((account) => (
            <div
              key={account.code}
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}
            >
              {/* Account Header */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">{account.name}</h3>
                    <p className="text-indigo-100 text-sm">حساب رقم: {account.code}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-indigo-200">الرصيد</p>
                    <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {account.balance.toLocaleString('ar-SA')} ر.س
                    </p>
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>التاريخ</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>البيان</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>مدين</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>دائن</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.transactions.map((trans, idx) => {
                        const runningBalance = account.transactions
                          .slice(0, idx + 1)
                          .reduce((sum, t) => sum + (t.debit - t.credit), 0);
                        
                        return (
                          <tr key={idx} className="border-b hover:bg-slate-50/5" style={{ borderColor: 'var(--border-color)' }}>
                            <td className="py-3 px-2" style={{ color: 'var(--text-secondary)' }}>
                              {new Date(trans.date).toLocaleDateString('ar-SA')}
                            </td>
                            <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                              {trans.description}
                            </td>
                            <td className="py-3 px-2 font-mono text-emerald-400">
                              {trans.debit > 0 ? trans.debit.toLocaleString('ar-SA') : '-'}
                            </td>
                            <td className="py-3 px-2 font-mono text-red-400">
                              {trans.credit > 0 ? trans.credit.toLocaleString('ar-SA') : '-'}
                            </td>
                            <td className="py-3 px-2 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                              {runningBalance.toLocaleString('ar-SA')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--border-color)' }}>
                        <td colSpan="2" className="py-3 px-2 text-right" style={{ color: 'var(--text-primary)' }}>
                          الإجمالي
                        </td>
                        <td className="py-3 px-2 font-mono text-emerald-400">
                          {account.transactions.reduce((sum, t) => sum + t.debit, 0).toLocaleString('ar-SA')}
                        </td>
                        <td className="py-3 px-2 font-mono text-red-400">
                          {account.transactions.reduce((sum, t) => sum + t.credit, 0).toLocaleString('ar-SA')}
                        </td>
                        <td className="py-3 px-2 font-mono text-xl" style={{ color: 'var(--text-primary)' }}>
                          {account.balance.toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GeneralLedger;
