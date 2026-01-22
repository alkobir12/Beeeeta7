'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Eye,
  Send,
  XCircle,
  Calendar
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { journalEntriesApi, JournalEntry, CreateJournalEntryRequest, chartOfAccountsApi, Account } from '@/lib/api';

type StatusFilter = 'all' | 'draft' | 'posted' | 'reversed';

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status?: string; start_date?: string; end_date?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      filters.start_date = dateRange.start;
      filters.end_date = dateRange.end;
      
      const data = await journalEntriesApi.getEntries(filters);
      setEntries(data);
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError('تعذر جلب القيود');
      // Mock data
      setEntries([
        {
          id: '1',
          entry_number: 'JE-2024-001',
          entry_date: '2024-12-15',
          description: 'تسجيل فاتورة مبيعات - العميل محمد أحمد',
          status: 'posted',
          total_debit: 5750,
          total_credit: 5750,
          lines: [
            { account_id: '1', account_code: '1201', account_name: 'العملاء', debit_amount: 5750, credit_amount: 0 },
            { account_id: '2', account_code: '4101', account_name: 'إيرادات خدمات الصيانة', debit_amount: 0, credit_amount: 5000 },
            { account_id: '3', account_code: '2201', account_name: 'ضريبة القيمة المضافة', debit_amount: 0, credit_amount: 750 },
          ],
          created_at: '2024-12-15T10:30:00',
        },
        {
          id: '2',
          entry_number: 'JE-2024-002',
          entry_date: '2024-12-16',
          description: 'صرف رواتب شهر ديسمبر',
          status: 'posted',
          total_debit: 45000,
          total_credit: 45000,
          lines: [
            { account_id: '4', account_code: '5201', account_name: 'رواتب الموظفين', debit_amount: 45000, credit_amount: 0 },
            { account_id: '5', account_code: '1102', account_name: 'البنك الأهلي', debit_amount: 0, credit_amount: 45000 },
          ],
          created_at: '2024-12-16T14:00:00',
        },
        {
          id: '3',
          entry_number: 'JE-2024-003',
          entry_date: '2024-12-18',
          description: 'شراء قطع غيار من المورد',
          status: 'draft',
          total_debit: 12000,
          total_credit: 12000,
          lines: [
            { account_id: '6', account_code: '1301', account_name: 'المخزون', debit_amount: 12000, credit_amount: 0 },
            { account_id: '7', account_code: '2101', account_name: 'الموردين', debit_amount: 0, credit_amount: 12000 },
          ],
          created_at: '2024-12-18T09:15:00',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateRange]);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await chartOfAccountsApi.getAccounts();
      setAccounts(data);
    } catch (err) {
      // Use mock accounts
      setAccounts([
        { id: '1', code: '1101', name_ar: 'النقدية في الصندوق', account_type: 'asset', category: 'أصول متداولة', balance: 0, is_active: true },
        { id: '2', code: '1102', name_ar: 'البنك الأهلي', account_type: 'asset', category: 'أصول متداولة', balance: 0, is_active: true },
        { id: '3', code: '1201', name_ar: 'العملاء', account_type: 'asset', category: 'أصول متداولة', balance: 0, is_active: true },
        { id: '4', code: '1301', name_ar: 'المخزون', account_type: 'asset', category: 'أصول متداولة', balance: 0, is_active: true },
        { id: '5', code: '2101', name_ar: 'الموردين', account_type: 'liability', category: 'خصوم متداولة', balance: 0, is_active: true },
        { id: '6', code: '2201', name_ar: 'ضريبة القيمة المضافة', account_type: 'liability', category: 'خصوم متداولة', balance: 0, is_active: true },
        { id: '7', code: '4101', name_ar: 'إيرادات خدمات الصيانة', account_type: 'revenue', category: 'إيرادات', balance: 0, is_active: true },
        { id: '8', code: '5201', name_ar: 'رواتب الموظفين', account_type: 'expense', category: 'مصروفات', balance: 0, is_active: true },
      ]);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, [fetchEntries, fetchAccounts]);

  const handlePostEntry = async (entryId: string) => {
    try {
      await journalEntriesApi.postEntry(entryId);
      fetchEntries();
    } catch (err) {
      console.error('Error posting entry:', err);
      alert('حدث خطأ في ترحيل القيد');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: <Clock size={14} />, label: 'مسودة' },
      posted: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle size={14} />, label: 'مرحّل' },
      reversed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: <XCircle size={14} />, label: 'ملغي' },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.entry_number.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query)
    );
  });

  // Stats
  const stats = {
    total: entries.length,
    draft: entries.filter(e => e.status === 'draft').length,
    posted: entries.filter(e => e.status === 'posted').length,
    totalDebit: entries.filter(e => e.status === 'posted').reduce((sum, e) => sum + e.total_debit, 0),
  };

  return (
    <div className="space-y-6" data-testid="journal-entries-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="text-blue-600" />
            القيود اليومية
          </h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة وتسجيل القيود المحاسبية</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          data-testid="create-entry-btn"
        >
          <Plus size={20} />
          <span>قيد جديد</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي القيود</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Clock className="text-gray-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">مسودات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.draft}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">مرحّلة</p>
              <p className="text-2xl font-bold text-green-600">{stats.posted}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الحركة</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.totalDebit)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث برقم القيد أو الوصف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'draft', 'posted', 'reversed'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' && 'الكل'}
                {filter === 'draft' && 'مسودة'}
                {filter === 'posted' && 'مرحّل'}
                {filter === 'reversed' && 'ملغي'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchEntries}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
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

      {/* Entries Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="text-gray-500 mt-4">لا توجد قيود</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">رقم القيد</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">التاريخ</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">الوصف</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">مدين</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">دائن</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">الحالة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-4">
                      <span className="font-medium text-blue-600 dark:text-blue-400">{entry.entry_number}</span>
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400 text-sm">
                      {new Date(entry.entry_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-4 text-gray-900 dark:text-white max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="px-4 py-4 text-left font-medium text-blue-600">
                      {formatCurrency(entry.total_debit)}
                    </td>
                    <td className="px-4 py-4 text-left font-medium text-purple-600">
                      {formatCurrency(entry.total_credit)}
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedEntry(entry);
                            setShowViewModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="عرض"
                        >
                          <Eye size={16} className="text-gray-500" />
                        </button>
                        
                        {entry.status === 'draft' && (
                          <button 
                            onClick={() => handlePostEntry(entry.id)}
                            className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30"
                            title="ترحيل"
                          >
                            <Send size={16} className="text-green-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Entry Modal */}
      {showCreateModal && (
        <CreateEntryModal 
          accounts={accounts}
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => {
            setShowCreateModal(false);
            fetchEntries();
          }}
        />
      )}

      {/* View Entry Modal */}
      {showViewModal && selectedEntry && (
        <ViewEntryModal
          entry={selectedEntry}
          onClose={() => {
            setShowViewModal(false);
            setSelectedEntry(null);
          }}
        />
      )}
    </div>
  );
}

// Create Entry Modal
function CreateEntryModal({ 
  accounts,
  onClose, 
  onSuccess 
}: { 
  accounts: Account[];
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([
    { account_id: '', debit_amount: 0, credit_amount: 0 },
    { account_id: '', debit_amount: 0, credit_amount: 0 },
  ]);
  const [autoPost, setAutoPost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => {
    setLines([...lines, { account_id: '', debit_amount: 0, credit_amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // If debit is entered, clear credit and vice versa
    if (field === 'debit_amount' && value) {
      newLines[index].credit_amount = 0;
    } else if (field === 'credit_amount' && value) {
      newLines[index].debit_amount = 0;
    }
    
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isBalanced) {
      alert('القيد غير متوازن. يجب أن يكون إجمالي المدين يساوي إجمالي الدائن');
      return;
    }

    setSubmitting(true);

    try {
      const entryData: CreateJournalEntryRequest = {
        entry_date: entryDate,
        description,
        lines: lines.filter(l => l.account_id && (l.debit_amount > 0 || l.credit_amount > 0)),
        auto_post: autoPost,
      };

      await journalEntriesApi.createEntry(entryData);
      onSuccess();
    } catch (err) {
      console.error('Error creating entry:', err);
      alert('حدث خطأ في إنشاء القيد');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">إنشاء قيد جديد</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ القيد</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوصف</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="وصف القيد..."
                required
              />
            </div>
          </div>

          {/* Entry Lines */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">سطور القيد</label>
            <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 py-2 text-right text-sm font-medium">الحساب</th>
                    <th className="px-3 py-2 text-left text-sm font-medium w-32">مدين</th>
                    <th className="px-3 py-2 text-left text-sm font-medium w-32">دائن</th>
                    <th className="px-3 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <select
                          value={line.account_id}
                          onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                          required
                        >
                          <option value="">اختر الحساب...</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name_ar}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.debit_amount || ''}
                          onChange={(e) => updateLine(index, 'debit_amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm text-left"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.credit_amount || ''}
                          onChange={(e) => updateLine(index, 'credit_amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm text-left"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <td className="px-3 py-2 text-right font-bold">الإجمالي</td>
                    <td className="px-3 py-2 text-left font-bold text-blue-600">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-2 text-left font-bold text-purple-600">{formatCurrency(totalCredit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <button
              type="button"
              onClick={addLine}
              className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Plus size={18} />
              <span>إضافة سطر</span>
            </button>
          </div>

          {/* Balance Check */}
          <div className={`rounded-lg p-3 flex items-center gap-2 ${isBalanced ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            {isBalanced ? (
              <>
                <CheckCircle className="text-green-600" size={20} />
                <span className="text-green-800 dark:text-green-200 text-sm">✓ القيد متوازن</span>
              </>
            ) : (
              <>
                <XCircle className="text-red-600" size={20} />
                <span className="text-red-800 dark:text-red-200 text-sm">
                  ⚠ القيد غير متوازن - الفرق: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                </span>
              </>
            )}
          </div>

          {/* Auto Post */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">ترحيل القيد تلقائياً بعد الحفظ</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || !isBalanced}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'جارٍ الحفظ...' : 'حفظ القيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Entry Modal
function ViewEntryModal({ 
  entry, 
  onClose 
}: { 
  entry: JournalEntry; 
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{entry.entry_number}</h2>
            <p className="text-sm text-gray-500">{new Date(entry.entry_date).toLocaleDateString('ar-SA')}</p>
          </div>
          {entry.status === 'draft' && (
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">مسودة</span>
          )}
          {entry.status === 'posted' && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">مرحّل</span>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">الوصف</p>
            <p className="text-gray-900 dark:text-white">{entry.description}</p>
          </div>

          <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-right text-sm font-medium">الحساب</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">مدين</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {entry.lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded mr-2">
                        {line.account_code}
                      </span>
                      {line.account_name}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {line.debit_amount > 0 ? (
                        <span className="font-medium text-blue-600">{formatCurrency(line.debit_amount)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {line.credit_amount > 0 ? (
                        <span className="font-medium text-purple-600">{formatCurrency(line.credit_amount)}</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <td className="px-4 py-2 text-right font-bold">الإجمالي</td>
                  <td className="px-4 py-2 text-left font-bold text-blue-600">{formatCurrency(entry.total_debit)}</td>
                  <td className="px-4 py-2 text-left font-bold text-purple-600">{formatCurrency(entry.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            تم الإنشاء: {new Date(entry.created_at).toLocaleString('ar-SA')}
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
