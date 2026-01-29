#!/usr/bin/env python3
"""
Migration: Add workshop_id column to operations table
This fixes the issue where credit operations are not showing in AR reports
because workshop_id is not being saved in the operations table.
"""

import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def add_workshop_id_to_operations():
    """Add workshop_id column to operations table"""
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Supabase credentials not found")
        return False
    
    try:
        # Create Supabase client
        supabase = create_client(supabase_url, supabase_key)
        
        # SQL to add workshop_id column to operations table
        sql_add_column = """
        ALTER TABLE operations 
        ADD COLUMN IF NOT EXISTS workshop_id text;
        """
        
        # SQL to add index for workshop_id
        sql_add_index = """
        CREATE INDEX IF NOT EXISTS idx_operations_workshop_id 
        ON operations (workshop_id);
        """
        
        print("🔄 Adding workshop_id column to operations table...")
        
        # Execute the SQL
        result1 = supabase.rpc('exec_sql', {'sql': sql_add_column}).execute()
        print("✅ Added workshop_id column")
        
        result2 = supabase.rpc('exec_sql', {'sql': sql_add_index}).execute()
        print("✅ Added index for workshop_id")
        
        # Verify the column was added
        verify_sql = """
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'operations' AND column_name = 'workshop_id';
        """
        
        verify_result = supabase.rpc('exec_sql', {'sql': verify_sql}).execute()
        
        if verify_result.data:
            print("✅ Migration completed successfully")
            print(f"   Column details: {verify_result.data}")
            return True
        else:
            print("⚠️ Column may not have been added properly")
            return False
            
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = add_workshop_id_to_operations()
    if success:
        print("\n🎉 Migration completed successfully!")
        print("   The operations table now has workshop_id column")
        print("   Credit operations should now appear in AR reports")
    else:
        print("\n❌ Migration failed!")
        print("   Please check the error messages above")
    
    exit(0 if success else 1)