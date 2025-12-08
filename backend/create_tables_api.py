#!/usr/bin/env python3
"""
Create tables via Supabase Management API
"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# Extract project ref from URL
project_ref = SUPABASE_URL.replace('https://', '').split('.')[0]

print(f"🔧 Project Ref: {project_ref}")
print(f"📡 Supabase URL: {SUPABASE_URL}")

# SQL Commands split into manageable chunks
sql_commands = [
    # Extensions
    """
    create extension if not exists "uuid-ossp";
    create extension if not exists pgcrypto;
    """,
    
    # Customers table
    """
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
    """,
    
    # Technicians table
    """
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
    """,
    
    # Services table
    """
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
    """,
    
    # Business Accounts table
    """
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
    """,
    
    # Vehicles table
    """
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
      status text default 'diagnosis',
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
    """,
    
    # Operations table
    """
    create table if not exists operations (
      id uuid primary key default gen_random_uuid(),
      account_id uuid references business_accounts(id) on delete set null,
      vehicle_id uuid references vehicles(id) on delete set null,
      type text not null,
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
    """,
    
    # Transactions table
    """
    create table if not exists transactions (
      id uuid primary key default gen_random_uuid(),
      account_id uuid references business_accounts(id) on delete set null,
      vehicle_id uuid references vehicles(id) on delete set null,
      type text not null,
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
    """,
    
    # Budgets table
    """
    create table if not exists budgets (
      id uuid primary key default gen_random_uuid(),
      account_id uuid references business_accounts(id) on delete cascade,
      period text not null,
      income_target numeric(14,2) default 0,
      expense_target numeric(14,2) default 0,
      notes text,
      created_at timestamptz default now(),
      unique(account_id, period)
    );
    create index if not exists idx_budgets_period on budgets (period desc);
    """,
    
    # Approval Requests table
    """
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
    """,
    
    # i18n table
    """
    create table if not exists i18n (
      lang text primary key,
      resources jsonb not null default '{}'::jsonb,
      updated_at timestamptz default now()
    );
    """,
    
    # Print Templates table
    """
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
    """,
    
    # Invoice Templates table
    """
    create table if not exists invoice_templates (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      format text default 'xlsx',
      storage_path text,
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
    """,
    
    # RLS Enable
    """
    alter table customers enable row level security;
    alter table technicians enable row level security;
    alter table services enable row level security;
    alter table business_accounts enable row level security;
    alter table vehicles enable row level security;
    alter table operations enable row level security;
    alter table transactions enable row level security;
    alter table budgets enable row level security;
    alter table approval_requests enable row level security;
    alter table i18n enable row level security;
    alter table print_templates enable row level security;
    alter table invoice_templates enable row level security;
    """,
]

# Try to execute via REST API endpoint for SQL
print("\n🔄 Attempting to create tables via Supabase REST API...")

# Method 1: Try using postgREST rpc endpoint
for i, sql in enumerate(sql_commands, 1):
    print(f"\n📝 Executing command batch {i}/{len(sql_commands)}...")
    
    # Supabase allows SQL execution via the REST API query endpoint
    # We'll use the service role key which has full access
    
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Try the query endpoint
    query_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    
    try:
        response = requests.post(
            query_url,
            json={'query': sql},
            headers=headers,
            timeout=30
        )
        
        if response.status_code in [200, 201, 204]:
            print(f"✅ Batch {i} executed successfully")
        else:
            print(f"⚠️  Batch {i} response: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"⚠️  Batch {i} failed: {str(e)[:100]}")

print("\n" + "="*60)
print("📋 Note: REST API method may not support DDL commands")
print("="*60)
print("\nPlease use Supabase Dashboard SQL Editor to execute:")
print("  File: /app/backend/supabase_schema.sql")
print("\nOr provide database password for direct psql connection")
