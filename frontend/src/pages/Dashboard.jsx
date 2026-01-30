import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Car, Users, Wrench, CheckCircle, Plus, Search, MoreVertical, Clock, RefreshCw, User, Calendar, ArrowRight } from 'lucide-react';
import { vehicleAPI, technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import VehicleQuickActions from '../components/VehicleQuickActions';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { themeName } = useTheme();
  const isLight = themeName === 'light' || themeName === 'dashPro';
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [vehicles, setVehicles] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const isMountedRef = useRef(true);
  
  const STATUS_CONFIG = {
    diagnosis: { label: t('status.diagnosis'), color: 'text-orange-400 bg-orange-500/10 border border-orange-500/20', iconColor: 'text-orange-400' },
    quotation: { label: t('status.quotation'), color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20', iconColor: 'text-yellow-400' },
    approved: { label: t('status.approved'), color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20', iconColor: 'text-yellow-400' },
    waiting_approval: { label: t('status.waiting_approval'), color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20', iconColor: 'text-yellow-400' },
    repair: { label: t('status.repair'), color: 'text-blue-400 bg-blue-500/10 border border-blue-500/20', iconColor: 'text-blue-400' },
    in_progress: { label: t('status.in_progress'), color: 'text-blue-400 bg-blue-500/10 border border-blue-500/20', iconColor: 'text-blue-400' },
    quality_check: { label: t('status.quality_check'), color: 'text-purple-400 bg-purple-500/10 border border-purple-500/20', iconColor: 'text-purple-400' },
    ready: { label: t('status.ready'), color: 'text-green-400 bg-green-500/10 border border-green-500/20', iconColor: 'text-green-400' },
    delivered: { label: t('status.delivered'), color: 'text-gray-400 bg-gray-500/10 border border-gray-500/20', iconColor: 'text-gray-400' }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchData(true); // Initial load with loading indicator
    
    // Background refresh when returning to dashboard
    const handleVisibilityChange = () => {
      if (!document.hidden && isMountedRef.current) {
        fetchData(false); // Background refresh without loading indicator
      }
    };
    
    // Listen for vehicle updates from other pages
    const handleVehicleUpdated = () => {
      console.log('🔄 Vehicle updated - background refresh');
      if (isMountedRef.current) {
        fetchData(false);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vehicleUpdated', handleVehicleUpdated);
    
    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vehicleUpdated', handleVehicleUpdated);
    };
  }, []);

  const fetchData = useCallback(async (showLoading = false) => {
    if (!isMountedRef.current) return;
    
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const [vehiclesRes, techniciansRes] = await Promise.all([
        vehicleAPI.getAll(),
        technicianAPI.getAll()
      ]);
      
      if (isMountedRef.current) {
        setVehicles(vehiclesRes.data);
        setTechnicians(techniciansRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (showLoading) {
        toast({ title: t('common.error'), description: t('common.loading'), variant: 'destructive' });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [t, toast]);

  const stats = {
    totalVehicles: vehicles.length,
    inProgress: vehicles.filter(v => ['diagnosis', 'in_progress', 'waiting_approval', 'quality_check', 'repair', 'quotation', 'approved'].includes(v.status)).length,
    ready: vehicles.filter(v => v.status === 'ready' || v.status === 'delivered').length,
    technicians: technicians.length
  };

  const [expandedVehicleId, setExpandedVehicleId] = useState(null);
  const [expandedStatWidget, setExpandedStatWidget] = useState(null);
  const [isHovering, setIsHovering] = useState(false);

  const filteredVehicles = vehicles.filter(vehicle => {
    // إخفاء السيارات "تم التسليم" من لوحة التحكم (تظهر في الأرشيف)
    if (vehicle.status === 'delivered') return false;
    const matchesSearch = 
      vehicle.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         vehicle.status === filterStatus ||
                         (filterStatus === 'ready' && (vehicle.status === 'ready' || vehicle.status === 'delivered'));

    // عند اختيار "approved" نعرض أيضاً "quotation" (بعض البيانات القديمة محفوظة بهذا الاسم)
    const matchesStatusFixed = filterStatus === 'approved'
      ? (vehicle.status === 'approved' || vehicle.status === 'quotation' || vehicle.status === 'waiting_approval')
      : matchesStatus;
    return matchesSearch && matchesStatusFixed;
  });

  const getStatusConfigForVehicle = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.diagnosis;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Theme-based styles (Glass / Purple)
  const styles = {
    bg: isLight ? 'radial-gradient(1200px circle at 20% 10%, rgba(168,85,247,0.18), transparent 45%), radial-gradient(900px circle at 80% 20%, rgba(99,102,241,0.16), transparent 50%), linear-gradient(180deg, #0b1020 0%, #0b1020 40%, #070a14 100%)' : '#0b1120',
    cardBg: isLight ? 'rgba(255,255,255,0.06)' : '#1e293b',
    cardBorder: isLight ? 'rgba(168,85,247,0.18)' : '#334155',
    textPrimary: isLight ? '#f8fafc' : '#f9fafb',
    textSecondary: isLight ? 'rgba(226,232,240,0.78)' : '#cbd5f5',
    textMuted: isLight ? 'rgba(148,163,184,0.8)' : '#64748b',
    inputBg: isLight ? 'rgba(255,255,255,0.06)' : '#1e293b',
    inputBorder: isLight ? 'rgba(255,255,255,0.10)' : '#334155',
    hoverBg: isLight ? 'rgba(255,255,255,0.08)' : '#334155',
    statCardBg: isLight ? 'rgba(255,255,255,0.06)' : 'rgba(30, 41, 59, 0.8)',
  };

  // ألوان خاصة لكروت المركبات لتشبه الكرت الأزرق في الصورة
  const isGlassPurpleTheme = isLight;
  const vehicleCardBackground = isGlassPurpleTheme
    ? 'radial-gradient(circle at 12% 18%, rgba(168,85,247,0.24), transparent 52%), radial-gradient(circle at 88% 78%, rgba(99,102,241,0.20), transparent 55%), rgba(255,255,255,0.06)'
    : styles.cardBg;
  const vehicleCardBorder = isGlassPurpleTheme
    ? 'rgba(168,85,247,0.22)'
    : styles.cardBorder;
  const vehicleText = {
    primary: isGlassPurpleTheme ? '#f8fafc' : styles.textPrimary,
    secondary: isGlassPurpleTheme ? 'rgba(226,232,240,0.82)' : styles.textSecondary,
    muted: isGlassPurpleTheme ? 'rgba(148,163,184,0.82)' : styles.textMuted,
  };

  return (
    <div 
      className={`max-w-7xl mx-auto min-h-screen px-1 sm:px-4 py-4 ${isRTL ? 'rtl' : 'ltr'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: styles.bg }}
    >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: styles.textPrimary }}>{t('dashboard.title')}</h1>
            <p className="text-sm sm:text-base mt-1 flex items-center gap-2" style={{ color: styles.textSecondary }}>
              {t('dashboard.overview')}
              {isRefreshing && (
                <RefreshCw size={14} className="animate-spin text-primary" />
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(false)}
              className="p-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: styles.cardBg,
                border: `1px solid ${styles.cardBorder}`
              }}
              title={isRTL ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-blue-500' : ''} style={{ color: isRefreshing ? undefined : styles.textSecondary }} />
            </button>
            <button
              onClick={() => {
                const newLang = i18n.language === 'ar' ? 'en' : 'ar';
                console.log('🔄 Changing language to:', newLang);
                i18n.changeLanguage(newLang);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ 
                backgroundColor: isLight ? '#1e293b' : '#3b82f6',
                color: '#ffffff'
              }}
            >
              {i18n.language === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button 
              onClick={() => navigate('/new-vehicle')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white transition-all"
              style={{ 
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Plus size={18} />
              <span>{t('dashboard.newVehicle') || t('dashboard.new_vehicle')}</span>
            </button>
          </div>
        </div>

        {/* Stats Grid - Responsive expandable widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
          {/* إجمالي المركبات */}
          <div
            className="dash-widget-shell"
            style={{ 
              backgroundColor: styles.cardBg, 
              border: `1px solid ${styles.cardBorder}`,
              maxHeight: expandedStatWidget === 'total' ? '280px' : '150px',
              transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
              boxShadow: expandedStatWidget === 'total' 
                ? '0 20px 50px rgba(0,0,0,0.15)' 
                : '0 4px 12px rgba(0,0,0,0.05)'
            }}
            data-expanded={expandedStatWidget === 'total'}
            onClick={() => {
              setExpandedStatWidget(prev => prev === 'total' ? null : 'total');
              setFilterStatus('all');
            }}
            onMouseEnter={() => setExpandedStatWidget('total')}
            onMouseLeave={() => setExpandedStatWidget(null)}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.totalVehicles') || t('dashboard.total_vehicles')}</span>
                <span className="text-2xl font-bold" style={{ color: styles.textPrimary }}>{stats.totalVehicles}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
                  <Car size={20} className="text-white" />
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.activeToday') || 'نشطة اليوم'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.inProgress}</span>
              </div>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.deliveredToday') || 'تم التسليم'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.ready}</span>
              </div>
            </div>
          </div>

          {/* مركبات قيد العمل */}
          <div
            className="dash-widget-shell"
            style={{ 
              backgroundColor: styles.cardBg, 
              border: `1px solid ${styles.cardBorder}`,
              maxHeight: expandedStatWidget === 'inProgress' ? '280px' : '150px',
              transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
              boxShadow: expandedStatWidget === 'inProgress' 
                ? '0 20px 50px rgba(0,0,0,0.15)' 
                : '0 4px 12px rgba(0,0,0,0.05)'
            }}
            data-expanded={expandedStatWidget === 'inProgress'}
            onClick={() => {
              setExpandedStatWidget(prev => prev === 'inProgress' ? null : 'inProgress');
              setFilterStatus('in_progress');
            }}
            onMouseEnter={() => setExpandedStatWidget('inProgress')}
            onMouseLeave={() => setExpandedStatWidget(null)}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.inProgress') || t('dashboard.in_progress')}</span>
                <span className="text-2xl font-bold" style={{ color: styles.textPrimary }}>{stats.inProgress}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Clock size={18} className="text-white" />
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.waitingParts') || 'بانتظار قطع الغيار'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.waitingParts || 0}</span>
              </div>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.inDiagnosis') || 'قيد التشخيص'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.diagnosis || 0}</span>
              </div>
            </div>
          </div>

          {/* جاهزة للتسليم */}
          <div
            className="dash-widget-shell"
            style={{ 
              backgroundColor: styles.cardBg, 
              border: `1px solid ${styles.cardBorder}`,
              maxHeight: expandedStatWidget === 'ready' ? '280px' : '150px',
              transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
              boxShadow: expandedStatWidget === 'ready' 
                ? '0 20px 50px rgba(0,0,0,0.15)' 
                : '0 4px 12px rgba(0,0,0,0.05)'
            }}
            data-expanded={expandedStatWidget === 'ready'}
            onClick={() => {
              setExpandedStatWidget(prev => prev === 'ready' ? null : 'ready');
              setFilterStatus('ready');
            }}
            onMouseEnter={() => setExpandedStatWidget('ready')}
            onMouseLeave={() => setExpandedStatWidget(null)}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.ready')}</span>
                <span className="text-2xl font-bold" style={{ color: styles.textPrimary }}>{stats.ready}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md">
                  <CheckCircle size={18} className="text-white" />
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.waitingPayment') || 'بانتظار السداد'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.waitingPayment || 0}</span>
              </div>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.inDelivery') || 'قيد التسليم'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.delivering || 0}</span>
              </div>
            </div>
          </div>

          {/* الفنيين */}
          <div
            className="dash-widget-shell"
            style={{ 
              backgroundColor: styles.cardBg, 
              border: `1px solid ${styles.cardBorder}`,
              maxHeight: expandedStatWidget === 'technicians' ? '280px' : '150px',
              transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
              boxShadow: expandedStatWidget === 'technicians' 
                ? '0 20px 50px rgba(0,0,0,0.15)' 
                : '0 4px 12px rgba(0,0,0,0.05)'
            }}
            data-expanded={expandedStatWidget === 'technicians'}
            onClick={() => {
              setExpandedStatWidget(prev => prev === 'technicians' ? null : 'technicians');
              navigate('/technicians');
            }}
            onMouseEnter={() => setExpandedStatWidget('technicians')}
            onMouseLeave={() => setExpandedStatWidget(null)}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.technicians')}</span>
                <span className="text-2xl font-bold" style={{ color: styles.textPrimary }}>{stats.technicians}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Users size={18} className="text-white" />
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.busyTechs') || 'مشغولون'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.busyTechnicians || 0}</span>
              </div>
              <div className="flex flex-col text-[9px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.freeTechs') || 'متاحون'}</span>
                <span className="font-semibold text-xs" style={{ color: styles.textPrimary }}>{stats.freeTechnicians || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter - Stack on mobile */}
        <div 
          className="rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-3 sm:space-y-0 sm:flex sm:flex-row sm:gap-4 sm:items-center"
          style={{ 
            backgroundColor: styles.cardBg,
            border: `1px solid ${styles.cardBorder}`
          }}
        >
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2" size={18} style={{ color: styles.textMuted }} />
            <input
              type="text"
              placeholder={t('dashboard.searchPlaceholder') || t('dashboard.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm sm:text-base transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ 
                backgroundColor: styles.inputBg,
                border: `1px solid ${styles.inputBorder}`,
                color: styles.textPrimary
              }}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
            {['all', 'diagnosis', 'quotation', 'approved', 'repair', 'ready'].map((status) => (
              <button
                key={`filter-${status}`}
                onClick={() => setFilterStatus(status)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  filterStatus === status 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : ''
                }`}
                style={filterStatus !== status ? { 
                  backgroundColor: isLight ? '#f1f5f9' : '#334155',
                  color: styles.textSecondary
                } : {}}
              >
                {status === 'all' ? t('common.all') : getStatusConfigForVehicle(status).label}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicles Grid - 1 column mobile, 2 tablet, 3 desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {filteredVehicles.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: isLight ? '#f1f5f9' : '#334155' }}
              >
                <Car size={40} style={{ color: styles.textMuted }} />
              </div>
              <h3 className="text-lg font-medium" style={{ color: styles.textPrimary }}>{t('common.no_data')}</h3>
              <p className="mt-1" style={{ color: styles.textSecondary }}>{t('dashboard.searchPlaceholder') || t('dashboard.search')}</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const statusConfig = getStatusConfigForVehicle(vehicle.status);
              const progress = typeof vehicle.progress === 'number' ? vehicle.progress : 65;
              const isUrgent = vehicle.priority === 'urgent' || vehicle.isUrgent;
              return (
                <div
                  key={`vehicle-${vehicle.id}`}
                  className="dash-widget-shell vehicle-card"
                  style={{
                    background: vehicleCardBackground,
                    border: `1px solid ${vehicleCardBorder}`,
                    boxShadow: expandedVehicleId === vehicle.id
                      ? '0 32px 120px rgba(2,6,23,0.85), 0 0 0 1px rgba(168,85,247,0.22)'
                      : '0 18px 60px rgba(2,6,23,0.65)',
                    backdropFilter: isGlassPurpleTheme ? 'blur(14px)' : undefined,
                    WebkitBackdropFilter: isGlassPurpleTheme ? 'blur(14px)' : undefined,
                    height: expandedVehicleId === vehicle.id ? 'auto' : '260px',
                    minHeight: '260px',
                    maxHeight: expandedVehicleId === vehicle.id ? 'none' : '260px',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: expandedVehicleId === vehicle.id ? 'scale(1.02)' : 'scale(1)',
                    overflow: 'hidden',
                  }}
                  data-expanded={expandedVehicleId === vehicle.id}
                  onClick={(e) => {
                    // لا تفعل شيء إذا النقر على زر أو رابط
                    if (e.target.closest('button') || e.target.closest('.navigate-btn')) {
                      return;
                    }
                    // التوسيع/الطي يكون بالضغط فقط لتجنب التعليق
                    setExpandedVehicleId(prev => prev === vehicle.id ? null : vehicle.id);
                  }}
                >
                  {/* النقاط الرأسية أعلى اليسار */}
                  <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                  </div>

                  {/* شارة الحالة + ترويسة الكرت */}
                  <div className="flex items-center justify-between mb-4 px-1 pt-1">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className={`px-3 py-1 rounded-full border text-[11px] font-medium ${statusConfig?.color || 'bg-slate-800/60 text-slate-200 border-slate-700'}`}>
                        {statusConfig?.label || (vehicle.status || '-')}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${vehicle.status === 'delivered' ? 'bg-gray-400' : vehicle.status === 'ready' ? 'bg-green-500' : vehicle.status === 'repair' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVehicle(vehicle);
                        setShowQuickActions(true);
                      }}
                      className="p-2 rounded-full hover:bg-gray-100/60 text-gray-400 flex-shrink-0"
                      aria-label="Quick Actions"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  {/* هوية المركبة: لوحة واضحة + اسم مركبة منظم */}
                  <div className="mb-4 space-y-3">
                    {/* رقم اللوحة بشكل واضح في المنتصف */}
                    <div className="flex justify-center">
                      <span className="vehicle-plate-pill inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/85 text-slate-50 text-base sm:text-lg font-bold border border-slate-700 shadow-inner">
                        <Car size={16} className="opacity-80" />
                        <span className="font-mono tracking-[0.35em] uppercase">
                          {vehicle.plateNumber || 'غير معروف'}
                        </span>
                      </span>
                    </div>

                    {/* اسم المركبة + الموديل + حالة الاستعجال */}
                    <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                      <div className="flex items-baseline gap-2 flex-wrap justify-center">
                        <span
                          className="vehicle-title-main text-base sm:text-xl font-semibold tracking-tight"
                          style={{ color: vehicleText.primary }}
                        >
                          {vehicle.brand || ''} {vehicle.model || ''}
                        </span>
                        {vehicle.year && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800/60 text-slate-200 text-xs font-semibold">
                            {vehicle.year}
                          </span>
                        )}
                      </div>
                      {isUrgent && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[11px] font-bold border border-red-500/30">
                          ⚡ عاجل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* صف الدخول / العميل - المنطقة الأساسية */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                        <Calendar size={15} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-0.5">تاريخ الدخول</p>
                        <p className="font-bold text-sm" style={{ color: vehicleText.primary }}>
                          {vehicle.entryDate || vehicle.createdAt
                            ? new Date(vehicle.entryDate || vehicle.createdAt).toLocaleDateString('ar-SA')
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800/60 flex items-center justify-center">
                        <User size={15} className="text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 font-medium mb-0.5">العميل</p>
                        <p className="font-bold text-sm truncate" style={{ color: vehicleText.primary }}>
                          {vehicle.customerName || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* شريط نسبة الإنجاز */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-sky-400" />
                        <span className="text-xs text-slate-300 font-medium">نسبة الإنجاز</span>
                      </div>
                      <span className="font-bold text-base text-sky-100">{progress}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-900/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* الشريط السفلي: المسؤول */}
                  <div className="mt-2 flex flex-col gap-2">
                    <div
                      className="flex items-center justify-between rounded-[20px] px-4 py-2.5"
                      style={{
                        backgroundColor: '#020617',
                        border: '1px solid rgba(100,116,139,0.2)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Wrench size={15} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">الفني المسؤول</p>
                          <p className="font-bold text-sm text-slate-100">
                            {vehicle.technicianName || vehicle.technician || 'غير محدد'}
                          </p>
                        </div>
                      </div>
                      <div className="navigate-btn flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all cursor-pointer border border-blue-500/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vehicle/${vehicle.id}`);
                        }}
                        title="فتح تفاصيل المركبة"
                      >
                        <ArrowRight size={16} />
                      </div>
                    </div>

                    {/* جزء إضافي يظهر عند التوسّع */}
                    {expandedVehicleId === vehicle.id && (
                      <div className="grid grid-cols-2 gap-3 bg-slate-950/60 rounded-2xl px-4 py-3 border border-slate-800/80 mt-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400 font-medium">رقم الهيكل (VIN)</span>
                          <span className="font-mono text-slate-100 text-sm font-semibold truncate">{vehicle.vin || 'غير محدد'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400 font-medium">عدد الزيارات</span>
                          <span className="font-bold text-sm text-slate-100">{vehicle.visitsCount || 0} زيارة</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400 font-medium">آخر تحديث</span>
                          <span className="text-slate-100 text-sm font-semibold">
                            {vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleDateString('ar-SA') : '-'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400 font-medium">التكلفة التقديرية</span>
                          <span className="text-emerald-400 text-sm font-bold">
                            {vehicle.estimatedTotal ? vehicle.estimatedTotal.toLocaleString('ar-SA') + ' ر.س' : '0 ر.س'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Actions Modal */}
        {showQuickActions && selectedVehicle && (
          <VehicleQuickActions
            isOpen={showQuickActions}
            vehicle={selectedVehicle}
            onClose={() => {
              setShowQuickActions(false);
              setSelectedVehicle(null);
            }}
            onStatusUpdate={async (newStatus) => {
              try {
                await vehicleAPI.update(selectedVehicle.id, { status: newStatus });

                // إذا تم التسليم، أغلق أي فاتورة مفتوحة مرتبطة بهذه المركبة
                if (newStatus === 'delivered') {
                  try {
                    const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');
                    const invRes = await axios.get(`${API_URL}/invoices`, { params: { vehicleId: selectedVehicle.id } });
                    const invoices = invRes.data || [];
                    const openInvoice = invoices.find(inv => inv.status !== 'paid' && inv.status !== 'cancelled');
                    if (openInvoice) {
                      await axios.put(`${API_URL}/invoices/${openInvoice.id}`, { status: 'issued' });
                    }
                  } catch (invErr) {
                    console.error('Failed to close invoice on delivery:', invErr);
                  }
                }

                await fetchData();
              } catch (error) {
                console.error('Failed to update vehicle status', error);
              }
            }}
            onDelete={async () => {
              try {
                await vehicleAPI.delete(selectedVehicle.id);
                await fetchData();
              } catch (error) {
                console.error('Failed to delete vehicle', error);
              }
            }}
          />
        )}
      </div>
  );
};

export default Dashboard;
