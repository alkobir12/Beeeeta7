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
    bg: isLight ? '#f8fafc' : '#0f172a',
    cardBg: isLight ? '#ffffff' : '#1e293b',
    cardBorder: isLight ? '#e2e8f0' : '#334155',
    textPrimary: isLight ? '#1e293b' : '#f1f5f9',
    textSecondary: isLight ? '#64748b' : '#94a3b8',
    textMuted: isLight ? '#94a3b8' : '#64748b',
    inputBg: isLight ? '#ffffff' : '#1e293b',
    inputBorder: isLight ? '#e2e8f0' : '#334155',
    hoverBg: isLight ? '#f1f5f9' : '#334155',
    statCardBg: isLight ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
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

        {/* Stats Grid - Responsive 2x2 on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div 
            onClick={() => setFilterStatus('all')} 
            className="rounded-2xl p-4 sm:p-5 cursor-pointer transition-all hover:shadow-lg group"
            style={{ 
              backgroundColor: styles.statCardBg,
              border: `1px solid ${styles.cardBorder}`
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium mb-1" style={{ color: styles.textSecondary }}>{t('dashboard.total_vehicles')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.totalVehicles}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Car size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setFilterStatus('in_progress')} 
            className="rounded-2xl p-4 sm:p-5 cursor-pointer transition-all hover:shadow-lg group"
            style={{ 
              backgroundColor: styles.statCardBg,
              border: `1px solid ${styles.cardBorder}`
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium mb-1" style={{ color: styles.textSecondary }}>{t('dashboard.in_progress')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.inProgress}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 transition-colors">
                <Wrench size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setFilterStatus('ready')} 
            className="rounded-2xl p-4 sm:p-5 cursor-pointer transition-all hover:shadow-lg group"
            style={{ 
              backgroundColor: styles.statCardBg,
              border: `1px solid ${styles.cardBorder}`
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium mb-1" style={{ color: styles.textSecondary }}>{t('dashboard.ready')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.ready}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-colors">
                <CheckCircle size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => navigate('/technicians')} 
            className="rounded-2xl p-4 sm:p-5 cursor-pointer transition-all hover:shadow-lg group"
            style={{ 
              backgroundColor: styles.statCardBg,
              border: `1px solid ${styles.cardBorder}`
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium mb-1" style={{ color: styles.textSecondary }}>{t('dashboard.technicians')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: styles.textPrimary }}>{stats.technicians}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                <Users size={20} className="sm:w-6 sm:h-6" />
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
                  className="relative rounded-[32px] p-4 sm:p-5 cursor-pointer transition-all group overflow-hidden"
                  style={{
                    backgroundColor: styles.cardBg,
                    border: `1px solid ${styles.cardBorder}`,
                    boxShadow: isLight
                      ? '0 18px 45px rgba(15, 23, 42, 0.08)'
                      : '0 18px 45px rgba(15, 23, 42, 0.6)'
                  }}
                  onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                >
                  {/* النقاط الرأسية أعلى اليسار */}
                  <div className="absolute top-5 left-5 flex flex-col gap-1 opacity-60">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                  </div>

                  {/* شارة قيد الإصلاح */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[11px] font-medium">
                        {t('vehicle_card.repair_entry') || 'قيد الإصلاح'}
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
                      className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900"
                      style={{ color: styles.textPrimary }}
                    >
                      {vehicle.brand} {vehicle.model} {vehicle.year || ''}
                    </h3>
                    {isUrgent && (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-500 text-[11px] font-semibold">
                        {t('vehicle_card.urgent') || 'عاجل'}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center gap-1">
                      <span className="text-[10px]">{t('vehicles.plate_number')}</span>
                      <span className="font-mono text-xs">{vehicle.plateNumber}</span>
                    </span>
                  </div>

                  {/* صف الدخول / العميل */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">{t('vehicle_card.entry_date') || 'الدخول'}</p>
                        <p className="font-semibold" style={{ color: styles.textPrimary }}>
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
                        <p className="text-[11px] text-gray-400">{t('vehicles_page.customer_name')}</p>
                        <p className="font-semibold truncate" style={{ color: styles.textPrimary }}>
                          {vehicle.customerName || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* شريط نسبة الإنجاز */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">{t('vehicle_card.progress') || 'نسبة الإنجاز'}</span>
                        <Clock size={12} className="text-gray-400" />
                      </div>
                      <span className="font-semibold text-blue-600">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* الشريط السفلي: المسؤول + الحالة */}
                  <div className="mt-1 pt-3 flex items-center justify-between rounded-[20px] bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px]">
                        <Wrench size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">{t('vehicle_card.responsible') || 'المسؤول'}</p>
                        <p className="font-semibold" style={{ color: styles.textPrimary }}>
                          {vehicle.technicianName || vehicle.technician || t('vehicle_card.default_responsible') || 'م. سامي'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <span>{statusConfig.label}</span>
                      <ArrowRight size={14} className="text-blue-500" />
                    </div>
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
