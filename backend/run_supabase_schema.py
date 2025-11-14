import os
import asyncio
import asyncpg

SQL_PATH = os.path.join(os.path.dirname(__file__), 'supabase_schema.sql')

async def main():
    dsn = os.environ.get('DIRECT_URL')
    if not dsn:
        raise RuntimeError('DIRECT_URL not set in environment')
    # Read SQL
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        sql = f.read()
    conn = await asyncpg.connect(dsn)
    try:
        # asyncpg execute can accept multiple statements
        await conn.execute(sql)
        print('✅ Supabase schema applied successfully')
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
