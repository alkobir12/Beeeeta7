import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Users, Wrench, CheckCircle, Plus, Search, MoreVertical, Clock } from 'lucide-react';
import Layout from '../components/Layout';
import { vehicleAPI, technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import VehicleQuickActions from '../components/VehicleQuickActions';

const STATUS_CONFIG = {
  diagnosis: { label: 'تشخيص', color: 'text-orange-600 bg-orange-50', iconColor: 'text-orange-500' },
  waiting_approval: { label: 'بانتظار الموافقة', color: 'text-yellow-600 bg-yellow-50', iconColor: 'text-yellow-500' },
  in_progress: { label: 'قيد العمل', color: 'text-blue-600 bg-blue-50', iconColor: 'text-blue-500' },
  quality_check: { label: 'فحص الجودة', color: 'text-purple-600 bg-purple-50', iconColor: 'text-purple-500' },
  ready: { label: 'جاهز للتسليم', color: 'text-green-600 bg-green-50', iconColor: 'text-green-500' },
  delivered: { label: 'تم التسليم', color: 'text-gray-600 bg-gray-50', iconColor: 'text-gray-500' }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [vehicles, setVehicles] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(false);

  useEffect(() => {
    fetchData();
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
      toast({ title: 'خطأ', description: 'فشل في تحميل البيانات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalVehicles: vehicles.length,
    inProgress: vehicles.filter(v => ['diagnosis', 'in_progress', 'waiting_approval', 'quality_check'].includes(v.status)).length,
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

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.diagnosis;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
            <p className="text-gray-500 mt-1">نظرة عامة على حالة الورشة اليوم</p>
          </div>
          <button 
            onClick={() => navigate('/new-vehicle')}
            className="apple-button flex items-center gap-2"
          >
            <Plus size={18} />
            <span>استقبال مركبة</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid-stats mb-8">
          <div onClick={() => setFilterStatus('all')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">إجمالي المركبات</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.totalVehicles}</h3>
              </div>
              <div className="p-3 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                <Car size={24} />
              </div>
            </div>
          </div>

          <div onClick={() => setFilterStatus('in_progress')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">قيد العمل</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.inProgress}</h3>
              </div>
              <div className="p-3 rounded-full bg-orange-50 text-orange-600 group-hover:bg-orange-100 transition-colors">
                <Wrench size={24} />
              </div>
            </div>
          </div>

          <div onClick={() => setFilterStatus('ready')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">جاهز للتسليم</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.ready}</h3>
              </div>
              <div className="p-3 rounded-full bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors">
                <CheckCircle size={24} />
              </div>
            </div>
          </div>

          <div onClick={() => navigate('/technicians')} className="stat-card group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">الفنيين المتاحين</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.technicians}</h3>
              </div>
              <div className="p-3 rounded-full bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                <Users size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="apple-card p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث باسم العميل، رقم اللوحة، أو نوع السيارة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-input pr-10"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            {['all', 'diagnosis', 'in_progress', 'ready'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filterStatus === status 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'الكل' : getStatusConfig(status).label}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="text-gray-400" size={40} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">لا توجد مركبات</h3>
              <p className="text-gray-500 mt-1">لم يتم العثور على مركبات تطابق بحثك</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const statusConfig = getStatusConfig(vehicle.status);
              return (
                <div 
                  key={vehicle.id} 
                  className="apple-card p-5 cursor-pointer hover:shadow-md transition-shadow group relative overflow-hidden"
                  onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-700 font-bold text-lg">
                        {vehicle.brand?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{vehicle.brand} {vehicle.model}</h3>
                        <p className="text-sm text-gray-500 font-mono">{vehicle.plateNumber}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVehicle(vehicle);
                        setShowQuickActions(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users size={16} className="text-gray-400" />
                      <span>{vehicle.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={16} className="text-gray-400" />
                      <span>{new Date(vehicle.createdAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
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
            vehicle={selectedVehicle}
            onClose={() => {
              setShowQuickActions(false);
              setSelectedVehicle(null);
            }}
            onRefresh={fetchData}
          />
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
