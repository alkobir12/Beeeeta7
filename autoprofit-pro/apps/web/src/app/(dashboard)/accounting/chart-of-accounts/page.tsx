'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  FolderTree,
  ChevronDown,
  ChevronRight,
  FileText,
  DollarSign,
  CreditCard,
  Briefcase,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { chartOfAccountsApi, Account } from '@/lib/api';

const accountTypeIcons: Record<string, React.ReactNode> = {
  asset: <DollarSign className="text-green-600" size={18} />,
  liability: <CreditCard className="text-red-600" size={18} />,
  equity: <Briefcase className="text-blue-600" size={18} />,
  revenue: <TrendingUp className="text-purple-600" size={18} />,
  expense: <TrendingDown className="text-orange-600" size={18} />,
};

const accountTypeLabels: Record<string, string> = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
};

const accountTypeColors: Record<string, string> = {
  asset: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  liability: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  equity: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  revenue: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  expense: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['asset', 'liability', 'equity', 'revenue', 'expense']));
  const [seeding, setSeeding] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await chartOfAccountsApi.getAccounts();
      setAccounts(data);
    } catch (err: unknown) {
      console.error('Error fetching accounts:', err);
      setError('تعذر جلب دليل الحسابات');
      // Mock data
      setAccounts([
        { id: '1', code: '1101', name_ar: 'النقدية في الصندوق', account_type: 'asset', category: 'أصول متداولة', balance: 50000, is_active: true },
        { id: '2', code: '1102', name_ar: 'البنك الأهلي', account_type: 'asset', category: 'أصول متداولة', balance: 200000, is_active: true },
        { id: '3', code: '1201', name_ar: 'العملاء', account_type: 'asset', category: 'أصول متداولة', balance: 150000, is_active: true },
        { id: '4', code: '1301', name_ar: 'المخزون', account_type: 'asset', category: 'أصول متداولة', balance: 80000, is_active: true },
        { id: '5', code: '1501', name_ar: 'السيارات والمعدات', account_type: 'asset', category: 'أصول ثابتة', balance: 500000, is_active: true },
        { id: '6', code: '1502', name_ar: 'المباني', account_type: 'asset', category: 'أصول ثابتة', balance: 1000000, is_active: true },
        { id: '7', code: '2101', name_ar: 'الموردين', account_type: 'liability', category: 'خصوم متداولة', balance: 75000, is_active: true },
        { id: '8', code: '2201', name_ar: 'الضرائب المستحقة', account_type: 'liability', category: 'خصوم متداولة', balance: 45000, is_active: true },
        { id: '9', code: '2301', name_ar: 'قرض بنكي', account_type: 'liability', category: 'خصوم طويلة الأجل', balance: 400000, is_active: true },
        { id: '10', code: '3101', name_ar: 'رأس مال المالك', account_type: 'equity', category: 'رأس المال', balance: 1000000, is_active: true },
        { id: '11', code: '3201', name_ar: 'أرباح محتجزة', account_type: 'equity', category: 'أرباح', balance: 460000, is_active: true },
        { id: '12', code: '4101', name_ar: 'إيرادات خدمات الصيانة', account_type: 'revenue', category: 'إيرادات تشغيلية', balance: 450000, is_active: true },
        { id: '13', code: '4102', name_ar: 'إيرادات بيع قطع الغيار', account_type: 'revenue', category: 'إيرادات تشغيلية', balance: 280000, is_active: true },
        { id: '14', code: '5101', name_ar: 'تكلفة قطع الغيار', account_type: 'expense', category: 'تكلفة المبيعات', balance: 180000, is_active: true },
        { id: '15', code: '5201', name_ar: 'رواتب الموظفين', account_type: 'expense', category: 'مصروفات تشغيلية', balance: 180000, is_active: true },
        { id: '16', code: '5202', name_ar: 'إيجار المبنى', account_type: 'expense', category: 'مصروفات تشغيلية', balance: 50000, is_active: true },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSeedAccounts = async () => {
    if (!confirm('سيتم إنشاء دليل الحسابات السعودي الافتراضي. هل تريد المتابعة؟')) return;
    
    setSeeding(true);
    try {
      await chartOfAccountsApi.seedAccounts();
      fetchAccounts();
    } catch (err) {
      console.error('Error seeding accounts:', err);
      alert('حدث خطأ في إنشاء دليل الحسابات');
    } finally {
      setSeeding(false);
    }
  };

  const toggleType = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = !searchQuery || 
      account.code.includes(searchQuery) || 
      account.name_ar.includes(searchQuery);
    
    const matchesType = typeFilter === 'all' || account.account_type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  // Group accounts by type
  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  // Calculate totals by type
  const typeTotals = Object.entries(groupedAccounts).reduce((totals, [type, accs]) => {
    totals[type] = accs.reduce((sum, acc) => sum + acc.balance, 0);
    return totals;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="chart-of-accounts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="text-blue-600" />
            دليل الحسابات
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            إدارة وتنظيم شجرة الحسابات المالية
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <button
            onClick={handleSeedAccounts}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          >
            <FileText size={18} />
            <span>{seeding ? 'جارٍ الإنشاء...' : 'دليل سعودي افتراضي'}</span>
          </button>

          <button
            onClick={fetchAccounts}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={18} />
            <span>حساب جديد</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-600" size={20} />
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">{error} - يتم عرض بيانات تجريبية</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(accountTypeLabels).map(([type, label]) => (
          <div 
            key={type}
            className={`rounded-xl p-4 border cursor-pointer transition-all ${
              typeFilter === type ? 'ring-2 ring-blue-500' : ''
            } ${accountTypeColors[type]}`}
            onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
          >
            <div className="flex items-center gap-2 mb-2">
              {accountTypeIcons[type]}
              <span className="font-medium">{label}</span>
            </div>
            <p className="text-lg font-bold">
              {formatCurrency(typeTotals[type] || 0)}
            </p>
            <p className="text-xs opacity-75">
              {groupedAccounts[type]?.length || 0} حساب
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث بكود الحساب أو الاسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="all">كل الأنواع</option>
            {Object.entries(accountTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts Tree */}
      <div className="space-y-4">
        {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
          <div key={type} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Type Header */}
            <button
              onClick={() => toggleType(type)}
              className={`w-full px-4 py-3 flex items-center justify-between ${accountTypeColors[type]}`}
            >
              <div className="flex items-center gap-3">
                {expandedTypes.has(type) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                {accountTypeIcons[type]}
                <span className="font-bold">{accountTypeLabels[type]}</span>
                <span className="text-sm opacity-75">({typeAccounts.length} حساب)</span>
              </div>
              <span className="font-bold">{formatCurrency(typeTotals[type] || 0)}</span>
            </button>

            {/* Accounts List */}
            {expandedTypes.has(type) && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Group by category */}
                {Object.entries(
                  typeAccounts.reduce((cats, acc) => {
                    if (!cats[acc.category]) cats[acc.category] = [];
                    cats[acc.category].push(acc);
                    return cats;
                  }, {} as Record<string, Account[]>)
                ).map(([category, categoryAccounts]) => (
                  <div key={category}>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-600 dark:text-gray-400">
                      {category}
                    </div>
                    {categoryAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {account.code}
                          </span>
                          <span className="text-gray-900 dark:text-white">{account.name_ar}</span>
                          {!account.is_active && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                              غير نشط
                            </span>
                          )}
                        </div>
                        <span className={`font-medium ${
                          type === 'asset' || type === 'expense' ? 'text-blue-600' : 'text-purple-600'
                        }`}>
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>إجمالي الحسابات: {accounts.length}</span>
        <span>الحسابات المعروضة: {filteredAccounts.length}</span>
      </div>
    </div>
  );
}
