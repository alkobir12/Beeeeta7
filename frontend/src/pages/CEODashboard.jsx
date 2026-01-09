import React, { useEffect, useState, useMemo } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, DollarSign, BarChart3, 
  PieChart, ArrowUpRight, ArrowDownRight, Calendar, Filter,
  Download, RefreshCw, Eye, ChevronDown, ChevronRight, Wallet,
  Users, Wrench, Car, Plus, Edit, Trash2, FolderTree
} from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CEODashboard = () => {
  const { toast } = useToast();
  
  // State
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [operations, setOperations] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [dateRange, setDateRange] = useState('month'); // today, week, month, year, custom
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Forms
  const [branchForm, setBranchForm] = useState({ name: '', code: '', currency: 'SAR' });
  const [accountForm, setAccountForm] = useState({ 
    code: '', name: '', nameEn: '', type: 'expense', parentId: '' 
  });

  useEffect(() => {
    loadAllData();
  }, [selectedBranch, dateRange]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBranches(),
        loadAccounts(),
        loadOperations()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/biz-accounts`);
      setBranches(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await axios.get(`${API_URL}/accounts`);
      setAccounts(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOperations = async () => {
    try {
      const res = await axios.get(`${API_URL}/operations`);
      setOperations(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Calculations
  const analytics = useMemo(() => {
    const now = new Date();
    const filtered = operations.filter(op => {
      // Filter by date range
      const opDate = new Date(op.date || op.createdAt);
      let isInRange = true;
      
      if (dateRange === 'today') {
        isInRange = opDate.toDateString() === now.toDateString();
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        isInRange = opDate >= weekAgo;
      } else if (dateRange === 'month') {
        isInRange = opDate.getMonth() === now.getMonth() && opDate.getFullYear() === now.getFullYear();
      } else if (dateRange === 'year') {
        isInRange = opDate.getFullYear() === now.getFullYear();
      }
      
      // Filter by branch
      if (selectedBranch !== 'all' && op.accountId !== selectedBranch) {
        return false;
      }
      
      return isInRange;
    });

    const revenue = filtered
      .filter(op => op.type === 'sale')
      .reduce((sum, op) => sum + (op.totalAmount || 0), 0);
    
    const expenses = filtered
      .filter(op => op.type === 'purchase')
      .reduce((sum, op) => sum + (op.totalAmount || 0), 0);
    
    const profit = revenue - expenses;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Account breakdown
    const accountBreakdown = {};
    accounts.forEach(acc => {
      accountBreakdown[acc.id] = {
        ...acc,
        total: 0,
        transactions: 0
      };
    });

    filtered.forEach(op => {
      if (op.accountId && accountBreakdown[op.accountId]) {
        accountBreakdown[op.accountId].total += (op.totalAmount || 0);
        accountBreakdown[op.accountId].transactions += 1;
      }
    });

    return {
      revenue,
      expenses,
      profit,
      profitMargin,
      transactionCount: filtered.length,
      accountBreakdown: Object.values(accountBreakdown).filter(a => a.transactions > 0)
    };
  }, [operations, dateRange, selectedBranch, accounts]);

  // Account Management Functions
  const saveAccount = async () => {
    try {
      const submitData = {
        ...accountForm,
        parentId: accountForm.parentId === '__none__' ? null : accountForm.parentId
      };
      
      if (editingAccount) {
        await axios.put(`${API_URL}/accounts/${editingAccount.id}`, submitData);
        toast({ title: 'تم', description: 'تم تحديث الحساب بنجاح' });
      } else {
        await axios.post(`${API_URL}/accounts`, { ...submitData, isSystem: false });
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
    if (account.isSystem || account.is_system) {
      toast({ title: 'تنبيه', description: 'لا يمكن حذف الحسابات الأساسية', variant: 'destructive' });
      return;
    }
    if (window.confirm('هل تريد حذف هذا الحساب؟')) {
      try {
        await axios.delete(`${API_URL}/accounts/${account.id}`);
        await loadAccounts();
        toast({ title: 'تم', description: 'تم حذف الحساب' });
      } catch (e) {
        toast({ title: 'خطأ', description: e.response?.data?.detail || 'فشل حذف الحساب', variant: 'destructive' });
      }
    }
  };

  const addBranch = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/biz-accounts`, { ...branchForm, isActive: true });
      setBranchForm({ name: '', code: '', currency: 'SAR' });
      setShowAddBranch(false);
      await loadBranches();
      toast({ title: 'تم', description: 'تم إضافة الفرع بنجاح' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل إضافة الفرع', variant: 'destructive' });
    }
  };

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const getChildAccounts = (parentId) => {
    return accounts.filter(acc => (acc.parentId || acc.parent_id) === parentId);
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'revenue': return <TrendingUp className="text-green-500" size={18} />;
      case 'expense': return <TrendingDown className="text-red-500" size={18} />;
      case 'asset': return <Wallet className="text-blue-500" size={18} />;
      case 'liability': return <DollarSign className="text-orange-500" size={18} />;
      case 'equity': return <Building2 className="text-purple-500" size={18} />;
      default: return <Wallet className="text-gray-500" size={18} />;
    }
  };

  const renderAccountTree = (parentId = null, level = 0) => {
    const children = getChildAccounts(parentId);
    
    return children.map(account => {
      const hasChildren = getChildAccounts(account.id).length > 0;
      const isExpanded = expandedAccounts[account.id];
      const accountData = analytics.accountBreakdown.find(a => a.id === account.id);
      const accountName = account.name_en || account.nameEn || account.name;
      const accountCode = account.code;

      return (
        <div key={account.id} className="border-b border-gray-100 last:border-0">
          <div 
            className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer ${level > 0 ? 'pr-' + (level * 8) : ''}`}
            onClick={() => hasChildren && toggleExpand(account.id)}
          >
            <div className="flex items-center gap-3 flex-1">
              {hasChildren ? (
                isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              ) : (
                <span className="w-4" />
              )}
              {getAccountIcon(account.type)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{account.name}</span>
                  <span className="text-xs text-gray-400">{accountCode}</span>
                </div>
                {accountName && accountName !== account.name && (
                  <div className="text-xs text-gray-500">{accountName}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {accountData && (
                <div className="text-left">
                  <div className="text-sm font-semibold">{accountData.total.toFixed(2)} ر.س</div>
                  <div className="text-xs text-gray-500">{accountData.transactions} معاملة</div>
                </div>
              )}
              {!(account.isSystem || account.is_system) && (
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAccount(account);
                      setAccountForm({
                        code: account.code,
                        name: account.name,
                        nameEn: account.name_en || account.nameEn || '',
                        type: account.type,
                        parentId: account.parent_id || account.parentId || ''
                      });
                      setShowAddAccount(true);
                    }}
                    className="p-1 hover:bg-blue-100 rounded"
                  >
                    <Edit size={14} className="text-blue-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAccount(account);
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div className="bg-gray-50/50">
              {renderAccountTree(account.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">لوحة المدير التنفيذي</h1>
          <p className="text-gray-500 mt-1">تحليلات شاملة وإدارة الحسابات والفروع</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAllData} variant="outline">
            <RefreshCw size={16} className="ml-2" />
            تحديث
          </Button>
          <Button onClick={() => setShowAddBranch(true)}>
            <Plus size={16} className="ml-2" />
            فرع جديد
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-sm">الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-sm">الفترة الزمنية</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="year">هذه السنة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">الإيرادات</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  {analytics.revenue.toFixed(2)} ر.س
                </h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">المصروفات</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">
                  {analytics.expenses.toFixed(2)} ر.س
                </h3>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="text-red-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">صافي الربح</p>
                <h3 className={`text-2xl font-bold mt-1 ${analytics.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {analytics.profit.toFixed(2)} ر.س
                </h3>
              </div>
              <div className={`p-3 rounded-full ${analytics.profit >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                <DollarSign className={analytics.profit >= 0 ? 'text-blue-600' : 'text-red-600'} size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">هامش الربح</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">
                  {analytics.profitMargin.toFixed(1)}%
                </h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <BarChart3 className="text-purple-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accounts">
            <FolderTree size={16} className="ml-2" />
            شجرة الحسابات
          </TabsTrigger>
          <TabsTrigger value="branches">
            <Building2 size={16} className="ml-2" />
            الفروع
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 size={16} className="ml-2" />
            التحليلات التفصيلية
          </TabsTrigger>
        </TabsList>

        {/* Chart of Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>شجرة الحسابات</CardTitle>
                <Button onClick={() => {
                  setEditingAccount(null);
                  setAccountForm({ code: '', name: '', nameEn: '', type: 'expense', parentId: '' });
                  setShowAddAccount(true);
                }}>
                  <Plus size={16} className="ml-2" />
                  حساب جديد
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">لا توجد حسابات</p>
                  <Button 
                    onClick={async () => {
                      try {
                        await axios.post(`${API_URL}/accounts/init-defaults`);
                        await loadAccounts();
                        toast({ title: 'تم', description: 'تم إنشاء الحسابات الافتراضية' });
                      } catch (e) {
                        toast({ title: 'خطأ', description: 'فشل إنشاء الحسابات', variant: 'destructive' });
                      }
                    }}
                    className="mt-4"
                  >
                    إنشاء الحسابات الافتراضية
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {renderAccountTree()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches">
          <Card>
            <CardHeader>
              <CardTitle>إدارة الفروع</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {branches.map(branch => (
                  <div key={branch.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Building2 size={20} className="text-blue-600" />
                      <div>
                        <h4 className="font-semibold">{branch.name}</h4>
                        <p className="text-sm text-gray-500">{branch.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {branch.isActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>
                  </div>
                ))}
                {branches.length === 0 && (
                  <p className="text-center text-gray-500 py-8">لا توجد فروع</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>أفضل 10 حسابات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.accountBreakdown
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10)
                    .map((account, idx) => (
                      <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                          {getAccountIcon(account.type)}
                          <div>
                            <div className="font-medium text-sm">{account.name}</div>
                            <div className="text-xs text-gray-500">{account.transactions} معاملة</div>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold">{account.total.toFixed(2)} ر.س</div>
                        </div>
                      </div>
                    ))}
                  {analytics.accountBreakdown.length === 0 && (
                    <p className="text-center text-gray-500 py-8">لا توجد معاملات في هذه الفترة</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'تعديل حساب' : 'إضافة حساب جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>رمز الحساب</Label>
              <Input 
                value={accountForm.code} 
                onChange={(e) => setAccountForm({...accountForm, code: e.target.value})}
                placeholder="مثال: 4110"
              />
            </div>
            <div>
              <Label>اسم الحساب (عربي)</Label>
              <Input 
                value={accountForm.name} 
                onChange={(e) => setAccountForm({...accountForm, name: e.target.value})}
                placeholder="مثال: إيرادات خدمات السيارات"
              />
            </div>
            <div>
              <Label>اسم الحساب (إنجليزي)</Label>
              <Input 
                value={accountForm.nameEn} 
                onChange={(e) => setAccountForm({...accountForm, nameEn: e.target.value})}
                placeholder="Example: Car Service Revenue"
              />
            </div>
            <div>
              <Label>نوع الحساب</Label>
              <Select value={accountForm.type} onValueChange={(val) => setAccountForm({...accountForm, type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">أصول (Assets)</SelectItem>
                  <SelectItem value="liability">خصوم (Liabilities)</SelectItem>
                  <SelectItem value="equity">حقوق ملكية (Equity)</SelectItem>
                  <SelectItem value="revenue">إيرادات (Revenue)</SelectItem>
                  <SelectItem value="expense">مصروفات (Expenses)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحساب الأب (اختياري)</Label>
              <Select value={accountForm.parentId || ''} onValueChange={(val) => setAccountForm({...accountForm, parentId: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحساب الأب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون حساب أب</SelectItem>
                  {accounts.filter(a => !a.parent_id && !a.parentId).map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveAccount} className="flex-1">حفظ</Button>
              <Button onClick={() => setShowAddAccount(false)} variant="outline">إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Branch Dialog */}
      <Dialog open={showAddBranch} onOpenChange={setShowAddBranch}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة فرع جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={addBranch} className="space-y-4">
            <div>
              <Label>اسم الفرع</Label>
              <Input 
                value={branchForm.name} 
                onChange={(e) => setBranchForm({...branchForm, name: e.target.value})}
                placeholder="مثال: فرع الرياض"
                required
              />
            </div>
            <div>
              <Label>رمز الفرع</Label>
              <Input 
                value={branchForm.code} 
                onChange={(e) => setBranchForm({...branchForm, code: e.target.value})}
                placeholder="مثال: RYD-001"
                required
              />
            </div>
            <div>
              <Label>العملة</Label>
              <Select value={branchForm.currency} onValueChange={(val) => setBranchForm({...branchForm, currency: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                  <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                  <SelectItem value="EUR">يورو (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">إضافة</Button>
              <Button type="button" onClick={() => setShowAddBranch(false)} variant="outline">إلغاء</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CEODashboard;
