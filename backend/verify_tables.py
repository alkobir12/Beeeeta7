#!/usr/bin/env python3
"""
Verify all required tables exist in Supabase
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing Supabase credentials")
    sys.exit(1)

# List of all required tables
REQUIRED_TABLES = [
    'customers',
    'technicians',
    'services',
    'parts',
    'business_accounts',
    'vehicles',
    'operations',
    'transactions',
    'budgets',
    'approval_requests',
    'i18n',
    'print_templates',
    'invoice_templates'
]

print("🔍 Verifying Supabase tables...\n")

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

results = {
    'existing': [],
    'missing': []
}

for table_name in REQUIRED_TABLES:
    try:
        # Try to query the table (will fail if table doesn't exist)
        response = client.table(table_name).select("*").limit(1).execute()
        results['existing'].append(table_name)
        print(f"✅ {table_name}: OK")
    except Exception as e:
        results['missing'].append(table_name)
        error_msg = str(e)
        if 'PGRST204' in error_msg or 'PGRST205' in error_msg or 'relation' in error_msg:
            print(f"❌ {table_name}: NOT FOUND")
        else:
            print(f"⚠️  {table_name}: ERROR - {error_msg[:100]}")

print("\n" + "="*60)
print("📊 SUMMARY")
print("="*60)
print(f"✅ Existing tables: {len(results['existing'])}/{len(REQUIRED_TABLES)}")
print(f"❌ Missing tables: {len(results['missing'])}/{len(REQUIRED_TABLES)}")

if results['missing']:
    print("\n🔴 Missing tables:")
    for table in results['missing']:
        print(f"   - {table}")
    print("\n📝 Action needed: Execute supabase_schema.sql in Supabase Dashboard")
    sys.exit(1)
else:
    print("\n✅ All tables verified successfully!")
    print("🚀 Backend should now work correctly")
    sys.exit(0)
