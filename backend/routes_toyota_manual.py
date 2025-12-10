"""
Toyota Manual Content API
Serves manual content without iframe
"""
from fastapi import APIRouter
from pathlib import Path
import json
import re
from bs4 import BeautifulSoup

router = APIRouter(prefix="/api/toyota-manual")

# Manual structure
SECTIONS = [
    {"id": "readme", "title": "READ ME", "title_ar": "اقرأني", "icon": "📋"},
    {"id": "general", "title": "General", "title_ar": "معلومات عامة", "icon": "📖"},
    {"id": "engine", "title": "Engine / Hybrid System", "title_ar": "المحرك والهايبرد", "icon": "🔩"},
    {"id": "drivetrain", "title": "Drivetrain", "title_ar": "نظام الدفع", "icon": "⚙️"},
    {"id": "suspension", "title": "Suspension", "title_ar": "التعليق", "icon": "🏗️"},
    {"id": "brake", "title": "Brake", "title_ar": "الفرامل", "icon": "🛑"},
    {"id": "steering", "title": "Steering", "title_ar": "التوجيه", "icon": "🎛️"},
    {"id": "audio", "title": "Audio/Visual/Telematics", "title_ar": "الصوتيات", "icon": "🎵"},
    {"id": "power", "title": "Power Source / Network", "title_ar": "الطاقة", "icon": "🔌"},
    {"id": "interior", "title": "Vehicle Interior", "title_ar": "الداخلية", "icon": "🪟"},
    {"id": "exterior", "title": "Vehicle Exterior", "title_ar": "الخارجية", "icon": "🚘"}
]

@router.get("/sections")
async def get_sections():
    """Get all manual sections"""
    return {"sections": SECTIONS}

@router.get("/section/{section_id}")
async def get_section_content(section_id: str):
    """Get content for a specific section"""
    
    # Find section
    section = next((s for s in SECTIONS if s['id'] == section_id), None)
    if not section:
        return {"error": "Section not found"}
    
    # Sample content - in production, parse from HTML files
    content = {
        "id": section_id,
        "title": section['title'],
        "title_ar": section['title_ar'],
        "icon": section['icon'],
        "content": generate_sample_content(section_id),
        "subsections": get_subsections(section_id)
    }
    
    return content

def get_subsections(section_id):
    """Get subsections for a section"""
    subsections = {
        "engine": [
            {"id": "engine-mech", "title": "Engine Mechanical", "title_ar": "ميكانيكا المحرك"},
            {"id": "engine-control", "title": "Engine Control System", "title_ar": "نظام التحكم"},
            {"id": "fuel", "title": "Fuel System", "title_ar": "نظام الوقود"},
            {"id": "cooling", "title": "Cooling System", "title_ar": "نظام التبريد"},
            {"id": "lubrication", "title": "Lubrication System", "title_ar": "نظام التشحيم"}
        ],
        "drivetrain": [
            {"id": "clutch", "title": "Clutch", "title_ar": "الدبرياج"},
            {"id": "transmission", "title": "Transmission", "title_ar": "ناقل الحركة"},
            {"id": "transfer", "title": "Transfer Case", "title_ar": "علبة النقل"},
            {"id": "shaft", "title": "Propeller Shaft", "title_ar": "عمود الإدارة"},
            {"id": "differential", "title": "Differential", "title_ar": "الدفرنس"}
        ],
        "suspension": [
            {"id": "front-sus", "title": "Front Suspension", "title_ar": "تعليق أمامي"},
            {"id": "rear-sus", "title": "Rear Suspension", "title_ar": "تعليق خلفي"},
            {"id": "shock", "title": "Shock Absorbers", "title_ar": "المساعدات"}
        ],
        "brake": [
            {"id": "brake-sys", "title": "Brake System", "title_ar": "نظام الفرامل"},
            {"id": "abs", "title": "ABS", "title_ar": "نظام ABS"},
            {"id": "parking", "title": "Parking Brake", "title_ar": "فرامل اليد"}
        ]
    }
    return subsections.get(section_id, [])

def generate_sample_content(section_id):
    """Generate sample content - will be replaced with actual parsed content"""
    
    content_map = {
        "readme": {
            "title": "READ ME - معلومات مهمة",
            "description": "يرجى قراءة هذه المعلومات قبل استخدام الدليل",
            "items": [
                {"type": "warning", "text": "⚠️ تأكد من فصل البطارية قبل أي عمل كهربائي"},
                {"type": "info", "text": "ℹ️ استخدم العدد والأدوات المناسبة"},
                {"type": "note", "text": "📝 احتفظ بقطع الغيار الأصلية"}
            ]
        },
        "engine": {
            "title": "Engine / Hybrid System - المحرك والهايبرد",
            "description": "معلومات شاملة عن نظام المحرك",
            "specs": {
                "Type": "V8 Diesel",
                "Displacement": "4.5L",
                "Power": "202 hp @ 3400 rpm",
                "Torque": "430 Nm @ 1600-2600 rpm"
            },
            "items": [
                {"type": "section", "text": "🔧 Engine Mechanical - الأجزاء الميكانيكية"},
                {"type": "section", "text": "💻 Engine Control System - نظام التحكم"},
                {"type": "section", "text": "⛽ Fuel System - نظام الوقود"}
            ]
        },
        "drivetrain": {
            "title": "Drivetrain - نظام الدفع",
            "description": "ناقل الحركة ونظام الدفع الرباعي",
            "items": [
                {"type": "section", "text": "⚙️ Transmission - ناقل الحركة"},
                {"type": "section", "text": "🔄 Transfer Case - علبة النقل"},
                {"type": "section", "text": "🔩 Differential - الدفرنس"}
            ]
        }
    }
    
    return content_map.get(section_id, {
        "title": f"{section_id.title()} Section",
        "description": "محتوى تفصيلي قادم قريباً",
        "items": []
    })

@router.get("/search")
async def search_manual(q: str):
    """Search in manual content"""
    results = []
    for section in SECTIONS:
        if q.lower() in section['title'].lower() or q.lower() in section['title_ar'].lower():
            results.append(section)
    return {"results": results, "count": len(results)}
