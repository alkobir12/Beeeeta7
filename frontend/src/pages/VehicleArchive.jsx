import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Car, Search, Calendar, User, Phone, FileText, Eye, Trash2, Filter } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { vehicleAPI } from '../services/api';
import { getStatusLabel, getStatusColor } from '../mock/data';

const VehicleArchive = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await vehicleAPI.getAll();
      setVehicles(response.data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الأرشيف",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (vehicleId, e) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذه المركبة من الأرشيف؟')) {
      return;
    }
    
    try {
      await vehicleAPI.delete(vehicleId);
      toast({
        title: "نجح",
        description: "تم حذف المركبة من الأرشيف"
      });
      fetchVehicles();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف المركبة",
        variant: "destructive"
      });
    }
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    // Search filter
    const matchesSearch = !searchQuery || 
      vehicle.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.customerPhone?.includes(searchQuery) ||
      vehicle.fileNumber?.includes(searchQuery);
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
    
    // Date filter
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const vehicleDate = new Date(vehicle.entryDate);
      if (dateFrom) {
        matchesDate = matchesDate && vehicleDate >= new Date(dateFrom);
      }
      if (dateTo) {
        matchesDate = matchesDate && vehicleDate <= new Date(dateTo + 'T23:59:59');
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
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
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">أرشيف المركبات</h1>
            <p className="text-slate-600">سجل كامل لجميع المركبات والصيانات السابقة</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium mb-1">إجمالي المركبات</p>
                    <p className="text-3xl font-bold text-blue-900">{vehicles.length}</p>
                  </div>
                  <div className="bg-blue-600 p-3 rounded-full">
                    <Car className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-700 text-sm font-medium mb-1">تم التسليم</p>
                    <p className="text-3xl font-bold text-green-900">
                      {vehicles.filter(v => v.status === 'ready').length}
                    </p>
                  </div>
                  <div className="bg-green-600 p-3 rounded-full">
                    <FileText className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-700 text-sm font-medium mb-1">قيد العمل</p>
                    <p className="text-3xl font-bold text-orange-900">
                      {vehicles.filter(v => v.status !== 'ready').length}
                    </p>
                  </div>
                  <div className="bg-orange-600 p-3 rounded-full">
                    <Car className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-700 text-sm font-medium mb-1">عدد العملاء</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {new Set(vehicles.map(v => v.customerPhone)).size}
                    </p>
                  </div>
                  <div className="bg-purple-600 p-3 rounded-full">
                    <User className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="mb-6 shadow-lg">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <Input
                      placeholder="بحث برقم اللوحة، اسم العميل، الجوال، أو رقم الملف..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 border-slate-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Date From */}
                <div>
                  <Input
                    type="date"
                    placeholder="من تاريخ"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border-slate-300 focus:border-blue-500"
                  />
                </div>

                {/* Date To */}
                <div>
                  <Input
                    type="date"
                    placeholder="إلى تاريخ"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border-slate-300 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex gap-2 mt-4 flex-wrap">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('all')}
                  size="sm"
                >
                  الكل ({vehicles.length})
                </Button>
                <Button
                  variant={statusFilter === 'diagnosis' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('diagnosis')}
                  size="sm"
                >
                  تشخيص ({vehicles.filter(v => v.status === 'diagnosis').length})
                </Button>
                <Button
                  variant={statusFilter === 'quotation' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('quotation')}
                  size="sm"
                >
                  تسعير ({vehicles.filter(v => v.status === 'quotation').length})
                </Button>
                <Button
                  variant={statusFilter === 'repair' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('repair')}
                  size="sm"
                >
                  إصلاح ({vehicles.filter(v => v.status === 'repair').length})
                </Button>
                <Button
                  variant={statusFilter === 'ready' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('ready')}
                  size="sm"
                >
                  جاهز ({vehicles.filter(v => v.status === 'ready').length})
                </Button>

                {/* Clear Filters */}
                {(searchQuery || dateFrom || dateTo || statusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery('');
                      setDateFrom('');
                      setDateTo('');
                      setStatusFilter('all');
                    }}
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    مسح الفلاتر
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <div className="mb-4 text-slate-600">
            النتائج: <span className="font-bold">{filteredVehicles.length}</span> مركبة
          </div>

          {/* Vehicles Table */}
          <div className="space-y-4">
            {filteredVehicles.map(vehicle => (
              <Card 
                key={vehicle.id} 
                className="shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/vehicle/${vehicle.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* Vehicle Info */}
                    <div className="flex items-center gap-6 flex-1">
                      <div className="bg-slate-100 p-4 rounded-lg">
                        <Car className="text-slate-700" size={32} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-slate-800">{vehicle.plateNumber}</h3>
                          {vehicle.fileNumber && (
                            <Badge variant="outline" className="bg-slate-100">
                              <FileText size={14} className="ml-1" />
                              {vehicle.fileNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-600 mb-1">
                          {vehicle.brand} {vehicle.model} - {vehicle.year}
                        </p>
                        <div className="flex gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <User size={14} />
                            {vehicle.customerName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone size={14} />
                            {vehicle.customerPhone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(vehicle.entryDate).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="flex items-center gap-4">
                      <Badge className={`${getStatusColor(vehicle.status)} text-white px-4 py-2`}>
                        {getStatusLabel(vehicle.status)}
                      </Badge>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/vehicle/${vehicle.id}`);
                          }}
                          className="hover:bg-blue-50"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleDelete(vehicle.id, e)}
                          className="hover:bg-red-600"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Services */}
                  {vehicle.services && vehicle.services.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="flex gap-2 flex-wrap">
                        {vehicle.services.map((service, idx) => (
                          <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {filteredVehicles.length === 0 && (
            <Card className="shadow-md">
              <CardContent className="p-12 text-center">
                <Car className="mx-auto text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 text-lg mb-2">لا توجد نتائج</p>
                <p className="text-slate-400 text-sm">جرب تعديل معايير البحث</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default VehicleArchive;
