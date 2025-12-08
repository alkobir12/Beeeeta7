import os
import asyncio
import asyncpg
from dotenv import load_dotenv

# Load .env
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SQL_PATH = os.path.join(os.path.dirname(__file__), 'supabase_schema.sql')

async def main():
    dsn = os.environ.get('DIRECT_URL')
    if not dsn:
        print('❌ DIRECT_URL not set in environment')
        return

    print(f"Connecting to {dsn.split('@')[-1]}...") # Log host only
    
    # Read SQL
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        sql = f.read()
        
    try:
        # Try connecting with SSL
        conn = await asyncpg.connect(dsn, ssl='require')
    except Exception as e:
        print(f"First connection attempt failed: {e}")
        try:
            # Fallback without explicit SSL param (might be in DSN)
            conn = await asyncpg.connect(dsn)
        except Exception as e2:
            print(f"❌ Connection failed: {e2}")
            return

    try:
        # asyncpg execute can accept multiple statements
        await conn.execute(sql)
        print('✅ Supabase schema applied successfully')
    except Exception as e:
        print(f"❌ Schema execution failed: {e}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
