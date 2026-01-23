-- Create invoices table in Supabase
-- This table stores automatic invoices linked to vehicles

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    plate_number TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) DEFAULT 0,
    tax NUMERIC(10, 2) DEFAULT 0,
    total NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on vehicle_id for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_vehicle_id ON public.invoices(vehicle_id);

-- Create index on customer_id for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on invoices" ON public.invoices
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE public.invoices IS 'Automatic invoices linked to vehicles and their service items';

-- Add comments to columns
COMMENT ON COLUMN public.invoices.id IS 'Unique invoice identifier';
COMMENT ON COLUMN public.invoices.vehicle_id IS 'Reference to vehicle';
COMMENT ON COLUMN public.invoices.customer_id IS 'Reference to customer';
COMMENT ON COLUMN public.invoices.customer_name IS 'Customer name (denormalized for quick access)';
COMMENT ON COLUMN public.invoices.plate_number IS 'Vehicle plate number (denormalized)';
COMMENT ON COLUMN public.invoices.items IS 'Array of invoice items (services/parts) in JSON format';
COMMENT ON COLUMN public.invoices.subtotal IS 'Subtotal before tax';
COMMENT ON COLUMN public.invoices.tax IS 'Tax amount';
COMMENT ON COLUMN public.invoices.total IS 'Total amount including tax';
COMMENT ON COLUMN public.invoices.status IS 'Invoice status: pending, paid, cancelled';
COMMENT ON COLUMN public.invoices.date IS 'Invoice date';
COMMENT ON COLUMN public.invoices.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.invoices.updated_at IS 'Record last update timestamp';
