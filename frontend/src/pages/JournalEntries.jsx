import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  BookOpen, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  Send,
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
  ChevronLeft,
  MoreVertical,
  Wrench,
  Building2
} from 'lucide-react';
import '../styles/dash-theme.css';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

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

// Entry type configurations matching the reference images
const getEntryTypeConfig = (type) => {
  const configs = {
    invoice: { 
      icon: Receipt, 
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      label: 'فاتورة',
      labelEn: 'Invoice'
    },
    payment: { 
      icon: CreditCard, 
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      label: 'محصلة',
      labelEn: 'Collected'
    },
    purchase: { 
      icon: ShoppingCart, 
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      label: 'مشتريات',
      labelEn: 'Purchase'
    },
    salary: { 
      icon: Briefcase, 
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      label: 'رواتب',
      labelEn: 'Salary'
    },
    manual: { 
      icon: FileText, 
      bgColor: 'bg-slate-50',
      textColor: 'text-slate-600',
      label: 'يدوي',
      labelEn: 'Manual'
    },
  };
  return configs[type] || configs.manual;
};

export default function JournalEntries() {
  const { isDark, theme, themeName } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // For DashPro and Light themes, content should be light
  const isLightContent = themeName === 'light' || themeName === 'dashPro';

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  const fetchJournalEntries = async () => {
    setLoading(true);
    try {
      const workshopId = process.env.REACT_APP_WORKSHOP_ID || 'finmodule-sync';
      const response = await fetch(`${API_URL}/finance/journal-entries?workshop_id=${workshopId}&limit=50`);
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
          customer_name: entry.customer_name
        }));
        setEntries(transformedEntries);
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.entry_number?.toLowerCase().includes(query) ||
      entry.description?.toLowerCase().includes(query) ||
      entry.customer_name?.toLowerCase().includes(query) ||
      entry.vehicle_plate?.toLowerCase().includes(query)
    );
  });

  // Stats calculation
  const stats = {
    total: entries.length,
    posted: entries.filter(e => e.status === 'posted').length,
    draft: entries.filter(e => e.status === 'draft').length,
    totalAmount: entries.reduce((sum, e) => sum + (e.total_debit || 0), 0),
  };

  const handlePrintInvoice = (entry) => {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return;
    // ... (keep existing print logic)
  };

  // Dynamic styles based on theme
  const cardBg = isLightContent ? 'bg-white' : 'bg-gray-800';
  const cardBorder = isLightContent ? 'border-gray-200' : 'border-gray-700';
  const textPrimary = isLightContent ? 'text-gray-900' : 'text-white';
  const textSecondary = isLightContent ? 'text-gray-600' : 'text-gray-400';
  const textMuted = isLightContent ? 'text-gray-400' : 'text-gray-500';

  return (
    <div 
      className={`p-4 md:p-6 min-h-screen transition-colors duration-300`}
      style={{ backgroundColor: isLightContent ? '#f8fafc' : '#0f172a' }}
      data-testid="journal-entries-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>
            القيود المحاسبية والفواتير
          </h1>
          <p className={`text-sm mt-1 ${textSecondary}`}>
            إدارة السيولة، الضرائب، وتحليلات النظام المالي
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchJournalEntries}
            className={`p-2.5 rounded-xl transition-all ${
              isLightContent ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
            }`}
            style={{ boxShadow: isLightContent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white transition-all"
            style={{ 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Plus size={18} />
            <span>قيد جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Matching IMG_0084 style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* AI Assistant Card - Dark Navy */}
        <div 
          className="col-span-2 lg:col-span-1 rounded-2xl p-5"
          style={{ 
            background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)'
          }}
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
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/90 text-sm leading-relaxed">
              لديك {stats.total} قيد محاسبي، إجمالي الحركات {formatCurrency(stats.totalAmount)}
            </p>
          </div>
        </div>

        {/* Total Entries */}
        <div 
          className={`rounded-2xl p-5 ${cardBg}`}
          style={{ 
            boxShadow: isLightContent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            border: isLightContent ? '1px solid #334155' : '1px solid #e2e8f0'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText size={22} className="text-blue-600" />
            </div>
            <div>
              <p className={`text-xs ${textMuted}`}>إجمالي القيود</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Posted Entries */}
        <div 
          className={`rounded-2xl p-5 ${cardBg}`}
          style={{ 
            boxShadow: isLightContent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            border: isLightContent ? '1px solid #334155' : '1px solid #e2e8f0'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={22} className="text-emerald-600" />
            </div>
            <div>
              <p className={`text-xs ${textMuted}`}>المرحّلة</p>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.posted}</p>
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div 
          className={`rounded-2xl p-5 ${cardBg}`}
          style={{ 
            boxShadow: isLightContent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            border: isLightContent ? '1px solid #334155' : '1px solid #e2e8f0'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
              <DollarSign size={22} className="text-purple-600" />
            </div>
            <div>
              <p className={`text-xs ${textMuted}`}>إجمالي الحركات</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div 
        className={`rounded-2xl p-4 mb-6 ${cardBg}`}
        style={{ 
          boxShadow: isLightContent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          border: isLightContent ? '1px solid #334155' : '1px solid #e2e8f0'
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted}`} size={18} />
            <input
              type="text"
              placeholder="بحث برقم القيد أو الوصف أو العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pr-10 pl-4 py-2.5 rounded-xl text-sm transition-all ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
            />
          </div>

          <div className={`flex gap-1.5 p-1 rounded-xl ${isLightContent ? 'bg-gray-700' : 'bg-gray-100'}`}>
            {['all', 'posted', 'draft'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white shadow-md'
                    : isLightContent ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter === 'all' && 'الكل'}
                {filter === 'posted' && 'مرحّل'}
                {filter === 'draft' && 'مسودة'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Journal Entries Table - Matching IMG_0084 style */}
      <div 
        className={`rounded-2xl overflow-hidden ${cardBg}`}
        style={{ 
          boxShadow: isLightContent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          border: isLightContent ? '1px solid #334155' : '1px solid #e2e8f0'
        }}
      >
        {/* Table Header */}
        <div className={`px-6 py-4 border-b ${isLightContent ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h2 className={`font-semibold ${textPrimary}`}>سجل الفواتير والعمليات</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <span className={textSecondary}>جاري التحميل...</span>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isLightContent ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <BookOpen className={textMuted} size={32} />
            </div>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>لا توجد قيود</h3>
            <p className={textSecondary}>أضف قيداً جديداً أو قم بإضافة بنود لملف مركبة</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table Header Row */}
            <div className={`grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider ${
              isLightContent ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50'
            }`}>
              <div className="col-span-4">الوصف</div>
              <div className="col-span-2">التاريخ</div>
              <div className="col-span-2">العميل</div>
              <div className="col-span-2">المبلغ</div>
              <div className="col-span-1">الحالة</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            {filteredEntries.map((entry) => {
              const typeConfig = getEntryTypeConfig(entry.reference_type);
              const TypeIcon = typeConfig.icon;
              const total = entry.total_debit || 0;

              return (
                <div 
                  key={entry.id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                    isLightContent ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Description & Icon */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeConfig.bgColor}`}>
                      <TypeIcon size={18} className={typeConfig.textColor} />
                    </div>
                    <div>
                      <p className={`font-medium ${textPrimary} text-sm`}>
                        {entry.description || 'قيد محاسبي'}
                      </p>
                      <p className={`text-xs ${textMuted}`}>
                        {entry.entry_number}
                      </p>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="col-span-2">
                    <p className={`text-sm ${textSecondary}`}>
                      {formatDate(entry.entry_date)}
                    </p>
                  </div>

                  {/* Customer */}
                  <div className="col-span-2">
                    <p className={`text-sm ${textPrimary} truncate`}>
                      {entry.customer_name || '-'}
                    </p>
                    {entry.vehicle_plate && (
                      <p className={`text-xs ${textMuted} font-mono`}>
                        {entry.vehicle_plate}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="col-span-2">
                    <p className={`font-semibold ${textPrimary}`}>
                      {formatCurrency(total)}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      entry.status === 'posted' 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        entry.status === 'posted' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}></span>
                      {entry.status === 'posted' ? 'مرحّل' : 'مسودة'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end gap-1">
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setShowDetailModal(true);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        isLightContent ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                      }`}
                      title="عرض التفاصيل"
                    >
                      <Eye size={16} className={textSecondary} />
                    </button>
                    <button
                      onClick={() => handlePrintInvoice(entry)}
                      className={`p-2 rounded-lg transition-colors ${
                        isLightContent ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                      }`}
                      title="طباعة"
                    >
                      <Printer size={16} className={textSecondary} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
          isDark={isDark}
        />
      )}
    </div>
  );
}

// Entry Detail Modal - Matching reference style
function EntryDetailModal({ entry, onClose, onPrint, isDark }) {
  const typeConfig = getEntryTypeConfig(entry.reference_type);
  const cardBg = isLightContent ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isLightContent ? 'text-white' : 'text-gray-900';
  const textSecondary = isLightContent ? 'text-gray-400' : 'text-gray-600';
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className={`${cardBg} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      >
        {/* Header */}
        <div 
          className="p-6 border-b"
          style={{ 
            borderColor: isLightContent ? '#334155' : '#e2e8f0',
            background: isLightContent ? 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
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
          {/* Entry Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 ${isLightContent ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className={`text-xs ${textSecondary}`}>التاريخ</p>
                  <p className={`font-semibold ${textPrimary}`}>
                    {formatDate(entry.entry_date)}
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 ${isLightContent ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className={`text-xs ${textSecondary}`}>الحالة</p>
                  <p className={`font-semibold ${entry.status === 'posted' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {entry.status === 'posted' ? 'مرحّل ✓' : 'مسودة'}
                  </p>
                </div>
              </div>
            </div>

            {entry.customer_name && (
              <div className={`rounded-xl p-4 ${isLightContent ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <User size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondary}`}>العميل</p>
                    <p className={`font-semibold ${textPrimary}`}>{entry.customer_name}</p>
                  </div>
                </div>
              </div>
            )}

            {entry.vehicle_plate && (
              <div className={`rounded-xl p-4 ${isLightContent ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Wrench size={18} className="text-orange-600" />
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondary}`}>رقم اللوحة</p>
                    <p className={`font-semibold font-mono ${textPrimary}`}>{entry.vehicle_plate}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Entry Lines Table */}
          <div>
            <h3 className={`font-semibold ${textPrimary} mb-3 flex items-center gap-2`}>
              <ArrowLeftRight size={16} className="text-blue-600" />
              تفاصيل القيد
            </h3>
            <div 
              className={`rounded-xl overflow-hidden border ${isLightContent ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <table className="w-full">
                <thead className={isLightContent ? 'bg-gray-700/50' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-4 py-3 text-right text-xs font-semibold ${textSecondary}`}>الحساب</th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${textSecondary}`}>مدين</th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${textSecondary}`}>دائن</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLightContent ? 'divide-gray-700' : 'divide-gray-100'}`}>
                  {entry.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className={`px-4 py-3 ${textPrimary}`}>
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded ml-2">
                          {line.account_code}
                        </span>
                        {line.account_name}
                      </td>
                      <td className="px-4 py-3 text-left font-mono">
                        {line.debit > 0 ? (
                          <span className="text-emerald-600 font-semibold">{formatCurrency(line.debit)}</span>
                        ) : <span className={textSecondary}>-</span>}
                      </td>
                      <td className="px-4 py-3 text-left font-mono">
                        {line.credit > 0 ? (
                          <span className="text-rose-600 font-semibold">{formatCurrency(line.credit)}</span>
                        ) : <span className={textSecondary}>-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className={isLightContent ? 'bg-gray-700/50' : 'bg-gray-50'}>
                  <tr className="font-bold">
                    <td className={`px-4 py-3 ${textPrimary}`}>الإجمالي</td>
                    <td className="px-4 py-3 text-left text-emerald-600">{formatCurrency(entry.total_debit)}</td>
                    <td className="px-4 py-3 text-left text-rose-600">{formatCurrency(entry.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Balance Check */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${
            entry.total_debit === entry.total_credit 
              ? 'bg-emerald-50 border border-emerald-200' 
              : 'bg-rose-50 border border-rose-200'
          }`}>
            {entry.total_debit === entry.total_credit ? (
              <>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <span className="text-emerald-700 font-medium">القيد متوازن ✓</span>
              </>
            ) : (
              <>
                <div className="p-2 bg-rose-100 rounded-lg">
                  <XCircle size={20} className="text-rose-600" />
                </div>
                <span className="text-rose-700 font-medium">القيد غير متوازن!</span>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-6 border-t flex gap-3 ${isLightContent ? 'border-gray-700' : 'border-gray-200'}`}>
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
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              isDark 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
