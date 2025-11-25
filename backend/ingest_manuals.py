
import asyncio
import os
import pdfplumber
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid

# Config
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'workshop_db')

async def ingest_manuals():
    if not MONGO_URL:
        print("❌ MONGO_URL not set")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    manuals_dir = '/app/backend/uploads/manuals'
    files = [f for f in os.listdir(manuals_dir) if f.endswith('.pdf')]
    
    print(f"📂 Found {len(files)} manuals to ingest...")
    
    for fname in files:
        path = os.path.join(manuals_dir, fname)
        print(f"📖 Processing {fname}...")
        
        try:
            # Check if already ingested
            existing = await db.knowledge_documents.count_documents({'filename': fname})
            if existing > 0:
                print(f"   ⚠️ Already ingested {existing} pages. Skipping.")
                continue

            chunks = []
            with pdfplumber.open(path) as pdf:
                total_pages = len(pdf.pages)
                print(f"   📄 Total pages: {total_pages}")
                
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if not text: continue
                    
                    # Create document chunk
                    doc = {
                        'id': str(uuid.uuid4()),
                        'title': f"{fname} - Page {i+1}",
                        'filename': fname,
                        'page_number': i + 1,
                        'content': text,
                        'type': 'manual',
                        'tags': ['manual', 'toyota', 'repair', fname],
                        'createdAt': datetime.utcnow()
                    }
                    chunks.append(doc)
                    
                    if len(chunks) >= 50:
                        await db.knowledge_documents.insert_many(chunks)
                        print(f"   💾 Saved {len(chunks)} pages...")
                        chunks = []
                
                if chunks:
                    await db.knowledge_documents.insert_many(chunks)
                    print(f"   💾 Saved final {len(chunks)} pages.")
                    
            print(f"✅ Finished {fname}")
            
        except Exception as e:
            print(f"❌ Error processing {fname}: {e}")

    print("🎉 Ingestion complete!")

if __name__ == "__main__":
    asyncio.run(ingest_manuals())
