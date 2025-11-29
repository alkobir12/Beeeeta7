import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { Building2, Globe, Palette, Database, Save, ChevronRight } from 'lucide-react';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const Settings = () => {
  const { toast } = useToast();
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

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setSettings({
        ...response.data,
        language: response.data.language || 'ar',
        themeName: response.data.themeName || 'light'
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      setTheme(settings.themeName);
      await axios.post(`${API_URL}/settings`, settings);
      localStorage.setItem('language', settings.language);
      
      toast({ title: 'تم الحفظ', description: 'تم حفظ الإعدادات بنجاح' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ الإعدادات', variant: 'destructive' });
      setLoading(false);
    }
  };

  const Section = ({ title, icon: Icon, children }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon size={18} className="text-gray-500" />
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 shadow-sm">
        {children}
      </div>
    </div>
  );

  const Row = ({ label, children }) => (
    <div className="flex items-center justify-between p-4 min-h-[3.5rem]">
      <span className="text-gray-900 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8 pt-4">
          <h1 className="text-3xl font-bold text-gray-900">الإعدادات</h1>
          <button 
            onClick={saveSettings}
            disabled={loading}
            className="apple-button flex items-center gap-2"
          >
            <Save size={18} />
            <span>{loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
          </button>
        </div>

        <Section title="معلومات الورشة" icon={Building2}>
          <Row label="اسم الورشة">
            <input 
              className="text-left bg-transparent outline-none text-gray-600 placeholder:text-gray-300 w-64"
              value={settings.workshopName}
              onChange={e => setSettings({...settings, workshopName: e.target.value})}
              placeholder="أدخل الاسم"
            />
          </Row>
          <Row label="رقم الهاتف">
            <input 
              className="text-left bg-transparent outline-none text-gray-600 placeholder:text-gray-300 w-64"
              value={settings.workshopPhone}
              onChange={e => setSettings({...settings, workshopPhone: e.target.value})}
              placeholder="05xxxxxxxx"
            />
          </Row>
          <Row label="العنوان">
            <input 
              className="text-left bg-transparent outline-none text-gray-600 placeholder:text-gray-300 w-64"
              value={settings.workshopAddress}
              onChange={e => setSettings({...settings, workshopAddress: e.target.value})}
              placeholder="المدينة، الحي"
            />
          </Row>
        </Section>

        <Section title="النظام والمظهر" icon={Globe}>
          <Row label="اللغة">
            <select 
              className="bg-transparent outline-none text-gray-600"
              value={settings.language}
              onChange={e => setSettings({...settings, language: e.target.value})}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
            <ChevronRight size={16} className="text-gray-300" />
          </Row>
          <Row label="المظهر">
            <select 
              className="bg-transparent outline-none text-gray-600"
              value={settings.themeName}
              onChange={e => setSettings({...settings, themeName: e.target.value})}
            >
              <option value="light">فاتح</option>
              <option value="dark">داكن</option>
            </select>
            <ChevronRight size={16} className="text-gray-300" />
          </Row>
          <Row label="العملة">
            <select 
              className="bg-transparent outline-none text-gray-600"
              value={settings.currency}
              onChange={e => setSettings({...settings, currency: e.target.value})}
            >
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </select>
            <ChevronRight size={16} className="text-gray-300" />
          </Row>
        </Section>

        <Section title="الضرائب والرسوم" icon={Palette}>
          <Row label="تفعيل الضريبة">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={settings.taxEnabled}
                onChange={e => setSettings({...settings, taxEnabled: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </Row>
          {settings.taxEnabled && (
            <Row label="نسبة الضريبة (%)">
              <input 
                type="number"
                className="text-left bg-transparent outline-none text-gray-600 w-20"
                value={settings.taxRate}
                onChange={e => setSettings({...settings, taxRate: parseFloat(e.target.value)})}
              />
            </Row>
          )}
        </Section>

        <Section title="النسخ الاحتياطي" icon={Database}>
          <Row label="Google Drive">
            <button 
              onClick={async () => {
                try {
                  await axios.post(`${API_URL}/admin/backup/drive`);
                  toast({ title: 'تم', description: 'تم النسخ الاحتياطي بنجاح' });
                } catch (e) {
                  toast({ title: 'خطأ', description: 'فشل النسخ الاحتياطي', variant: 'destructive' });
                }
              }}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              نسخ الآن
            </button>
          </Row>
        </Section>
      </div>
    </Layout>
  );
};

export default Settings;
