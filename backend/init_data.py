#!/usr/bin/env python3
"""
Initialize the workshop database with sample data
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from models import Technician, Service, Part

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


async def init_database():
    """Initialize database with sample data"""

    # Connect to MongoDB
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get("DB_NAME", "workshop_db")]

    print("🔧 Initializing Workshop Database...")

    # Check if data already exists
    existing_techs = await db.technicians.count_documents({})
    if existing_techs > 0:
        print("✅ Database already initialized!")
        return

    # Sample Technicians
    technicians = [
        Technician(
            name="أحمد محمد",
            phone="0501234567",
            specialty="محركات",
            completedJobs=150,
            rating=4.8,
        ),
        Technician(
            name="محمد علي",
            phone="0509876543",
            specialty="كهرباء",
            completedJobs=120,
            rating=4.7,
        ),
        Technician(
            name="خالد أحمد",
            phone="0505555555",
            specialty="تكييف",
            completedJobs=80,
            rating=4.9,
        ),
        Technician(
            name="عبدالله سعد",
            phone="0502222222",
            specialty="فرامل",
            completedJobs=200,
            rating=4.6,
        ),
    ]

    # Sample Services
    services = [
        Service(
            name="تغيير زيت المحرك", category="صيانة دورية", price=150.0, duration=30
        ),
        Service(name="فحص شامل", category="تشخيص", price=100.0, duration=60),
        Service(
            name="تغيير فلتر الهواء", category="صيانة دورية", price=80.0, duration=15
        ),
        Service(
            name="تغيير فلتر الوقود", category="صيانة دورية", price=120.0, duration=20
        ),
        Service(name="فحص الفرامل", category="فرامل", price=200.0, duration=45),
        Service(name="تغيير تيل الفرامل", category="فرامل", price=300.0, duration=60),
        Service(name="فحص البطارية", category="كهرباء", price=50.0, duration=15),
        Service(name="تغيير البطارية", category="كهرباء", price=400.0, duration=30),
        Service(name="صيانة التكييف", category="تكييف", price=250.0, duration=90),
        Service(name="تعبئة فريون", category="تكييف", price=180.0, duration=30),
        Service(name="تغيير إطارات", category="إطارات", price=800.0, duration=45),
        Service(name="ترصيص إطارات", category="إطارات", price=100.0, duration=30),
        Service(
            name="تغيير زيت القير", category="نقل الحركة", price=200.0, duration=45
        ),
        Service(name="صيانة المحرك", category="محركات", price=500.0, duration=180),
        Service(name="إصلاح عطل كهربائي", category="كهرباء", price=300.0, duration=120),
    ]

    # Sample Parts
    parts = [
        Part(
            partNumber="OIL-001",
            name="زيت محرك 5W-30",
            category="زيوت",
            purchasePrice=45.0,
            sellingPrice=65.0,
            quantity=50,
            minQuantity=10,
            supplier="شركة الزيوت المتقدمة",
        ),
        Part(
            partNumber="FILTER-001",
            name="فلتر هواء",
            category="فلاتر",
            purchasePrice=25.0,
            sellingPrice=40.0,
            quantity=30,
            minQuantity=5,
            supplier="قطع غيار الخليج",
        ),
        Part(
            partNumber="BRAKE-001",
            name="تيل فرامل أمامي",
            category="فرامل",
            purchasePrice=80.0,
            sellingPrice=120.0,
            quantity=20,
            minQuantity=3,
            supplier="فرامل الأمان",
        ),
        Part(
            partNumber="BATTERY-001",
            name="بطارية 12V 70Ah",
            category="كهرباء",
            purchasePrice=200.0,
            sellingPrice=300.0,
            quantity=15,
            minQuantity=2,
            supplier="بطاريات القوة",
        ),
        Part(
            partNumber="TIRE-001",
            name="إطار 205/55R16",
            category="إطارات",
            purchasePrice=150.0,
            sellingPrice=220.0,
            quantity=40,
            minQuantity=8,
            supplier="إطارات الخليج",
        ),
        Part(
            partNumber="SPARK-001",
            name="شمعة احتراق",
            category="محركات",
            purchasePrice=15.0,
            sellingPrice=25.0,
            quantity=100,
            minQuantity=20,
            supplier="قطع المحركات",
        ),
        Part(
            partNumber="COOLANT-001",
            name="سائل تبريد",
            category="سوائل",
            purchasePrice=20.0,
            sellingPrice=35.0,
            quantity=25,
            minQuantity=5,
            supplier="سوائل السيارات",
        ),
        Part(
            partNumber="BELT-001",
            name="سير مولد",
            category="محركات",
            purchasePrice=30.0,
            sellingPrice=50.0,
            quantity=15,
            minQuantity=3,
            supplier="أحزمة المحركات",
        ),
    ]

    # Insert data
    print("👥 Adding technicians...")
    await db.technicians.insert_many([tech.dict() for tech in technicians])

    print("🔧 Adding services...")
    await db.services.insert_many([service.dict() for service in services])

    print("🔩 Adding parts...")
    await db.parts.insert_many([part.dict() for part in parts])

    print("✅ Database initialization complete!")
    print(f"   - {len(technicians)} technicians added")
    print(f"   - {len(services)} services added")
    print(f"   - {len(parts)} parts added")

    # Close connection
    client.close()


if __name__ == "__main__":
    asyncio.run(init_database())
