-- Finance Module Schema for Supabase
-- ===================================

-- 1. جدول journal_entries (القيود المحاسبية)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    lines JSONB NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_journal_entries_workshop_id ON journal_entries(workshop_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);

-- 2. جدول chart_of_accounts (دليل الحسابات)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    category TEXT,
    balance DECIMAL(12,2) DEFAULT 0,
    workshop_id TEXT NOT NULL,
    parent_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(workshop_id, code)
);

-- إنشاء indexes
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_workshop_id ON chart_of_accounts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code ON chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(type);

-- 3. إضافة بيانات أولية لدليل الحسابات (حسابات أساسية)
INSERT INTO chart_of_accounts (code, name_ar, name_en, type, workshop_id) VALUES
    -- الأصول
    ('101', 'النقدية', 'Cash', 'asset', 'default'),
    ('113', 'ذمم مدينة عملاء', 'Accounts Receivable', 'asset', 'default'),
    ('121', 'مخزون قطع الغيار', 'Parts Inventory', 'asset', 'default'),
    ('151', 'معدات', 'Equipment', 'asset', 'default'),
    ('152', 'مركبات', 'Vehicles', 'asset', 'default'),
    
    -- الالتزامات
    ('211', 'ذمم دائنة موردين', 'Accounts Payable', 'liability', 'default'),
    ('221', 'قروض قصيرة الأجل', 'Short-term Loans', 'liability', 'default'),
    ('231', 'قروض طويلة الأجل', 'Long-term Loans', 'liability', 'default'),
    
    -- حقوق الملكية
    ('301', 'رأس المال', 'Capital', 'equity', 'default'),
    ('302', 'الأرباح المحتجزة', 'Retained Earnings', 'equity', 'default'),
    
    -- الإيرادات
    ('411', 'إيرادات خدمات الصيانة', 'Service Revenue', 'revenue', 'default'),
    ('412', 'إيرادات بيع قطع الغيار', 'Parts Sales Revenue', 'revenue', 'default'),
    
    -- المصروفات
    ('514', 'مصاريف قطع الغيار', 'Parts Expenses', 'expense', 'default'),
    ('521', 'مصاريف رواتب', 'Salaries Expense', 'expense', 'default'),
    ('522', 'مصاريف إيجار', 'Rent Expense', 'expense', 'default'),
    ('523', 'مصاريف كهرباء وماء', 'Utilities Expense', 'expense', 'default'),
    ('524', 'مصاريف صيانة', 'Maintenance Expense', 'expense', 'default'),
    ('525', 'مصاريف إعلانات', 'Advertising Expense', 'expense', 'default')
ON CONFLICT (workshop_id, code) DO NOTHING;

-- 4. إنشاء RLS (Row Level Security) policies
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Policy للقراءة - يمكن للجميع القراءة
CREATE POLICY "Allow read access to all users" ON journal_entries
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to all users" ON chart_of_accounts
    FOR SELECT USING (true);

-- Policy للكتابة - يمكن للجميع الكتابة (يمكن تقييده لاحقاً)
CREATE POLICY "Allow insert access to all users" ON journal_entries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow insert access to all users" ON chart_of_accounts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to all users" ON chart_of_accounts
    FOR UPDATE USING (true);

-- 5. إنشاء function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إضافة trigger
CREATE TRIGGER update_chart_of_accounts_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. إنشاء views مفيدة
CREATE OR REPLACE VIEW journal_entries_summary AS
SELECT 
    workshop_id,
    DATE_TRUNC('month', date) as month,
    COUNT(*) as total_entries,
    SUM(total) as total_amount
FROM journal_entries
GROUP BY workshop_id, DATE_TRUNC('month', date)
ORDER BY month DESC;

-- View لملخص الحسابات حسب النوع
CREATE OR REPLACE VIEW accounts_by_type AS
SELECT 
    workshop_id,
    type,
    COUNT(*) as account_count,
    SUM(balance) as total_balance
FROM chart_of_accounts
WHERE is_active = TRUE
GROUP BY workshop_id, type
ORDER BY type;

-- التحقق من نجاح الإنشاء
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('journal_entries', 'chart_of_accounts');
