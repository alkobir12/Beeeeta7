import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  AlertCircle,
  DollarSign,
  Eye,
  CreditCard,
  Send
} from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, typeFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Mock data for now
      setInvoices([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          invoice_type: 'sale',
          invoice_date: '2024-12-15',
          due_date: '2024-12-30',
          customer_name: 'محمد أحمد العتيبي',
          items: [],
          subtotal: 5000,
          tax_amount: 750,
          discount_amount: 0,
          total_amount: 5750,
          amount_paid: 5750,
          balance_due: 0,
          status: 'paid',
          payment_status: 'paid',
        },
        {
          id: '2',
          invoice_number: 'INV-2024-002',
          invoice_type: 'sale',
          invoice_date: '2024-12-18',
          due_date: '2025-01-02',
          customer_name: 'عبدالله سعد المالكي',
          items: [],
          subtotal: 12000,
          tax_amount: 1800,
          discount_amount: 500,
          total_amount: 13300,
          amount_paid: 6000,
          balance_due: 7300,
          status: 'issued',
          payment_status: 'partial',
        },
        {
          id: '3',
          invoice_number: 'INV-2024-003',
          invoice_type: 'sale',
          invoice_date: '2024-12-20',
          customer_name: 'فهد خالد الدوسري',
          items: [],
          subtotal: 3500,
          tax_amount: 525,
          discount_amount: 0,
          total_amount: 4025,
          amount_paid: 0,
          balance_due: 4025,
          status: 'draft',
          payment_status: 'unpaid',
        },
      ]);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-700 text-gray-300', icon: <Clock size={14} />, label: 'مسودة' },
      issued: { color: 'bg-blue-900/50 text-blue-300', icon: <Send size={14} />, label: 'صادرة' },
      paid: { color: 'bg-green-900/50 text-green-300', icon: <CheckCircle size={14} />, label: 'مدفوعة' },
      cancelled: { color: 'bg-red-900/50 text-red-300', icon: <XCircle size={14} />, label: 'ملغية' },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status) => {
    const badges = {
      unpaid: { color: 'bg-red-900/50 text-red-300', label: 'غير مدفوعة' },
      partial: { color: 'bg-yellow-900/50 text-yellow-300', label: 'مدفوعة جزئياً' },
      paid: { color: 'bg-green-900/50 text-green-300', label: 'مدفوعة بالكامل' },
    };
    const badge = badges[status] || badges.unpaid;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(query) ||
      inv.customer_name?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    pendingAmount: invoices.filter(inv => inv.payment_status !== 'paid').reduce((sum, inv) => sum + inv.balance_due, 0),
    paidCount: invoices.filter(inv => inv.status === 'paid').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">الفواتير</h1>
          <p className="text-gray-400">إدارة فواتير المبيعات والمشتريات</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>فاتورة جديدة</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-900/30 rounded-lg">
              <FileText className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">إجمالي الفواتير</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-900/30 rounded-lg">
              <DollarSign className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">إجمالي المبلغ</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-900/30 rounded-lg">
              <Clock className="text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">المبالغ المعلقة</p>
              <p className="text-xl font-bold text-orange-400">{formatCurrency(stats.pendingAmount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-900/30 rounded-lg">
              <CheckCircle className="text-purple-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">المدفوعة</p>
              <p className="text-2xl font-bold text-green-400">{stats.paidCount}</p>
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
              placeholder="بحث برقم الفاتورة أو اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'draft', 'issued', 'paid'].map((filter) => (
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
                {filter === 'issued' && 'صادرة'}
                {filter === 'paid' && 'مدفوعة'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchInvoices}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={20} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-600" />
            <p className="text-gray-400 mt-4">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">العميل</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">التاريخ</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">المبلغ</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">المتبقي</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">الحالة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">الدفع</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-4">
                      <span className="font-medium text-blue-400">{invoice.invoice_number}</span>
                    </td>
                    <td className="px-4 py-4 text-white">
                      {invoice.customer_name || '-'}
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-sm">
                      {new Date(invoice.invoice_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-4 text-left font-medium text-white">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-4 text-left">
                      <span className={invoice.balance_due > 0 ? 'text-orange-400 font-medium' : 'text-green-400'}>
                        {formatCurrency(invoice.balance_due)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-4 py-4">
                      {getPaymentStatusBadge(invoice.payment_status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 rounded hover:bg-gray-700 transition-colors" title="عرض">
                          <Eye size={16} className="text-gray-400" />
                        </button>
                        
                        {invoice.status === 'draft' && (
                          <button className="p-1.5 rounded hover:bg-blue-900/30 transition-colors" title="إصدار">
                            <Send size={16} className="text-blue-400" />
                          </button>
                        )}
                        
                        {invoice.status !== 'draft' && invoice.balance_due > 0 && (
                          <button 
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowPaymentModal(true);
                            }}
                            className="p-1.5 rounded hover:bg-green-900/30 transition-colors"
                            title="تسجيل دفعة"
                          >
                            <CreditCard size={16} className="text-green-400" />
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

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => {
            setShowCreateModal(false);
            fetchInvoices();
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          onSubmit={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}

// Create Invoice Modal
function CreateInvoiceModal({ onClose, onSuccess }) {
  const [invoiceType, setInvoiceType] = useState('sale');
  const [customerName, setCustomerName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [taxRate, setTaxRate] = useState(15);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
    }).format(amount || 0);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      onSuccess();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">إنشاء فاتورة جديدة</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Invoice Type */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-gray-300">
              <input
                type="radio"
                name="invoiceType"
                value="sale"
                checked={invoiceType === 'sale'}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span>فاتورة مبيعات</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-300">
              <input
                type="radio"
                name="invoiceType"
                value="purchase"
                checked={invoiceType === 'purchase'}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span>فاتورة مشتريات</span>
            </label>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {invoiceType === 'sale' ? 'اسم العميل' : 'اسم المورد'}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">تاريخ الفاتورة</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                required
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">البنود</label>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <input
                    type="text"
                    placeholder="الوصف"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    required
                  />
                  <input
                    type="number"
                    placeholder="الكمية"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="1"
                    required
                  />
                  <input
                    type="number"
                    placeholder="السعر"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    min="0"
                    step="0.01"
                    required
                  />
                  <span className="w-32 py-2 text-center font-medium text-white">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
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
              onClick={addItem}
              className="mt-3 flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <Plus size={18} />
              <span>إضافة بند</span>
            </button>
          </div>

          {/* Summary */}
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>المجموع الفرعي</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>ضريبة القيمة المضافة ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-600 text-white">
              <span>الإجمالي</span>
              <span className="text-blue-400">{formatCurrency(total)}</span>
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
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'جارٍ الإنشاء...' : 'إنشاء الفاتورة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Payment Modal
function PaymentModal({ invoice, onClose, onSubmit }) {
  const [amount, setAmount] = useState(invoice.balance_due);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
    }).format(amt || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      onSubmit();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">تسجيل دفعة</h2>
          <p className="text-sm text-gray-400 mt-1">فاتورة رقم: {invoice.invoice_number}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-800">
            <div className="flex justify-between text-sm text-gray-300">
              <span>إجمالي الفاتورة</span>
              <span className="font-medium text-white">{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 text-gray-300">
              <span>المدفوع</span>
              <span className="text-green-400">{formatCurrency(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2 pt-2 border-t border-blue-800 text-white">
              <span>المتبقي</span>
              <span className="text-orange-400">{formatCurrency(invoice.balance_due)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">المبلغ</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              min="0.01"
              max={invoice.balance_due}
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">طريقة الدفع</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="cash">نقداً</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="credit_card">بطاقة ائتمان</option>
              <option value="check">شيك</option>
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
              disabled={submitting || amount <= 0 || amount > invoice.balance_due}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'جارٍ التسجيل...' : 'تسجيل الدفعة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
