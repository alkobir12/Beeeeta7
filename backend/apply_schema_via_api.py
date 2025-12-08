#!/usr/bin/env python3
"""
Apply Supabase schema via REST API
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing Supabase credentials in .env")
    sys.exit(1)

# Read the schema SQL
with open('/app/backend/supabase_schema.sql', 'r') as f:
    schema_sql = f.read()

print("📋 Schema SQL loaded successfully")
print(f"📊 SQL length: {len(schema_sql)} characters")

# Create Supabase client
client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

print("\n🔄 Executing schema via Supabase REST API...")

try:
    # Use the SQL endpoint via rpc or direct execution
    # Note: Supabase REST API doesn't directly support DDL execution
    # We'll need to use the PostgreSQL connection or Supabase dashboard
    
    print("\n⚠️ DDL (CREATE TABLE) commands cannot be executed via REST API")
    print("📝 Please execute the schema using ONE of these methods:")
    print("\n" + "="*60)
    print("METHOD 1: Supabase Dashboard (RECOMMENDED)")
    print("="*60)
    print("1. Go to: https://supabase.com/dashboard")
    print("2. Select your project")
    print("3. Navigate to: SQL Editor")
    print("4. Copy the entire content of: /app/backend/supabase_schema.sql")
    print("5. Paste it into the SQL Editor")
    print("6. Click 'Run' button")
    print("7. Verify tables are created in 'Table Editor'")
    
    print("\n" + "="*60)
    print("METHOD 2: psql Command Line (if you have direct access)")
    print("="*60)
    print("psql \"postgresql://postgres:[YOUR-PASSWORD]@db.kqjlyozhvwswooztccag.supabase.co:5432/postgres\" -f /app/backend/supabase_schema.sql")
    
    print("\n" + "="*60)
    print("After creating tables, run this verification:")
    print("="*60)
    print("cd /app/backend && python3 verify_tables.py")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
