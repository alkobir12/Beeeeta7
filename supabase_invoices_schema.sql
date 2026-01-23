-- Invoices Table Schema for Supabase
-- =====================================

-- 1. إنشاء جدول الفواتير
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    plate_number TEXT,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_invoices_vehicle_id ON invoices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);

-- 3. إنشاء RLS (Row Level Security)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy للقراءة
CREATE POLICY "Allow read access to invoices" ON invoices
    FOR SELECT USING (true);

-- Policy للكتابة
CREATE POLICY "Allow insert access to invoices" ON invoices
    FOR INSERT WITH CHECK (true);

-- Policy للتحديث
CREATE POLICY "Allow update access to invoices" ON invoices
    FOR UPDATE USING (true);

-- Policy للحذف
CREATE POLICY "Allow delete access to invoices" ON invoices
    FOR DELETE USING (true);

-- 4. Function لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Trigger لتحديث updated_at
CREATE TRIGGER update_invoices_updated_at_trigger
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoices_updated_at();

-- 6. View لإحصائيات الفواتير
CREATE OR REPLACE VIEW invoices_stats AS
SELECT 
    status,
    COUNT(*) as count,
    SUM(total) as total_amount,
    AVG(total) as avg_amount
FROM invoices
GROUP BY status;

-- التحقق من النجاح
SELECT 'Invoices table created successfully!' as status;
