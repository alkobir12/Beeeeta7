import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { Building2, Phone, Mail, MapPin, FileText, Upload, Save } from 'lucide-react';
import Layout from '../components/Layout';
import AIHelper from '../components/AIHelper';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WorkshopProfile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    nameEnglish: '',
    logo: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    postalCode: '',
    taxNumber: '',
    commercialRegister: '',
    bankAccount: '',
    iban: '',
    workingHours: '',
    invoiceFooter: '',
    termsAndConditions: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`);
      // Ensure all fields have values (prevent undefined)
      setProfile({
        name: response.data.name || '',
        nameEnglish: response.data.nameEnglish || '',
        logo: response.data.logo || '',
        phone: response.data.phone || '',
        whatsapp: response.data.whatsapp || '',
        email: response.data.email || '',
        address: response.data.address || '',
        city: response.data.city || '',
        postalCode: response.data.postalCode || '',
        taxNumber: response.data.taxNumber || '',
        commercialRegister: response.data.commercialRegister || '',
        bankAccount: response.data.bankAccount || '',
        iban: response.data.iban || '',
        workingHours: response.data.workingHours || '',
        invoiceFooter: response.data.invoiceFooter || '',
        termsAndConditions: response.data.termsAndConditions || ''
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.put(`${API}/profile`, profile);
      await loadProfile(); // Reload profile data to reflect changes
      toast({
        title: 'تم الحفظ',
        description: 'تم تحديث معلومات الورشة بنجاح'
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل حفظ المعلومات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-lg shadow-lg text-white mb-6">
              <Building2 className="mx-auto mb-4" size={48} />
              <h1 className="text-3xl font-bold">بروفايل الورشة</h1>
              <p className="text-blue-100 mt-2">إدارة معلومات ورشتك</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Basic Info */}
            <Card className="mb-6 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
                <CardTitle>المعلومات الأساسية</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم الورشة (عربي) *</Label>
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({...profile, name: e.target.value})}
                      placeholder="ورشتي"
                      required
                    />
                  </div>
                  <div>
                    <Label>اسم الورشة (إنجليزي)</Label>
                    <Input
                      value={profile.nameEnglish || ''}
                      onChange={(e) => setProfile({...profile, nameEnglish: e.target.value})}
                      placeholder="My Workshop"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="mb-6 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Phone size={24} />
                  معلومات الاتصال
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>رقم الهاتف *</Label>
                    <Input
                      value={profile.phone}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                      placeholder="0501234567"
                      required
                    />
                  </div>
                  <div>
                    <Label>واتساب *</Label>
                    <Input
                      value={profile.whatsapp}
                      onChange={(e) => setProfile({...profile, whatsapp: e.target.value})}
                      placeholder="966501234567"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={profile.email || ''}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                      placeholder="info@workshop.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card className="mb-6 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-orange-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <MapPin size={24} />
                  العنوان
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>العنوان الكامل *</Label>
                  <Input
                    value={profile.address}
                    onChange={(e) => setProfile({...profile, address: e.target.value})}
                    placeholder="الشارع، الحي"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>المدينة *</Label>
                    <Input
                      value={profile.city}
                      onChange={(e) => setProfile({...profile, city: e.target.value})}
                      placeholder="الرياض"
                      required
                    />
                  </div>
                  <div>
                    <Label>الرمز البريدي</Label>
                    <Input
                      value={profile.postalCode || ''}
                      onChange={(e) => setProfile({...profile, postalCode: e.target.value})}
                      placeholder="12345"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legal Info */}
            <Card className="mb-6 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-purple-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <FileText size={24} />
                  المعلومات القانونية
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>الرقم الضريبي</Label>
                    <Input
                      value={profile.taxNumber || ''}
                      onChange={(e) => setProfile({...profile, taxNumber: e.target.value})}
                      placeholder="300000000000003"
                    />
                  </div>
                  <div>
                    <Label>السجل التجاري</Label>
                    <Input
                      value={profile.commercialRegister || ''}
                      onChange={(e) => setProfile({...profile, commercialRegister: e.target.value})}
                      placeholder="1234567890"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card className="mb-6 shadow-lg">
              <CardHeader className="bg-gradient-to-l from-slate-50 to-transparent">
                <CardTitle>معلومات إضافية</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>ساعات العمل</Label>
                  <Input
                    value={profile.workingHours || ''}
                    onChange={(e) => setProfile({...profile, workingHours: e.target.value})}
                    placeholder="السبت - الخميس: 8 صباحاً - 6 مساءً"
                  />
                </div>
                <div>
                  <Label>نص تذييل الفاتورة</Label>
                  <Textarea
                    value={profile.invoiceFooter || ''}
                    onChange={(e) => setProfile({...profile, invoiceFooter: e.target.value})}
                    placeholder="شكراً لتعاملكم معنا"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>الشروط والأحكام</Label>
                  <Textarea
                    value={profile.termsAndConditions || ''}
                    onChange={(e) => setProfile({...profile, termsAndConditions: e.target.value})}
                    placeholder="الشروط والأحكام الخاصة بالورشة"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 text-lg shadow-lg"
              >
                <Save className="ml-2" size={20} />
                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </div>
          </form>
        </div>
        <AIHelper />
      </div>
    </Layout>
  );
};

export default WorkshopProfile;