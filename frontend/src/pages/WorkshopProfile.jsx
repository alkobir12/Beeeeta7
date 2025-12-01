import React, { useState, useEffect } from 'react';
import { useToast } from '../hooks/use-toast';
import { Building2, Phone, MapPin, FileText, Save } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WorkshopProfile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '', nameEnglish: '', phone: '', whatsapp: '', email: '', address: '', city: '',
    postalCode: '', taxNumber: '', commercialRegister: '', workingHours: '', invoiceFooter: '', termsAndConditions: ''
  });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`);
      setProfile({ ...profile, ...response.data });
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/profile`, profile);
      toast({ title: 'تم الحفظ', description: 'تم تحديث معلومات الورشة بنجاح' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-4">
            <Building2 size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ملف الورشة</h1>
          <p className="text-gray-500 mt-1">إدارة الهوية والمعلومات الرسمية</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <Building2 size={20} />
              <h3 className="font-bold text-gray-900">المعلومات الأساسية</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">اسم الورشة (عربي)</label><input className="apple-input" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">اسم الورشة (إنجليزي)</label><input className="apple-input" value={profile.nameEnglish} onChange={e => setProfile({...profile, nameEnglish: e.target.value})} /></div>
            </div>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-green-600">
              <Phone size={20} />
              <h3 className="font-bold text-gray-900">معلومات الاتصال</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">رقم الهاتف</label><input className="apple-input" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} required /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">واتساب</label><input className="apple-input" value={profile.whatsapp} onChange={e => setProfile({...profile, whatsapp: e.target.value})} /></div>
              <div className="md:col-span-2"><label className="text-sm font-medium text-gray-700 mb-1 block">البريد الإلكتروني</label><input type="email" className="apple-input" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} /></div>
            </div>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-orange-600">
              <MapPin size={20} />
              <h3 className="font-bold text-gray-900">العنوان</h3>
            </div>
            <div className="space-y-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">العنوان الكامل</label><input className="apple-input" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">المدينة</label><input className="apple-input" value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">الرمز البريدي</label><input className="apple-input" value={profile.postalCode} onChange={e => setProfile({...profile, postalCode: e.target.value})} /></div>
              </div>
            </div>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center gap-2 mb-6 text-purple-600">
              <FileText size={20} />
              <h3 className="font-bold text-gray-900">المعلومات القانونية</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">الرقم الضريبي</label><input className="apple-input" value={profile.taxNumber} onChange={e => setProfile({...profile, taxNumber: e.target.value})} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">السجل التجاري</label><input className="apple-input" value={profile.commercialRegister} onChange={e => setProfile({...profile, commercialRegister: e.target.value})} /></div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="apple-button w-full h-12 text-lg font-semibold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
            <Save size={20} />
            <span>{loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
          </button>
        </form>
      </div>
  );
};

export default WorkshopProfile;
