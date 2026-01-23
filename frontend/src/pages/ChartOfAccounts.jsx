import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Plus, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Default Saudi Chart of Accounts
const DEFAULT_ACCOUNTS = [
  // الأصول
  { id: '1', code: '1', name_ar: 'الأصول', type: 'asset', category: null, parent_id: null, current_balance: 0, isExpanded: true },
  { id: '11', code: '11', name_ar: 'الأصول المتداولة', type: 'asset', category: 'current', parent_id: '1', current_balance: 0 },
  { id: '111', code: '111', name_ar: 'النقدية والبنوك', type: 'asset', category: 'cash', parent_id: '11', current_balance: 125000 },
  { id: '112', code: '112', name_ar: 'الذمم المدينة', type: 'asset', category: 'receivable', parent_id: '11', current_balance: 45000 },
  { id: '113', code: '113', name_ar: 'المخزون', type: 'asset', category: 'inventory', parent_id: '11', current_balance: 78500 },
  { id: '12', code: '12', name_ar: 'الأصول الثابتة', type: 'asset', category: 'fixed', parent_id: '1', current_balance: 0 },
  { id: '121', code: '121', name_ar: 'المعدات والأجهزة', type: 'asset', category: 'equipment', parent_id: '12', current_balance: 250000 },
  { id: '122', code: '122', name_ar: 'مجمع الإهلاك', type: 'asset', category: 'depreciation', parent_id: '12', current_balance: -45000 },
  
  // الالتزامات
  { id: '2', code: '2', name_ar: 'الالتزامات', type: 'liability', category: null, parent_id: null, current_balance: 0, isExpanded: true },
  { id: '21', code: '21', name_ar: 'الالتزامات المتداولة', type: 'liability', category: 'current', parent_id: '2', current_balance: 0 },
  { id: '211', code: '211', name_ar: 'الذمم الدائنة', type: 'liability', category: 'payable', parent_id: '21', current_balance: 35000 },
  { id: '212', code: '212', name_ar: 'ضريبة القيمة المضافة المستحقة', type: 'liability', category: 'vat', parent_id: '21', current_balance: 12500 },
  { id: '22', code: '22', name_ar: 'الالتزامات طويلة الأجل', type: 'liability', category: 'long_term', parent_id: '2', current_balance: 0 },
  { id: '221', code: '221', name_ar: 'القروض طويلة الأجل', type: 'liability', category: 'loans', parent_id: '22', current_balance: 100000 },
  
  // حقوق الملكية
  { id: '3', code: '3', name_ar: 'حقوق الملكية', type: 'equity', category: null, parent_id: null, current_balance: 0, isExpanded: true },
  { id: '31', code: '31', name_ar: 'رأس المال', type: 'equity', category: 'capital', parent_id: '3', current_balance: 200000 },
  { id: '32', code: '32', name_ar: 'الأرباح المحتجزة', type: 'equity', category: 'retained', parent_id: '3', current_balance: 106000 },
  
  // الإيرادات
  { id: '4', code: '4', name_ar: 'الإيرادات', type: 'revenue', category: null, parent_id: null, current_balance: 0, isExpanded: true },
  { id: '41', code: '41', name_ar: 'إيرادات الخدمات', type: 'revenue', category: 'services', parent_id: '4', current_balance: 350000 },
  { id: '42', code: '42', name_ar: 'إيرادات قطع الغيار', type: 'revenue', category: 'parts', parent_id: '4', current_balance: 125000 },
  
  // المصروفات
  { id: '5', code: '5', name_ar: 'المصروفات', type: 'expense', category: null, parent_id: null, current_balance: 0, isExpanded: true },
  { id: '51', code: '51', name_ar: 'تكلفة المبيعات', type: 'expense', category: 'cogs', parent_id: '5', current_balance: 180000 },
  { id: '52', code: '52', name_ar: 'الرواتب والأجور', type: 'expense', category: 'salaries', parent_id: '5', current_balance: 95000 },
  { id: '53', code: '53', name_ar: 'الإيجار', type: 'expense', category: 'rent', parent_id: '5', current_balance: 48000 },
  { id: '54', code: '54', name_ar: 'المصاريف الإدارية', type: 'expense', category: 'admin', parent_id: '5', current_balance: 22000 },
];

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState(['1', '2', '3', '4', '5']);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);

  const getAccountTypeInfo = (type) => {
    const types = {
      asset: { label: 'أصول', color: 'text-blue-400', bgColor: 'bg-blue-900/30', icon: Wallet },
      liability: { label: 'التزامات', color: 'text-red-400', bgColor: 'bg-red-900/30', icon: TrendingDown },
      equity: { label: 'حقوق ملكية', color: 'text-purple-400', bgColor: 'bg-purple-900/30', icon: DollarSign },
      revenue: { label: 'إيرادات', color: 'text-green-400', bgColor: 'bg-green-900/30', icon: TrendingUp },
      expense: { label: 'مصروفات', color: 'text-orange-400', bgColor: 'bg-orange-900/30', icon: TrendingDown },
    };
    return types[type] || types.asset;
  };

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const getChildren = (parentId) => {
    return accounts.filter(acc => acc.parent_id === parentId);
  };

  const hasChildren = (accountId) => {
    return accounts.some(acc => acc.parent_id === accountId);
  };

  const filteredAccounts = accounts.filter(acc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return acc.name_ar.toLowerCase().includes(query) || acc.code.includes(query);
  });

  const renderAccount = (account, level = 0) => {
    const children = getChildren(account.id);
    const isExpanded = expandedAccounts.includes(account.id);
    const typeInfo = getAccountTypeInfo(account.type);
    const TypeIcon = typeInfo.icon;

    // Skip if not matching search and no children match
    if (searchQuery && !filteredAccounts.find(a => a.id === account.id)) {
      const hasMatchingChild = children.some(child => 
        filteredAccounts.find(a => a.id === child.id)
      );
      if (!hasMatchingChild) return null;
    }

    return (
      <div key={account.id}>
        <div 
          className={`flex items-center gap-3 py-3 px-4 hover:bg-gray-700/30 transition-colors border-b border-gray-700/50 ${level > 0 ? 'bg-gray-800/30' : ''}`}
          style={{ paddingRight: `${level * 24 + 16}px` }}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleExpand(account.id)}
            className={`p-1 rounded transition-colors ${hasChildren(account.id) ? 'hover:bg-gray-600' : 'invisible'}`}
          >
            {isExpanded ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
          </button>

          {/* Account Code */}
          <span className="font-mono text-sm text-gray-500 w-16">{account.code}</span>

          {/* Account Type Icon */}
          <div className={`p-1.5 rounded ${typeInfo.bgColor}`}>
            <TypeIcon size={14} className={typeInfo.color} />
          </div>

          {/* Account Name */}
          <span className="flex-1 font-medium text-white">{account.name_ar}</span>

          {/* Account Type Badge */}
          <span className={`text-xs px-2 py-0.5 rounded ${typeInfo.bgColor} ${typeInfo.color}`}>
            {typeInfo.label}
          </span>

          {/* Balance */}
          <span className={`font-mono text-sm w-32 text-left ${account.current_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {account.current_balance !== 0 ? formatCurrency(Math.abs(account.current_balance)) : '-'}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => {
                setSelectedParent(account);
                setShowAddModal(true);
              }}
              className="p-1.5 rounded hover:bg-gray-600 transition-colors"
              title="إضافة حساب فرعي"
            >
              <Plus size={14} className="text-gray-400" />
            </button>
            <button className="p-1.5 rounded hover:bg-gray-600 transition-colors" title="تعديل">
              <Edit2 size={14} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Children */}
        {isExpanded && children.map(child => renderAccount(child, level + 1))}
      </div>
    );
  };

  // Calculate totals
  const totals = {
    assets: accounts.filter(a => a.type === 'asset' && a.current_balance !== 0).reduce((sum, a) => sum + a.current_balance, 0),
    liabilities: accounts.filter(a => a.type === 'liability' && a.current_balance !== 0).reduce((sum, a) => sum + a.current_balance, 0),
    equity: accounts.filter(a => a.type === 'equity' && a.current_balance !== 0).reduce((sum, a) => sum + a.current_balance, 0),
    revenue: accounts.filter(a => a.type === 'revenue' && a.current_balance !== 0).reduce((sum, a) => sum + a.current_balance, 0),
    expenses: accounts.filter(a => a.type === 'expense' && a.current_balance !== 0).reduce((sum, a) => sum + a.current_balance, 0),
  };

  return (
    <div className="p-6 space-y-6" data-testid="chart-of-accounts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderTree className="text-blue-500" />
            دليل الحسابات
          </h1>
          <p className="text-gray-400">إدارة الحسابات المحاسبية وفقاً للنظام السعودي</p>
        </div>

        <button
          onClick={() => {
            setSelectedParent(null);
            setShowAddModal(true);
          }}
          className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          data-testid="add-account-btn"
        >
          <Plus size={20} />
          <span>حساب جديد</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'الأصول', value: totals.assets, type: 'asset' },
          { label: 'الالتزامات', value: totals.liabilities, type: 'liability' },
          { label: 'حقوق الملكية', value: totals.equity, type: 'equity' },
          { label: 'الإيرادات', value: totals.revenue, type: 'revenue' },
          { label: 'المصروفات', value: totals.expenses, type: 'expense' },
        ].map((item) => {
          const typeInfo = getAccountTypeInfo(item.type);
          return (
            <div key={item.type} className={`${typeInfo.bgColor} rounded-xl p-4 border border-gray-700`}>
              <p className={`text-sm ${typeInfo.color}`}>{item.label}</p>
              <p className="text-lg font-bold text-white mt-1">{formatCurrency(item.value)}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="بحث بالاسم أو رقم الحساب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            data-testid="search-accounts"
          />
        </div>
      </div>

      {/* Accounts Tree */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 py-3 px-4 bg-gray-700/50 border-b border-gray-600">
          <span className="w-8"></span>
          <span className="font-mono text-sm text-gray-400 w-16">الرمز</span>
          <span className="w-8"></span>
          <span className="flex-1 text-sm font-semibold text-gray-300">اسم الحساب</span>
          <span className="text-sm text-gray-400 w-20">النوع</span>
          <span className="text-sm text-gray-400 w-32 text-left">الرصيد</span>
          <span className="w-20"></span>
        </div>

        {/* Accounts List */}
        <div className="max-h-[600px] overflow-y-auto">
          {accounts.filter(acc => acc.parent_id === null).map(account => renderAccount(account))}
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          parentAccount={selectedParent}
          onClose={() => {
            setShowAddModal(false);
            setSelectedParent(null);
          }}
          onAdd={(newAccount) => {
            setAccounts([...accounts, { ...newAccount, id: String(Date.now()) }]);
            setShowAddModal(false);
            setSelectedParent(null);
          }}
        />
      )}
    </div>
  );
}

// Add Account Modal
function AddAccountModal({ parentAccount, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    code: parentAccount ? `${parentAccount.code}` : '',
    name_ar: '',
    type: parentAccount?.type || 'asset',
    category: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      ...formData,
      parent_id: parentAccount?.id || null,
      current_balance: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {parentAccount ? `إضافة حساب فرعي لـ "${parentAccount.name_ar}"` : 'إضافة حساب جديد'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">رمز الحساب</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="مثال: 1111"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">اسم الحساب</label>
            <input
              type="text"
              value={formData.name_ar}
              onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="اسم الحساب بالعربي"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">نوع الحساب</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              disabled={!!parentAccount}
            >
              <option value="asset">أصول</option>
              <option value="liability">التزامات</option>
              <option value="equity">حقوق ملكية</option>
              <option value="revenue">إيرادات</option>
              <option value="expense">مصروفات</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-white transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              إضافة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
