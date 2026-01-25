import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, Mail, Plus, Car, MapPin, RefreshCw, User, Edit2, Trash2 } from 'lucide-react';
import { customerAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Customers = () => {
  const { themeName } = useTheme();
  const isLight = themeName === 'light' || themeName === 'dashPro';
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

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

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Users size={32} className="text-blue-500" />
            العملاء
          </h1>
          <p className="text-sm mt-2" style={{ color: styles.textSecondary }}>
            إدارة بيانات العملاء والتواصل معهم
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCustomers}
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
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Plus size={18} />
            <span>عميل جديد</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
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
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Users size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold mb-2" style={{ color: styles.textPrimary }}>لا يوجد عملاء</h3>
            <p style={{ color: styles.textSecondary }}>ابدأ بإضافة عميل جديد</p>
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
                      <h3 className="text-xl font-bold text-slate-50">{customer.name}</h3>
                      <p className="text-xs text-slate-400">عميل #{customer.id?.slice(0, 8)}</p>
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
                      <p className="text-sm font-bold text-slate-100 font-mono">{customer.phone || '-'}</p>
                    </div>
                  </div>
                  
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                        <Mail size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 font-medium">البريد الإلكتروني</p>
                        <p className="text-sm font-semibold text-slate-100 truncate">{customer.email}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* التفاصيل الموسعة */}
                {expandedCustomerId === customer.id && (
                  <div className="bg-slate-950/60 rounded-2xl px-4 py-3 border border-slate-800/80 space-y-3">
                    {customer.address && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                          <MapPin size={14} />
                          العنوان
                        </span>
                        <span className="text-sm font-semibold text-slate-100">{customer.address}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                        <Car size={14} />
                        عدد المركبات
                      </span>
                      <span className="text-sm font-bold text-blue-400">{customer.vehicleCount || 0}</span>
                    </div>
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

export default Customers;
