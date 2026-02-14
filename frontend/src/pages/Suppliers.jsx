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

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.phone?.includes(searchQuery) ||
    supplier.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
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
          >
            <RefreshCw size={18} style={{ color: styles.textSecondary }} />
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all"
            style={{ 
              background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
              boxShadow: '0 4px 14px rgba(234, 179, 8, 0.25)'
            }}
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
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-16 text-center">
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
                      <h3 className="text-xl font-bold text-slate-50">{supplier.name}</h3>
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
                      <p className="text-sm font-bold text-slate-100 font-mono">{supplier.phone || '-'}</p>
                    </div>
                  </div>
                  
                  {supplier.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                        <Mail size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 font-medium">البريد الإلكتروني</p>
                        <p className="text-sm font-semibold text-slate-100 truncate">{supplier.email}</p>
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
                        <span className="text-sm font-semibold text-slate-100">{supplier.address}</span>
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
                          // Edit action
                        }}
                        className="flex-1 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-sm font-semibold"
                      >
                        <Edit2 size={14} className="inline ml-1" />
                        تعديل
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Delete action
                        }}
                        className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-semibold"
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

export default Suppliers;
