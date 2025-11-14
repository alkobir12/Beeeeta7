-- Supabase Schema for Workshop Management System
-- Phase 1: Core tables, indexes, RLS enablement

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =================== Core Entities ===================

-- Customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  address text,
  vehicle_brand text,
  vehicle_plate text,
  vehicle_km int,
  total_visits int default 0,
  last_visit timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_customers_phone on customers (phone);
create index if not exists idx_customers_last_visit on customers (last_visit desc);

-- Technicians
create table if not exists technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  specialty text,
  active_jobs int default 0,
  completed_jobs int default 0,
  rating numeric(3,2) default 5.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Services
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  price numeric(12,2) default 0,
  duration_minutes int default 0,
  vat_percent numeric(5,2) default 0,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_services_name on services using gin (to_tsvector('simple', coalesce(name,'')));
create index if not exists idx_services_category on services (category);

-- Parts
create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  part_number text not null,
  name text not null,
  category text,
  purchase_price numeric(12,2) not null,
  selling_price numeric(12,2) not null,
  quantity int not null,
  min_quantity int default 5,
  supplier text,
  image text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(part_number)
);
create index if not exists idx_parts_name on parts using gin (to_tsvector('simple', coalesce(name,'')));
create index if not exists idx_parts_low_stock on parts (quantity, min_quantity);

-- Business Accounts (Branches)
create table if not exists business_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  currency text default 'SAR',
  active boolean default true,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_biz_accounts_active on business_accounts (active, archived);
create index if not exists idx_biz_accounts_created on business_accounts (created_at desc);

-- Vehicles
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  brand text not null,
  model text not null,
  year int,
  color text,
  vin text,
  file_number text,
  customer_id uuid references customers(id) on delete set null,
  status text default 'diagnosis', -- diagnosis, quotation, repair, ready, delivered
  entry_date timestamptz default now(),
  estimated_completion timestamptz,
  completion_date timestamptz,
  tracking_link text,
  images jsonb default '[]'::jsonb,
  services jsonb default '[]'::jsonb,
  parts jsonb default '[]'::jsonb,
  technician_id uuid references technicians(id) on delete set null,
  technician_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_vehicles_plate on vehicles (plate_number);
create index if not exists idx_vehicles_status on vehicles (status);
create index if not exists idx_vehicles_entry on vehicles (entry_date desc);

-- Operations (purchase/sale etc.)
create table if not exists operations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references business_accounts(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  type text not null, -- purchase, sale, service, etc.
  partner_type text,
  partner_name text,
  items jsonb default '[]'::jsonb,
  subtotal numeric(14,2) default 0,
  total numeric(14,2) default 0,
  payment_method text default 'cash',
  notes text,
  op_date timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_operations_type_date on operations (type, op_date desc);
create index if not exists idx_operations_account on operations (account_id);
create index if not exists idx_operations_vehicle on operations (vehicle_id);

-- Transactions (income/expense)
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references business_accounts(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  type text not null, -- income / expense
  category text,
  amount numeric(14,2) not null,
  description text,
  date timestamptz default now(),
  reference text,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists idx_transactions_date on transactions (date desc);
create index if not exists idx_transactions_type on transactions (type);
create index if not exists idx_transactions_account on transactions (account_id);

-- Budgets
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references business_accounts(id) on delete cascade,
  period text not null, -- YYYY-MM
  income_target numeric(14,2) default 0,
  expense_target numeric(14,2) default 0,
  notes text,
  created_at timestamptz default now(),
  unique(account_id, period)
);
create index if not exists idx_budgets_period on budgets (period desc);

-- Approval Requests
create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  vehicle_id uuid references vehicles(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  title text default 'طلب اعتماد',
  amount numeric(14,2) default 0,
  service_items jsonb default '[]'::jsonb,
  service_items_text text,
  status text default 'pending',
  created_at timestamptz default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  responder_name text,
  responder_phone text,
  revoked boolean default false
);
create index if not exists idx_approvals_token on approval_requests (token);
create index if not exists idx_approvals_vehicle on approval_requests (vehicle_id);

-- i18n Resources
create table if not exists i18n (
  lang text primary key,
  resources jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Print Templates (simple HTML)
create table if not exists print_templates (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  content text not null,
  is_active boolean default false,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_print_templates_type on print_templates (type);
create index if not exists idx_print_templates_active on print_templates (is_active);

-- Invoice Templates (A4 Designer + XLSX mapping)
create table if not exists invoice_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format text default 'xlsx',
  storage_path text, -- path in storage bucket instead of GridFS
  fields jsonb default '[]'::jsonb,
  preview jsonb default '[]'::jsonb,
  mapping jsonb default '{}'::jsonb,
  items_config jsonb default '{}'::jsonb,
  elements jsonb default '[]'::jsonb,
  schema jsonb default '[]'::jsonb,
  page jsonb default '{"size":"A4","orientation":"portrait"}'::jsonb,
  sample_data jsonb default '{}'::jsonb,
  is_default boolean default false,
  archived boolean default false,
  source_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_invoice_templates_default on invoice_templates (is_default);
create index if not exists idx_invoice_templates_archived on invoice_templates (archived);

-- =================== RLS Enable ===================

alter table customers enable row level security;
alter table technicians enable row level security;
alter table services enable row level security;
alter table parts enable row level security;
alter table business_accounts enable row level security;
alter table vehicles enable row level security;
alter table operations enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table approval_requests enable row level security;
alter table i18n enable row level security;
alter table print_templates enable row level security;
alter table invoice_templates enable row level security;

-- =================== Storage Buckets ===================
-- Create private bucket for templates (XLSX/HTML)
insert into storage.buckets (id, name, public)
values ('templates', 'templates', false)
on conflict (id) do nothing;
