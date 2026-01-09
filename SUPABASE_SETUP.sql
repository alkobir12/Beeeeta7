-- ====================================================================
-- SUPABASE INITIALIZATION - CEO DASHBOARD & CHART OF ACCOUNTS
-- ====================================================================
-- Copy this entire script and run it in Supabase Dashboard → SQL Editor
-- ====================================================================

-- STEP 1: Add images column to approval_requests
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='approval_requests' AND column_name='images'
    ) THEN
        ALTER TABLE approval_requests ADD COLUMN images jsonb DEFAULT '[]'::jsonb;
        RAISE NOTICE '✅ Added images column to approval_requests';
    ELSE
        RAISE NOTICE '✅ images column already exists';
    END IF;
END $$;

-- STEP 2: Create accounts table
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS accounts CASCADE;

CREATE TABLE accounts (
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

CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_type ON accounts(type);

RAISE NOTICE '✅ Created accounts table';

-- إنشاء جدول الزيارات
CREATE TABLE IF NOT EXISTS vehicle_visits (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  entry_date timestamptz default now(),
  exit_date timestamptz,
  status text default 'in_progress',
  mileage integer,
  notes text,
  technician_id uuid references technicians(id) on delete set null,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_visits_vehicle ON vehicle_visits(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON vehicle_visits(entry_date);

-- إضافة visit_id لجدول العمليات
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='operations' AND column_name='visit_id'
    ) THEN
        ALTER TABLE operations ADD COLUMN visit_id uuid references vehicle_visits(id) on delete set null;
        CREATE INDEX idx_operations_visit ON operations(visit_id);
    END IF;
END $$;

-- STEP 3: Insert default chart of accounts (45 accounts)
-- --------------------------------------------------------------------

-- 1000 - Assets (الأصول)
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
('acc-1207', '1207', 'مجمع الإهلاك', 'Accumulated Depreciation', 'asset', 'acc-1200', true, 0.0);

-- 2000 - Liabilities (الخصوم)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-2000', '2000', 'الخصوم', 'Liabilities', 'liability', NULL, true, 0.0),
('acc-2100', '2100', 'الخصوم المتداولة', 'Current Liabilities', 'liability', 'acc-2000', true, 0.0),
('acc-2101', '2101', 'الموردون', 'Accounts Payable', 'liability', 'acc-2100', true, 0.0),
('acc-2102', '2102', 'مصروفات مستحقة', 'Accrued Expenses', 'liability', 'acc-2100', true, 0.0),
('acc-2103', '2103', 'رواتب مستحقة', 'Accrued Salaries', 'liability', 'acc-2100', true, 0.0);

-- 3000 - Equity (حقوق الملكية)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-3000', '3000', 'حقوق الملكية', 'Equity', 'equity', NULL, true, 0.0),
('acc-3100', '3100', 'حقوق المالك', 'Owner''s Equity', 'equity', 'acc-3000', true, 0.0),
('acc-3101', '3101', 'رأس المال', 'Owner Capital', 'equity', 'acc-3100', true, 0.0),
('acc-3102', '3102', 'مسحوبات المالك', 'Owner Drawings', 'equity', 'acc-3100', true, 0.0),
('acc-3103', '3103', 'أرباح محتجزة', 'Retained Earnings', 'equity', 'acc-3100', true, 0.0),
('acc-3104', '3104', 'صافي الربح/الخسارة', 'Net Profit/Loss', 'equity', 'acc-3100', true, 0.0);

-- 4000 - Revenue (الإيرادات)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-4000', '4000', 'الإيرادات', 'Revenue', 'revenue', NULL, true, 0.0),
('acc-4100', '4100', 'إيرادات الخدمات', 'Service Revenue', 'revenue', 'acc-4000', true, 0.0),
('acc-4101', '4101', 'إيرادات خدمات ميكانيكية', 'Mechanical Service Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-4102', '4102', 'إيرادات إصلاح محركات', 'Engine Repair Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-4103', '4103', 'إيرادات فرامل وتعليق', 'Brake & Suspension Revenue', 'revenue', 'acc-4100', true, 0.0);

-- 5000 - Cost of Services (تكلفة الخدمات)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-5000', '5000', 'تكلفة الخدمات', 'Cost of Services', 'expense', NULL, true, 0.0),
('acc-5100', '5100', 'تكاليف مباشرة', 'Direct Costs', 'expense', 'acc-5000', true, 0.0),
('acc-5101', '5101', 'أجور فنيين مباشرة', 'Technicians Wages - Direct', 'expense', 'acc-5100', true, 0.0),
('acc-5102', '5102', 'قطع غيار مستخدمة', 'Spare Parts Used', 'expense', 'acc-5100', true, 0.0),
('acc-5103', '5103', 'مستهلكات مستخدمة', 'Consumables Used', 'expense', 'acc-5100', true, 0.0);

-- 6000 - Operating Expenses (المصروفات التشغيلية)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-6000', '6000', 'المصروفات التشغيلية', 'Operating Expenses', 'expense', NULL, true, 0.0),
('acc-6100', '6100', 'مصروفات عامة وإدارية', 'General & Administrative', 'expense', 'acc-6000', true, 0.0),
('acc-6101', '6101', 'رواتب إدارية', 'Administrative Salaries', 'expense', 'acc-6100', true, 0.0),
('acc-6102', '6102', 'إيجار المركز', 'Workshop Rent', 'expense', 'acc-6100', true, 0.0),
('acc-6103', '6103', 'كهرباء ومياه', 'Electricity & Water', 'expense', 'acc-6100', true, 0.0),
('acc-6104', '6104', 'صيانة معدات', 'Equipment Maintenance', 'expense', 'acc-6100', true, 0.0),
('acc-6105', '6105', 'ملابس وسلامة مهنية', 'Uniforms & Safety', 'expense', 'acc-6100', true, 0.0);

-- STEP 4: Verification
-- --------------------------------------------------------------------
SELECT 
    type as "نوع الحساب",
    COUNT(*) as "العدد"
FROM accounts
GROUP BY type
ORDER BY type;

SELECT '✅ تم إنشاء ' || COUNT(*) || ' حساب بنجاح!' as "النتيجة"
FROM accounts;

-- ====================================================================
-- END OF SCRIPT
-- ====================================================================
-- After running this script:
-- 1. Visit /business-accounts in your app
-- 2. All accounts will be loaded automatically
-- 3. You can add custom accounts, branches, and view analytics
-- ====================================================================
