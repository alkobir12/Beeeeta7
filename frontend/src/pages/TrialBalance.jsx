import React, { useState } from 'react';
import { 
  Scale, 
  Download, 
  RefreshCw, 
  Calendar,
  CheckCircle,
  XCircle,
  Search
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Sample Trial Balance Data
const TRIAL_BALANCE_DATA = {
  as_of_date: '2024-12-31',
  accounts: [
    // Assets
    { code: '111', name: 'النقدية والبنوك', type: 'asset', debit: 125000, credit: 0 },
    { code: '112', name: 'الذمم المدينة', type: 'asset', debit: 45000, credit: 0 },
    { code: '113', name: 'المخزون', type: 'asset', debit: 78500, credit: 0 },
    { code: '114', name: 'مصروفات مدفوعة مقدماً', type: 'asset', debit: 12000, credit: 0 },
    { code: '121', name: 'المعدات والأجهزة', type: 'asset', debit: 250000, credit: 0 },
    { code: '122', name: 'الأثاث والتجهيزات', type: 'asset', debit: 35000, credit: 0 },
    { code: '123', name: 'مجمع الإهلاك', type: 'asset', debit: 0, credit: 45000 },
    
    // Liabilities
    { code: '211', name: 'الذمم الدائنة', type: 'liability', debit: 0, credit: 35000 },
    { code: '212', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', debit: 0, credit: 12500 },
    { code: '213', name: 'مصروفات مستحقة', type: 'liability', debit: 0, credit: 8000 },
    { code: '214', name: 'القسط الحالي من القروض', type: 'liability', debit: 0, credit: 24000 },
    { code: '221', name: 'القروض طويلة الأجل', type: 'liability', debit: 0, credit: 76000 },
    { code: '222', name: 'التزامات الإيجار', type: 'liability', debit: 0, credit: 18000 },
    
    // Equity
    { code: '31', name: 'رأس المال', type: 'equity', debit: 0, credit: 200000 },
    { code: '32', name: 'احتياطي نظامي', type: 'equity', debit: 0, credit: 20000 },
    { code: '33', name: 'الأرباح المحتجزة', type: 'equity', debit: 0, credit: 82000 },
    
    // Revenue
    { code: '41', name: 'إيرادات خدمات الصيانة', type: 'revenue', debit: 0, credit: 350000 },
    { code: '42', name: 'إيرادات قطع الغيار', type: 'revenue', debit: 0, credit: 125000 },
    { code: '43', name: 'إيرادات الفحص والتشخيص', type: 'revenue', debit: 0, credit: 45000 },
    { code: '44', name: 'إيرادات متنوعة', type: 'revenue', debit: 0, credit: 8000 },
    
    // Expenses
    { code: '51', name: 'تكلفة قطع الغيار المباعة', type: 'expense', debit: 95000, credit: 0 },
    { code: '52', name: 'تكلفة المواد والمستهلكات', type: 'expense', debit: 35000, credit: 0 },
    { code: '53', name: 'الرواتب والأجور', type: 'expense', debit: 180000, credit: 0 },
    { code: '54', name: 'الإيجار', type: 'expense', debit: 48000, credit: 0 },
    { code: '55', name: 'الكهرباء والماء', type: 'expense', debit: 18000, credit: 0 },
    { code: '56', name: 'صيانة المعدات', type: 'expense', debit: 12000, credit: 0 },
    { code: '57', name: 'التأمينات', type: 'expense', debit: 8000, credit: 0 },
    { code: '58', name: 'الاستهلاك', type: 'expense', debit: 25000, credit: 0 },
    { code: '61', name: 'مصاريف إدارية', type: 'expense', debit: 15000, credit: 0 },
    { code: '62', name: 'مصاريف تسويق', type: 'expense', debit: 12000, credit: 0 },
    { code: '63', name: 'مصاريف اتصالات', type: 'expense', debit: 6000, credit: 0 },
    { code: '71', name: 'فوائد القروض', type: 'expense', debit: 9000, credit: 0 },
    { code: '72', name: 'رسوم بنكية', type: 'expense', debit: 2000, credit: 0 },
  ],
};

export default function TrialBalance() {
  const [data] = useState(TRIAL_BALANCE_DATA);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Calculate totals
  const totalDebit = data.accounts.reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredit = data.accounts.reduce((sum, acc) => sum + acc.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Filter accounts
  const filteredAccounts = data.accounts.filter(acc => {
    if (filterType !== 'all' && acc.type !== filterType) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return acc.name.toLowerCase().includes(query) || acc.code.includes(query);
  });

  const getTypeLabel = (type) => {
    const labels = {
      asset: 'أصول',
      liability: 'التزامات',
      equity: 'حقوق ملكية',
      revenue: 'إيرادات',
      expense: 'مصروفات',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      asset: 'text-blue-400',
      liability: 'text-red-400',
      equity: 'text-purple-400',
      revenue: 'text-green-400',
      expense: 'text-orange-400',
    };
    return colors[type] || 'text-gray-400';
  };

  return (
    <div className="p-6 space-y-6" data-testid="trial-balance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="text-blue-500" />
            ميزان المراجعة
          </h1>
          <p className="text-gray-400">التحقق من توازن الحسابات المحاسبية</p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
            <Calendar size={18} className="text-gray-400" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-transparent text-white border-0 outline-none"
            />
          </div>
          <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors">
            <Download size={20} className="text-gray-400" />
          </button>
          <button 
            onClick={() => setLoading(true)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
          >
            <RefreshCw size={20} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`rounded-xl p-4 flex items-center justify-between ${isBalanced ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <>
              <div className="p-2 bg-green-900/50 rounded-full">
                <CheckCircle className="text-green-400" size={24} />
              </div>
              <div>
                <p className="font-bold text-green-400">ميزان المراجعة متوازن ✓</p>
                <p className="text-sm text-green-300/70">إجمالي المدين = إجمالي الدائن</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-red-900/50 rounded-full">
                <XCircle className="text-red-400" size={24} />
              </div>
              <div>
                <p className="font-bold text-red-400">ميزان المراجعة غير متوازن!</p>
                <p className="text-sm text-red-300/70">الفرق: {formatCurrency(Math.abs(totalDebit - totalCredit))}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm opacity-80">إجمالي المدين</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalDebit)}</p>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm opacity-80">إجمالي الدائن</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalCredit)}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">عدد الحسابات</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.accounts.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الحساب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              data-testid="search-trial-balance"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'asset', 'liability', 'equity', 'revenue', 'expense'].map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterType(filter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterType === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {filter === 'all' ? 'الكل' : getTypeLabel(filter)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">رمز الحساب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">اسم الحساب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">النوع</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-green-400">مدين</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-red-400">دائن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredAccounts.map((account, idx) => (
                <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-gray-400">{account.code}</span>
                  </td>
                  <td className="px-4 py-3 text-white">{account.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${getTypeColor(account.type)}`}>
                      {getTypeLabel(account.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    {account.debit > 0 ? (
                      <span className="font-mono text-green-400">{formatCurrency(account.debit)}</span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left">
                    {account.credit > 0 ? (
                      <span className="font-mono text-red-400">{formatCurrency(account.credit)}</span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-700">
              <tr className="font-bold">
                <td colSpan="3" className="px-4 py-4 text-white">الإجمالي</td>
                <td className="px-4 py-4 text-left text-green-400">{formatCurrency(totalDebit)}</td>
                <td className="px-4 py-4 text-left text-red-400">{formatCurrency(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary by Type */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['asset', 'liability', 'equity', 'revenue', 'expense'].map((type) => {
          const typeAccounts = data.accounts.filter(a => a.type === type);
          const typeDebit = typeAccounts.reduce((sum, a) => sum + a.debit, 0);
          const typeCredit = typeAccounts.reduce((sum, a) => sum + a.credit, 0);
          const netBalance = typeDebit - typeCredit;
          
          return (
            <div key={type} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className={`text-sm ${getTypeColor(type)} mb-2`}>{getTypeLabel(type)}</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(Math.abs(netBalance))}
              </p>
              <p className="text-xs text-gray-500">
                {typeAccounts.length} حساب
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
