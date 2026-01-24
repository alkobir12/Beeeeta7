import React, { useState, useEffect } from 'react';
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
  Edit3,
  Trash2,
  Receipt,
  ShoppingCart,
  Briefcase,
  CreditCard,
  User
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Helper for entry type icons and colors
const getEntryTypeConfig = (type) => {
  const configs = {
    invoice: { 
      icon: Receipt, 
      color: 'from-blue-500 to-cyan-400', 
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      label: 'فاتورة',
      emoji: '🧾'
    },
    payment: { 
      icon: CreditCard, 
      color: 'from-emerald-500 to-teal-400', 
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      label: 'دفعة',
      emoji: '💰'
    },
    purchase: { 
      icon: ShoppingCart, 
      color: 'from-purple-500 to-violet-400', 
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      label: 'مشتريات',
      emoji: '📦'
    },
    salary: { 
      icon: Briefcase, 
      color: 'from-orange-500 to-amber-400', 
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      label: 'رواتب',
      emoji: '💼'
    },
    manual: { 
      icon: Edit3, 
      color: 'from-slate-500 to-gray-400', 
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      label: 'يدوي',
      emoji: '✏️'
    },
  };
  return configs[type] || configs.manual;
};

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch journal entries from backend
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
        // Transform backend data to match frontend format
        const transformedEntries = data.data.map((entry, index) => ({
          id: entry.id || String(index),
          entry_number: `JE-${entry.date?.replace(/-/g, '') || 'XXXX'}-${String(index + 1).padStart(3, '0')}`,
          entry_date: entry.date,
          description: entry.description,
          reference_type: entry.source === 'operation' ? (entry.description?.includes('بيع') ? 'invoice' : 'purchase') : 'manual',
          reference_number: entry.source === 'operation' ? entry.id?.substring(0, 8) : null,
          status: 'posted',
          total_debit: entry.total,
          total_credit: entry.total,
          lines: entry.lines?.map(line => ({
            account_code: line.account,
            account_name: line.account_name,
            debit: line.debit,
            credit: line.credit
          })) || [],
          created_by: 'النظام',
          posted_at: entry.date,
          vehicle_plate: entry.vehicle_plate,
          customer_name: entry.customer_name
        }));
        setEntries(transformedEntries);
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-amber-900/50 text-amber-300 border border-amber-600/30', icon: <Clock size={12} />, label: 'مسودة' },
      posted: { color: 'bg-emerald-900/50 text-emerald-300 border border-emerald-600/30', icon: <CheckCircle size={12} />, label: 'مرحّل' },
      cancelled: { color: 'bg-red-900/50 text-red-300 border border-red-600/30', icon: <XCircle size={12} />, label: 'ملغى' },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  const handlePrintInvoice = (entry) => {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return;

    const doc = printWindow.document;
    const total = entry.total_debit || entry.total_credit || 0;

    doc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة - ${entry.entry_number}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; background: #f5f5f5; color: #111827; }
    .invoice-container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; }
    .workshop-name { font-size: 22px; font-weight: 700; color: #1e40af; }
    .invoice-title { font-size: 18px; font-weight: 600; color: #111827; }
    .meta { font-size: 13px; color: #4b5563; margin-top: 4px; }
    .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #166534; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
    .info-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-size: 14px; color: #111827; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1e40af; color: white; padding: 12px 16px; text-align: right; font-size: 13px; }
    td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    tr:nth-child(even) { background: #f8fafc; }
    .totals { margin-top: 24px; padding: 16px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 8px; color: white; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .totals-row.final { border-top: 1px solid rgba(255,255,255,0.3); margin-top: 8px; padding-top: 16px; font-size: 18px; font-weight: 700; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <div class="workshop-name">ورشة الصيانة</div>
        <div class="meta">سند قيد محاسبي</div>
      </div>
      <div style="text-align: left;">
        <div class="invoice-title">فاتورة / قيد</div>
        <div class="meta">رقم: ${entry.entry_number}</div>
        <div class="meta">التاريخ: ${entry.entry_date || '-'}</div>
        <div style="margin-top: 8px;"><span class="badge">${entry.status === 'posted' ? '✓ مرحّل' : 'مسودة'}</span></div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">العميل</div>
        <div class="info-value">${entry.customer_name || '-'}</div>
      </div>
      <div>
        <div class="info-label">رقم اللوحة</div>
        <div class="info-value">${entry.vehicle_plate || '-'}</div>
      </div>
      <div>
        <div class="info-label">الوصف</div>
        <div class="info-value">${entry.description || '-'}</div>
      </div>
      <div>
        <div class="info-label">المرجع</div>
        <div class="info-value">${entry.reference_number || '-'}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50%;">الحساب</th>
          <th style="width: 25%;">مدين</th>
          <th style="width: 25%;">دائن</th>
        </tr>
      </thead>
      <tbody>
        ${entry.lines.map(line => `
          <tr>
            <td><strong>${line.account_code || ''}</strong> - ${line.account_name || ''}</td>
            <td style="color: #059669; font-weight: 600;">${line.debit ? line.debit.toFixed(2) + ' ر.س' : '-'}</td>
            <td style="color: #dc2626; font-weight: 600;">${line.credit ? line.credit.toFixed(2) + ' ر.س' : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>إجمالي المدين</span>
        <span>${(entry.total_debit || 0).toFixed(2)} ر.س</span>
      </div>
      <div class="totals-row">
        <span>إجمالي الدائن</span>
        <span>${(entry.total_credit || 0).toFixed(2)} ر.س</span>
      </div>
      <div class="totals-row final">
        <span>الإجمالي</span>
        <span>${total.toFixed(2)} ر.س</span>
      </div>
    </div>

    <div class="footer">
      تم إنشاء هذا المستند من نظام القيود المحاسبية | ${new Date().toLocaleDateString('ar-SA')}
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    doc.close();
  };

  const filteredEntries = entries.filter((entry) => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (typeFilter !== 'all' && entry.reference_type !== typeFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.entry_number?.toLowerCase().includes(query) ||
      entry.description?.toLowerCase().includes(query) ||
      entry.customer_name?.toLowerCase().includes(query) ||
      entry.vehicle_plate?.toLowerCase().includes(query)
    );
  });

  const postEntry = (entryId) => {
    setEntries(entries.map(e => 
      e.id === entryId 
        ? { ...e, status: 'posted', posted_at: new Date().toISOString() }
        : e
    ));
  };

  // Stats
  const stats = {
    total: entries.length,
    posted: entries.filter(e => e.status === 'posted').length,
    draft: entries.filter(e => e.status === 'draft').length,
    totalAmount: entries.filter(e => e.status === 'posted').reduce((sum, e) => sum + (e.total_debit || 0), 0),
  };

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen" data-testid="journal-entries-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <BookOpen className="text-white" size={24} />
            </div>
            القيود المحاسبية والفواتير
          </h1>
          <p className="text-gray-400 text-sm mt-1">تسجيل ومتابعة القيود المحاسبية وطباعتها كفواتير</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchJournalEntries}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 transition-all border border-gray-600/50"
            data-testid="refresh-entries-btn"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/20"
            data-testid="add-entry-btn"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">قيد جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl">
              <FileText className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400">إجمالي القيود</p>
              <p className="text-xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl">
              <CheckCircle className="text-emerald-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400">المرحّلة</p>
              <p className="text-xl font-bold text-emerald-400">{stats.posted}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl">
              <Clock className="text-amber-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400">المسودات</p>
              <p className="text-xl font-bold text-amber-400">{stats.draft}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 rounded-xl">
              <ArrowLeftRight className="text-purple-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400">إجمالي الحركات</p>
              <p className="text-base font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="بحث برقم القيد أو الوصف أو العميل أو اللوحة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              data-testid="search-entries"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 p-1 bg-gray-900/50 rounded-xl border border-gray-700/50">
              {['all', 'draft', 'posted'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === filter
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {filter === 'all' && 'الكل'}
                  {filter === 'draft' && 'مسودة'}
                  {filter === 'posted' && 'مرحّل'}
                </button>
              ))}
            </div>
            
            <div className="flex gap-1 p-1 bg-gray-900/50 rounded-xl border border-gray-700/50">
              {['all', 'invoice', 'purchase', 'payment', 'manual'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTypeFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    typeFilter === filter
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {filter === 'all' && 'كل الأنواع'}
                  {filter === 'invoice' && '🧾 فاتورة'}
                  {filter === 'purchase' && '📦 مشتريات'}
                  {filter === 'payment' && '💰 دفعة'}
                  {filter === 'manual' && '✏️ يدوي'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Entries Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            <span className="text-gray-400 text-sm">جاري التحميل...</span>
          </div>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-700/50 flex items-center justify-center">
            <BookOpen className="text-gray-500" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">لا توجد قيود</h3>
          <p className="text-gray-500 text-sm">أضف قيداً جديداً أو قم بإضافة بنود لملف مركبة</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredEntries.map((entry) => {
            const total = entry.total_debit || entry.total_credit || 0;
            const typeConfig = getEntryTypeConfig(entry.reference_type);
            const TypeIcon = typeConfig.icon;
            
            return (
              <article
                key={entry.id}
                className={`group relative bg-gradient-to-br from-gray-800/90 to-gray-900/90 rounded-2xl border ${typeConfig.borderColor} p-4 flex flex-col backdrop-blur-sm hover:shadow-xl hover:shadow-black/20 transition-all duration-300 hover:-translate-y-1`}
                data-testid={`entry-card-${entry.id}`}
              >
                {/* Gradient accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${typeConfig.color}`}></div>
                
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${typeConfig.bgColor} flex items-center justify-center text-xl`}>
                      {typeConfig.emoji}
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">رقم القيد</div>
                      <div className="font-bold text-blue-400 text-sm">{entry.entry_number}</div>
                      {entry.entry_date && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {new Date(entry.entry_date).toLocaleDateString('ar-SA')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg ${typeConfig.bgColor} ${typeConfig.borderColor} border font-medium`}>
                      {typeConfig.label}
                    </span>
                    {getStatusBadge(entry.status)}
                  </div>
                </div>

                {/* Customer & Vehicle Info */}
                <div className="space-y-1.5 mb-3 flex-1">
                  {entry.customer_name && (
                    <div className="flex items-center gap-2 text-xs">
                      <User size={12} className="text-gray-500" />
                      <span className="text-gray-300 truncate">{entry.customer_name}</span>
                    </div>
                  )}
                  {entry.vehicle_plate && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">🚗</span>
                      <span className="text-gray-300 font-mono">{entry.vehicle_plate}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                    {entry.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  <div>
                    <div className="text-[10px] text-gray-500">إجمالي القيد</div>
                    <div className={`font-bold text-base bg-gradient-to-r ${typeConfig.color} bg-clip-text text-transparent`}>
                      {formatCurrency(total)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setShowDetailModal(true);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                      title="عرض التفاصيل"
                    >
                      <Eye size={16} className="text-gray-400 hover:text-white" />
                    </button>

                    <button
                      onClick={() => handlePrintInvoice(entry)}
                      className="p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
                      title="طباعة الفاتورة"
                    >
                      <Printer size={16} className="text-blue-400 hover:text-blue-300" />
                    </button>

                    {entry.status === 'draft' && (
                      <button
                        onClick={() => postEntry(entry.id)}
                        className="p-2 rounded-lg hover:bg-emerald-500/20 transition-colors"
                        title="ترحيل القيد"
                      >
                        <Send size={16} className="text-emerald-400 hover:text-emerald-300" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedEntry(null);
          }}
          onPrint={handlePrintInvoice}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateEntryModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(newEntry) => {
            setEntries([...entries, { ...newEntry, id: String(Date.now()), entry_number: `JE-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(entries.length + 1).padStart(3, '0')}` }]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// Entry Detail Modal
function EntryDetailModal({ entry, onClose, onPrint }) {
  const typeConfig = getEntryTypeConfig(entry.reference_type);
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700/50 shadow-2xl">
        {/* Header */}
        <div className={`p-6 border-b border-gray-700/50 bg-gradient-to-r ${typeConfig.color} bg-opacity-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${typeConfig.bgColor} flex items-center justify-center text-2xl`}>
                {typeConfig.emoji}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{entry.entry_number}</h2>
                <p className="text-gray-400 text-sm">{entry.description}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors">
              <XCircle size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Entry Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
              <span className="text-xs text-gray-500">التاريخ</span>
              <p className="text-white font-medium">{new Date(entry.entry_date).toLocaleDateString('ar-SA')}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
              <span className="text-xs text-gray-500">الحالة</span>
              <p className="mt-1">{entry.status === 'posted' ? <span className="text-emerald-400">✓ مرحّل</span> : <span className="text-amber-400">⏳ مسودة</span>}</p>
            </div>
            {entry.customer_name && (
              <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
                <span className="text-xs text-gray-500">العميل</span>
                <p className="text-white font-medium">{entry.customer_name}</p>
              </div>
            )}
            {entry.vehicle_plate && (
              <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/30">
                <span className="text-xs text-gray-500">رقم اللوحة</span>
                <p className="text-white font-medium font-mono">{entry.vehicle_plate}</p>
              </div>
            )}
          </div>

          {/* Entry Lines */}
          <div>
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-blue-400" />
              تفاصيل القيد
            </h3>
            <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-gray-700/30">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs text-gray-400 font-medium">الحساب</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">مدين</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-400 font-medium">دائن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {entry.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-blue-400 text-xs ml-2 bg-blue-500/10 px-1.5 py-0.5 rounded">{line.account_code}</span>
                        <span className="text-white text-sm">{line.account_name}</span>
                      </td>
                      <td className="px-4 py-3 text-left font-mono text-sm">
                        {line.debit > 0 ? (
                          <span className="text-emerald-400 font-semibold">{formatCurrency(line.debit)}</span>
                        ) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-4 py-3 text-left font-mono text-sm">
                        {line.credit > 0 ? (
                          <span className="text-rose-400 font-semibold">{formatCurrency(line.credit)}</span>
                        ) : <span className="text-gray-600">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-800/50">
                  <tr className="font-bold">
                    <td className="px-4 py-3 text-white">الإجمالي</td>
                    <td className="px-4 py-3 text-left text-emerald-400">{formatCurrency(entry.total_debit)}</td>
                    <td className="px-4 py-3 text-left text-rose-400">{formatCurrency(entry.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Balance Check */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${entry.total_debit === entry.total_credit ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
            {entry.total_debit === entry.total_credit ? (
              <>
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle className="text-emerald-400" size={20} />
                </div>
                <span className="text-emerald-400 font-medium">القيد متوازن ✓</span>
              </>
            ) : (
              <>
                <div className="p-2 bg-rose-500/20 rounded-lg">
                  <XCircle className="text-rose-400" size={20} />
                </div>
                <span className="text-rose-400 font-medium">القيد غير متوازن!</span>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-700/50 flex gap-3">
          <button
            onClick={() => onPrint(entry)}
            className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-medium flex items-center justify-center gap-2"
          >
            <Printer size={18} />
            طباعة كفاتورة
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 transition-all font-medium border border-gray-600/50"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Entry Modal
function CreateEntryModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    reference_type: 'manual',
    reference_number: '',
  });
  const [lines, setLines] = useState([
    { account_code: '', account_name: '', debit: 0, credit: 0 },
    { account_code: '', account_name: '', debit: 0, credit: 0 },
  ]);

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const addLine = () => {
    setLines([...lines, { account_code: '', account_name: '', debit: 0, credit: 0 }]);
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const removeLine = (index) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isBalanced) return;
    
    onCreate({
      ...formData,
      lines,
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: 'draft',
      created_by: 'المستخدم الحالي',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700/50 shadow-2xl">
        <div className="p-6 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <Plus className="text-white" size={20} />
            </div>
            إنشاء قيد يومي جديد
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">التاريخ</label>
              <input
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">نوع المرجع</label>
              <select
                value={formData.reference_type}
                onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="manual">✏️ يدوي</option>
                <option value="invoice">🧾 فاتورة</option>
                <option value="payment">💰 دفعة</option>
                <option value="purchase">📦 مشتريات</option>
                <option value="salary">💼 رواتب</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">الوصف</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-gray-500"
              placeholder="وصف القيد..."
              required
            />
          </div>

          {/* Entry Lines */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">بنود القيد</label>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="flex gap-2 items-center bg-gray-900/30 p-3 rounded-xl border border-gray-700/30">
                  <input
                    type="text"
                    placeholder="رمز"
                    value={line.account_code}
                    onChange={(e) => updateLine(index, 'account_code', e.target.value)}
                    className="w-20 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <input
                    type="text"
                    placeholder="اسم الحساب"
                    value={line.account_name}
                    onChange={(e) => updateLine(index, 'account_name', e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <input
                    type="number"
                    placeholder="مدين"
                    value={line.debit || ''}
                    onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 bg-emerald-900/20 border border-emerald-700/30 rounded-lg text-emerald-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="دائن"
                    value={line.credit || ''}
                    onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 bg-rose-900/20 border border-rose-700/30 rounded-lg text-rose-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    min="0"
                    step="0.01"
                  />
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-2 text-rose-400 hover:bg-rose-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-3 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              <Plus size={16} />
              إضافة سطر
            </button>
          </div>

          {/* Totals */}
          <div className={`rounded-xl p-4 ${isBalanced ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
            <div className="flex justify-between items-center">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400 text-xs">إجمالي المدين</span>
                  <p className="text-emerald-400 font-bold text-lg">{formatCurrency(totalDebit)}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">إجمالي الدائن</span>
                  <p className="text-rose-400 font-bold text-lg">{formatCurrency(totalCredit)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <>
                    <CheckCircle className="text-emerald-400" size={20} />
                    <span className="text-emerald-400 font-medium">متوازن ✓</span>
                  </>
                ) : (
                  <>
                    <Clock className="text-amber-400" size={20} />
                    <span className="text-amber-400 font-medium">غير متوازن</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl hover:bg-gray-700 text-gray-300 transition-all font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              إنشاء القيد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
