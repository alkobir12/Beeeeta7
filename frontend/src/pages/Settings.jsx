import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { 
  Settings as SettingsIcon, 
  Building2, 
  FileText, 
  Bell, 
  Globe, 
  Shield,
  Download,
  Upload,
  Save,
  RefreshCw
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workshop');
  const [settings, setSettings] = useState({
    // Workshop Settings
    workshopName: '',
    workshopPhone: '',
    workshopWhatsapp: '',
    workshopEmail: '',
    workshopAddress: '',
    workshopCity: '',
    taxNumber: '',
    logoUrl: '',
    
    // Print Settings
    defaultTemplate: 'invoice',
    printHeaderFooter: true,
    printLogo: true,
    printWatermark: false,
    paperSize: 'A4',
    printOrientation: 'portrait',
    
    // Notification Settings
    smsEnabled: false,
    whatsappEnabled: true,
    emailEnabled: false,
    notifyOnNewVehicle: true,
    notifyOnStatusChange: true,
    notifyOnPayment: true,
    
    // System Settings
    language: 'ar',
    currency: 'SAR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12',
    timezone: 'Asia/Riyadh',
    
    // Security Settings
    requireLogin: false,
    sessionTimeout: 60,
    backupEnabled: true,
    backupFrequency: 'daily'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/settings`);
      setSettings({ ...settings, ...response.data });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await axios.post(`${API_URL}/settings`, settings);
      toast({
        title: "تم الحفظ",
        description: "تم حفظ الإعدادات بنجاح"
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive"
      });
    }
  };

  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `settings_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    toast({
      title: "نجح",
      description: "تم تصدير الإعدادات بنجاح"
    });
  };

  const handleImportSettings = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setSettings({ ...settings, ...imported });
        toast({
          title: "نجح",
          description: "تم استيراد الإعدادات بنجاح"
        });
      } catch (error) {
        toast({
          title: "خطأ",
          description: "فشل في استيراد الإعدادات",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات؟')) {
      fetchSettings();
      toast({
        title: "تم",
        description: "تم إعادة تعيين الإعدادات"
      });
    }
  };

  const tabs = [
    { id: 'workshop', label: 'معلومات الورشة', icon: Building2 },
    { id: 'printing', label: 'الطباعة والنماذج', icon: FileText },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'system', label: 'النظام', icon: Globe },
    { id: 'security', label: 'الأمان', icon: Shield },
  ];

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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">الإعدادات العامة</h1>
              <p className="text-slate-600">إدارة إعدادات النظام والورشة</p>
            </div>
            <div className="flex gap-2">
              <label htmlFor="import-settings">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <Upload size={18} className="ml-2" />
                    استيراد
                  </span>
                </Button>
                <input
                  id="import-settings"
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="hidden"
                />
              </label>
              <Button variant="outline" onClick={handleExportSettings}>
                <Download size={18} className="ml-2" />
                تصدير
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw size={18} className="ml-2" />
                إعادة تعيين
              </Button>
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Save size={18} className="ml-2" />
                حفظ التغييرات
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Icon size={18} />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {/* Workshop Settings */}
          {activeTab === 'workshop' && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Building2 size={24} />
                  معلومات الورشة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم الورشة *</Label>
                    <Input
                      value={settings.workshopName}
                      onChange={(e) => setSettings({...settings, workshopName: e.target.value})}
                      placeholder="ورشة إصلاح السيارات"
                    />
                  </div>
                  <div>
                    <Label>رقم الجوال *</Label>
                    <Input
                      value={settings.workshopPhone}
                      onChange={(e) => setSettings({...settings, workshopPhone: e.target.value})}
                      placeholder="0501234567"
                    />
                  </div>
                  <div>
                    <Label>رقم الواتساب</Label>
                    <Input
                      value={settings.workshopWhatsapp}
                      onChange={(e) => setSettings({...settings, workshopWhatsapp: e.target.value})}
                      placeholder="966501234567"
                    />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={settings.workshopEmail}
                      onChange={(e) => setSettings({...settings, workshopEmail: e.target.value})}
                      placeholder="info@workshop.com"
                    />
                  </div>
                  <div>
                    <Label>المدينة</Label>
                    <Input
                      value={settings.workshopCity}
                      onChange={(e) => setSettings({...settings, workshopCity: e.target.value})}
                      placeholder="الرياض"
                    />
                  </div>
                  <div>
                    <Label>الرقم الضريبي</Label>
                    <Input
                      value={settings.taxNumber}
                      onChange={(e) => setSettings({...settings, taxNumber: e.target.value})}
                      placeholder="300000000000003"
                    />
                  </div>
                </div>
                <div>
                  <Label>العنوان الكامل</Label>
                  <Textarea
                    value={settings.workshopAddress}
                    onChange={(e) => setSettings({...settings, workshopAddress: e.target.value})}
                    placeholder="شارع الملك فهد، حي النزهة"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>رابط الشعار (اختياري)</Label>
                  <Input
                    value={settings.logoUrl}
                    onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Printing Settings */}
          {activeTab === 'printing' && (
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-l from-purple-50">
                  <CardTitle className="flex items-center gap-2">
                    <FileText size={24} />
                    إعدادات الطباعة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>النموذج الافتراضي</Label>
                      <select
                        value={settings.defaultTemplate}
                        onChange={(e) => setSettings({...settings, defaultTemplate: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                      >
                        <option value="invoice">فاتورة بيع</option>
                        <option value="diagnosis">تقرير تشخيص</option>
                        <option value="quotation">عرض سعر</option>
                      </select>
                    </div>
                    <div>
                      <Label>حجم الورق</Label>
                      <select
                        value={settings.paperSize}
                        onChange={(e) => setSettings({...settings, paperSize: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                      >
                        <option value="A4">A4</option>
                        <option value="A5">A5</option>
                        <option value="Letter">Letter</option>
                      </select>
                    </div>
                    <div>
                      <Label>اتجاه الطباعة</Label>
                      <select
                        value={settings.printOrientation}
                        onChange={(e) => setSettings({...settings, printOrientation: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                      >
                        <option value="portrait">عمودي</option>
                        <option value="landscape">أفقي</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">طباعة الرأسية والتذييل</Label>
                        <p className="text-sm text-slate-500">عرض معلومات الورشة في أعلى وأسفل كل صفحة</p>
                      </div>
                      <Switch
                        checked={settings.printHeaderFooter}
                        onCheckedChange={(checked) => setSettings({...settings, printHeaderFooter: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">طباعة الشعار</Label>
                        <p className="text-sm text-slate-500">إظهار شعار الورشة في النماذج المطبوعة</p>
                      </div>
                      <Switch
                        checked={settings.printLogo}
                        onCheckedChange={(checked) => setSettings({...settings, printLogo: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">العلامة المائية</Label>
                        <p className="text-sm text-slate-500">إضافة علامة مائية خلفية للنماذج</p>
                      </div>
                      <Switch
                        checked={settings.printWatermark}
                        onCheckedChange={(checked) => setSettings({...settings, printWatermark: checked})}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-l from-blue-50">
                  <CardTitle>إدارة النماذج</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-slate-600 mb-4">يمكنك إنشاء وتعديل نماذج الطباعة من صفحة النماذج</p>
                  <Button
                    onClick={() => navigate('/templates')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText size={18} className="ml-2" />
                    إدارة النماذج
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50">
                <CardTitle className="flex items-center gap-2">
                  <Bell size={24} />
                  إعدادات الإشعارات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-800">قنوات الإشعارات</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">إشعارات SMS</Label>
                      <p className="text-sm text-slate-500">إرسال رسائل نصية للعملاء</p>
                    </div>
                    <Switch
                      checked={settings.smsEnabled}
                      onCheckedChange={(checked) => setSettings({...settings, smsEnabled: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">إشعارات واتساب</Label>
                      <p className="text-sm text-slate-500">إرسال رسائل عبر الواتساب</p>
                    </div>
                    <Switch
                      checked={settings.whatsappEnabled}
                      onCheckedChange={(checked) => setSettings({...settings, whatsappEnabled: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">إشعارات البريد الإلكتروني</Label>
                      <p className="text-sm text-slate-500">إرسال بريد إلكتروني للعملاء</p>
                    </div>
                    <Switch
                      checked={settings.emailEnabled}
                      onCheckedChange={(checked) => setSettings({...settings, emailEnabled: checked})}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-bold text-lg text-slate-800">أنواع الإشعارات</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">مركبة جديدة</Label>
                      <p className="text-sm text-slate-500">إشعار عند استقبال مركبة جديدة</p>
                    </div>
                    <Switch
                      checked={settings.notifyOnNewVehicle}
                      onCheckedChange={(checked) => setSettings({...settings, notifyOnNewVehicle: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">تغيير الحالة</Label>
                      <p className="text-sm text-slate-500">إشعار عند تغيير حالة المركبة</p>
                    </div>
                    <Switch
                      checked={settings.notifyOnStatusChange}
                      onCheckedChange={(checked) => setSettings({...settings, notifyOnStatusChange: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">الدفع</Label>
                      <p className="text-sm text-slate-500">إشعار عند إتمام عملية الدفع</p>
                    </div>
                    <Switch
                      checked={settings.notifyOnPayment}
                      onCheckedChange={(checked) => setSettings({...settings, notifyOnPayment: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-orange-50">
                <CardTitle className="flex items-center gap-2">
                  <Globe size={24} />
                  إعدادات النظام
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اللغة</Label>
                    <select
                      value={settings.language}
                      onChange={(e) => setSettings({...settings, language: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <Label>العملة</Label>
                    <select
                      value={settings.currency}
                      onChange={(e) => setSettings({...settings, currency: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="BHD">دينار بحريني (BHD)</option>
                    </select>
                  </div>
                  <div>
                    <Label>تنسيق التاريخ</Label>
                    <select
                      value={settings.dateFormat}
                      onChange={(e) => setSettings({...settings, dateFormat: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <Label>تنسيق الوقت</Label>
                    <select
                      value={settings.timeFormat}
                      onChange={(e) => setSettings({...settings, timeFormat: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="12">12 ساعة</option>
                      <option value="24">24 ساعة</option>
                    </select>
                  </div>
                  <div>
                    <Label>المنطقة الزمنية</Label>
                    <select
                      value={settings.timezone}
                      onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                      <option value="Asia/Dubai">دبي (GMT+4)</option>
                      <option value="Asia/Kuwait">الكويت (GMT+3)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-red-50">
                <CardTitle className="flex items-center gap-2">
                  <Shield size={24} />
                  إعدادات الأمان
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">تفعيل تسجيل الدخول</Label>
                    <p className="text-sm text-slate-500">يطلب من المستخدمين تسجيل الدخول</p>
                  </div>
                  <Switch
                    checked={settings.requireLogin}
                    onCheckedChange={(checked) => setSettings({...settings, requireLogin: checked})}
                  />
                </div>
                
                <div>
                  <Label>مهلة الجلسة (دقيقة)</Label>
                  <Input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})}
                    placeholder="60"
                  />
                  <p className="text-sm text-slate-500 mt-1">المدة قبل تسجيل الخروج التلقائي</p>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-bold text-lg text-slate-800">النسخ الاحتياطي</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">تفعيل النسخ الاحتياطي التلقائي</Label>
                      <p className="text-sm text-slate-500">نسخ احتياطي تلقائي لقاعدة البيانات</p>
                    </div>
                    <Switch
                      checked={settings.backupEnabled}
                      onCheckedChange={(checked) => setSettings({...settings, backupEnabled: checked})}
                    />
                  </div>
                  <div>
                    <Label>تكرار النسخ الاحتياطي</Label>
                    <select
                      value={settings.backupFrequency}
                      onChange={(e) => setSettings({...settings, backupFrequency: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    >
                      <option value="hourly">كل ساعة</option>
                      <option value="daily">يومياً</option>
                      <option value="weekly">أسبوعياً</option>
                      <option value="monthly">شهرياً</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
