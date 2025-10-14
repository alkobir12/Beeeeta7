import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { statusSteps, getStatusLabel, getStatusColor } from '../mock/data';
import { ArrowRight, Car, User, Phone, Calendar, Wrench, MessageSquare, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { vehicleAPI, technicianAPI } from '../services/api';
import Layout from '../components/Layout';

const VehicleDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('diagnosis');
  const [notes, setNotes] = useState('');
  const [assignedTech, setAssignedTech] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vehicleRes, techniciansRes] = await Promise.all([
        vehicleAPI.getById(id),
        technicianAPI.getAll()
      ]);
      setVehicle(vehicleRes.data);
      setTechnicians(techniciansRes.data);
      setStatus(vehicleRes.data.status || 'diagnosis');
      setNotes(vehicleRes.data.notes || '');
      setAssignedTech(vehicleRes.data.technicianId || '');
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات المركبة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      await vehicleAPI.update(id, {
        status,
        notes,
        technicianId: assignedTech
      });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث حالة المركبة بنجاح. سيتم إرسال إشعار للعميل.',
      });
      fetchData();
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث المركبة",
        variant: "destructive"
      });
    }
  };

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

  if (!vehicle) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" dir="rtl">
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <Car className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-500 text-lg">المركبة غير موجودة</p>
              <Button onClick={() => navigate('/')} className="mt-4">العودة للرئيسية</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleNotify = () => {
    toast({
      title: 'تم الإرسال',
      description: 'تم إرسال رابط التتبع ورسالة واتساب للعميل.',
    });
  };

  const currentStepIndex = statusSteps.findIndex(s => s.key === status);

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="hover:bg-slate-100 transition-colors"
          >
            <ArrowRight size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-800">{vehicle.plateNumber}</h1>
            <p className="text-slate-600">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
          </div>
          <Badge className={`${getStatusColor(status)} text-white px-4 py-2 text-base`}>
            {getStatusLabel(status)}
          </Badge>
        </div>

        {/* Status Progress */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>مراحل العمل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between relative">
              {statusSteps.map((step, index) => (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center z-10">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        index <= currentStepIndex 
                          ? step.color + ' text-white shadow-lg' 
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {index < currentStepIndex ? (
                        <CheckCircle size={24} />
                      ) : (
                        <span className="font-bold">{index + 1}</span>
                      )}
                    </div>
                    <span className={`mt-2 text-sm font-medium ${
                      index <= currentStepIndex ? 'text-slate-800' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle & Customer Info */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Car size={24} />
                  معلومات المركبة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">رقم اللوحة</span>
                  <span className="font-semibold text-slate-800">{vehicle.plateNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">الماركة</span>
                  <span className="font-semibold text-slate-800">{vehicle.brand}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">الموديل</span>
                  <span className="font-semibold text-slate-800">{vehicle.model}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">السنة</span>
                  <span className="font-semibold text-slate-800">{vehicle.year}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">اللون</span>
                  <span className="font-semibold text-slate-800">{vehicle.color}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <User size={24} />
                  معلومات العميل
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">الاسم</span>
                  <span className="font-semibold text-slate-800">{vehicle.customerName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">رقم الجوال</span>
                  <span className="font-semibold text-slate-800">{vehicle.customerPhone}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">رابط التتبع</span>
                  <span className="font-mono text-blue-600">{vehicle.trackingLink}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Panel */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-orange-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <Wrench size={24} />
                  إدارة العمل
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">تحديث الحالة</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusSteps.map(step => (
                        <SelectItem key={step.key} value={step.key}>
                          {step.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">الفني المسؤول</label>
                  <Select value={assignedTech} onValueChange={setAssignedTech}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفني" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map(tech => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name} - {tech.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">الخدمات</label>
                  <div className="flex gap-2 flex-wrap">
                    {vehicle.services.map((service, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-700 border-blue-200">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleStatusUpdate}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  حفظ التحديثات
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-purple-50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <MessageSquare size={24} />
                  ملاحظات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أضف ملاحظات حول حالة المركبة..."
                  className="min-h-32"
                />
                <Button 
                  onClick={handleNotify}
                  variant="outline"
                  className="w-full border-green-600 text-green-700 hover:bg-green-50 transition-colors"
                >
                  <Phone className="ml-2" size={18} />
                  إرسال تحديث للعميل (واتساب)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Timeline */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar size={24} />
              التواريخ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-1">تاريخ الاستقبال</p>
                <p className="font-semibold text-blue-900">{new Date(vehicle.entryDate).toLocaleString('ar-SA')}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700 mb-1">التسليم المتوقع</p>
                <p className="font-semibold text-orange-900">{new Date(vehicle.estimatedCompletion).toLocaleString('ar-SA')}</p>
              </div>
              {vehicle.completionDate && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700 mb-1">تاريخ الإنجاز</p>
                  <p className="font-semibold text-green-900">{new Date(vehicle.completionDate).toLocaleString('ar-SA')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VehicleDetails;