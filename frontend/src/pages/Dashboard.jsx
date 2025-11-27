import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Car, Users, Wrench, CheckCircle, Plus, Search, MoreVertical, Clock, AlertCircle } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { vehicleAPI, technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import VehicleQuickActions from '../components/VehicleQuickActions';

// حالات المركبة
const STATUS_CONFIG = {
  diagnosis: { label: 'تشخيص', color: 'bg-orange-500', bgLight: 'bg-orange-50 text-orange-700' },
  waiting_approval: { label: 'بانتظار الموافقة', color: 'bg-yellow-500', bgLight: 'bg-yellow-50 text-yellow-700' },
  in_progress: { label: 'قيد العمل', color: 'bg-blue-500', bgLight: 'bg-blue-50 text-blue-700' },
  quality_check: { label: 'فحص الجودة', color: 'bg-purple-500', bgLight: 'bg-purple-50 text-purple-700' },
  ready: { label: 'جاهز للتسليم', color: 'bg-green-500', bgLight: 'bg-green-50 text-green-700' },
  delivered: { label: 'تم التسليم', color: 'bg-gray-500', bgLight: 'bg-gray-50 text-gray-700' }
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
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل البيانات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // إحصائيات
  const stats = {
    totalVehicles: vehicles.length,
    inProgress: vehicles.filter(v => ['diagnosis', 'in_progress', 'waiting_approval', 'quality_check'].includes(v.status)).length,
    ready: vehicles.filter(v => v.status === 'ready').length,
    technicians: technicians.length
  };

  // تصفية المركبات
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
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-main">
        {/* العنوان */}
        <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="page-title">لوحة التحكم</h1>
            <p className="page-subtitle">مرحباً بك في نظام إدارة الورشة</p>
          </div>
          <Button 
            onClick={() => navigate('/new-vehicle')}
            className="btn-primary"
          >
            <Plus size={20} />
            <span>استقبال مركبة جديدة</span>
          </Button>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid-stats mb-8">
          <div 
            onClick={() => setFilterStatus('all')} 
            className="stat-card stat-card-blue cursor-pointer"
          >
            <div>
              <p className="stat-label">إجمالي المركبات</p>
              <p className="stat-value text-blue-600">{stats.totalVehicles}</p>
            </div>
            <div className="stat-icon bg-blue-500 text-white">
              <Car size={24} />
            </div>
          </div>

          <div 
            onClick={() => setFilterStatus('in_progress')} 
            className="stat-card stat-card-orange cursor-pointer"
          >
            <div>
              <p className="stat-label">قيد العمل</p>
              <p className="stat-value text-orange-600">{stats.inProgress}</p>
            </div>
            <div className="stat-icon bg-orange-500 text-white">
              <Wrench size={24} />
            </div>
          </div>

          <div 
            onClick={() => setFilterStatus('ready')} 
            className="stat-card stat-card-green cursor-pointer"
          >
            <div>
              <p className="stat-label">جاهز للتسليم</p>
              <p className="stat-value text-green-600">{stats.ready}</p>
            </div>
            <div className="stat-icon bg-green-500 text-white">
              <CheckCircle size={24} />
            </div>
          </div>

          <div 
            onClick={() => navigate('/technicians')} 
            className="stat-card stat-card-purple cursor-pointer"
          >
            <div>
              <p className="stat-label">الفنيين</p>
              <p className="stat-value text-purple-600">{stats.technicians}</p>
            </div>
            <div className="stat-icon bg-purple-500 text-white">
              <Users size={24} />
            </div>
          </div>
        </div>

        {/* البحث والتصفية */}
        <Card className="card-modern mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  type="text"
                  placeholder="بحث باسم العميل أو رقم اللوحة أو الماركة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-modern pr-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'diagnosis', 'in_progress', 'ready'].map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className={filterStatus === status ? 'bg-primary' : ''}
                  >
                    {status === 'all' ? 'الكل' : getStatusConfig(status).label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* قائمة المركبات */}
        <div className="grid-fluid">
          {filteredVehicles.length === 0 ? (
            <Card className="card-modern col-span-full">
              <CardContent className="p-8 text-center">
                <Car className="mx-auto mb-4 text-muted-foreground" size={48} />
                <p className="text-muted-foreground">لا توجد مركبات</p>
                <Button 
                  onClick={() => navigate('/new-vehicle')}
                  className="btn-primary mt-4"
                >
                  <Plus size={18} />
                  <span>إضافة مركبة جديدة</span>
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredVehicles.map((vehicle) => {
              const statusConfig = getStatusConfig(vehicle.status);
              return (
                <Card 
                  key={vehicle.id} 
                  className="card-modern cursor-pointer"
                  onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                >
                  <CardContent className="p-4">
                    {/* رأس البطاقة */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${statusConfig.color} flex items-center justify-center text-white`}>
                          <Car size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">
                            {vehicle.brand} {vehicle.model}
                          </h3>
                          <p className="text-sm text-muted-foreground">{vehicle.plateNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicle(vehicle);
                          setShowQuickActions(true);
                        }}
                        className="btn-icon"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    {/* معلومات العميل */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Users size={14} className="text-muted-foreground" />
                        <span>{vehicle.customerName}</span>
                      </div>
                      {vehicle.customerPhone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span dir="ltr">{vehicle.customerPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* الحالة والتاريخ */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <Badge className={statusConfig.bgLight}>
                        {statusConfig.label}
                      </Badge>
                      {vehicle.createdAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(vehicle.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* نافذة الإجراءات السريعة */}
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
