import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Play, Database } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';
import { resolveBackendBase } from '../utils/backendBase';

const API_URL = `${resolveBackendBase()}/api`;

const DatabaseSetup = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null);

  const sqlScript = `-- ====================================================================
-- SUPABASE SETUP - لوحة المدير التنفيذي
-- ====================================================================

-- إضافة عمود images
ALTER TABLE approval_requests 
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

-- إنشاء جدول accounts
CREATE TABLE IF NOT EXISTS accounts (
  id text primary key,
  code text not null unique,
  name text not null,
  name_en text,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id text references accounts(id) on delete restrict,
  is_system boolean default false,
  balance numeric(14,2) default 0,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- إدراج الحسابات الافتراضية (45 حساب)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-1000', '1000', 'الأصول', 'Assets', 'asset', NULL, true, 0.0),
('acc-1100', '1100', 'الأصول المتداولة', 'Current Assets', 'asset', 'acc-1000', true, 0.0),
('acc-1101', '1101', 'النقد', 'Cash', 'asset', 'acc-1100', true, 0.0),
('acc-1102', '1102', 'البنك', 'Bank', 'asset', 'acc-1100', true, 0.0),
('acc-1103', '1103', 'العملاء', 'Accounts Receivable', 'asset', 'acc-1100', true, 0.0),
('acc-1105', '1105', 'مخزون قطع غيار', 'Spare Parts Inventory', 'asset', 'acc-1100', true, 0.0),
('acc-1106', '1106', 'مخزون مستهلكات', 'Consumables Inventory', 'asset', 'acc-1100', true, 0.0),
('acc-1200', '1200', 'الأصول الثابتة', 'Fixed Assets', 'asset', 'acc-1000', true, 0.0),
('acc-1201', '1201', 'معدات ميكانيكية', 'Mechanical Equipment', 'asset', 'acc-1200', true, 0.0),
('acc-1202', '1202', 'رافعات سيارات', 'Car Lifts', 'asset', 'acc-1200', true, 0.0),
('acc-1203', '1203', 'أجهزة فحص', 'Diagnostic Tools', 'asset', 'acc-1200', true, 0.0),
('acc-1207', '1207', 'مجمع الإهلاك', 'Accumulated Depreciation', 'asset', 'acc-1200', true, 0.0),
('acc-2000', '2000', 'الخصوم', 'Liabilities', 'liability', NULL, true, 0.0),
('acc-2100', '2100', 'الخصوم المتداولة', 'Current Liabilities', 'liability', 'acc-2000', true, 0.0),
('acc-2101', '2101', 'الموردون', 'Accounts Payable', 'liability', 'acc-2100', true, 0.0),
('acc-2102', '2102', 'مصروفات مستحقة', 'Accrued Expenses', 'liability', 'acc-2100', true, 0.0),
('acc-2103', '2103', 'رواتب مستحقة', 'Accrued Salaries', 'liability', 'acc-2100', true, 0.0),
('acc-3000', '3000', 'حقوق الملكية', 'Equity', 'equity', NULL, true, 0.0),
('acc-3100', '3100', 'حقوق المالك', 'Owner''s Equity', 'equity', 'acc-3000', true, 0.0),
('acc-3101', '3101', 'رأس المال', 'Owner Capital', 'equity', 'acc-3100', true, 0.0),
('acc-3102', '3102', 'مسحوبات المالك', 'Owner Drawings', 'equity', 'acc-3100', true, 0.0),
('acc-3103', '3103', 'أرباح محتجزة', 'Retained Earnings', 'equity', 'acc-3100', true, 0.0),
('acc-3104', '3104', 'صافي الربح/الخسارة', 'Net Profit/Loss', 'equity', 'acc-3100', true, 0.0),
('acc-4000', '4000', 'الإيرادات', 'Revenue', 'revenue', NULL, true, 0.0),
('acc-4100', '4100', 'إيرادات الخدمات', 'Service Revenue', 'revenue', 'acc-4000', true, 0.0),
('acc-4101', '4101', 'إيرادات خدمات ميكانيكية', 'Mechanical Service Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-4102', '4102', 'إيرادات إصلاح محركات', 'Engine Repair Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-4103', '4103', 'إيرادات فرامل وتعليق', 'Brake & Suspension Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-5000', '5000', 'تكلفة الخدمات', 'Cost of Services', 'expense', NULL, true, 0.0),
('acc-5100', '5100', 'تكاليف مباشرة', 'Direct Costs', 'expense', 'acc-5000', true, 0.0),
('acc-5101', '5101', 'أجور فنيين مباشرة', 'Technicians Wages - Direct', 'expense', 'acc-5100', true, 0.0),
('acc-5102', '5102', 'قطع غيار مستخدمة', 'Spare Parts Used', 'expense', 'acc-5100', true, 0.0),
('acc-5103', '5103', 'مستهلكات مستخدمة', 'Consumables Used', 'expense', 'acc-5100', true, 0.0),
('acc-6000', '6000', 'المصروفات التشغيلية', 'Operating Expenses', 'expense', NULL, true, 0.0),
('acc-6100', '6100', 'مصروفات عامة وإدارية', 'General & Administrative', 'expense', 'acc-6000', true, 0.0),
('acc-6101', '6101', 'رواتب إدارية', 'Administrative Salaries', 'expense', 'acc-6100', true, 0.0),
('acc-6102', '6102', 'إيجار المركز', 'Workshop Rent', 'expense', 'acc-6100', true, 0.0),
('acc-6103', '6103', 'كهرباء ومياه', 'Electricity & Water', 'expense', 'acc-6100', true, 0.0),
('acc-6104', '6104', 'صيانة معدات', 'Equipment Maintenance', 'expense', 'acc-6100', true, 0.0),
('acc-6105', '6105', 'ملابس وسلامة مهنية', 'Uniforms & Safety', 'expense', 'acc-6100', true, 0.0);

-- تحقق من النتيجة
SELECT '✅ تم إنشاء ' || COUNT(*) || ' حساب بنجاح!' FROM accounts;`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopied(true);
      toast({ title: 'تم النسخ!', description: 'تم نسخ SQL إلى الحافظة' });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({ title: 'خطأ', description: 'فشل النسخ', variant: 'destructive' });
    }
  };

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await axios.post(`${API_URL}/admin/init-database`);
      setStatus(res.data);
      
      if (res.data.errors && res.data.errors.length > 0) {
        toast({ 
          title: 'تحتاج إلى إعداد', 
          description: 'يرجى تشغيل SQL في Supabase Dashboard',
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'تم!', description: 'قاعدة البيانات جاهزة' });
      }
    } catch (err) {
      toast({ title: 'خطأ', description: 'فشل التحقق', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" dir="rtl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🚀 إعداد قاعدة البيانات</h1>
        <p className="text-gray-500">قم بتشغيل SQL لتفعيل شجرة الحسابات ونظام الاعتماد المحسّن</p>
      </div>

      {/* Status Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} />
            حالة قاعدة البيانات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={checkStatus} disabled={checking} className="w-full">
            {checking ? 'جاري الفحص...' : 'فحص الحالة'}
          </Button>

          {status && (
            <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className={status.images_column ? 'text-green-600' : 'text-red-600'}>
                  {status.images_column ? '✅' : '❌'}
                </span>
                <span>عمود الصور (images) في جدول الاعتماد</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={status.accounts_table ? 'text-green-600' : 'text-red-600'}>
                  {status.accounts_table ? '✅' : '❌'}
                </span>
                <span>جدول الحسابات (accounts)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={status.default_accounts ? 'text-green-600' : 'text-red-600'}>
                  {status.default_accounts ? '✅' : '❌'}
                </span>
                <span>الحسابات الافتراضية (45 حساب)</span>
              </div>

              {status.errors && status.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <p className="font-bold">يجب تشغيل SQL يدوياً:</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {status.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>خطوات الإعداد (3 دقائق)</CardTitle>
          <CardDescription>اتبع هذه الخطوات لتفعيل جميع الميزات</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-bold mb-1">افتح Supabase Dashboard</h3>
                <a 
                  href="https://supabase.com/dashboard/project/kqjlyozhvwswooztccag/sql/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                >
                  اذهب إلى SQL Editor
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-bold mb-2">انسخ SQL</h3>
                <Button 
                  onClick={copyToClipboard}
                  variant="outline"
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="ml-2 text-green-600" />
                      تم النسخ!
                    </>
                  ) : (
                    <>
                      <Copy size={16} className="ml-2" />
                      نسخ SQL إلى الحافظة
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-bold mb-1">الصق وشغّل</h3>
                <p className="text-sm text-gray-600">
                  الصق الكود في SQL Editor واضغط زر <span className="font-bold text-green-600">Run</span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                ✓
              </div>
              <div className="flex-1">
                <h3 className="font-bold mb-1">تم! ارجع للتطبيق</h3>
                <p className="text-sm text-gray-600">
                  بعد التشغيل، ارجع إلى <a href="/business-accounts" className="text-blue-600 hover:underline">لوحة المدير التنفيذي</a>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SQL Preview */}
      <Card>
        <CardHeader>
          <CardTitle>معاينة SQL</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
            {sqlScript}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSetup;