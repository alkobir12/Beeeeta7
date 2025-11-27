import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import Layout from '../components/Layout';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    workshopName: 'ورشتي',
    workshopPhone: '',
    workshopEmail: '',
    workshopAddress: '',
    currency: 'SAR',
    taxEnabled: false,
    taxRate: 15,
    language: 'ar',
    themeName: 'light'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      
      // Get language from settings or localStorage
      const savedLanguage = response.data.language || localStorage.getItem('language') || 'ar';
      
      // Sync language to localStorage for i18n
      localStorage.setItem('language', savedLanguage);
      
      // Ensure all fields have default values to prevent undefined
      setSettings({
        workshopName: response.data.workshopName || 'ورشتي',
        workshopPhone: response.data.workshopPhone || '',
        workshopEmail: response.data.workshopEmail || '',
        workshopAddress: response.data.workshopAddress || '',
        currency: response.data.currency || 'SAR',
        taxEnabled: response.data.taxEnabled || false,
        taxRate: response.data.taxRate || 15,
        language: savedLanguage,
        themeName: response.data.themeName || theme, // Use context theme if not in DB
        baseRepairTemplateActive: response.data.baseRepairTemplateActive ?? true,
        baseRepairTemplateHtml: response.data.baseRepairTemplateHtml || '',
      });
      
      // Sync context theme if DB has a value
      if (response.data.themeName && response.data.themeName !== theme) {
        setTheme(response.data.themeName);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      // Update theme in context
      setTheme(settings.themeName);
      
      await axios.post(`${API_URL}/settings`, settings);
      
      // Save language to localStorage for i18n
      localStorage.setItem('language', settings.language);
      
      // Update i18n language immediately
      if (window.i18n) {
        window.i18n.changeLanguage(settings.language);
      }
      
      // Update document direction
      document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = settings.language;
      
      // Reload settings to confirm save
      await fetchSettings();
      
      toast({ 
        title: settings.language === 'ar' ? 'تم الحفظ' : 'Saved', 
        description: settings.language === 'ar' ? 'تم حفظ الإعدادات بنجاح. سيتم إعادة تحميل الصفحة...' : 'Settings saved successfully. Page will reload...' 
      });
      
      // Reload page after 1 second to apply language/theme changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Save error:', error);
      toast({ 
        title: 'خطأ', 
        description: 'فشل في حفظ الإعدادات', 
        variant: 'destructive' 
      });
      setLoading(false);
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

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">الإعدادات العامة</h1>
              <p className="text-slate-600">إدارة إعدادات النظام والورشة</p>
            </div>
            <Button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700">
              حفظ التغييرات
            </Button>
          </div>

          <div className="space-y-6">
            {/* Workshop Settings */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50">
                <CardTitle>معلومات الورشة</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم الورشة</Label>
                    <Input
                      value={settings.workshopName}
                      onChange={(e) => setSettings({...settings, workshopName: e.target.value})}
                      placeholder="اسم الورشة"
                    />
                  </div>
                  <div>
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={settings.workshopPhone}
                      onChange={(e) => setSettings({...settings, workshopPhone: e.target.value})}
                      placeholder="رقم الهاتف"
                    />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      value={settings.workshopEmail}
                      onChange={(e) => setSettings({...settings, workshopEmail: e.target.value})}
                      placeholder="البريد الإلكتروني"
                    />
                  </div>
                  <div>
                    <Label>العنوان</Label>
                    <Input
                      value={settings.workshopAddress}
                      onChange={(e) => setSettings({...settings, workshopAddress: e.target.value})}
                      placeholder="العنوان"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Settings */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50">
                <CardTitle>إعدادات النظام</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>العملة</Label>
                    <select 
                      className="w-full border rounded p-2" 
                      value={settings.currency} 
                      onChange={(e) => setSettings({...settings, currency: e.target.value})}
                    >
                      <option value="SAR">ريال سعودي</option>
                      <option value="USD">دولار أمريكي</option>
                      <option value="EUR">يورو</option>
                    </select>
                  </div>
                  <div>
                    <Label>اللغة</Label>
                    <select 
                      className="w-full border rounded p-2" 
                      value={settings.language} 
                      onChange={(e) => setSettings({...settings, language: e.target.value})}
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">تفعيل الضريبة</Label>
                    <p className="text-sm text-slate-500">إضافة ضريبة القيمة المضافة</p>
                  </div>
                  <Switch
                    checked={settings.taxEnabled}
                    onCheckedChange={(checked) => setSettings({...settings, taxEnabled: checked})}
                  />
                </div>
                
                {settings.taxEnabled && (
                  <div>
                    <Label>نسبة الضريبة (%)</Label>
                    <Input
                      type="number"
                      value={settings.taxRate}
                      onChange={(e) => setSettings({...settings, taxRate: parseFloat(e.target.value)})}
                      placeholder="15"
                    />
                  </div>
                )}
              </CardContent>

            {/* Google Integration */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-yellow-50">
                <CardTitle>تكامل Google Drive & Sheets</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">النسخ الاحتياطي التلقائي</Label>
                      <p className="text-sm text-slate-500">نسخ قاعدة البيانات إلى Google Drive</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await axios.post(`${API_URL}/admin/backup/drive`);
                          toast({ title: 'تم', description: 'تم النسخ الاحتياطي بنجاح' });
                        } catch (e) {
                          toast({ title: 'خطأ', description: 'فشل النسخ الاحتياطي', variant: 'destructive' });
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      نسخ الآن
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">تصدير الفواتير</Label>
                      <p className="text-sm text-slate-500">تصدير الفواتير إلى Google Sheets</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await axios.post(`${API_URL}/admin/export/sheets`);
                          toast({ title: 'تم', description: 'تم التصدير بنجاح' });
                        } catch (e) {
                          toast({ title: 'خطأ', description: 'فشل التصدير', variant: 'destructive' });
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      تصدير الآن
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Base Repair Template Settings */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-purple-50">
                <CardTitle>قالب الطباعة الأساسي (فاتورة/حالة إصلاح)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">تفعيل القالب الأساسي</Label>
                    <p className="text-sm text-slate-500">عند التفعيل سيتم استخدام القالب الأساسي للفاتورة/الحالة والصفحات المطبوعة.</p>
                  </div>
                  <Switch
                    checked={!!settings.baseRepairTemplateActive}
                    onCheckedChange={(checked) => setSettings({...settings, baseRepairTemplateActive: checked})}
                  />
                </div>

                <div>
                  <Label className="text-sm">تحرير HTML للقالب</Label>
                  <Textarea
                    className="min-h-[260px] font-mono text-xs"
                    value={settings.baseRepairTemplateHtml}
                    onChange={(e)=> setSettings({...settings, baseRepairTemplateHtml: e.target.value})}
                    placeholder="<!DOCTYPE html> ..."
                  />
                  <p className="text-xs text-slate-500 mt-2">يمكنك لصق قالب HTML مخصص بالكامل هنا. إن تركته فارغًا سيتم استخدام القالب الافتراضي المدمج.</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={async ()=>{
                    try{
                      const res = await axios.post(`${API_URL}/print/resolve-template`, { override_type: 'repair' });
                      const html = res.data?.template?.content || '';
                      const w = window.open('', '_blank');
                      w.document.write(html);
                      w.document.close();
                    }catch(e){
                      console.error(e);
                    }
                  }}>معاينة القالب</Button>
                </div>
              </CardContent>
            </Card>

            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;