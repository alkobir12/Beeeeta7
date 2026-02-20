import React, { useEffect, useState } from 'react';
import { Building2, Plus, ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, DollarSign, Users, Wrench, Car, Trash2, Edit, FolderTree } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// الحسابات الافتراضية
const DEFAULT_ACCOUNTS = [
  // الإيرادات
  { id: 'rev-main', code: '4000', name: 'الإيرادات', nameEn: 'Revenue', type: 'revenue', parentId: null, isSystem: true },
  { id: 'rev-services', code: '4100', name: 'إيرادات الخدمات', nameEn: 'Service Revenue', type: 'revenue', parentId: 'rev-main', isSystem: true },
  { id: 'rev-parts', code: '4200', name: 'إيرادات قطع الغيار', nameEn: 'Parts Revenue', type: 'revenue', parentId: 'rev-main', isSystem: true },
  { id: 'rev-other', code: '4900', name: 'إيرادات أخرى', nameEn: 'Other Revenue', type: 'revenue', parentId: 'rev-main', isSystem: true },
  
  // المصروفات
  { id: 'exp-main', code: '5000', name: 'المصروفات', nameEn: 'Expenses', type: 'expense', parentId: null, isSystem: true },
  { id: 'exp-operational', code: '5100', name: 'مصروفات تشغيلية', nameEn: 'Operational Expenses', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-salaries', code: '5200', name: 'الرواتب والأجور', nameEn: 'Salaries & Wages', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-rent', code: '5300', name: 'الإيجار', nameEn: 'Rent', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-utilities', code: '5400', name: 'المرافق (كهرباء/ماء)', nameEn: 'Utilities', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-maintenance', code: '5500', name: 'صيانة وإصلاحات', nameEn: 'Maintenance & Repairs', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-parts-cost', code: '5600', name: 'تكلفة قطع الغيار', nameEn: 'Parts Cost', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-personal', code: '5700', name: 'مصروفات شخصية', nameEn: 'Personal Expenses', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-marketing', code: '5800', name: 'تسويق وإعلان', nameEn: 'Marketing & Advertising', type: 'expense', parentId: 'exp-main', isSystem: true },
  { id: 'exp-other', code: '5900', name: 'مصروفات أخرى', nameEn: 'Other Expenses', type: 'expense', parentId: 'exp-main', isSystem: true },
];

const BusinessAccounts = () => {
  const { toast } = useToast();
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', currency: 'SAR' });
  const [accountForm, setAccountForm] = useState({ 
    code: '', name: '', nameEn: '', type: 'expense', parentId: '' 
  });

  const loadBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/biz-accounts`);
      setBranches(res.data || []);
    } catch (e) { console.error(e); }
  };

  const loadAccounts = async () => {
    try {
      const res = await axios.get(`${API_URL}/accounts-chart`);
      if (res.data && res.data.length > 0) {
        setAccounts(res.data);
      } else {
        // Initialize default accounts
        await axios.post(`${API_URL}/accounts-chart/init-defaults`);
        const res2 = await axios.get(`${API_URL}/accounts-chart`);
        setAccounts(res2.data || DEFAULT_ACCOUNTS);
      }
    } catch (e) { 
      console.error(e);
      setAccounts(DEFAULT_ACCOUNTS);
    }
  };

  useEffect(() => { 
    loadBranches(); 
    loadAccounts();
  }, []);

  const addBranch = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/biz-accounts`, { ...branchForm, isActive: true });
      setBranchForm({ name: '', code: '', currency: 'SAR' });
      await loadBranches();
      toast({ title: 'تم', description: 'تم إضافة الفرع بنجاح' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل إضافة الفرع', variant: 'destructive' });
    }
  };

  const toggleBranchActive = async (branch) => {
    try {
      await axios.put(`${API_URL}/biz-accounts/${branch.id}`, { isActive: !branch.isActive });
      await loadBranches();
    } catch (e) { console.error(e); }
  };

  const saveAccount = async () => {
    try {
      if (editingAccount) {
        await axios.put(`${API_URL}/accounts-chart/${editingAccount.id}`, accountForm);
        toast({ title: 'تم', description: 'تم تحديث الحساب بنجاح' });
      } else {
        await axios.post(`${API_URL}/accounts-chart`, { 
          ...accountForm, 
          isSystem: false 
        });
        toast({ title: 'تم', description: 'تم إضافة الحساب بنجاح' });
      }
      setShowAddAccount(false);
      setEditingAccount(null);
      setAccountForm({ code: '', name: '', nameEn: '', type: 'expense', parentId: '' });
      await loadAccounts();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل حفظ الحساب', variant: 'destructive' });
    }
  };

  const deleteAccount = async (account) => {
    if (account.isSystem) {
      toast({ title: 'تنبيه', description: 'لا يمكن حذف الحسابات الأساسية', variant: 'destructive' });
      return;
    }
    if (window.confirm('هل تريد حذف هذا الحساب؟')) {
      try {
        await axios.delete(`${API_URL}/accounts-chart/${account.id}`);
        await loadAccounts();
        toast({ title: 'تم', description: 'تم حذف الحساب' });
      } catch (e) {
        toast({ title: 'خطأ', description: e.response?.data?.detail || 'فشل حذف الحساب', variant: 'destructive' });
      }
    }
  };

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'revenue': return <TrendingUp className="text-green-500" size={18} />;
      case 'expense': return <TrendingDown className="text-red-500" size={18} />;
      default: return <Wallet className="text-blue-500" size={18} />;
    }
  };

  const getChildAccounts = (parentId) => {
    return accounts.filter(acc => acc.parentId === parentId);
  };

  const renderAccountTree = (parentId = null, level = 0) => {
    const children = getChildAccounts(parentId);
    if (children.length === 0) return null;

    return children.map(account => {
      const hasChildren = getChildAccounts(account.id).length > 0;
      const isExpanded = expandedAccounts[account.id];

      return (
        <div key={account.id}>
          <div 
            className={`flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors ${level > 0 ? 'mr-' + (level * 6) : ''}`}
            style={{ marginRight: level * 24 }}
          >
            <div className="flex items-center gap-3">
              {hasChildren ? (
                <button onClick={() => toggleExpand(account.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <div className="w-6" />
              )}
              {getAccountIcon(account.type)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{account.code}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{account.name}</span>
                </div>
                {account.nameEn && <p className="text-xs text-gray-500">{account.nameEn}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                account.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {account.type === 'revenue' ? 'إيراد' : 'مصروف'}
              </span>
              {!account.isSystem && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setEditingAccount(account);
                      setAccountForm({
                        code: account.code,
                        name: account.name,
                        nameEn: account.nameEn || '',
                        type: account.type,
                        parentId: account.parentId || ''
                      });
                      setShowAddAccount(true);
                    }}
                  >
                    <Edit size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteAccount(account)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
          {hasChildren && isExpanded && renderAccountTree(account.id, level + 1)}
        </div>
      );
    });
  };

  // الحسابات الرئيسية (بدون أب)
  const mainAccounts = accounts.filter(acc => !acc.parentId);
  // حسابات الإيرادات للاختيار
  const revenueAccounts = accounts.filter(acc => acc.type === 'revenue');
  // حسابات المصروفات للاختيار
  const expenseAccounts = accounts.filter(acc => acc.type === 'expense');

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderTree className="text-blue-500" />
            الحسابات والفروع
          </h1>
          <p className="text-gray-500 mt-1 text-sm">إدارة شجرة الحسابات والفروع</p>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Wallet size={16} />
            شجرة الحسابات
          </TabsTrigger>
          <TabsTrigger value="branches" className="flex items-center gap-2">
            <Building2 size={16} />
            الفروع
          </TabsTrigger>
        </TabsList>

        {/* شجرة الحسابات */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-blue-600">
                <FolderTree size={20} />
                <h3 className="font-bold text-gray-900">شجرة الحسابات المحاسبية</h3>
              </div>
              <Button onClick={() => { setEditingAccount(null); setShowAddAccount(true); }} size="sm">
                <Plus size={16} className="ml-2" />
                إضافة حساب
              </Button>
            </div>

            {/* ملخص الحسابات */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="text-green-600" size={20} />
                  <span className="font-semibold text-green-700 dark:text-green-400">الإيرادات</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{revenueAccounts.length}</p>
                <p className="text-xs text-green-600/70">حساب</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="text-red-600" size={20} />
                  <span className="font-semibold text-red-700 dark:text-red-400">المصروفات</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{expenseAccounts.length}</p>
                <p className="text-xs text-red-600/70">حساب</p>
              </div>
            </div>

            {/* شجرة الحسابات */}
            <div className="border rounded-xl divide-y dark:border-gray-700 dark:divide-gray-700">
              {renderAccountTree(null, 0)}
            </div>
          </div>
        </TabsContent>

        {/* الفروع */}
        <TabsContent value="branches" className="space-y-4">
          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <Plus size={20} />
              <h3 className="font-bold text-gray-900">إضافة فرع جديد</h3>
            </div>
            <form onSubmit={addBranch} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Input 
                placeholder="اسم الفرع" 
                value={branchForm.name} 
                onChange={e => setBranchForm({...branchForm, name: e.target.value})} 
                required 
              />
              <Input 
                placeholder="الكود" 
                value={branchForm.code} 
                onChange={e => setBranchForm({...branchForm, code: e.target.value})} 
                required 
              />
              <Input 
                placeholder="العملة" 
                value={branchForm.currency} 
                onChange={e => setBranchForm({...branchForm, currency: e.target.value})} 
              />
              <Button type="submit">حفظ</Button>
            </form>
          </div>

          <div className="grid gap-4">
            {branches.length === 0 ? (
              <div className="apple-card p-8 text-center text-gray-500">
                <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                <p>لا توجد فروع</p>
              </div>
            ) : (
              branches.map(branch => (
                <div key={branch.id} className={`apple-card p-4 sm:p-5 flex items-center justify-between ${!branch.isActive && 'opacity-60'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{branch.name}</h3>
                      <p className="text-sm text-gray-500">{branch.code} • {branch.currency}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleBranchActive(branch)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      branch.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {branch.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog إضافة/تعديل حساب */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'تعديل حساب' : 'إضافة حساب جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>كود الحساب</Label>
                <Input 
                  placeholder="مثال: 5150" 
                  value={accountForm.code}
                  onChange={e => setAccountForm({...accountForm, code: e.target.value})}
                />
              </div>
              <div>
                <Label>نوع الحساب</Label>
                <Select value={accountForm.type} onValueChange={v => setAccountForm({...accountForm, type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">إيراد</SelectItem>
                    <SelectItem value="expense">مصروف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>اسم الحساب (عربي)</Label>
              <Input 
                placeholder="مثال: مصروفات الوقود" 
                value={accountForm.name}
                onChange={e => setAccountForm({...accountForm, name: e.target.value})}
              />
            </div>
            <div>
              <Label>اسم الحساب (إنجليزي)</Label>
              <Input 
                placeholder="Example: Fuel Expenses" 
                value={accountForm.nameEn}
                onChange={e => setAccountForm({...accountForm, nameEn: e.target.value})}
              />
            </div>
            <div>
              <Label>الحساب الأب</Label>
              <Select value={accountForm.parentId} onValueChange={v => setAccountForm({...accountForm, parentId: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحساب الأب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون (حساب رئيسي)</SelectItem>
                  {accounts.filter(a => a.type === accountForm.type).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveAccount} className="w-full">
              {editingAccount ? 'تحديث' : 'إضافة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessAccounts;
