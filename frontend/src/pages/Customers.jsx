import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Phone, Mail, Plus, Car, MapPin, RefreshCw, User, Edit2, Trash2, Upload } from 'lucide-react';
import { customerAPI, api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Customers = () => {
  const { themeName } = useTheme();
  const isLight = themeName === 'light' || themeName === 'dashPro';
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
    email: '',
    address: '',
    vehicleBrand: '',
    vehiclePlate: '',
    vehicleKm: '',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
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
      const response = await customerAPI.getAll();
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
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            placeholder="ابحث عن عميل بالاسم، رقم الهاتف أو البريد الإلكتروني..."
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
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                        <Car size={14} />
                        عدد المركبات
                      </span>
                      <span className="text-sm font-bold text-blue-400" data-testid={`customer-vehicles-count-${customer.id}`}>
                        {customer.vehicleCount || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
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
    </div>
  );
};

export default Customers;
