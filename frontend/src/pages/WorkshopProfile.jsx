import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../hooks/use-toast';
import { Building2, Phone, MapPin, FileText, Save, Upload, Image, X, Sparkles } from 'lucide-react';
import axios from 'axios';
import { resolveBackendBase } from '../utils/backendBase';

const API = process.env.NODE_ENV === 'production'
  ? '/api'
  : `${resolveBackendBase()}/api`.replace('//api', '/api');

const WorkshopProfile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState({
    name: '', nameEnglish: '', slogan: '', sloganEnglish: '', logo: '',
    phone: '', whatsapp: '', email: '', address: '', city: '',
    postalCode: '', taxNumber: '', commercialRegister: '', workingHours: '', invoiceFooter: '', termsAndConditions: ''
  });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`);
      setProfile((prev) => ({ ...prev, ...response.data }));
    } catch (error) { console.error(error); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'خطأ', description: 'يرجى اختيار ملف صورة', variant: 'destructive' });
      return;
    }
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت', variant: 'destructive' });
      return;
    }
    
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API}/profile/upload-logo`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile((prev) => ({ ...prev, logo: data.logo_url || data.url }));
        toast({ title: 'تم الرفع', description: 'تم رفع الشعار بنجاح' });
      } else {
        throw new Error('فشل رفع الشعار');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      // If upload fails, use base64 as fallback
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfile((prev) => ({ ...prev, logo: e.target.result }));
        toast({ title: 'تم', description: 'تم تحميل الشعار محلياً' });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const removeLogo = () => {
    setProfile((prev) => ({ ...prev, logo: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/profile`, profile);
      await loadProfile();
      toast({ title: 'تم الحفظ', description: 'تم تحديث معلومات الورشة بنجاح' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="text-center py-4 sm:py-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-3 sm:mb-4">
          <Building2 size={32} className="sm:w-10 sm:h-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ملف الورشة</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">إدارة الهوية والمعلومات الرسمية</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Logo & Branding Section */}
        <div className="apple-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6 text-purple-600">
            <Image size={20} />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">الهوية البصرية</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <div className="flex flex-col items-center">
              <label className="text-sm font-medium text-gray-700 mb-3 block">شعار الورشة (Logo)</label>
              <div className="relative">
                {profile.logo ? (
                  <div className="relative group">
                    <img 
                      src={profile.logo} 
                      alt="شعار الورشة" 
                      className="w-32 h-32 sm:w-40 sm:h-40 object-contain rounded-xl border-2 border-gray-200 bg-white p-2"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -left-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-32 sm:w-40 sm:h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                  >
                    {uploadingLogo ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    ) : (
                      <>
                        <Upload size={28} className="text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500 text-center px-2">اضغط لرفع الشعار</span>
                        <span className="text-[10px] text-gray-400 mt-1">PNG, JPG (أقصى 2MB)</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              {profile.logo && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  تغيير الشعار
                </button>
              )}
            </div>

            {/* Slogan */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-500" />
                  الشعار النصي (Slogan) - عربي
                </label>
                <input 
                  className="apple-input" 
                  placeholder="مثال: جودة تستحق الثقة"
                  value={profile.slogan || ''} 
                  onChange={e => setProfile({...profile, slogan: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-500" />
                  الشعار النصي (Slogan) - إنجليزي
                </label>
                <input 
                  className="apple-input" 
                  placeholder="Example: Quality You Can Trust"
                  value={profile.sloganEnglish || ''} 
                  onChange={e => setProfile({...profile, sloganEnglish: e.target.value})} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="apple-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6 text-blue-600">
            <Building2 size={20} />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">المعلومات الأساسية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">اسم الورشة (عربي)</label>
              <input className="apple-input" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">اسم الورشة (إنجليزي)</label>
              <input className="apple-input" value={profile.nameEnglish} onChange={e => setProfile({...profile, nameEnglish: e.target.value})} />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="apple-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6 text-green-600">
            <Phone size={20} />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">معلومات الاتصال</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">رقم الهاتف</label>
              <input className="apple-input" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">واتساب</label>
              <input className="apple-input" value={profile.whatsapp} onChange={e => setProfile({...profile, whatsapp: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">البريد الإلكتروني</label>
              <input type="email" className="apple-input" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="apple-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6 text-orange-600">
            <MapPin size={20} />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">العنوان</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">العنوان الكامل</label>
              <input className="apple-input" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">المدينة</label>
                <input className="apple-input" value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">الرمز البريدي</label>
                <input className="apple-input" value={profile.postalCode} onChange={e => setProfile({...profile, postalCode: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        {/* Legal Info */}
        <div className="apple-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6 text-purple-600">
            <FileText size={20} />
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">المعلومات القانونية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">الرقم الضريبي</label>
              <input className="apple-input" value={profile.taxNumber} onChange={e => setProfile({...profile, taxNumber: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">السجل التجاري</label>
              <input className="apple-input" value={profile.commercialRegister} onChange={e => setProfile({...profile, commercialRegister: e.target.value})} />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={loading} 
          className="apple-button w-full h-11 sm:h-12 text-base sm:text-lg font-semibold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          data-testid="workshop-profile-save-button"
        >
          <Save size={20} />
          <span>{loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
        </button>
      </form>
    </div>
  );
};

export default WorkshopProfile;