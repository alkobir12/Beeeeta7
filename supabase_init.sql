-- =================================================================
-- Supabase Initialization Script
-- Run this in Supabase Dashboard → SQL Editor
-- =================================================================

-- 1. Add images column to approval_requests table
-- =================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='approval_requests' AND column_name='images'
    ) THEN
        ALTER TABLE approval_requests ADD COLUMN images jsonb DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added images column to approval_requests';
    ELSE
        RAISE NOTICE 'images column already exists in approval_requests';
    END IF;
END $$;

-- 2. Create accounts table for chart of accounts
-- =================================================================
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

-- 3. Insert default chart of accounts (45 accounts)
-- =================================================================

-- Level 1 & 2: Assets
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

-- Liabilities
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-2000', '2000', 'الخصوم', 'Liabilities', 'liability', NULL, true, 0.0),
('acc-2100', '2100', 'الخصوم المتداولة', 'Current Liabilities', 'liability', 'acc-2000', true, 0.0),
('acc-2101', '2101', 'الموردون', 'Accounts Payable', 'liability', 'acc-2100', true, 0.0),
('acc-2102', '2102', 'مصروفات مستحقة', 'Accrued Expenses', 'liability', 'acc-2100', true, 0.0),
('acc-2103', '2103', 'رواتب مستحقة', 'Accrued Salaries', 'liability', 'acc-2100', true, 0.0);

-- Equity
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-3000', '3000', 'حقوق الملكية', 'Equity', 'equity', NULL, true, 0.0),
('acc-3100', '3100', 'حقوق المالك', 'Owner''s Equity', 'equity', 'acc-3000', true, 0.0),
('acc-3101', '3101', 'رأس المال', 'Owner Capital', 'equity', 'acc-3100', true, 0.0),
('acc-3102', '3102', 'مسحوبات المالك', 'Owner Drawings', 'equity', 'acc-3100', true, 0.0),
('acc-3103', '3103', 'أرباح محتجزة', 'Retained Earnings', 'equity', 'acc-3100', true, 0.0),
('acc-3104', '3104', 'صافي الربح/الخسارة', 'Net Profit/Loss', 'equity', 'acc-3100', true, 0.0);

-- Revenue
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-4000', '4000', 'الإيرادات', 'Revenue', 'revenue', NULL, true, 0.0),
('acc-4100', '4100', 'إيرادات الخدمات', 'Service Revenue', 'revenue', 'acc-4000', true, 0.0),
('acc-4101', '4101', 'إيرادات خدمات ميكانيكية', 'Mechanical Service Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-4102', '4102', 'إيرادات إصلاح محركات', 'Engine Repair Revenue', 'revenue', 'acc-4100', true, 0.0),
('acc-4103', '4103', 'إيرادات فرامل وتعليق', 'Brake & Suspension Revenue', 'revenue', 'acc-4100', true, 0.0);

-- Cost of Services (Expenses)
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-5000', '5000', 'تكلفة الخدمات', 'Cost of Services', 'expense', NULL, true, 0.0),
('acc-5100', '5100', 'تكاليف مباشرة', 'Direct Costs', 'expense', 'acc-5000', true, 0.0),
('acc-5101', '5101', 'أجور فنيين مباشرة', 'Technicians Wages - Direct', 'expense', 'acc-5100', true, 0.0),
('acc-5102', '5102', 'قطع غيار مستخدمة', 'Spare Parts Used', 'expense', 'acc-5100', true, 0.0),
('acc-5103', '5103', 'مستهلكات مستخدمة', 'Consumables Used', 'expense', 'acc-5100', true, 0.0);

-- Operating Expenses
INSERT INTO accounts (id, code, name, name_en, type, parent_id, is_system, balance) VALUES
('acc-6000', '6000', 'المصروفات التشغيلية', 'Operating Expenses', 'expense', NULL, true, 0.0),
('acc-6100', '6100', 'مصروفات عامة وإدارية', 'General & Administrative', 'expense', 'acc-6000', true, 0.0),
('acc-6101', '6101', 'رواتب إدارية', 'Administrative Salaries', 'expense', 'acc-6100', true, 0.0),
('acc-6102', '6102', 'إيجار المركز', 'Workshop Rent', 'expense', 'acc-6100', true, 0.0),
('acc-6103', '6103', 'كهرباء ومياه', 'Electricity & Water', 'expense', 'acc-6100', true, 0.0),
('acc-6104', '6104', 'صيانة معدات', 'Equipment Maintenance', 'expense', 'acc-6100', true, 0.0),
('acc-6105', '6105', 'ملابس وسلامة مهنية', 'Uniforms & Safety', 'expense', 'acc-6100', true, 0.0);

-- =================================================================
-- Verification
-- =================================================================
SELECT 
    type,
    COUNT(*) as count
FROM accounts
GROUP BY type
ORDER BY type;

SELECT '✅ Initialization Complete! Created ' || COUNT(*) || ' accounts.' as result
FROM accounts;
