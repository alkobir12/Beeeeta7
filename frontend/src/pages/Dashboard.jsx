import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { statusSteps, getStatusLabel, getStatusColor } from '../mock/data';
import { Car, Users, Wrench, CheckCircle, Plus, Search, Trash2, MoreVertical } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { vehicleAPI, technicianAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import VehicleQuickActions from '../components/VehicleQuickActions';

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
        title: "خطأ",
        description: "فشل في تحميل البيانات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المركبة؟')) {
      return;
    }
    
    try {
      await vehicleAPI.delete(vehicleId);
      toast({
        title: "نجح",
        description: "تم حذف المركبة بنجاح"
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف المركبة",
        variant: "destructive"
      });
    }
  };

  const handleStatusUpdate = async (vehicleId, newStatus) => {
    try {
      await vehicleAPI.update(vehicleId, { status: newStatus });
      toast({
        title: "نجح",
        description: "تم تحديث الحالة بنجاح"
      });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث الحالة",
        variant: "destructive"
      });
    }
  };

  const openQuickActions = (vehicle, e) => {
    e.stopPropagation();
    setSelectedVehicle(vehicle);
    setShowQuickActions(true);
  };

  const stats = {
    totalVehicles: vehicles.length,
    inProgress: vehicles.filter(v => v.status !== 'ready').length,
    ready: vehicles.filter(v => v.status === 'ready').length,
    technicians: technicians.length
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = vehicle.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         vehicle.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || vehicle.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">جاري التحميل...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">نظام إدارة الورش</h1>
            <p className="text-slate-600">لوحة التحكم الرئيسية</p>
          </div>
          <Button 
            onClick={() => navigate('/new-vehicle')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Plus className="ml-2" size={20} />
            استقبال مركبة جديدة
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card onClick={() => setFilterStatus('all')} className="cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-700 text-sm font-medium mb-1">إجمالي المركبات</p>
                  <p className="text-3xl font-bold text-blue-900">{stats.totalVehicles}</p>
                </div>
                <div className="bg-blue-600 p-3 rounded-full">
                  <Car className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => setFilterStatus('diagnosis')} className="cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100 border-none shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-700 text-sm font-medium mb-1">قيد العمل</p>
                  <p className="text-3xl font-bold text-orange-900">{stats.inProgress}</p>
                </div>
                <div className="bg-orange-600 p-3 rounded-full">
                  <Wrench className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => setFilterStatus('ready')} className="cursor-pointer bg-gradient-to-br from-green-50 to-green-100 border-none shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-700 text-sm font-medium mb-1">جاهز للتسليم</p>
                  <p className="text-3xl font-bold text-green-900">{stats.ready}</p>
                </div>
                <div className="bg-green-600 p-3 rounded-full">
                  <CheckCircle className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => navigate('/technicians')} className="cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100 border-none shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-700 text-sm font-medium mb-1">الفنيين</p>
                  <p className="text-3xl font-bold text-purple-900">{stats.technicians}</p>
                </div>
                <div className="bg-purple-600 p-3 rounded-full">
                  <Users className="text-white" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="mb-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                  <Input
                    placeholder="بحث برقم اللوحة أو اسم العميل..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 border-slate-300 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('all')}
                  className="transition-all duration-200"
                >
                  الكل
                </Button>
                {statusSteps.map(step => (
                  <Button
                    key={step.key}
                    variant={filterStatus === step.key ? 'default' : 'outline'}
                    onClick={() => setFilterStatus(step.key)}
                    className="transition-all duration-200"
                  >
                    {step.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredVehicles.map(vehicle => (
            <Card 
              key={vehicle.id} 
              className="shadow-md hover:shadow-xl transition-all duration-300 border-r-4"
              style={{ borderRightColor: getStatusColor(vehicle.status).replace('bg-', '#') }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div 
                    className="flex items-center gap-6 flex-1 cursor-pointer"
                    onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                  >
                    <div className="bg-slate-100 p-4 rounded-lg">
                      <Car className="text-slate-700" size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{vehicle.plateNumber}</h3>
                      <p className="text-slate-600">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
                      <p className="text-sm text-slate-500 mt-1">{vehicle.customerName} - {vehicle.customerPhone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-sm text-slate-500 mb-1">الفني المسؤول</p>
                      <p className="font-semibold text-slate-700">{vehicle.technicianName || 'غير محدد'}</p>
                    </div>
                    <Badge className={`${getStatusColor(vehicle.status)} text-white px-4 py-2 text-sm`}>
                      {getStatusLabel(vehicle.status)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => openQuickActions(vehicle, e)}
                      className="hover:bg-slate-100"
                    >
                      <MoreVertical size={16} />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex gap-2 flex-wrap">
                    {vehicle.services && vehicle.services.map((service, idx) => (
                      <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredVehicles.length === 0 && (
          <Card className="shadow-md">
            <CardContent className="p-12 text-center">
              <Car className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">لا توجد مركبات</p>
            </CardContent>
          </Card>
        )}
      </div>
      </div>

      {/* Quick Actions Modal */}
      {selectedVehicle && (
        <VehicleQuickActions
          isOpen={showQuickActions}
          onClose={() => {
            setShowQuickActions(false);
            setSelectedVehicle(null);
          }}
          vehicle={selectedVehicle}
          onStatusUpdate={(newStatus) => handleStatusUpdate(selectedVehicle.id, newStatus)}
          onDelete={() => handleDeleteVehicle(selectedVehicle.id)}
        />
      )}
    </Layout>
  );
};

export default Dashboard;