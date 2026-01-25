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
    quotation: { label: t('status.waiting_approval'), color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20', iconColor: 'text-yellow-400' },
    approved: { label: t('status.waiting_approval'), color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20', iconColor: 'text-yellow-400' },
    waiting_approval: { label: t('status.waiting_approval'), color: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20', iconColor: 'text-yellow-400' },
    repair: { label: t('status.in_progress'), color: 'text-blue-400 bg-blue-500/10 border border-blue-500/20', iconColor: 'text-blue-400' },
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

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = 
      vehicle.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         vehicle.status === filterStatus ||
                         (filterStatus === 'ready' && (vehicle.status === 'ready' || vehicle.status === 'delivered'));
    return matchesSearch && matchesStatus;
  });

  const getStatusConfigForVehicle = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.diagnosis;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Theme-based styles
  const styles = {
    bg: isLight ? '#f5f7fb' : '#0b1120',
    cardBg: isLight ? '#ffffff' : '#1e293b',
    cardBorder: isLight ? '#e2e8f0' : '#334155',
    textPrimary: isLight ? '#0f172a' : '#f9fafb',
    textSecondary: isLight ? '#64748b' : '#cbd5f5',
    textMuted: isLight ? '#94a3b8' : '#64748b',
    inputBg: isLight ? '#ffffff' : '#1e293b',
    inputBorder: isLight ? '#e2e8f0' : '#334155',
    hoverBg: isLight ? '#f1f5f9' : '#334155',
    statCardBg: isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
  };

  // ألوان خاصة لكروت المركبات لتشبه الكرت الأزرق في الصورة
  const isBlueCardTheme = isLight; // نستخدم الكرت الأزرق في الثيم الفاتح حالياً
  const vehicleCardBackground = isBlueCardTheme
    ? 'radial-gradient(circle at 0% 0%, rgba(59,130,246,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.22), transparent 55%), linear-gradient(145deg, #020617 0%, #020617 45%, #020617 100%)'
    : styles.cardBg;
  const vehicleCardBorder = isBlueCardTheme
    ? 'rgba(15,23,42,0.55)'
    : styles.cardBorder;
  const vehicleText = {
    primary: isBlueCardTheme ? '#f9fafb' : styles.textPrimary,
    secondary: isBlueCardTheme ? 'rgba(226,232,240,0.86)' : styles.textSecondary,
    muted: isBlueCardTheme ? 'rgba(148,163,184,0.9)' : styles.textMuted,
  };

  return (
    <div 
      className={`max-w-7xl mx-auto min-h-screen px-1 sm:px-4 py-4 ${isRTL ? 'rtl' : 'ltr'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: styles.bg }}
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
              <span>{t('dashboard.new_vehicle')}</span>
            </button>
          </div>
        </div>

        {/* Stats Grid - Responsive expandable widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
          {/* إجمالي المركبات */}
          <div
            className="dash-widget-shell"
            style={{ backgroundColor: styles.cardBg, border: `1px solid ${styles.cardBorder}` }}
            onClick={() => setFilterStatus('all')}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.total_vehicles')}</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.totalVehicles}</span>
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.in_workshop')}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md">
                  <Car size={24} className="text-white" />
                </div>
                <div className="text-xs" style={{ color: styles.textSecondary }}>
                  <div>{t('dashboard.vehicles_hint') || 'كل المركبات المسجلة في النظام'}</div>
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.active_today') || 'نشطة اليوم'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.inProgress}</span>
              </div>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.delivered_today') || 'تم التسليم'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.ready}</span>
              </div>
            </div>
          </div>

          {/* مركبات قيد العمل */}
          <div
            className="dash-widget-shell"
            style={{ backgroundColor: styles.cardBg, border: `1px solid ${styles.cardBorder}` }}
            onClick={() => setFilterStatus('in_progress')}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.in_progress')}</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.inProgress}</span>
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: styles.textSecondary }}>
                <Wrench size={16} className="text-sky-400" />
                <span>{t('dashboard.under_repair') || 'قيد الإصلاح'}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Clock size={22} className="text-white" />
                </div>
                <div className="text-xs" style={{ color: styles.textSecondary }}>
                  <div>{t('dashboard.in_progress_hint') || 'مركبات داخل الورشة بانتظار الإنهاء'}</div>
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.waiting_parts') || 'بانتظار قطع الغيار'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.waitingParts || 0}</span>
              </div>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.in_diagnosis') || 'قيد التشخيص'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.diagnosis || 0}</span>
              </div>
            </div>
          </div>

          {/* جاهزة للتسليم */}
          <div
            className="dash-widget-shell"
            style={{ backgroundColor: styles.cardBg, border: `1px solid ${styles.cardBorder}` }}
            onClick={() => setFilterStatus('ready')}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.ready')}</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.ready}</span>
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: styles.textSecondary }}>
                <CheckCircle size={16} className="text-emerald-400" />
                <span>{t('dashboard.can_deliver') || 'جاهزة للتسليم'}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md">
                  <CheckCircle size={22} className="text-white" />
                </div>
                <div className="text-xs" style={{ color: styles.textSecondary }}>
                  <div>{t('dashboard.ready_hint') || 'مركبات منتهية بانتظار استلام العميل'}</div>
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.waiting_payment') || 'بانتظار السداد'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.waitingPayment || 0}</span>
              </div>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.in_delivery') || 'قيد التسليم'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.delivering || 0}</span>
              </div>
            </div>
          </div>

          {/* الفنيين */}
          <div
            className="dash-widget-shell"
            style={{ backgroundColor: styles.cardBg, border: `1px solid ${styles.cardBorder}` }}
            onClick={() => navigate('/technicians')}
          >
            <div className="dash-widget-top">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium" style={{ color: styles.textSecondary }}>{t('dashboard.technicians')}</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.technicians}</span>
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: styles.textSecondary }}>
                <Users size={16} className="text-purple-400" />
                <span>{t('dashboard.active_now') || 'نشط الآن'}</span>
              </div>
            </div>
            <div className="dash-widget-main">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Users size={22} className="text-white" />
                </div>
                <div className="text-xs" style={{ color: styles.textSecondary }}>
                  <div>{t('dashboard.technicians_hint') || 'توزيع الأحمال على الفنيين في الورشة'}</div>
                </div>
              </div>
            </div>
            <div className="dash-widget-bottom border-t" style={{ borderColor: styles.cardBorder }}>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.busy_techs') || 'مشغولون'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.busyTechnicians || 0}</span>
              </div>
              <div className="flex flex-col text-[11px]" style={{ color: styles.textSecondary }}>
                <span>{t('dashboard.free_techs') || 'متاحون'}</span>
                <span className="font-semibold" style={{ color: styles.textPrimary }}>{stats.freeTechnicians || 0}</span>
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
              placeholder={t('dashboard.search')}
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
            {['all', 'diagnosis', 'repair', 'ready'].map((status) => (
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
              <p className="mt-1" style={{ color: styles.textSecondary }}>{t('dashboard.search')}</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const statusConfig = getStatusConfigForVehicle(vehicle.status);
              const progress = typeof vehicle.progress === 'number' ? vehicle.progress : 65;
              const isUrgent = vehicle.priority === 'urgent' || vehicle.isUrgent;
              return (
                <div
                  key={`vehicle-${vehicle.id}`}
                  className="dash-widget-shell"
                  style={{
                    background: vehicleCardBackground,
                    border: `1px solid ${vehicleCardBorder}`,
                    boxShadow: isBlueCardTheme
                      ? '0 24px 70px rgba(15,23,42,0.75)'
                      : '0 18px 45px rgba(15, 23, 42, 0.6)',
                    maxHeight: expandedVehicleId === vehicle.id ? 420 : 260,
                    transition: 'max-height 0.35s ease, box-shadow 0.35s ease',
                  }}
                  data-expanded={expandedVehicleId === vehicle.id}
                  onClick={() => setExpandedVehicleId(prev => (prev === vehicle.id ? null : vehicle.id))}
                >
                  {/* النقاط الرأسية أعلى اليسار */}
                  <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                  </div>

                  {/* شارة قيد الإصلاح + ترويسة الكرت */}
                  <div className="flex items-center justify-between mb-4 px-1 pt-1">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[11px] font-medium">
                        قيد الإصلاح
                      </span>
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
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

                  {/* العنوان الرئيسي + البادجات */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <h3
                      className="text-[1.35rem] sm:text-[1.5rem] font-extrabold tracking-tight"
                      style={{ color: vehicleText.primary }}
                    >
                      {vehicle.brand} {vehicle.model} {vehicle.year || ''}
                    </h3>
                    {isUrgent && (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-500 text-[11px] font-semibold">
                        عاجل
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center gap-1">
                      <span className="font-mono text-xs tracking-[0.18em]">
                        {vehicle.plateNumber}
                      </span>
                    </span>
                  </div>

                  {/* صف الدخول / العميل - المنطقة الأساسية */}
                  <div className="grid grid-cols-2 gap-4 mb-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[11px]" style={{ color: vehicleText.muted }}>الدخول</p>
                        <p className="font-semibold text-[0.9rem]" style={{ color: vehicleText.primary }}>
                          {vehicle.entryDate || vehicle.createdAt
                            ? new Date(vehicle.entryDate || vehicle.createdAt).toLocaleDateString('ar-SA')
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <User size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px]" style={{ color: vehicleText.muted }}>العميل</p>
                        <p className="font-semibold text-[0.9rem] truncate" style={{ color: vehicleText.primary }}>
                          {vehicle.customerName || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* شريط نسبة الإنجاز - يمكن اعتباره جزء من التوسّع */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px]" style={{ color: vehicleText.muted }}>نسبة الإنجاز</span>
                        <Clock size={12} className="text-sky-300" />
                      </div>
                      <span className="font-semibold text-[0.9rem] text-sky-100">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* الشريط السفلي: المسؤول + تفاصيل إضافية عند التوسّع */}
                  <div
                    className="mt-2 flex flex-col gap-2"
                  >
                    <div
                      className="flex items-center justify-between rounded-[20px] px-3 py-2"
                      style={{
                        backgroundColor: isBlueCardTheme ? '#020617' : '#020617',
                        color: '#f9fafb',
                      }}
                    >
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <div className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-[11px]">
                          <Wrench size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-300 mb-0">المسؤول</p>
                          <p className="font-semibold text-sm">
                            {vehicle.technicianName || vehicle.technician || 'م. سامي'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white">
                        <ArrowRight size={14} />
                      </div>
                    </div>

                    {/* جزء إضافي يظهر عند التوسّع */}
                    {expandedVehicleId === vehicle.id && (
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 rounded-2xl px-3 py-2 border border-slate-800/80 mt-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400">رقم الهيكل (VIN)</span>
                          <span className="font-mono text-slate-100 text-xs">{vehicle.vin || '-'}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400">عدد الزيارات</span>
                          <span className="font-semibold text-slate-100 text-xs">{vehicle.visitsCount || 0}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400">آخر تحديث</span>
                          <span className="text-slate-100 text-xs">
                            {vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleDateString('ar-SA') : '-'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400">إجمالي التكلفة التقديرية</span>
                          <span className="text-emerald-300 text-xs">
                            {vehicle.estimatedTotal ? vehicle.estimatedTotal.toLocaleString('ar-SA') + ' ر.س' : '-'}
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
