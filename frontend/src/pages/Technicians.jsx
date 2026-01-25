import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, Wrench, Plus, RefreshCw, User, Star, CheckCircle, Clock } from 'lucide-react';
import { technicianAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Technicians = () => {
  const { themeName } = useTheme();
  const isLight = themeName === 'light' || themeName === 'dashPro';
  const [searchQuery, setSearchQuery] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTechId, setExpandedTechId] = useState(null);

  const styles = {
    bg: isLight ? '#f5f7fb' : '#0b1120',
    cardBg: isLight ? '#ffffff' : '#1e293b',
    textPrimary: isLight ? '#0f172a' : '#f9fafb',
    textSecondary: isLight ? '#64748b' : '#cbd5f5',
  };

  const cardGradient = 'radial-gradient(circle at 0% 0%, rgba(139,92,246,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(168,85,247,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)';

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      const response = await technicianAPI.getAll();
      setTechnicians(response.data || []);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTechnicians = technicians.filter(tech =>
    tech.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tech.phone?.includes(searchQuery) ||
    tech.specialty?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Wrench size={32} className="text-purple-500" />
            الفنيين
          </h1>
          <p className="text-sm mt-2" style={{ color: styles.textSecondary }}>
            إدارة فريق العمل والفنيين
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTechnicians}
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
              background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
              boxShadow: '0 4px 14px rgba(147, 51, 234, 0.25)'
            }}
          >
            <Plus size={18} />
            <span>فني جديد</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن فني بالاسم، التخصص أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-3 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            style={{ 
              backgroundColor: styles.cardBg,
              border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`,
              color: styles.textPrimary
            }}
          />
        </div>
      </div>

      {/* Technicians Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTechnicians.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Wrench size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold mb-2" style={{ color: styles.textPrimary }}>لا يوجد فنيين</h3>
            <p style={{ color: styles.textSecondary }}>ابدأ بإضافة فني جديد</p>
          </div>
        ) : (
          filteredTechnicians.map((tech) => (
            <div
              key={tech.id}
              className="relative rounded-[28px] overflow-hidden transition-all duration-400 cursor-pointer"
              style={{
                background: cardGradient,
                border: '1px solid rgba(15,23,42,0.55)',
                boxShadow: expandedTechId === tech.id
                  ? '0 32px 100px rgba(15,23,42,0.9), 0 0 0 1px rgba(168,85,247,0.3)'
                  : '0 24px 70px rgba(15,23,42,0.75)',
                height: expandedTechId === tech.id ? 'auto' : '240px',
                minHeight: '240px',
                maxHeight: expandedTechId === tech.id ? 'none' : '240px',
                transform: expandedTechId === tech.id ? 'scale(1.02)' : 'scale(1)',
              }}
              onClick={() => setExpandedTechId(prev => prev === tech.id ? null : tech.id)}
              onMouseEnter={() => setExpandedTechId(tech.id)}
              onMouseLeave={() => setExpandedTechId(null)}
            >
              {/* النقاط الزخرفية */}
              <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
                <span className="w-1 h-1 rounded-full bg-gray-400" />
                <span className="w-1 h-1 rounded-full bg-gray-400" />
                <span className="w-1 h-1 rounded-full bg-gray-400" />
              </div>

              <div className="p-6">
                {/* الاسم والتخصص */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Wrench size={28} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-50">{tech.name}</h3>
                    <p className="text-sm text-purple-400 font-semibold">{tech.specialty || 'فني عام'}</p>
                  </div>
                </div>

                {/* الإحصائيات */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-800/60">
                    <p className="text-xs text-slate-400 mb-1">المركبات الحالية</p>
                    <p className="text-lg font-bold text-blue-400">{tech.currentVehicles || 0}</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-800/60">
                    <p className="text-xs text-slate-400 mb-1">المنجزة</p>
                    <p className="text-lg font-bold text-emerald-400">{tech.completedVehicles || 0}</p>
                  </div>
                </div>

                {/* رقم الهاتف */}
                <div className="flex items-center gap-2 bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-800/60">
                  <Phone size={14} className="text-emerald-400" />
                  <span className="text-sm font-bold text-slate-100 font-mono">{tech.phone || '-'}</span>
                </div>

                {/* التفاصيل الموسعة */}
                {expandedTechId === tech.id && (
                  <div className="bg-slate-950/60 rounded-2xl px-4 py-3 border border-slate-800/80 mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">التقييم</span>
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-bold text-yellow-400">{tech.rating || '4.8'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">الحالة</span>
                      <span className={`text-sm font-semibold ${tech.isAvailable ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {tech.isAvailable ? 'متاح' : 'مشغول'}
                      </span>
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

export default Technicians;
