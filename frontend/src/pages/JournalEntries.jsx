import React, { useState, useEffect } from 'react';
import { resolveBackendBase } from '../utils/backendBase';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  FileText,
  ArrowLeftRight,
  Printer,
  Calendar,
  User,
  Receipt,
  ShoppingCart,
  Briefcase,
  CreditCard,
  TrendingUp,
  DollarSign,
  Wrench,
  Pencil,
  Trash2,
  Save,
  X,
} from 'lucide-react';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${resolveBackendBase() || ''}/api`.replace('//api', '/api')
);
const WORKSHOP_ID = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0) + ' ر.س';
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getEntryTypeConfig = (type) => {
  const configs = {
    invoice: { icon: Receipt, bgColor: 'bg-blue-500/15', textColor: 'text-blue-200', label: 'فاتورة' },
    payment: { icon: CreditCard, bgColor: 'bg-emerald-500/15', textColor: 'text-emerald-200', label: 'محصلة' },
    purchase: { icon: ShoppingCart, bgColor: 'bg-purple-500/15', textColor: 'text-purple-200', label: 'مشتريات' },
    salary: { icon: Briefcase, bgColor: 'bg-orange-500/15', textColor: 'text-orange-200', label: 'رواتب' },
    manual: { icon: FileText, bgColor: 'bg-slate-500/15', textColor: 'text-slate-200', label: 'يدوي' },
  };
  return configs[type] || configs.manual;
};

const sanitizeEntryText = (value = '') => {
  if (!value) return '';
  return String(value)
    .replace(/ACCOUNT_CODE:\s*\S+/gi, '')
    .replace(/ACCOUNTING_TARGET:\s*\S+/gi, '')
    .replace(/ACCOUNTING_SOURCE:\s*\S+/gi, '')
    .replace(/ACCOUNT_NAME:\s*[^|\n]+/gi, '')
    .replace(/ACCOUNT_CLASS:\s*\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Chart of Accounts (loaded from API)

export default function JournalEntries() {
  const themeName = 'dark';
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [coaAccounts, setCoaAccounts] = useState([]);
  
  const isLight = false;

  useEffect(() => { fetchJournalEntries(); }, []);

  useEffect(() => {
    fetchChartOfAccounts();
  }, []);

  const fetchJournalEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/finance/journal-entries?workshop_id=${WORKSHOP_ID}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const transformedEntries = data.data.map((entry, index) => ({
          id: entry.id || String(index),
          entry_number: `JE-${String(index + 1).padStart(4, '0')}`,
          entry_date: entry.date,
          description: entry.description,
          reference_type: entry.source === 'operation' ? (entry.description?.includes('بيع') ? 'invoice' : 'purchase') : 'manual',
          status: 'posted',
          total_debit: entry.total,
          total_credit: entry.total,
          lines: entry.lines?.map(line => ({
            account_code: line.account,
            account_name: line.account_name,
            debit: line.debit,
            credit: line.credit
          })) || [],
          vehicle_plate: entry.vehicle_plate,
          customer_name: entry.customer_name,
          source: entry.source || 'manual'
        }));
        setEntries(transformedEntries);
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartOfAccounts = async () => {
    try {
      const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
      const response = await fetch(`${API_URL}/finance/chart-of-accounts?workshop_id=${workshopId}`);
      const data = await response.json();
      if (data?.success && Array.isArray(data?.data)) {
        setCoaAccounts(data.data);
      } else {
        setCoaAccounts([]);
      }
    } catch (e) {
      console.error('Failed to fetch chart of accounts:', e);
      setCoaAccounts([]);
    }
  };

  const handleCreateEntry = async (formData) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/finance/journal-entries?workshop_id=${WORKSHOP_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          description: formData.description,
          transaction_type: formData.transaction_type,
          lines: formData.lines,
          total: formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchJournalEntries();
        setShowEntryForm(false);
        setEditingEntry(null);
      } else {
        alert(data.message || 'حدث خطأ في إنشاء القيد');
      }
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('حدث خطأ في إنشاء القيد');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntry = async (formData) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/finance/journal-entries/${editingEntry.id}?workshop_id=${WORKSHOP_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          description: formData.description,
          transaction_type: formData.transaction_type,
          lines: formData.lines,
          total: formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
        })
      });
      const data = await response.json();
      if (data.success) {
        await fetchJournalEntries();
        setShowEntryForm(false);
        setEditingEntry(null);
      } else {
        alert(data.message || 'حدث خطأ في تحديث القيد');
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('حدث خطأ في تحديث القيد');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      const response = await fetch(`${API_URL}/finance/journal-entries/${entryId}?workshop_id=${WORKSHOP_ID}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        await fetchJournalEntries();
        setDeleteConfirm(null);
      } else {
        alert(data.message || 'حدث خطأ في حذف القيد');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('حدث خطأ في حذف القيد');
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const safeDescription = sanitizeEntryText(entry.description || '');
    return (
      entry.entry_number?.toLowerCase().includes(query) ||
      safeDescription.toLowerCase().includes(query) ||
      entry.customer_name?.toLowerCase().includes(query) ||
      entry.vehicle_plate?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: entries.length,
    posted: entries.filter(e => e.status === 'posted').length,
    draft: entries.filter(e => e.status === 'draft').length,
    totalAmount: entries.reduce((sum, e) => sum + (e.total_debit || 0), 0),
    manual: entries.filter(e => e.source === 'manual').length,
  };

  const handlePrintInvoice = (entry) => {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return;
    const total = entry.total_debit || 0;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة - ${entry.entry_number}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; color: #111827; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 700; color: #1e40af; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1e40af; color: white; padding: 12px; text-align: right; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .totals { margin-top: 24px; padding: 16px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 8px; color: white; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">ورشة الصيانة</div>
      <div>فاتورة: ${entry.entry_number}<br/>التاريخ: ${entry.entry_date || '-'}</div>
    </div>
    <p><strong>العميل:</strong> ${entry.customer_name || '-'} | <strong>اللوحة:</strong> ${entry.vehicle_plate || '-'}</p>
    <table>
      <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
      <tbody>
        ${entry.lines.map(l => `<tr><td>${l.account_code} - ${l.account_name}</td><td>${l.debit ? l.debit.toFixed(2) : '-'}</td><td>${l.credit ? l.credit.toFixed(2) : '-'}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>الإجمالي</span><span>${total.toFixed(2)} ر.س</span></div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    printWindow.document.close();
  };

  const styles = {
    bg: 'radial-gradient(140% 140% at 10% 0%, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.92) 55%, #0b1120 100%)',
    cardBg: 'rgba(15, 23, 42, 0.68)',
    cardBorder: 'rgba(148, 163, 184, 0.2)',
    cardShadow: '0 18px 40px rgba(15, 23, 42, 0.45)',
    cardBlur: 'blur(16px)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5f5',
    textMuted: '#94a3b8',
    inputBg: 'rgba(15, 23, 42, 0.6)',
    inputBorder: 'rgba(148, 163, 184, 0.25)',
    hoverBg: 'rgba(59, 130, 246, 0.12)',
  };

  return (
    <div 
      className="p-4 md:p-6 min-h-screen transition-colors duration-300"
      style={{ background: styles.bg }}
      data-testid="journal-entries-page"
    >
      {/* Header */}
      <div
        className="mb-6 rounded-3xl border px-6 py-5 backdrop-blur-xl"
        style={{
          backgroundColor: styles.cardBg,
          borderColor: styles.cardBorder,
          boxShadow: styles.cardShadow,
          backdropFilter: styles.cardBlur
        }}
        data-testid="journal-header-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: styles.textPrimary }} data-testid="journal-header-title">
              دفتر اليومية المحاسبية
            </h1>
            <p className="text-sm mt-1" style={{ color: styles.textSecondary }} data-testid="journal-header-subtitle">
              إدارة السيولة، الضرائب، وتحليلات النظام المالي
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchJournalEntries}
              className="p-2.5 rounded-xl transition-all"
              style={{ 
                backgroundColor: styles.cardBg,
                border: `1px solid ${styles.cardBorder}`,
                boxShadow: styles.cardShadow,
                color: styles.textSecondary
              }}
              data-testid="refresh-btn"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => {
                setEditingEntry(null);
                setShowEntryForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white transition-all"
              style={{ 
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
              data-testid="new-entry-btn"
            >
              <Plus size={18} />
              <span>قيد جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* AI Assistant Card */}
        <div 
          className="col-span-2 lg:col-span-1 rounded-2xl p-5 border backdrop-blur-xl"
          style={{ 
            background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            boxShadow: styles.cardShadow,
            borderColor: styles.cardBorder,
            backdropFilter: styles.cardBlur
          }}
          data-testid="journal-ai-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
            >
              <TrendingUp size={24} className="text-white" />
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">المساعد المالي</p>
              <p className="text-white font-bold">أبو فهد</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-3" data-testid="journal-ai-summary">
            <p className="text-white/90 text-sm leading-relaxed">
              لديك {stats.total} قيد محاسبي ({stats.manual} يدوي)، إجمالي الحركات {formatCurrency(stats.totalAmount)}
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        {[
          { key: 'total', label: 'إجمالي القيود', value: stats.total, icon: FileText, iconBg: 'bg-blue-500/15', iconColor: 'text-blue-200' },
          { key: 'manual', label: 'القيود اليدوية', value: stats.manual, icon: Pencil, iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-200' },
          { key: 'amount', label: 'إجمالي الحركات', value: formatCurrency(stats.totalAmount), icon: DollarSign, iconBg: 'bg-purple-500/15', iconColor: 'text-purple-200', small: true },
        ].map((stat) => (
          <div 
            key={stat.key}
            className="rounded-2xl p-5 border backdrop-blur-xl"
            style={{ 
              backgroundColor: styles.cardBg,
              borderColor: styles.cardBorder,
              boxShadow: styles.cardShadow,
              backdropFilter: styles.cardBlur
            }}
            data-testid={`journal-stat-${stat.key}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon size={22} className={stat.iconColor} />
              </div>
              <div>
                <p className="text-xs" style={{ color: styles.textMuted }} data-testid={`journal-stat-${stat.key}-label`}>{stat.label}</p>
                <p className={`font-bold ${stat.small ? 'text-lg' : 'text-2xl'}`} style={{ color: styles.textPrimary }} data-testid={`journal-stat-${stat.key}-value`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div 
        className="rounded-2xl p-4 mb-6 border backdrop-blur-xl"
        style={{ 
          backgroundColor: styles.cardBg,
          borderColor: styles.cardBorder,
          boxShadow: styles.cardShadow,
          backdropFilter: styles.cardBlur
        }}
        data-testid="journal-filters-card"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: styles.textMuted }} size={18} />
            <input
              type="text"
              placeholder="بحث برقم القيد أو الوصف أو العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ 
                backgroundColor: styles.inputBg,
                border: `1px solid ${styles.inputBorder}`,
                color: styles.textPrimary
              }}
              data-testid="search-input"
            />
          </div>

          <div 
            className="flex gap-1.5 p-1 rounded-xl"
            style={{ backgroundColor: styles.inputBg }}
            data-testid="journal-status-filter"
          >
            {['all', 'posted', 'draft'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === filter ? 'bg-blue-600 text-white shadow-md' : ''
                }`}
                style={statusFilter !== filter ? { color: styles.textSecondary } : {}}
                data-testid={`filter-${filter}`}
              >
                {filter === 'all' ? 'الكل' : filter === 'posted' ? 'مرحّل' : 'مسودة'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Journal Entries Table */}
      <div 
        className="rounded-2xl overflow-hidden border backdrop-blur-xl"
        style={{ 
          backgroundColor: styles.cardBg,
          borderColor: styles.cardBorder,
          boxShadow: styles.cardShadow,
          backdropFilter: styles.cardBlur
        }}
        data-testid="journal-entries-card"
      >
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${styles.cardBorder}` }}>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-300" />
            <h2 className="font-semibold" style={{ color: styles.textPrimary }} data-testid="journal-entries-title">سجل الفواتير والعمليات</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <span style={{ color: styles.textSecondary }}>جاري التحميل...</span>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ backgroundColor: styles.inputBg }}>
              <BookOpen size={32} style={{ color: styles.textMuted }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: styles.textPrimary }}>لا توجد قيود</h3>
            <p style={{ color: styles.textSecondary }}>أضف قيداً جديداً أو قم بإضافة بنود لملف مركبة</p>
          </div>
        ) : (
          <>
            <div className="block md:hidden px-4 pb-4 space-y-3">
              {filteredEntries.map((entry) => {
                const typeConfig = getEntryTypeConfig(entry.reference_type);
                const TypeIcon = typeConfig.icon;
                const total = entry.total_debit || 0;
                const isManual = entry.source === 'manual';
                const safeDescription = sanitizeEntryText(entry.description || 'قيد محاسبي');

                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border p-4 backdrop-blur-xl"
                    style={{
                      backgroundColor: styles.cardBg,
                      borderColor: styles.cardBorder,
                      boxShadow: styles.cardShadow,
                      backdropFilter: styles.cardBlur
                    }}
                    data-testid={`entry-card-${entry.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeConfig.bgColor}`}>
                          <TypeIcon size={18} className={typeConfig.textColor} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-100" data-testid={`entry-card-desc-${entry.id}`}>
                            {safeDescription || 'قيد محاسبي'}
                          </p>
                          <p className="text-xs text-slate-400" data-testid={`entry-card-number-${entry.id}`}>
                            {entry.entry_number}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full ${
                        isManual ? 'bg-white/10 text-slate-200' : 'bg-blue-500/15 text-blue-200'
                      }`} data-testid={`entry-card-source-${entry.id}`}>
                        {isManual ? 'يدوي' : 'آلي'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span data-testid={`entry-card-date-${entry.id}`}>{formatDate(entry.entry_date)}</span>
                      <span data-testid={`entry-card-customer-${entry.id}`}>{entry.customer_name || '-'}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-100" data-testid={`entry-card-total-${entry.id}`}>
                        {formatCurrency(total)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePrintInvoice(entry)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="طباعة"
                          data-testid={`entry-card-print-${entry.id}`}
                        >
                          <Printer size={16} className="text-blue-300" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEntry(entry);
                            setShowDetailModal(true);
                          }}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="عرض التفاصيل"
                          data-testid={`entry-card-view-${entry.id}`}
                        >
                          <Eye size={16} className="text-blue-300" />
                        </button>
                        {isManual && (
                          <>
                            <button
                              onClick={() => {
                                setEditingEntry(entry);
                                setShowEntryForm(true);
                              }}
                              className="p-2 rounded-lg transition-colors hover:bg-white/10"
                              title="تعديل"
                              data-testid={`entry-card-edit-${entry.id}`}
                            >
                              <Pencil size={16} className="text-amber-300" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(entry)}
                              className="p-2 rounded-lg transition-colors hover:bg-white/10"
                              title="حذف"
                              data-testid={`entry-card-delete-${entry.id}`}
                            >
                              <Trash2 size={16} className="text-rose-300" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
              <div>
                {/* Table Header */}
                <div 
                  className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ 
                    color: styles.textSecondary,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)'
                  }}
                >
                  <div className="col-span-4">الوصف</div>
                  <div className="col-span-2">التاريخ</div>
                  <div className="col-span-2">العميل</div>
                  <div className="col-span-2">المبلغ</div>
                  <div className="col-span-1">النوع</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Table Rows */}
                {filteredEntries.map((entry) => {
                  const typeConfig = getEntryTypeConfig(entry.reference_type);
                  const TypeIcon = typeConfig.icon;
                  const total = entry.total_debit || 0;
                  const isManual = entry.source === 'manual';
                  const safeDescription = sanitizeEntryText(entry.description || 'قيد محاسبي');

                  return (
                    <div 
                      key={entry.id}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors"
                      style={{ borderBottom: `1px solid ${styles.cardBorder}` }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = styles.hoverBg}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      data-testid={`entry-row-${entry.id}`}
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeConfig.bgColor}`}>
                          <TypeIcon size={18} className={typeConfig.textColor} />
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: styles.textPrimary }}>
                            {safeDescription || 'قيد محاسبي'}
                          </p>
                          <p className="text-xs" style={{ color: styles.textMuted }}>
                            {entry.entry_number}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <p className="text-sm" style={{ color: styles.textSecondary }}>
                          {formatDate(entry.entry_date)}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-sm truncate" style={{ color: styles.textPrimary }}>
                          {entry.customer_name || '-'}
                        </p>
                        {entry.vehicle_plate && (
                          <p className="text-xs font-mono" style={{ color: styles.textMuted }}>
                            {entry.vehicle_plate}
                          </p>
                        )}
                      </div>

                      <div className="col-span-2">
                        <p className="font-semibold" style={{ color: styles.textPrimary }}>
                          {formatCurrency(total)}
                        </p>
                      </div>

                      <div className="col-span-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          isManual 
                            ? 'bg-white/10 text-slate-200' 
                            : 'bg-blue-500/15 text-blue-200'
                        }`}>
                          {isManual ? 'يدوي' : 'آلي'}
                        </span>
                      </div>

                      <div className="col-span-1 flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedEntry(entry);
                            setShowDetailModal(true);
                          }}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="عرض التفاصيل"
                          data-testid={`view-btn-${entry.id}`}
                        >
                          <Eye size={16} style={{ color: styles.textSecondary }} />
                        </button>
                        {isManual && (
                          <>
                            <button
                              onClick={() => {
                                setEditingEntry(entry);
                                setShowEntryForm(true);
                              }}
                              className="p-2 rounded-lg transition-colors hover:bg-white/10"
                              title="تعديل"
                              data-testid={`edit-btn-${entry.id}`}
                            >
                              <Pencil size={16} className="text-amber-300" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(entry)}
                              className="p-2 rounded-lg transition-colors hover:bg-white/10"
                              title="حذف"
                              data-testid={`delete-btn-${entry.id}`}
                            >
                              <Trash2 size={16} className="text-rose-300" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handlePrintInvoice(entry)}
                              className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="طباعة"
                          data-testid={`print-btn-${entry.id}`}
                        >
                          <Printer size={16} style={{ color: styles.textSecondary }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedEntry(null);
          }}
          onPrint={handlePrintInvoice}
          isLight={isLight}
          styles={styles}
        />
      )}

      {/* Entry Form Modal */}
      {showEntryForm && (
        <EntryFormModal
          entry={editingEntry}
          onClose={() => {
            setShowEntryForm(false);
            setEditingEntry(null);
          }}
          onSave={editingEntry ? handleUpdateEntry : handleCreateEntry}
          saving={saving}
          isLight={isLight}
          styles={styles}
          coaAccounts={coaAccounts}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          entry={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDeleteEntry(deleteConfirm.id)}
          isLight={isLight}
          styles={styles}
        />
      )}
    </div>
  );
}

function EntryFormModal({ entry, onClose, onSave, saving, isLight, styles, coaAccounts }) {
  const [formData, setFormData] = useState({
    date: entry?.entry_date || new Date().toISOString().split('T')[0],
    description: entry?.description || '',
    transaction_type: entry?.transaction_type || 'manual',
    lines: entry?.lines?.length > 0 ? entry.lines.map(l => ({
      account_code: l.account_code || l.account,
      account_name: l.account_name,
      debit: l.debit || 0,
      credit: l.credit || 0
    })) : [
      { account_code: '', account_name: '', debit: 0, credit: 0 },
      { account_code: '', account_name: '', debit: 0, credit: 0 }
    ]
  });

  const [ocrImage, setOcrImage] = useState('');
  const [ocrPreview, setOcrPreview] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState('');

  const totalDebit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { account_code: '', account_name: '', debit: 0, credit: 0 }]
    }));
  };

  const removeLine = (index) => {
    if (formData.lines.length <= 2) return;
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index, field, value) => {
    setFormData(prev => {
      const newLines = [...prev.lines];
      if (field === 'account_code') {
        const account = coaAccounts.find((a) => String(a.code) === String(value));
        newLines[index] = {
          ...newLines[index],
          account_code: value,
          account_name: account ? (account.name_ar || account.name || '') : ''
        };
      } else {
        newLines[index] = { ...newLines[index], [field]: value };
      }
      return { ...prev, lines: newLines };
    });
  };

  const handleOcrFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.toString() || '';
      setOcrImage(base64);
      setOcrPreview(base64);
      setOcrResult(null);
      setOcrError('');
    };
    reader.readAsDataURL(file);
  };

  const runOcr = async () => {
    if (!ocrImage) return;
    setOcrLoading(true);
    setOcrError('');
    try {
      const { data } = await axios.post(`${API_URL}/parts/ocr`, { image_base64: ocrImage });
      setOcrResult(data);
    } catch (error) {
      setOcrError(error?.response?.data?.detail || 'تعذر قراءة الفاتورة');
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrToEntry = () => {
    if (!ocrResult) return;
    const total = Number(ocrResult?.totals?.grand_total || 0);
    const description = [
      'فاتورة مشتريات',
      ocrResult.vendor,
      ocrResult.invoice_number ? `#${ocrResult.invoice_number}` : ''
    ].filter(Boolean).join(' ');

    setFormData(prev => ({
      ...prev,
      description: description || prev.description,
      lines: [
        { account_code: '', account_name: '', debit: total || 0, credit: 0 },
        { account_code: '', account_name: '', debit: 0, credit: total || 0 }
      ]
    }));
  };

  const handleSubmit = () => {
    if (!formData.description.trim()) {
      alert('يرجى إدخال وصف القيد');
      return;
    }
    if (!isBalanced) {
      alert('القيد غير متوازن. يجب أن يتساوى المدين والدائن');
      return;
    }
    if (totalDebit === 0) {
      alert('يرجى إدخال مبالغ للقيد');
      return;
    }
    onSave({
      ...formData,
      lines: formData.lines.map(l => ({
        account: l.account_code,
        account_name: l.account_name,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0
      }))
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ 
          backgroundColor: styles.cardBg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        }}
      >
        {/* Header */}
        <div 
          className="p-6"
          style={{ 
            borderBottom: `1px solid ${styles.cardBorder}`,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                <FileText size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {entry ? 'تعديل قيد محاسبي' : 'قيد محاسبي جديد'}
                </h2>
                <p className="text-white/80 text-sm">أدخل تفاصيل القيد المحاسبي</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: styles.textPrimary }}>
                التاريخ
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ 
                  backgroundColor: styles.inputBg,
                  border: `1px solid ${styles.inputBorder}`,
                  color: styles.textPrimary
                }}
                data-testid="entry-date-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: styles.textPrimary }}>
                الوصف
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="مثال: دفعة إيجار الشهر"
                className="w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ 
                  backgroundColor: styles.inputBg,
                  border: `1px solid ${styles.inputBorder}`,
                  color: styles.textPrimary
                }}
                data-testid="entry-description-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: styles.textPrimary }}>
                نوع الحركة
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData(prev => ({ ...prev, transaction_type: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ 
                  backgroundColor: styles.inputBg,
                  border: `1px solid ${styles.inputBorder}`,
                  color: styles.textPrimary
                }}
              >
                <option value="manual">قيد يدوي عام</option>
                <option value="purchase">شراء / مصروف</option>
                <option value="sale">بيع / إيراد</option>
                <option value="expense">مصاريف تشغيلية</option>
                <option value="other">أخرى</option>
              </select>
            </div>
          </div>

        {/* OCR Invoice */}
        <div className="rounded-xl p-4 mb-4" style={{ border: `1px solid ${styles.cardBorder}`, backgroundColor: styles.cardBg }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: styles.textPrimary }}>مسح فاتورة مشتريات</div>
              <div className="text-xs" style={{ color: styles.textSecondary }}>التقط صورة أو ارفع ملف لملء القيد تلقائياً</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="text-xs px-3 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: styles.inputBg, border: `1px solid ${styles.inputBorder}`, color: styles.textPrimary }}>
                التقاط بالكاميرا
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleOcrFileChange} data-testid="journal-ocr-camera-input" />
              </label>
              <label className="text-xs px-3 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: styles.inputBg, border: `1px solid ${styles.inputBorder}`, color: styles.textPrimary }}>
                رفع ملف
                <input type="file" accept="image/*" className="hidden" onChange={handleOcrFileChange} data-testid="journal-ocr-file-input" />
              </label>
              <button
                type="button"
                onClick={runOcr}
                disabled={ocrLoading}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#2563eb', color: '#fff' }}
                data-testid="journal-ocr-run"
              >
                {ocrLoading ? 'جاري القراءة...' : 'تشغيل OCR'}
              </button>
              {ocrResult && (
                <button
                  type="button"
                  onClick={applyOcrToEntry}
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#10b981', color: '#fff' }}
                  data-testid="journal-ocr-apply"
                >
                  تطبيق على القيد
                </button>
              )}
            </div>
          </div>
          {ocrPreview && (
            <img src={ocrPreview} alt="OCR" className="mt-3 max-h-48 rounded-xl" data-testid="journal-ocr-preview" />
          )}
          {ocrError && (
            <div className="mt-2 text-xs text-red-500" data-testid="journal-ocr-error">{ocrError}</div>
          )}
          {ocrResult && (
            <div className="mt-2 text-xs" style={{ color: styles.textSecondary }} data-testid="journal-ocr-summary">
              المورد: {ocrResult.vendor || 'غير محدد'} | الإجمالي: {ocrResult.totals?.grand_total || '—'}
            </div>
          )}
        </div>

          {/* Entry Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: styles.textPrimary }}>
                <ArrowLeftRight size={16} className="text-blue-300" />
                بنود القيد
              </h3>
              <button
                onClick={addLine}
                className="text-sm text-blue-300 hover:text-blue-200 font-medium flex items-center gap-1"
                data-testid="add-line-btn"
              >
                <Plus size={16} />
                إضافة سطر
              </button>
            </div>

            <div 
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${styles.cardBorder}` }}
            >
              <table className="w-full">
                <thead style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: styles.textSecondary }}>الحساب</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ color: styles.textSecondary }}>مدين</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ color: styles.textSecondary }}>دائن</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${styles.cardBorder}` }}>
                      <td className="px-4 py-3">
                        <select
                          value={line.account_code}
                          onChange={(e) => updateLine(idx, 'account_code', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm"
                          style={{ 
                            backgroundColor: styles.inputBg,
                            border: `1px solid ${styles.inputBorder}`,
                            color: styles.textPrimary
                          }}
                          data-testid={`line-account-${idx}`}
                        >
                          <option value="">اختر الحساب</option>
                          {coaAccounts.map(acc => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name_ar || acc.name || ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 rounded-lg text-sm text-center"
                          style={{ 
                            backgroundColor: styles.inputBg,
                            border: `1px solid ${styles.inputBorder}`,
                            color: styles.textPrimary
                          }}
                          data-testid={`line-debit-${idx}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 rounded-lg text-sm text-center"
                          style={{ 
                            backgroundColor: styles.inputBg,
                            border: `1px solid ${styles.inputBorder}`,
                            color: styles.textPrimary
                          }}
                          data-testid={`line-credit-${idx}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {formData.lines.length > 2 && (
                          <button
                            onClick={() => removeLine(idx)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-rose-300"
                            data-testid={`remove-line-${idx}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
                  <tr className="font-bold">
                    <td className="px-4 py-3" style={{ color: styles.textPrimary }}>الإجمالي</td>
                    <td className="px-4 py-3 text-center text-emerald-300">{formatCurrency(totalDebit)}</td>
                    <td className="px-4 py-3 text-center text-rose-300">{formatCurrency(totalCredit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Balance Check */}
          <div className={`rounded-xl p-4 flex items-center gap-3 border ${
            isBalanced && totalDebit > 0
              ? 'bg-emerald-500/10 border-emerald-400/30' 
              : 'bg-amber-500/10 border-amber-400/30'
          }`}>
            {isBalanced && totalDebit > 0 ? (
              <>
                <div className="p-2 bg-emerald-500/15 rounded-lg">
                  <CheckCircle size={20} className="text-emerald-300" />
                </div>
                <span className="text-emerald-300 font-medium">القيد متوازن ✓</span>
              </>
            ) : (
              <>
                <div className="p-2 bg-amber-500/15 rounded-lg">
                  <Clock size={20} className="text-amber-300" />
                </div>
                <span className="text-amber-300 font-medium">
                  {totalDebit === 0 ? 'أدخل المبالغ' : `فرق: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${styles.cardBorder}` }}>
          <button
            onClick={handleSubmit}
            disabled={saving || !isBalanced || totalDebit === 0}
            className="flex-1 py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
            }}
            data-testid="save-entry-btn"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save size={18} />
                {entry ? 'حفظ التعديلات' : 'إنشاء القيد'}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium transition-all"
            style={{ 
              backgroundColor: styles.inputBg,
              border: `1px solid ${styles.cardBorder}`,
              color: styles.textSecondary
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ entry, onClose, onConfirm, isLight, styles }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl w-full max-w-md overflow-hidden"
        style={{ 
          backgroundColor: styles.cardBg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        }}
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
            <Trash2 size={32} className="text-rose-300" />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: styles.textPrimary }}>
            حذف القيد المحاسبي
          </h3>
          <p className="mb-6" style={{ color: styles.textSecondary }}>
            هل أنت متأكد من حذف القيد
            <span className="font-semibold"> {entry.description || entry.entry_number} </span>؟
            <br />
            <span className="text-rose-300 text-sm">هذا الإجراء لا يمكن التراجع عنه</span>
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl font-medium text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
              data-testid="confirm-delete-btn"
            >
              <Trash2 size={18} />
              نعم، احذف
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-medium transition-all"
              style={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: styles.textSecondary
              }}
              data-testid="cancel-delete-btn"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryDetailModal({ entry, onClose, onPrint, isLight, styles }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ 
          backgroundColor: styles.cardBg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        }}
      >
        {/* Header */}
        <div 
          className="p-6"
          style={{ 
            borderBottom: `1px solid ${styles.cardBorder}`,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                <Receipt size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{entry.entry_number}</h2>
                <p className="text-white/80 text-sm">{entry.description}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <XCircle size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Entry Info */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'التاريخ', value: formatDate(entry.entry_date), icon: Calendar, iconBg: 'bg-blue-500/15', iconColor: 'text-blue-200' },
              { label: 'النوع', value: entry.source === 'manual' ? 'يدوي' : 'آلي', icon: FileText, iconBg: 'bg-slate-50', iconColor: 'text-slate-600' },
              entry.customer_name && { label: 'العميل', value: entry.customer_name, icon: User, iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
              entry.vehicle_plate && { label: 'رقم اللوحة', value: entry.vehicle_plate, icon: Wrench, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
            ].filter(Boolean).map((item, i) => (
              <div 
                key={i}
                className="rounded-xl p-4"
                style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${item.iconBg} flex items-center justify-center`}>
                    <item.icon size={18} className={item.iconColor} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: styles.textSecondary }}>{item.label}</p>
                    <p className="font-semibold" style={{ color: styles.textPrimary }}>
                      {item.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Entry Lines */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: styles.textPrimary }}>
              <ArrowLeftRight size={16} className="text-blue-300" />
              تفاصيل القيد
            </h3>
            <div 
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${styles.cardBorder}` }}
            >
              <table className="w-full">
                <thead style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: styles.textSecondary }}>الحساب</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: styles.textSecondary }}>مدين</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: styles.textSecondary }}>دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${styles.cardBorder}` }}>
                      <td className="px-4 py-3" style={{ color: styles.textPrimary }}>
                        <span className="font-mono text-xs bg-blue-500/15 text-blue-200 px-2 py-0.5 rounded ml-2">
                          {line.account_code}
                        </span>
                        {line.account_name}
                      </td>
                      <td className="px-4 py-3 text-left font-mono">
                        {line.debit > 0 ? (
                          <span className="text-emerald-300 font-semibold">{formatCurrency(line.debit)}</span>
                        ) : <span style={{ color: styles.textMuted }}>-</span>}
                      </td>
                      <td className="px-4 py-3 text-left font-mono">
                        {line.credit > 0 ? (
                          <span className="text-rose-300 font-semibold">{formatCurrency(line.credit)}</span>
                        ) : <span style={{ color: styles.textMuted }}>-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
                  <tr className="font-bold">
                    <td className="px-4 py-3" style={{ color: styles.textPrimary }}>الإجمالي</td>
                    <td className="px-4 py-3 text-left text-emerald-300">{formatCurrency(entry.total_debit)}</td>
                    <td className="px-4 py-3 text-left text-rose-300">{formatCurrency(entry.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Balance Check */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${
            entry.total_debit === entry.total_credit 
              ? 'bg-emerald-500/10 border border-emerald-400/30' 
              : 'bg-rose-500/10 border border-rose-400/30'
          }`}>
            {entry.total_debit === entry.total_credit ? (
              <>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle size={20} className="text-emerald-300" />
                </div>
                <span className="text-emerald-700 font-medium">القيد متوازن ✓</span>
              </>
            ) : (
              <>
                <div className="p-2 bg-rose-100 rounded-lg">
                  <XCircle size={20} className="text-rose-300" />
                </div>
                <span className="text-rose-700 font-medium">القيد غير متوازن!</span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${styles.cardBorder}` }}>
          <button
            onClick={() => onPrint(entry)}
            className="flex-1 py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2"
            style={{ 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Printer size={18} />
            طباعة كفاتورة
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium transition-all"
            style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: styles.textSecondary
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}