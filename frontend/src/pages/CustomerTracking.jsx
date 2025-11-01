import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Car, CheckCircle, Calendar, Wrench, Phone, Mail, Hash } from 'lucide-react';
import { vehicleAPI } from '../services/api';
import CustomerChatbot from '../components/CustomerChatbot';

const getStatusLabel = (key) => {
  const map = {
    diagnosis: 'تشخيص',
    quotation: 'تسعير',
    approved: 'معتمد',
    repair: 'تحت الإصلاح',
    ready: 'جاهز للتسليم',
    delivered: 'تم التسليم',
  };
  return map[key] || key || 'غير محدد';
};

const getStatusColor = (key) => {
  const map = {
    diagnosis: 'bg-yellow-500',
    quotation: 'bg-blue-500',
    approved: 'bg-green-500',
    repair: 'bg-orange-500',
    ready: 'bg-green-600',
    delivered: 'bg-gray-500',
  };
  return map[key] || 'bg-slate-400';
};

const steps = [
  { key: 'diagnosis', label: 'تشخيص', color: 'bg-yellow-500' },
  { key: 'quotation', label: 'تسعير', color: 'bg-blue-500' },
  { key: 'approved', label: 'معتمد', color: 'bg-green-500' },
  { key: 'repair', label: 'تحت الإصلاح', color: 'bg-orange-500' },
  { key: 'ready', label: 'جاهز للتسليم', color: 'bg-green-600' },
  { key: 'delivered', label: 'تم التسليم', color: 'bg-gray-500' },
];

const CustomerTracking = () => {
  const { trackingId } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await vehicleAPI.track(trackingId);
        setVehicle(res.data);
        setError('');
      } catch (e) {
        setError('رابط غير صحيح - الرجاء التحقق من رابط التتبع');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [trackingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center" dir="rtl">
        <div className="text-slate-700">جاري التحميل...</div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center" dir="rtl">
        <Card className="shadow-xl max-w-md">
          <CardContent className="p-12 text-center">
            <Car className="mx-auto text-slate-300 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">رابط غير صحيح</h2>
            <p className="text-slate-600">{error || 'الرجاء التحقق من رابط التتبع'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepIndex = steps.findIndex(s => s.key === vehicle.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50" dir="rtl">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Car className="text-blue-600" size={40} />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">تتبع مركبتك</h1>
          <p className="text-slate-600 text-lg">{vehicle.plateNumber}</p>
        </div>

        {/* Status Badge */}
        <div className="text-center mb-8">
          <Badge className={`${getStatusColor(vehicle.status)} text-white px-6 py-3 text-lg shadow-lg`}>
            الحالة الحالية: {getStatusLabel(vehicle.status)}
          </Badge>
        </div>

        {/* Progress Steps */}
        <Card className="mb-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-center text-2xl">مراحل العمل</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-6">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isPending = index > currentStepIndex;

                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div 
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted 
                          ? 'bg-green-500 text-white shadow-lg scale-110' 
                          : isCurrent
                          ? step.color + ' text-white shadow-xl scale-110 animate-pulse'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle size={32} />
                      ) : (
                        <span className="text-2xl font-bold">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold ${
                        isCompleted || isCurrent ? 'text-slate-800' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {isCompleted && 'تم الإنجاز'}
                        {isCurrent && 'جاري العمل عليها'}
                        {isPending && 'في الانتظار'}
                      </p>
                    </div>
                    {(isCompleted || isCurrent) && (
                      <CheckCircle className="text-green-500" size={24} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Car size={24} />
              معلومات المركبة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">رقم اللوحة</p>
                <p className="font-bold text-slate-800 text-lg">{vehicle.plateNumber}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">المركبة</p>
                <p className="font-bold text-slate-800 text-lg">{vehicle.brand} {vehicle.model}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">السنة</p>
                <p className="font-bold text-slate-800 text-lg">{vehicle.year}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">اللون</p>
                <p className="font-bold text-slate-800 text-lg">{vehicle.color}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">رقم الملف</p>
                <p className="font-bold text-slate-800 text-lg">{vehicle.file_number || '-'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">VIN</p>
                <p className="font-bold text-slate-800 text-lg">{vehicle.vin || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-orange-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Wrench size={24} />
              الخدمات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-2 flex-wrap">
              {(vehicle.services || []).map((service, idx) => (
                <Badge key={idx} className="bg-orange-100 text-orange-700 border-orange-200 px-4 py-2">
                  {service}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-green-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <Calendar size={24} />
              التواريخ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  تاريخ الاستقبال
                </p>
                <p className="font-semibold text-blue-900">{vehicle.entryDate ? new Date(vehicle.entryDate).toLocaleString('ar-SA') : '-'}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  التسليم المتوقع
                </p>
                <p className="font-semibold text-orange-900">{vehicle.estimatedCompletion ? new Date(vehicle.estimatedCompletion).toLocaleString('ar-SA') : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-4">هل لديك استفسار؟</h3>
            <p className="text-slate-600 mb-6">لا تتردد في التواصل معنا</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href={`tel:${vehicle.customerPhone || ''}`} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md">
                <Phone size={20} />
                اتصل بنا
              </a>
              <a href={`mailto:${vehicle.customerEmail || 'support@workshop.com'}`} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                <Mail size={20} />
                راسلنا
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerTracking;
