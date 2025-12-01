import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Car, CheckCircle, Wrench, AlertCircle, Phone, Mail, ArrowRight } from 'lucide-react';
import { vehicleAPI } from '../services/api';
import CustomerChatbot from '../components/CustomerChatbot';

const getStatusLabel = (key) => {
  const map = { diagnosis: 'تشخيص', quotation: 'تسعير', approved: 'معتمد', repair: 'إصلاح', ready: 'جاهز', delivered: 'تم التسليم' };
  return map[key] || key;
};

const steps = [
  { key: 'diagnosis', label: 'تشخيص' }, { key: 'quotation', label: 'تسعير' },
  { key: 'repair', label: 'إصلاح' }, { key: 'ready', label: 'جاهز' }, { key: 'delivered', label: 'تم التسليم' }
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
      } catch (e) { setError('رابط غير صحيح'); } finally { setLoading(false); }
    };
    load();
  }, [trackingId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] text-gray-500">جاري التحميل...</div>;
  if (error || !vehicle) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]"><div className="apple-card p-8 text-center"><AlertCircle className="mx-auto text-red-500 mb-4" size={48}/><h2 className="text-xl font-bold text-gray-900">{error}</h2></div></div>;

  const currentIdx = steps.findIndex(s => s.key === vehicle.status);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans" dir="rtl">
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center mb-10 pt-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-500/10">
            <Car className="text-blue-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">تتبع حالة المركبة</h1>
          <p className="text-gray-500 text-lg">{vehicle.plateNumber} • {vehicle.brand} {vehicle.model}</p>
        </div>

        <div className="apple-card p-8 mb-8 border-0 shadow-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">مراحل العمل</h2>
          <div className="relative flex justify-between">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-gray-100 -z-10 rounded-full">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
              />
            </div>

            {steps.map((step, idx) => {
              const isCompleted = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              
              return (
                <div key={step.key} className="flex flex-col items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30' : 'bg-white border-2 border-gray-200 text-gray-300'
                  }`}>
                    {isCompleted ? <CheckCircle size={20} /> : <span className="text-sm font-bold">{idx + 1}</span>}
                  </div>
                  <span className={`text-xs font-medium transition-colors ${isCurrent ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-10 p-4 bg-blue-50 rounded-xl text-center">
            <p className="text-blue-800 font-medium">
              الحالة الحالية: <span className="font-bold text-lg mr-1">{getStatusLabel(vehicle.status)}</span>
            </p>
            {vehicle.estimatedCompletion && (
              <p className="text-blue-600/80 text-sm mt-1">
                الموعد المتوقع: {new Date(vehicle.estimatedCompletion).toLocaleDateString('ar-SA')}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="apple-card p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wrench size={20} className="text-gray-400" />
              الخدمات المطلوبة
            </h3>
            <div className="flex flex-wrap gap-2">
              {(vehicle.services || []).map((s, i) => (
                <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="apple-card p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Phone size={20} className="text-gray-400" />
              تواصل معنا
            </h3>
            <div className="space-y-3">
              <a href={`tel:${vehicle.customerPhone}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Phone size={20} />
                </div>
                <span className="font-medium text-gray-700">اتصال هاتفي</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      <CustomerChatbot vehicleId={vehicle?.id} vehicleInfo={`${vehicle?.brand} ${vehicle?.model}`} />
    </div>
  );
};

export default CustomerTracking;
