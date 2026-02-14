import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, RefreshCw, User, Phone, Mail, MapPin, Edit2, Trash2, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { supplierAPI } from '../services/api';

const Suppliers = () => {
  const { themeName } = useTheme();
  const isLight = themeName === 'light' || themeName === 'dashPro';
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSupplierId, setExpandedSupplierId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    contactPerson: '',
    email: '',
    address: '',
    city: '',
    category: '',
  });

  const styles = {
    bg: isLight ? '#f5f7fb' : '#0b1120',
    cardBg: isLight ? '#ffffff' : '#1e293b',
    textPrimary: isLight ? '#0f172a' : '#f9fafb',
    textSecondary: isLight ? '#64748b' : '#cbd5f5',
  };

  const cardGradient = 'radial-gradient(circle at 0% 0%, rgba(234,179,8,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(251,191,36,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)';

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await supplierAPI.getAll();
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      contactPerson: '',
      email: '',
      address: '',
      city: '',
      category: '',
    });
    setEditingSupplier(null);
  };

  const openNewSupplier = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditSupplier = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      phone: supplier.phone || '',
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      category: supplier.category || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المورد', variant: 'destructive' });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال رقم الجوال', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        contactPerson: formData.contactPerson.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        category: formData.category.trim(),
      };

      if (editingSupplier?.id) {
        await supplierAPI.update(editingSupplier.id, payload);
        toast({ title: 'تم التحديث', description: 'تم تحديث بيانات المورد بنجاح' });
      } else {
        await supplierAPI.create(payload);
        toast({ title: 'تم الحفظ', description: 'تم إضافة المورد بنجاح' });
      }
      setShowModal(false);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({ title: 'خطأ', description: 'تعذر حفظ المورد', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!supplier?.id) return;
    const confirmed = window.confirm(`هل أنت متأكد من حذف المورد "${supplier.name}"؟`);
    if (!confirmed) return;

    try {
      await supplierAPI.delete(supplier.id);
      toast({ title: 'تم الحذف', description: 'تم حذف المورد بنجاح' });
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({ title: 'خطأ', description: 'تعذر حذف المورد', variant: 'destructive' });
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.phone?.includes(searchQuery) ||
    supplier.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]" data-testid="suppliers-loading">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto min-h-screen px-4 py-6" style={{ backgroundColor: styles.bg }} dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: styles.textPrimary }}>
            <Package size={32} className="text-yellow-500" />
            الموردين
          </h1>
          <p className="text-sm mt-2" style={{ color: styles.textSecondary }}>
            إدارة الموردين وقطع الغيار
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSuppliers}
            className="p-2.5 rounded-lg transition-colors"
            style={{ 
              backgroundColor: styles.cardBg,
              border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`
            }}
            data-testid="suppliers-refresh-button"
          >
            <RefreshCw size={18} style={{ color: styles.textSecondary }} />
          </button>
          <button
            onClick={openNewSupplier}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all"
            style={{ 
              background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
              boxShadow: '0 4px 14px rgba(234, 179, 8, 0.25)'
            }}
            data-testid="supplier-add-button"
          >
            <Plus size={18} />
            <span>مورد جديد</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن مورد بالاسم، رقم الهاتف أو البريد الإلكتروني..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-3 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            style={{ 
              backgroundColor: styles.cardBg,
              border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`,
              color: styles.textPrimary
            }}
            data-testid="supplier-search-input"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-16 text-center" data-testid="suppliers-empty-state">
            <Package size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold mb-2" style={{ color: styles.textPrimary }}>لا يوجد موردين</h3>
            <p style={{ color: styles.textSecondary }}>ابدأ بإضافة مورد جديد</p>
          </div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="relative rounded-[28px] overflow-hidden transition-all duration-400 cursor-pointer"
              style={{
                background: cardGradient,
                border: '1px solid rgba(15,23,42,0.55)',
                boxShadow: expandedSupplierId === supplier.id
                  ? '0 32px 100px rgba(15,23,42,0.9), 0 0 0 1px rgba(234,179,8,0.3)'
                  : '0 24px 70px rgba(15,23,42,0.75)',
                height: expandedSupplierId === supplier.id ? 'auto' : '220px',
                minHeight: '220px',
                maxHeight: expandedSupplierId === supplier.id ? 'none' : '220px',
                transform: expandedSupplierId === supplier.id ? 'scale(1.02)' : 'scale(1)',
              }}
              onClick={() => setExpandedSupplierId(prev => prev === supplier.id ? null : supplier.id)}
              onMouseEnter={() => setExpandedSupplierId(supplier.id)}
              onMouseLeave={() => setExpandedSupplierId(null)}
              data-testid={`supplier-card-${supplier.id}`}
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
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg">
                      <Package size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-50" data-testid={`supplier-name-${supplier.id}`}>
                        {supplier.name}
                      </h3>
                      <p className="text-xs text-slate-400">مورد #{supplier.id?.slice(0, 8)}</p>
                    </div>
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
                      <p className="text-sm font-bold text-slate-100 font-mono" data-testid={`supplier-phone-${supplier.id}`}>
                        {supplier.phone || '-'}
                      </p>
                    </div>
                  </div>
                  
                  {supplier.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                        <Mail size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 font-medium">البريد الإلكتروني</p>
                        <p className="text-sm font-semibold text-slate-100 truncate" data-testid={`supplier-email-${supplier.id}`}>
                          {supplier.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* التفاصيل الموسعة */}
                {expandedSupplierId === supplier.id && (
                  <div className="bg-slate-950/60 rounded-2xl px-4 py-3 border border-slate-800/80 space-y-3">
                    {supplier.address && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                          <MapPin size={14} />
                          العنوان
                        </span>
                        <span className="text-sm font-semibold text-slate-100" data-testid={`supplier-address-${supplier.id}`}>
                          {supplier.address}
                        </span>
                      </div>
                    )}
                    {supplier.totalPurchases !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">إجمالي المشتريات</span>
                        <span className="text-sm font-bold text-yellow-400">
                          {supplier.totalPurchases?.toLocaleString('ar-SA')} ر.س
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSupplier(supplier);
                        }}
                        className="flex-1 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-sm font-semibold"
                        data-testid={`supplier-edit-${supplier.id}`}
                      >
                        <Edit2 size={14} className="inline ml-1" />
                        تعديل
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSupplier(supplier);
                        }}
                        className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-semibold"
                        data-testid={`supplier-delete-${supplier.id}`}
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

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          data-testid="supplier-modal-overlay"
        >
          <div
            className="liquid-surface w-full max-w-2xl p-6 relative"
            style={{
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(148,163,184,0.18)',
            }}
            data-testid="supplier-modal"
          >
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="absolute top-4 left-4 p-2 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(148,163,184,0.18)',
                color: 'rgba(226,232,240,0.85)',
              }}
              data-testid="supplier-modal-close"
            >
              <X size={18} />
            </button>
            <div className="mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'rgba(248,250,252,0.95)' }} data-testid="supplier-modal-title">
                {editingSupplier ? 'تعديل المورد' : 'إضافة مورد جديد'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(226,232,240,0.65)' }}>
                أدخل بيانات المورد الأساسية وسيتم حفظها مباشرة.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="supplier-modal-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>اسم المورد *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      color: 'rgba(248,250,252,0.92)',
                    }}
                    data-testid="supplier-name-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>رقم الجوال *</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      color: 'rgba(248,250,252,0.92)',
                    }}
                    data-testid="supplier-phone-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>المسؤول</label>
                  <input
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      color: 'rgba(248,250,252,0.92)',
                    }}
                    data-testid="supplier-contact-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>المدينة</label>
                  <input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      color: 'rgba(248,250,252,0.92)',
                    }}
                    data-testid="supplier-city-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>البريد الإلكتروني</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    color: 'rgba(248,250,252,0.92)',
                  }}
                  data-testid="supplier-email-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>العنوان</label>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    color: 'rgba(248,250,252,0.92)',
                  }}
                  data-testid="supplier-address-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold" style={{ color: 'rgba(226,232,240,0.7)' }}>التصنيف</label>
                <input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    color: 'rgba(248,250,252,0.92)',
                  }}
                  placeholder="مثال: قطع غيار، زيوت"
                  data-testid="supplier-category-input"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    color: 'rgba(226,232,240,0.85)',
                  }}
                  data-testid="supplier-modal-cancel"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{
                    background: 'rgba(234,179,8,0.2)',
                    border: '1px solid rgba(234,179,8,0.35)',
                    color: 'rgba(254,243,199,0.95)',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                  disabled={isSaving}
                  data-testid="supplier-modal-save"
                >
                  {isSaving ? 'جاري الحفظ...' : editingSupplier ? 'تحديث المورد' : 'حفظ المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
