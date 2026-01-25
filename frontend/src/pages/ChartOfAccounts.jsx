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

// Default Saudi Chart of Accounts - يُستخدم فقط إذا لم يكن هناك بيانات في API
const DEFAULT_ACCOUNTS = [
  // بيانات افتراضية فارغة
];

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState(['header-asset', 'header-liability', 'header-equity', 'header-revenue', 'header-expense']);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);

  // جلب الحسابات من الـ API عند تحميل الصفحة
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
      const response = await fetch(`${API_URL}/finance/chart-of-accounts?workshop_id=${workshopId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // تحويل البيانات من الـ API إلى format الصفحة
        const transformedAccounts = [];
        const accountsByType = {
          asset: [],
          liability: [],
          equity: [],
          revenue: [],
          expense: []
        };
        
        // تصنيف الحسابات حسب النوع
        data.data.forEach(acc => {
          const type = acc.type || 'asset';
          if (accountsByType[type]) {
            accountsByType[type].push({
              id: acc.id || acc.code,
              code: acc.code,
              name_ar: acc.name_ar || acc.name,
              type: type,
              category: acc.category,
              parent_id: null,
              current_balance: acc.balance || 0
            });
          }
        });
        
        // بناء شجرة الحسابات مع headers
        // استخدام IDs فريدة للـ headers لتجنب التعارض مع IDs الحسابات من الـ API
        if (accountsByType.asset.length > 0) {
          transformedAccounts.push({
            id: 'header-asset', code: '1', name_ar: 'الأصول', type: 'asset', 
            category: null, parent_id: null, current_balance: 0, isExpanded: true
          });
          accountsByType.asset.forEach(acc => {
            acc.parent_id = 'header-asset';
            transformedAccounts.push(acc);
          });
        }
        
        if (accountsByType.liability.length > 0) {
          transformedAccounts.push({
            id: 'header-liability', code: '2', name_ar: 'الالتزامات', type: 'liability',
            category: null, parent_id: null, current_balance: 0, isExpanded: true
          });
          accountsByType.liability.forEach(acc => {
            acc.parent_id = 'header-liability';
            transformedAccounts.push(acc);
          });
        }
        
        if (accountsByType.equity.length > 0) {
          transformedAccounts.push({
            id: 'header-equity', code: '3', name_ar: 'حقوق الملكية', type: 'equity',
            category: null, parent_id: null, current_balance: 0, isExpanded: true
          });
          accountsByType.equity.forEach(acc => {
            acc.parent_id = 'header-equity';
            transformedAccounts.push(acc);
          });
        }
        
        if (accountsByType.revenue.length > 0) {
          transformedAccounts.push({
            id: 'header-revenue', code: '4', name_ar: 'الإيرادات', type: 'revenue',
            category: null, parent_id: null, current_balance: 0, isExpanded: true
          });
          accountsByType.revenue.forEach(acc => {
            acc.parent_id = 'header-revenue';
            transformedAccounts.push(acc);
          });
        }
        
        if (accountsByType.expense.length > 0) {
          transformedAccounts.push({
            id: 'header-expense', code: '5', name_ar: 'المصروفات', type: 'expense',
            category: null, parent_id: null, current_balance: 0, isExpanded: true
          });
          accountsByType.expense.forEach(acc => {
            acc.parent_id = 'header-expense';
            transformedAccounts.push(acc);
          });
        }
        
        setAccounts(transformedAccounts.length > 0 ? transformedAccounts : []);
      } else {
        // لا يوجد بيانات - عرض صفحة فارغة
        setAccounts([]);
      }
    } catch (error) {
      console.error('Error fetching chart of accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

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
    // منع infinite recursion
    if (level > 5) return null;
    if (!account || !account.id) return null;
    
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedParent(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="add-account-btn"
          >
            <Plus size={20} />
            <span>حساب جديد</span>
          </button>
          
          <button
            onClick={async () => {
              if (!window.confirm('⚠️ تحذير: هل أنت متأكد من حذف جميع البيانات المالية؟\n\nسيتم حذف:\n• جميع الحسابات\n• جميع العمليات المالية\n• جميع القيود\n\nلا يمكن التراجع عن هذا الإجراء!')) {
                return;
              }
              
              const finalConfirm = window.prompt('اكتب "حذف كل شيء" للتأكيد النهائي:', '');
              if (finalConfirm !== 'حذف كل شيء') {
                alert('تم إلغاء العملية');
                return;
              }
              
              try {
                const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
                const response = await fetch(
                  `${API_URL}/finance/reset-all-data?workshop_id=${workshopId}&confirm=DELETE_ALL`,
                  { method: 'DELETE' }
                );
                const data = await response.json();
                
                if (data.success) {
                  alert('✅ تم حذف جميع البيانات المالية بنجاح!\n\nتم حذف:\n' + 
                    `• الحسابات: ${data.deleted_counts?.chart_of_accounts || 'all'}\n` +
                    `• العمليات: ${data.deleted_counts?.operations || 'all'}\n` +
                    `• القيود: ${data.deleted_counts?.journal_entries || 'all'}`
                  );
                  window.location.reload();
                } else {
                  alert('❌ فشل الحذف: ' + data.message);
                }
              } catch (error) {
                console.error('Error deleting data:', error);
                alert('❌ حدث خطأ أثناء الحذف');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            title="حذف جميع البيانات المالية والبدء من الصفر"
          >
            <Trash2 size={20} />
            <span>إعادة تعيين الكل</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="text-blue-600" size={20} />
            <span className="text-xs font-semibold text-blue-800">الأصول</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(totals.assets)}</div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="text-red-600" size={20} />
            <span className="text-xs font-semibold text-red-800">الالتزامات</span>
          </div>
          <div className="text-2xl font-bold text-red-900">{formatCurrency(totals.liabilities)}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-purple-600" size={20} />
            <span className="text-xs font-semibold text-purple-800">حقوق الملكية</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">{formatCurrency(totals.equity)}</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-green-600" size={20} />
            <span className="text-xs font-semibold text-green-800">الإيرادات</span>
          </div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(totals.revenues)}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="text-orange-600" size={20} />
            <span className="text-xs font-semibold text-orange-800">المصروفات</span>
          </div>
          <div className="text-2xl font-bold text-orange-900">{formatCurrency(totals.expenses)}</div>
        </div>
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
