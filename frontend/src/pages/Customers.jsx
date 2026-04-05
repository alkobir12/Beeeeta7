import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Phone, Mail, Plus, Car, MapPin, RefreshCw, User, Edit2, Trash2, Upload, MessageCircle } from 'lucide-react';
import { customerAPI, api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import DebtWhatsAppComposerDialog from '../components/DebtWhatsAppComposerDialog';
import { buildDebtWhatsAppDraft } from '../utils/debtWhatsapp';
import { getWhatsAppLink } from '../utils/constants';

const Customers = () => {
  const { themeName } = useTheme();
  const { toast } = useToast();
  const isLight = themeName === 'light' || themeName === 'dashPro';
  const workshopId = process.env.REACT_APP_WORKSHOP_ID;
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    fileNumber: '',
    email: '',
    address: '',
    vehicleBrand: '',
    vehiclePlate: '',
    vehicleKm: '',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [whatsAppDialogOpen, setWhatsAppDialogOpen] = useState(false);
  const [whatsAppDrafts, setWhatsAppDrafts] = useState([]);
  const fileInputRef = useRef(null);

  const styles = {
    bg: isLight ? '#f5f7fb' : '#0b1120',
    cardBg: isLight ? '#ffffff' : '#1e293b',
    textPrimary: isLight ? '#0f172a' : '#f9fafb',
    textSecondary: isLight ? '#64748b' : '#cbd5f5',
  };

  const cardGradient = 'radial-gradient(circle at 0% 0%, rgba(59,130,246,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)';

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll(workshopId ? { workshop_id: workshopId } : {});
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      fileNumber: '',
      email: '',
      address: '',
      vehicleBrand: '',
      vehiclePlate: '',
      vehicleKm: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      fileNumber: customer.fileNumber || '',
      email: customer.email || '',
      address: customer.address || '',
      vehicleBrand: customer.vehicleBrand || '',
      vehiclePlate: customer.vehiclePlate || '',
      vehicleKm: customer.vehicleKm || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      toast({ title: 'يرجى إدخال اسم العميل ورقم الجوال', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        fileNumber: formData.fileNumber?.trim() || null,
        vehicleKm: formData.vehicleKm ? Number(formData.vehicleKm) : null,
      };
      if (editingCustomer?.id) {
        await customerAPI.update(editingCustomer.id, payload);
        toast({ title: 'تم تحديث بيانات العميل بنجاح' });
      } else {
        await customerAPI.create(payload);
        toast({ title: 'تمت إضافة العميل بنجاح' });
      }
      setShowForm(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({ title: 'تعذر حفظ بيانات العميل', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setSaving(true);
    try {
      await customerAPI.delete(deleteTarget.id);
      toast({ title: 'تم حذف العميل بنجاح' });
      setDeleteTarget(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({ title: 'تعذر حذف العميل', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportSummary(null);
    setImportError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/import/customers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSummary(response.data);
      await fetchCustomers();
    } catch (error) {
      const message = error?.response?.data?.detail || 'تعذر استيراد الملف.';
      setImportError(message);
    } finally {
      setImporting(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery) ||
    String(customer.fileNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMoney = (value) => Number(value || 0).toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const openWhatsAppPreview = (customer) => {
    const draft = buildDebtWhatsAppDraft(customer, 'customer');
    if (!draft.phone) {
      toast({ title: 'رقم غير صالح', description: 'لا يوجد رقم واتساب صالح لهذا العميل', variant: 'destructive' });
      return;
    }
    setWhatsAppDrafts([draft]);
    setWhatsAppDialogOpen(true);
  };

  const updateWhatsAppDraft = (draftId, message) => {
    setWhatsAppDrafts((prev) => prev.map((draft) => (
      draft.id === draftId
        ? { ...draft, message, url: draft.phone ? getWhatsAppLink(draft.phone, message) : '' }
        : draft
    )));
  };

  const sendWhatsAppCurrent = (draft) => {
    if (!draft?.phone || !draft?.url) {
      toast({ title: 'خطأ', description: 'تعذر إنشاء رابط واتساب', variant: 'destructive' });
      return;
    }
    window.open(draft.url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]" data-testid="customers-loading">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="max-w-7xl mx-auto min-h-screen px-4 py-6"
      style={{ backgroundColor: styles.bg }}
      dir="rtl"
      data-testid="customers-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1
            className="text-3xl font-bold flex items-center gap-3"
            style={{ color: styles.textPrimary }}
            data-testid="customers-title"
          >
            <Users size={32} className="text-blue-500" />
            العملاء
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: styles.textSecondary }}
            data-testid="customers-subtitle"
          >
            إدارة بيانات العملاء والتواصل معهم
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
            data-testid="customers-import-input"
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: styles.cardBg,
              border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`,
              color: styles.textPrimary,
            }}
            data-testid="customers-import-button"
          >
            <Upload size={18} />
            <span>{importing ? 'جاري الاستيراد...' : 'استيراد Excel'}</span>
          </button>
          <button
            onClick={fetchCustomers}
            className="p-2.5 rounded-lg transition-colors"
            style={{ 
              backgroundColor: styles.cardBg,
              border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`
            }}
            data-testid="customers-refresh-button"
          >
            <RefreshCw size={18} style={{ color: styles.textSecondary }} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all"
            data-testid="customers-add-button"
            style={{ 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
            }}
            data-testid="customers-add-button"
          >
            <Plus size={18} />
            <span>عميل جديد</span>
          </button>
        </div>
      </div>

      {(importSummary || importError) && (
        <div
          className="mb-6 rounded-2xl border px-4 py-3"
          style={{
            backgroundColor: styles.cardBg,
            borderColor: isLight ? '#e2e8f0' : '#334155',
            color: styles.textPrimary,
          }}
          data-testid="customers-import-summary"
        >
          {importSummary && (
            <div className="text-sm" data-testid="customers-import-success">
              تم استيراد <span className="font-bold">{importSummary.imported || 0}</span> عميل،
              تحديث <span className="font-bold">{importSummary.updated || 0}</span>،
              تخطي <span className="font-bold">{importSummary.skipped || 0}</span>.
            </div>
          )}
          {importError && (
            <div className="text-sm text-red-500" data-testid="customers-import-error">
              {importError}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-6" data-testid="customers-search-section">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن عميل بالاسم، رقم الهاتف، رقم الملف أو البريد الإلكتروني..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-3 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{ 
              backgroundColor: styles.cardBg,
              border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`,
              color: styles.textPrimary
            }}
            data-testid="customers-search-input"
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-16 text-center" data-testid="customers-empty-state">
            <Users size={48} className="mx-auto mb-4 text-slate-400" />
            <h3
              className="text-xl font-semibold mb-2"
              style={{ color: styles.textPrimary }}
              data-testid="customers-empty-title"
            >
              لا يوجد عملاء
            </h3>
            <p style={{ color: styles.textSecondary }} data-testid="customers-empty-description">
              ابدأ بإضافة عميل جديد
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="relative rounded-[28px] overflow-hidden transition-all duration-400 cursor-pointer"
              style={{
                background: cardGradient,
                border: '1px solid rgba(15,23,42,0.55)',
                boxShadow: expandedCustomerId === customer.id
                  ? '0 32px 100px rgba(15,23,42,0.9), 0 0 0 1px rgba(59,130,246,0.3)'
                  : '0 24px 70px rgba(15,23,42,0.75)',
                height: expandedCustomerId === customer.id ? 'auto' : '220px',
                minHeight: '220px',
                maxHeight: expandedCustomerId === customer.id ? 'none' : '220px',
                transform: expandedCustomerId === customer.id ? 'scale(1.02)' : 'scale(1)',
              }}
              onClick={() => setExpandedCustomerId(prev => prev === customer.id ? null : customer.id)}
              onMouseEnter={() => setExpandedCustomerId(customer.id)}
              onMouseLeave={() => setExpandedCustomerId(null)}
              data-testid={`customer-card-${customer.id}`}
            >
              {/* النقاط الزخرفية */}
              <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
                <span className="w-1 h-1 rounded-full bg-gray-400" />
                <span className="w-1 h-1 rounded-full bg-gray-400" />
                <span className="w-1 h-1 rounded-full bg-gray-400" />
              </div>

              <div className="p-6">
                {/* الاسم والأيقونة */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <User size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-50" data-testid={`customer-name-${customer.id}`}>
                        {customer.name}
                      </h3>
                      <p className="text-xs text-slate-400" data-testid={`customer-id-${customer.id}`}>
                        عميل #{customer.id?.slice(0, 8)}
                      </p>
                      <p className="text-[11px] text-cyan-300" data-testid={`customer-file-number-${customer.id}`}>
                        رقم الملف: {customer.fileNumber || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(customer);
                      }}
                      className="p-2 rounded-lg border border-white/10 text-slate-200 hover:bg-white/10"
                      data-testid={`customer-edit-inline-${customer.id}`}
                    >
                      تعديل
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(customer);
                      }}
                      className="p-2 rounded-lg border border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                      data-testid={`customer-delete-inline-${customer.id}`}
                    >
                      حذف
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4" data-testid={`customer-balance-grid-${customer.id}`}>
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-2">
                    <p className="text-[10px] text-cyan-200/80">مدين</p>
                    <p className="text-xs font-bold text-cyan-100" data-testid={`customer-debit-balance-${customer.id}`}>
                      {formatMoney(customer.debitBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-2">
                    <p className="text-[10px] text-amber-200/80">دائن</p>
                    <p className="text-xs font-bold text-amber-100" data-testid={`customer-credit-balance-${customer.id}`}>
                      {formatMoney(customer.creditBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-2">
                    <p className="text-[10px] text-rose-200/80">آجل</p>
                    <p className="text-xs font-bold text-rose-100" data-testid={`customer-ajel-balance-${customer.id}`}>
                      {formatMoney(customer.ajelBalance)}
                    </p>
                  </div>
                </div>

                {/* معلومات الاتصال */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                      <Phone size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">رقم الهاتف</p>
                      <p className="text-sm font-bold text-slate-100 font-mono" data-testid={`customer-phone-${customer.id}`}>
                        {customer.phone || '-'}
                      </p>
                    </div>
                  </div>
                  
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                        <Mail size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 font-medium">البريد الإلكتروني</p>
                        <p className="text-sm font-semibold text-slate-100 truncate" data-testid={`customer-email-${customer.id}`}>
                          {customer.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* التفاصيل الموسعة */}
                {expandedCustomerId === customer.id && (
                  <div
                    className="bg-slate-950/60 rounded-2xl px-4 py-3 border border-slate-800/80 space-y-3"
                    data-testid={`customer-details-${customer.id}`}
                  >
                    {customer.address && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                          <MapPin size={14} />
                          العنوان
                        </span>
                        <span className="text-sm font-semibold text-slate-100" data-testid={`customer-address-${customer.id}`}>
                          {customer.address}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">رقم الملف</span>
                      <span className="text-sm font-bold text-cyan-300" data-testid={`customer-file-number-detail-${customer.id}`}>
                        {customer.fileNumber || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                        <Car size={14} />
                        عدد المركبات
                      </span>
                      <span className="text-sm font-bold text-blue-400" data-testid={`customer-vehicles-count-${customer.id}`}>
                        {customer.vehicleCount || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">إجمالي المدفوعات</span>
                      <span className="text-sm font-bold text-emerald-300" data-testid={`customer-settled-amount-${customer.id}`}>
                        {formatMoney(customer.settledAmount)} ر.س
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">عدد خطط/حركات الآجل</span>
                      <span className="text-sm font-bold text-indigo-300" data-testid={`customer-payment-plan-count-${customer.id}`}>
                        {customer.paymentPlanCount || 0}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-2" data-testid={`customer-movements-${customer.id}`}>
                      <p className="text-xs font-semibold text-slate-300">سجل الحركات</p>
                      {Array.isArray(customer.movements) && customer.movements.length > 0 ? (
                        customer.movements.slice(0, 4).map((mv) => (
                          <div
                            key={mv.id}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"
                            data-testid={`customer-movement-item-${customer.id}-${mv.id}`}
                          >
                            <div>
                              <p className="text-[11px] text-slate-200">{mv.label || 'حركة مالية'}</p>
                              <p className="text-[10px] text-slate-400">
                                {mv.date ? String(mv.date).slice(0, 10) : '-'}
                                <span className={`mx-1 px-1.5 py-0.5 rounded ${mv.flow === 'out' ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                                  {mv.flowLabel || (mv.flow === 'out' ? 'خارج' : 'داخل')}
                                </span>
                                <span className="text-[10px] text-slate-500" data-testid={`customer-movement-visit-${customer.id}-${mv.id}`}>
                                  زيارة: {mv.visitId || '-'}
                                </span>
                              </p>
                            </div>
                            <p className={`text-xs font-bold ${mv.direction === 'debit' ? 'text-cyan-300' : 'text-amber-300'}`}>
                              {formatMoney(mv.amount)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-500" data-testid={`customer-movements-empty-${customer.id}`}>
                          لا توجد حركات مسجلة حتى الآن.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsAppPreview(customer);
                        }}
                        className="flex-1 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all text-sm font-semibold"
                        data-testid={`customer-whatsapp-preview-button-${customer.id}`}
                      >
                        <MessageCircle size={14} className="inline ml-1" />
                        معاينة واتساب
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(customer);
                        }}
                        className="flex-1 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-sm font-semibold"
                        data-testid={`customer-edit-button-${customer.id}`}
                      >
                        <Edit2 size={14} className="inline ml-1" />
                        تعديل
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(customer);
                        }}
                        className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-semibold"
                        data-testid={`customer-delete-button-${customer.id}`}
                      >
                        <Trash2 size={14} className="inline ml-1" />
                        حذف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={openCreateModal}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center rounded-full bg-blue-500 px-4 py-4 text-white shadow-xl md:hidden"
        data-testid="customers-add-floating-button"
      >
        +
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="customer-form-modal">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white"
                data-testid="customer-form-close"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400">اسم العميل</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  data-testid="customer-form-name"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">رقم الجوال</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  data-testid="customer-form-phone"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">رقم الملف</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.fileNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fileNumber: e.target.value }))}
                  data-testid="customer-form-file-number"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">البريد الإلكتروني</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  data-testid="customer-form-email"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">العنوان</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  data-testid="customer-form-address"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">نوع المركبة</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.vehicleBrand}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vehicleBrand: e.target.value }))}
                  data-testid="customer-form-vehicle-brand"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">رقم اللوحة</label>
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.vehiclePlate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vehiclePlate: e.target.value }))}
                  data-testid="customer-form-vehicle-plate"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">عداد المركبة</label>
                <input
                  type="number"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.vehicleKm}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vehicleKm: e.target.value }))}
                  data-testid="customer-form-vehicle-km"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200"
                data-testid="customer-form-cancel"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                data-testid="customer-form-submit"
              >
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="customer-delete-modal">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-center">
            <h3 className="text-lg font-bold text-white">تأكيد الحذف</h3>
            <p className="mt-2 text-sm text-slate-300">هل تريد حذف العميل {deleteTarget.name}؟</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200"
                data-testid="customer-delete-cancel"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                data-testid="customer-delete-confirm"
              >
                {saving ? 'جارٍ الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DebtWhatsAppComposerDialog
        open={whatsAppDialogOpen}
        onOpenChange={setWhatsAppDialogOpen}
        drafts={whatsAppDrafts}
        onUpdateDraft={updateWhatsAppDraft}
        onSendCurrent={sendWhatsAppCurrent}
        onSendAll={(allDrafts) => allDrafts.forEach((draft, index) => {
          if (!draft.phone || !draft.url) return;
          setTimeout(() => window.open(draft.url, '_blank', 'noopener,noreferrer'), index * 250);
        })}
      />
    </div>
  );
};

export default Customers;
