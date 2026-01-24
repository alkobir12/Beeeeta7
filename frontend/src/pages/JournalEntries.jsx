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
  ArrowLeftRight
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Sample journal entries
const SAMPLE_ENTRIES = [
  {
    id: '1',
    entry_number: 'JE-2024-001',
    entry_date: '2024-12-15',
    description: 'تسجيل فاتورة مبيعات INV-2024-001',
    reference_type: 'invoice',
    reference_number: 'INV-2024-001',
    status: 'posted',
    total_debit: 5750,
    total_credit: 5750,
    lines: [
      { account_code: '112', account_name: 'الذمم المدينة', debit: 5750, credit: 0 },
      { account_code: '41', account_name: 'إيرادات الخدمات', debit: 0, credit: 5000 },
      { account_code: '212', account_name: 'ضريبة القيمة المضافة المستحقة', debit: 0, credit: 750 },
    ],
    created_by: 'أحمد محمد',
    posted_at: '2024-12-15T10:30:00',
  },
  {
    id: '2',
    entry_number: 'JE-2024-002',
    entry_date: '2024-12-16',
    description: 'استلام دفعة من العميل',
    reference_type: 'payment',
    reference_number: 'PAY-2024-001',
    status: 'posted',
    total_debit: 5750,
    total_credit: 5750,
    lines: [
      { account_code: '111', account_name: 'النقدية والبنوك', debit: 5750, credit: 0 },
      { account_code: '112', account_name: 'الذمم المدينة', debit: 0, credit: 5750 },
    ],
    created_by: 'أحمد محمد',
    posted_at: '2024-12-16T14:00:00',
  },
  {
    id: '3',
    entry_number: 'JE-2024-003',
    entry_date: '2024-12-18',
    description: 'شراء قطع غيار من المورد',
    reference_type: 'purchase',
    reference_number: 'PO-2024-005',
    status: 'posted',
    total_debit: 11500,
    total_credit: 11500,
    lines: [
      { account_code: '113', account_name: 'المخزون', debit: 10000, credit: 0 },
      { account_code: '212', account_name: 'ضريبة القيمة المضافة المستحقة', debit: 1500, credit: 0 },
      { account_code: '211', account_name: 'الذمم الدائنة', debit: 0, credit: 11500 },
    ],
    created_by: 'سعد العتيبي',
    posted_at: '2024-12-18T09:15:00',
  },
  {
    id: '4',
    entry_number: 'JE-2024-004',
    entry_date: '2024-12-20',
    description: 'دفع رواتب الموظفين لشهر ديسمبر',
    reference_type: 'salary',
    reference_number: null,
    status: 'draft',
    total_debit: 25000,
    total_credit: 25000,
    lines: [
      { account_code: '52', account_name: 'الرواتب والأجور', debit: 25000, credit: 0 },
      { account_code: '111', account_name: 'النقدية والبنوك', debit: 0, credit: 25000 },
    ],
    created_by: 'محمد الشهري',
    posted_at: null,
  },
];

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
          entry_number: `JE-${entry.date.replace(/-/g, '')}-${String(index + 1).padStart(3, '0')}`,
          entry_date: entry.date,
          description: entry.description,
          reference_type: entry.source === 'operation' ? (entry.description.includes('بيع') ? 'invoice' : 'purchase') : 'manual',
          reference_number: entry.source === 'operation' ? entry.id.substring(0, 8) : null,
          status: 'posted',
          total_debit: entry.total,
          total_credit: entry.total,
          lines: entry.lines.map(line => ({
            account_code: line.account,
            account_name: line.account_name,
            debit: line.debit,
            credit: line.credit
          })),
          created_by: 'النظام',
          posted_at: entry.date,
          vehicle_plate: entry.vehicle_plate,
          customer_name: entry.customer_name
        }));
        setEntries(transformedEntries);
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      setEntries(SAMPLE_ENTRIES);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-700 text-gray-300', icon: <Clock size={14} />, label: 'مسودة' },
      posted: { color: 'bg-green-900/50 text-green-300', icon: <CheckCircle size={14} />, label: 'مرحّل' },
      cancelled: { color: 'bg-red-900/50 text-red-300', icon: <XCircle size={14} />, label: 'ملغى' },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  const getReferenceTypeBadge = (type) => {
    const types = {
      invoice: { label: 'فاتورة', color: 'bg-blue-900/30 text-blue-300' },
      payment: { label: 'دفعة', color: 'bg-green-900/30 text-green-300' },
      purchase: { label: 'مشتريات', color: 'bg-purple-900/30 text-purple-300' },
      salary: { label: 'رواتب', color: 'bg-orange-900/30 text-orange-300' },
      manual: { label: 'يدوي', color: 'bg-gray-700 text-gray-300' },
    };
    const badge = types[type] || types.manual;
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const handlePrintInvoice = (entry) => {
    // صفحة طباعة مبنية على بيانات القيد نفسه
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
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .workshop-name { font-size: 20px; font-weight: 700; color: #111827; }
    .invoice-title { font-size: 18px; font-weight: 600; color: #111827; }
    .meta { font-size: 13px; color: #4b5563; margin-top: 4px; }
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-posted { background: #ecfdf3; color: #166534; }
    .section-title { font-size: 14px; font-weight: 600; color: #4b5563; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 32px; font-size: 13px; margin-bottom: 20px; }
    .info-label { color: #6b7280; }
    .info-value { color: #111827; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; text-align: right; font-weight: 600; color: #4b5563; }
    tfoot td { border-top: 1px solid #e5e7eb; font-weight: 600; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .totals { margin-top: 16px; width: 260px; margin-left: auto; font-size: 13px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals-label { color: #4b5563; }
    .totals-value { color: #111827; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <div class="workshop-name">${document.title || 'ورشة الصيانة'}</div>
        <div class="meta">سند فاتورة مبني على القيد: ${entry.entry_number}</div>
      </div>
      <div style="text-align: left;">
        <div class="invoice-title">فاتورة</div>
        <div class="meta">رقم الفاتورة: ${entry.entry_number}</div>
        <div class="meta">التاريخ: ${entry.entry_date}</div>
        <div style="margin-top: 6px;">
          <span class="badge badge-posted">${entry.status === 'posted' ? 'مرحّلة' : 'مسودة'}</span>
        </div>
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

    <div class="section-title">تفاصيل القيد / البنود</div>
    <table>
      <thead>
        <tr>
          <th>الحساب</th>
          <th class="text-right">مدين</th>
          <th class="text-right">دائن</th>
        </tr>
      </thead>
      <tbody>
        ${entry.lines.map(line => `
          <tr>
            <td>${line.account_code || ''} - ${line.account_name || ''}</td>
            <td class="text-right">${line.debit ? line.debit.toFixed(2) : '0.00'}</td>
            <td class="text-right">${line.credit ? line.credit.toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span class="totals-label">إجمالي المدين</span>
        <span class="totals-value">${(entry.total_debit || 0).toFixed(2)} ريال</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">إجمالي الدائن</span>
        <span class="totals-value">${(entry.total_credit || 0).toFixed(2)} ريال</span>
      </div>
      <div class="totals-row" style="border-top: 1px solid #e5e7eb; margin-top: 4px; padding-top: 6px;">
        <span class="totals-label">إجمالي الفاتورة</span>
        <span class="totals-value">${total.toFixed(2)} ريال</span>
      </div>
    </div>

    <div class="footer">
      تم توليد هذه الفاتورة من نظام القيود المحاسبية. للاستخدام الداخلي فقط.
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`);
    doc.close();
  };

      </span>
    );
  };

  const filteredEntries = entries.filter((entry) => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.entry_number.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query)
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
    totalAmount: entries.filter(e => e.status === 'posted').reduce((sum, e) => sum + e.total_debit, 0),
  };

  return (
    <div className="p-6 space-y-6" data-testid="journal-entries-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-blue-500" />
            القيود اليومية والفواتير
          </h1>
          <p className="text-gray-400">تسجيل ومتابعة القيود المحاسبية والفواتير المرتبطة بها</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          data-testid="add-entry-btn"
        >
          <Plus size={20} />
          <span>قيد جديد</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-900/30 rounded-lg">
              <FileText className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">إجمالي القيود</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-900/30 rounded-lg">
              <CheckCircle className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">المرحّلة</p>
              <p className="text-2xl font-bold text-green-400">{stats.posted}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-900/30 rounded-lg">
              <Clock className="text-yellow-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">المسودات</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.draft}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900/30 rounded-lg">
              <ArrowLeftRight className="text-purple-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">إجمالي الحركات</p>
              <p className="text-lg font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث برقم القيد أو الوصف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              data-testid="search-entries"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'draft', 'posted'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {filter === 'all' && 'الكل'}
                {filter === 'draft' && 'مسودة'}
                {filter === 'posted' && 'مرحّل'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-600" />
            <p className="text-gray-400 mt-4">لا توجد قيود</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">رقم القيد</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">التاريخ</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">الوصف</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">النوع</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">مدين</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">دائن</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">الحالة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-blue-400">{entry.entry_number}</span>
                        {entry.vehicle_plate && (
                          <span className="text-xs text-gray-400 mt-1">🚗 {entry.vehicle_plate}</span>
                        )}
                        {entry.customer_name && (
                          <span className="text-xs text-gray-500 mt-0.5">👤 {entry.customer_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-sm">
                      {new Date(entry.entry_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-4 text-white max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="px-4 py-4">
                      {getReferenceTypeBadge(entry.reference_type)}
                    </td>
                    <td className="px-4 py-4 text-left font-mono text-green-400">
                      {formatCurrency(entry.total_debit)}
                    </td>
                    <td className="px-4 py-4 text-left font-mono text-red-400">
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
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-gray-700 transition-colors" 
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} className="text-gray-400" />
                        </button>
                        
                        {entry.status === 'draft' && (
                          <button 
                            onClick={() => postEntry(entry.id)}
                            className="p-1.5 rounded hover:bg-green-900/30 transition-colors" 
                            title="ترحيل القيد"
                          >
                            <Send size={16} className="text-green-400" />
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

      {/* Detail Modal */}
      {showDetailModal && selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedEntry(null);
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateEntryModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(newEntry) => {
            setEntries([...entries, { ...newEntry, id: String(Date.now()), entry_number: `JE-2024-${String(entries.length + 1).padStart(3, '0')}` }]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// Entry Detail Modal
function EntryDetailModal({ entry, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">{entry.entry_number}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <XCircle size={24} />
            </button>
          </div>
          <p className="text-gray-400 mt-1">{entry.description}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Entry Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">التاريخ:</span>
              <span className="text-white mr-2">{new Date(entry.entry_date).toLocaleDateString('ar-SA')}</span>
            </div>
            <div>
              <span className="text-gray-400">الحالة:</span>
              <span className="mr-2">{entry.status === 'posted' ? '✓ مرحّل' : '⏳ مسودة'}</span>
            </div>
            {entry.reference_number && (
              <div>
                <span className="text-gray-400">المرجع:</span>
                <span className="text-blue-400 mr-2">{entry.reference_number}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">بواسطة:</span>
              <span className="text-white mr-2">{entry.created_by}</span>
            </div>
          </div>

          {/* Entry Lines */}
          <div>
            <h3 className="font-semibold text-white mb-3">تفاصيل القيد</h3>
            <div className="bg-gray-700/50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-right text-sm text-gray-300">الحساب</th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">مدين</th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">دائن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {entry.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-500 text-sm ml-2">{line.account_code}</span>
                        <span className="text-white">{line.account_name}</span>
                      </td>
                      <td className="px-4 py-3 text-left font-mono">
                        {line.debit > 0 ? (
                          <span className="text-green-400">{formatCurrency(line.debit)}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-left font-mono">
                        {line.credit > 0 ? (
                          <span className="text-red-400">{formatCurrency(line.credit)}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-700">
                  <tr className="font-bold">
                    <td className="px-4 py-3 text-white">الإجمالي</td>
                    <td className="px-4 py-3 text-left text-green-400">{formatCurrency(entry.total_debit)}</td>
                    <td className="px-4 py-3 text-left text-red-400">{formatCurrency(entry.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Balance Check */}
          <div className={`rounded-lg p-4 ${entry.total_debit === entry.total_credit ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
            <div className="flex items-center gap-2">
              {entry.total_debit === entry.total_credit ? (
                <>
                  <CheckCircle className="text-green-400" size={20} />
                  <span className="text-green-400">القيد متوازن ✓</span>
                </>
              ) : (
                <>
                  <XCircle className="text-red-400" size={20} />
                  <span className="text-red-400">القيد غير متوازن!</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">إنشاء قيد يومي جديد</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">التاريخ</label>
              <input
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">نوع المرجع</label>
              <select
                value={formData.reference_type}
                onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="manual">يدوي</option>
                <option value="invoice">فاتورة</option>
                <option value="payment">دفعة</option>
                <option value="purchase">مشتريات</option>
                <option value="salary">رواتب</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">الوصف</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="وصف القيد..."
              required
            />
          </div>

          {/* Entry Lines */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">بنود القيد</label>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="رمز الحساب"
                    value={line.account_code}
                    onChange={(e) => updateLine(index, 'account_code', e.target.value)}
                    className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono"
                  />
                  <input
                    type="text"
                    placeholder="اسم الحساب"
                    value={line.account_name}
                    onChange={(e) => updateLine(index, 'account_name', e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                  <input
                    type="number"
                    placeholder="مدين"
                    value={line.debit || ''}
                    onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-green-400"
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="دائن"
                    value={line.credit || ''}
                    onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-red-400"
                    min="0"
                    step="0.01"
                  />
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"
                    >
                      <XCircle size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-3 flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <Plus size={18} />
              <span>إضافة سطر</span>
            </button>
          </div>

          {/* Totals */}
          <div className={`rounded-lg p-4 ${isBalanced ? 'bg-green-900/20 border border-green-800' : 'bg-yellow-900/20 border border-yellow-800'}`}>
            <div className="flex justify-between items-center">
              <div className="flex gap-8">
                <div>
                  <span className="text-gray-400 text-sm">إجمالي المدين:</span>
                  <span className="text-green-400 font-bold mr-2">{formatCurrency(totalDebit)}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">إجمالي الدائن:</span>
                  <span className="text-red-400 font-bold mr-2">{formatCurrency(totalCredit)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <>
                    <CheckCircle className="text-green-400" size={18} />
                    <span className="text-green-400 text-sm">متوازن</span>
                  </>
                ) : (
                  <>
                    <Clock className="text-yellow-400" size={18} />
                    <span className="text-yellow-400 text-sm">غير متوازن</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 text-white transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إنشاء القيد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
