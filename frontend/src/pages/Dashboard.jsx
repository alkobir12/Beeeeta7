import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Users, Wrench, CheckCircle, Plus, Search, MoreVertical, Clock } from 'lucide-react';
import { vehicleAPI, technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import VehicleQuickActions from '../components/VehicleQuickActions';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [vehicles, setVehicles] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  
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
    fetchData();
    
    // Auto-refresh when returning to dashboard
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    
    // Listen for vehicle updates from other pages (VehicleDetails, VehicleQuickActions)
    const handleVehicleUpdated = () => {
      console.log('🔄 Vehicle updated event received - refreshing dashboard');
      fetchData();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vehicleUpdated', handleVehicleUpdated);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vehicleUpdated', handleVehicleUpdated);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, techniciansRes] = await Promise.all([
        vehicleAPI.getAll(),
        technicianAPI.getAll()
      ]);
      setVehicles(vehiclesRes.data);
      setTechnicians(techniciansRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('common.error'), description: t('common.loading'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalVehicles: vehicles.length,
    inProgress: vehicles.filter(v => ['diagnosis', 'in_progress', 'waiting_approval', 'quality_check', 'repair', 'quotation', 'approved'].includes(v.status)).length,
    ready: vehicles.filter(v => v.status === 'ready').length,
    technicians: technicians.length
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = 
      vehicle.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || vehicle.status === filterStatus;
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

  return (
    <div className={`max-w-7xl mx-auto bg-emergent-black min-h-screen px-1 sm:px-0 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1">{t('dashboard.overview')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newLang = i18n.language === 'ar' ? 'en' : 'ar';
                console.log('🔄 Changing language to:', newLang);
                i18n.changeLanguage(newLang);
              }}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700"
            >
              {i18n.language === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button 
              onClick={() => navigate('/new-vehicle')}
              className="apple-button flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Plus size={18} />
              <span>{t('dashboard.new_vehicle')}</span>
            </button>
          </div>
        </div>

        {/* Stats Grid - Responsive 2x2 on mobile, 4 on desktop */}
        <div className="grid-stats mb-4 sm:mb-8">
          <div onClick={() => setFilterStatus('all')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{t('dashboard.total_vehicles')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.totalVehicles}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Car size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>

          <div onClick={() => setFilterStatus('in_progress')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{t('dashboard.in_progress')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.inProgress}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 transition-colors">
                <Wrench size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>

          <div onClick={() => setFilterStatus('ready')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{t('dashboard.ready')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.ready}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition-colors">
                <CheckCircle size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>

          <div onClick={() => navigate('/technicians')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">{t('dashboard.technicians')}</p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.technicians}</h3>
              </div>
              <div className="p-2 sm:p-3 rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                <Users size={20} className="sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter - Stack on mobile */}
        <div className="apple-card p-3 sm:p-4 mb-4 sm:mb-6 space-y-3 sm:space-y-0 sm:flex sm:flex-row sm:gap-4 sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t('dashboard.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-input pr-10 text-sm sm:text-base"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
            {['all', 'diagnosis', 'repair', 'ready'].map((status) => (
              <button
                key={`filter-${status}`}
                onClick={() => setFilterStatus(status)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  filterStatus === status 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
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
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="text-gray-400" size={40} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">{t('common.no_data')}</h3>
              <p className="text-gray-500 mt-1">{t('dashboard.search')}</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const statusConfig = getStatusConfigForVehicle(vehicle.status);
              return (
                <div 
                  key={`vehicle-${vehicle.id}`} 
                  className="apple-card p-3 sm:p-4 md:p-5 cursor-pointer hover:shadow-md transition-shadow group relative overflow-hidden"
                  onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-700 font-bold text-base sm:text-lg flex-shrink-0">
                        {vehicle.brand?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{vehicle.brand} {vehicle.model}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 font-mono">{vehicle.plateNumber}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVehicle(vehicle);
                        setShowQuickActions(true);
                      }}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                      aria-label="Quick Actions"
                    >
                      <MoreVertical size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>

                  <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                      <Users size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{vehicle.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                      <Clock size={14} className="text-gray-400 flex-shrink-0" />
                      <span>{vehicle.createdAt ? new Date(vehicle.createdAt).toLocaleDateString('ar-SA') : '-'}</span>
                    </div>
                  </div>

                  <div className="pt-3 sm:pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
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
