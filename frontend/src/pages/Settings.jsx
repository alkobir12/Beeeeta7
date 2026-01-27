import React, { useState, useEffect } from 'react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import { useTheme, themes } from '../contexts/ThemeContext';
import { 
  Building2, 
  Globe, 
  Palette, 
  Database, 
  Save, 
  ChevronLeft,
  Sun,
  Moon,
  Monitor,
  Check,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useStitch from '../hooks/useStitch';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const Settings = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { toast } = useToast();
  const { themeName, changeTheme, isDark } = useTheme();
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
    themeName: 'dark'
  });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      setSettings({
        ...response.data,
        language: response.data.language || 'ar',
        themeName: response.data.themeName || themeName
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setSettings({...settings, themeName: newTheme});
    changeTheme(newTheme);
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/settings`, settings);
      localStorage.setItem('language', settings.language);
      localStorage.setItem('theme', settings.themeName);
      
      toast({ title: t('common.success'), description: t('messages.success_saved') });
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ title, icon: Icon, children }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon size={18} className="theme-text-secondary" style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</h2>
      </div>
      <div className="rounded-xl border overflow-hidden divide-y shadow-sm" 
           style={{ 
             backgroundColor: 'var(--bg-surface)', 
             borderColor: 'var(--border-color)',
             divideColor: 'var(--border-light)'
           }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ label, children }) => (
    <div className="flex items-center justify-between p-4 min-h-[3.5rem]"
         style={{ borderColor: 'var(--border-light)' }}>
      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  );

  // Theme preview cards
  const ThemeCard = ({ themeKey, theme }) => {
    const isSelected = settings.themeName === themeKey;
    const isDarkTheme = theme.mode === 'dark';
    
    return (
      <button
        onClick={() => handleThemeChange(themeKey)}
        className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${
          isSelected 
            ? 'border-blue-500 ring-2 ring-blue-500/20' 
            : 'border-transparent hover:border-gray-300'
        }`}
        style={{ 
          backgroundColor: isDarkTheme ? '#1e293b' : '#ffffff',
          minWidth: '120px'
        }}
      >
        {/* Theme preview */}
        <div 
          className="w-full h-20 rounded-lg mb-3 overflow-hidden flex"
          style={{ 
            backgroundColor: theme.background,
            border: `1px solid ${theme.border}`
          }}
        >
          {/* Sidebar preview */}
          <div 
            className="w-1/4 h-full"
            style={{ backgroundColor: theme.sidebarBg }}
          >
            <div 
              className="w-3/4 h-2 mx-auto mt-3 rounded"
              style={{ backgroundColor: theme.sidebarActive }}
            />
            <div 
              className="w-1/2 h-1.5 mx-auto mt-2 rounded opacity-50"
              style={{ backgroundColor: theme.sidebarText }}
            />
            <div 
              className="w-1/2 h-1.5 mx-auto mt-1 rounded opacity-50"
              style={{ backgroundColor: theme.sidebarText }}
            />
          </div>
          {/* Content preview */}
          <div className="flex-1 p-2">
            <div 
              className="w-full h-4 rounded"
              style={{ backgroundColor: theme.card }}
            />
            <div className="flex gap-1 mt-1">
              <div 
                className="flex-1 h-6 rounded"
                style={{ backgroundColor: theme.card }}
              />
              <div 
                className="flex-1 h-6 rounded"
                style={{ backgroundColor: theme.card }}
              />
            </div>
          </div>
        </div>
        
        {/* Theme icon */}
        <div className={`p-2 rounded-full mb-2 ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-100'}`}>
          {themeKey === 'dark' && <Moon size={18} className="text-blue-400" />}
          {themeKey === 'light' && <Sun size={18} className="text-amber-500" />}
          {themeKey === 'dashPro' && <Monitor size={18} className="text-indigo-500" />}
        </div>
        
        {/* Theme name */}
        <span className={`text-sm font-medium ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
          {theme.name}
        </span>
        
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <Check size={12} className="text-white" />
          </div>
        )}
      </button>
    );
  };

  return (
    <div 
      className={`max-w-3xl mx-auto pb-20 ${isRTL ? 'rtl' : 'ltr'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ minHeight: '100vh' }}
    >
      <div className="flex items-center justify-between mb-8 pt-4">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('settings.title')}
        </h1>
        <button 
          onClick={saveSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all"
          style={{ 
            backgroundColor: 'var(--accent-primary)', 
            color: '#ffffff'
          }}
        >
          <Save size={18} />
          <span>{loading ? t('settings.saving') : t('settings.save_changes')}</span>
        </button>
      </div>

      {/* Theme Selection Section */}
      <Section title="المظهر والثيم" icon={Palette}>
        <div className="p-4">
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            اختر الثيم المناسب للواجهة
          </p>
          <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
            {Object.entries(themes).map(([key, theme]) => (
              <ThemeCard key={key} themeKey={key} theme={theme} />
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('settings.workshop_info')} icon={Building2}>
        <Row label={t('settings.workshop_name')}>
          <input 
            className="text-left bg-transparent outline-none w-64"
            style={{ color: 'var(--text-secondary)' }}
            value={settings.workshopName}
            onChange={e => setSettings({...settings, workshopName: e.target.value})}
            placeholder={t('settings.workshop_name')}
          />
        </Row>
        <Row label={t('settings.workshop_phone')}>
          <input 
            className="text-left bg-transparent outline-none w-64"
            style={{ color: 'var(--text-secondary)' }}
            value={settings.workshopPhone}
            onChange={e => setSettings({...settings, workshopPhone: e.target.value})}
            placeholder="05xxxxxxxx"
          />
        </Row>
        <Row label={t('settings.workshop_address')}>
          <input 
            className="text-left bg-transparent outline-none w-64"
            style={{ color: 'var(--text-secondary)' }}
            value={settings.workshopAddress}
            onChange={e => setSettings({...settings, workshopAddress: e.target.value})}
            placeholder={t('settings.workshop_address')}
          />
        </Row>
      </Section>

      <Section title={t('settings.system_appearance')} icon={Globe}>
        <Row label={t('settings.language')}>
          <select 
            className="bg-transparent outline-none"
            style={{ color: 'var(--text-secondary)' }}
            value={settings.language}
            onChange={e => setSettings({...settings, language: e.target.value})}
          >
            <option value="ar">{t('settings.arabic')}</option>
            <option value="en">{t('settings.english')}</option>
          </select>
          <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
        </Row>
        <Row label={t('settings.currency')}>
          <select 
            className="bg-transparent outline-none"
            style={{ color: 'var(--text-secondary)' }}
            value={settings.currency}
            onChange={e => setSettings({...settings, currency: e.target.value})}
          >
            <option value="SAR">ريال سعودي (SAR)</option>
            <option value="USD">دولار أمريكي (USD)</option>
          </select>
          <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
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
              className="text-left bg-transparent outline-none w-20"
              style={{ color: 'var(--text-secondary)' }}
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
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--accent-primary)' }}
          >
            نسخ الآن
          </button>
        </Row>
      </Section>
    </div>
  );
};

export default Settings;
