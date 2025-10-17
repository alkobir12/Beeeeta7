"""
AI Knowledge Base System
Intelligent learning system for AI Helper to store and retrieve solutions
"""
import os
from datetime import datetime
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import json

load_dotenv()

class AIKnowledgeBase:
    """
    Knowledge base for storing and retrieving automotive solutions
    Enables AI to learn from past cases and provide better answers
    """
    
    def __init__(self, db):
        self.db = db
        self.collection = db.ai_knowledge_base
        
    async def add_solution(
        self,
        problem_type: str,
        vehicle_info: str,
        problem_description: str,
        solution: str,
        technician_name: str = None,
        effectiveness_rating: int = 5
    ):
        """
        Add a new solution to the knowledge base
        
        Args:
            problem_type: Category (engine, electrical, brakes, etc.)
            vehicle_info: Vehicle make, model, year
            problem_description: Description of the problem
            solution: Solution that worked
            technician_name: Who solved it
            effectiveness_rating: 1-5, how effective was the solution
        """
        entry = {
            "problem_type": problem_type,
            "vehicle_info": vehicle_info,
            "problem_description": problem_description,
            "solution": solution,
            "technician_name": technician_name,
            "effectiveness_rating": effectiveness_rating,
            "created_at": datetime.utcnow(),
            "times_used": 0,
            "success_count": 0,
            "keywords": self._extract_keywords(problem_description),
            "tags": self._generate_tags(problem_type, vehicle_info)
        }
        
        await self.collection.insert_one(entry)
        return entry
    
    async def search_solutions(
        self,
        query: str,
        vehicle_info: str = None,
        problem_type: str = None,
        limit: int = 5
    ) -> List[Dict]:
        """
        Search for relevant solutions based on query
        
        Returns:
            List of relevant solutions sorted by relevance and effectiveness
        """
        # Build search query
        search_filters = []
        
        # Text search
        if query:
            keywords = self._extract_keywords(query)
            search_filters.append({
                "$or": [
                    {"problem_description": {"$regex": query, "$options": "i"}},
                    {"solution": {"$regex": query, "$options": "i"}},
                    {"keywords": {"$in": keywords}}
                ]
            })
        
        # Vehicle filter
        if vehicle_info:
            search_filters.append({
                "vehicle_info": {"$regex": vehicle_info, "$options": "i"}
            })
        
        # Problem type filter
        if problem_type:
            search_filters.append({
                "problem_type": problem_type
            })
        
        # Combine filters
        query_filter = {"$and": search_filters} if search_filters else {}
        
        # Search and sort by effectiveness and usage
        results = await self.collection.find(query_filter).sort([
            ("effectiveness_rating", -1),
            ("times_used", -1),
            ("created_at", -1)
        ]).limit(limit).to_list(length=limit)
        
        # Remove ObjectId fields for JSON serialization
        for result in results:
            result.pop("_id", None)
        
        return results
    
    async def mark_solution_used(self, solution_id: str, was_successful: bool = True):
        """
        Mark a solution as used and track its success
        """
        update = {
            "$inc": {
                "times_used": 1,
                "success_count": 1 if was_successful else 0
            }
        }
        
        await self.collection.update_one({"_id": solution_id}, update)
    
    async def get_common_problems(self, limit: int = 10) -> List[Dict]:
        """
        Get most common problems and their solutions
        """
        pipeline = [
            {
                "$group": {
                    "_id": "$problem_type",
                    "count": {"$sum": 1},
                    "avg_rating": {"$avg": "$effectiveness_rating"},
                    "problems": {"$push": {
                        "description": "$problem_description",
                        "solution": "$solution"
                    }}
                }
            },
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        
        results = await self.collection.aggregate(pipeline).to_list(length=limit)
        return results
    
    async def get_vehicle_specific_issues(self, vehicle_info: str) -> List[Dict]:
        """
        Get common issues for a specific vehicle
        """
        results = await self.collection.find({
            "vehicle_info": {"$regex": vehicle_info, "$options": "i"}
        }).sort("effectiveness_rating", -1).limit(10).to_list(length=10)
        
        # Remove ObjectId fields for JSON serialization
        for result in results:
            result.pop("_id", None)
        
        return results
    
    def _extract_keywords(self, text: str) -> List[str]:
        """
        Extract important keywords from text
        """
        # Common automotive keywords
        keywords = []
        
        # Arabic automotive terms
        arabic_terms = [
            "محرك", "فرامل", "كهرباء", "تكييف", "جير", "زيت", "فلتر",
            "إطارات", "بطارية", "دينمو", "سلف", "شمعات", "بخاخات",
            "رديتر", "مساعدات", "مقصات", "شكمان", "صدام", "إضاءة"
        ]
        
        text_lower = text.lower()
        for term in arabic_terms:
            if term in text_lower:
                keywords.append(term)
        
        return keywords
    
    def _generate_tags(self, problem_type: str, vehicle_info: str) -> List[str]:
        """
        Generate tags for better categorization
        """
        tags = [problem_type]
        
        # Extract brand from vehicle info
        brands = ["تويوتا", "هونداي", "نيسان", "فورد", "شيفروليه", "مرسيدس", "بي ام دبليو"]
        for brand in brands:
            if brand in vehicle_info:
                tags.append(brand)
        
        return tags


# Predefined knowledge base data
INITIAL_KNOWLEDGE = [
    {
        "problem_type": "محرك",
        "vehicle_info": "تويوتا كامري 2015",
        "problem_description": "صوت طقطقة من المحرك عند بداية التشغيل",
        "solution": "فحص مستوى الزيت وتغييره. في حالة استمرار المشكلة، فحص سير التايمن والسلسلة.",
        "technician_name": "أحمد محمد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "كهرباء",
        "vehicle_info": "هونداي سوناتا 2018",
        "problem_description": "البطارية تفرغ بسرعة",
        "solution": "فحص الدينمو والتأكد من شحنه الصحيح. فحص استهلاك التيار في وضع الإيقاف للكشف عن تسريب كهربائي.",
        "technician_name": "محمد علي",
        "effectiveness_rating": 4
    },
    {
        "problem_type": "تكييف",
        "vehicle_info": "نيسان باترول 2020",
        "problem_description": "التكييف لا يبرد بشكل كافٍ",
        "solution": "فحص مستوى غاز الفريون وإعادة التعبئة. تنظيف المكثف الخارجي. فحص كمبروسر التكييف.",
        "technician_name": "خالد أحمد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "فرامل",
        "vehicle_info": "فورد F-150 2019",
        "problem_description": "اهتزاز في المقود عند الفرملة",
        "solution": "تبديل ديسكات الفرامل الأمامية وعمل تسوية للديسكات. تبديل الفحمات إذا كانت مستهلكة.",
        "technician_name": "عبدالله سعد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "جير",
        "vehicle_info": "شيفروليه كابتيفا 2016",
        "problem_description": "تأخر في نقل السرعات في الجير الأوتوماتيك",
        "solution": "تغيير زيت الجير بالكامل واستخدام زيت أصلي. فحص فلتر الجير وتبديله إذا لزم الأمر.",
        "technician_name": "أحمد محمد",
        "effectiveness_rating": 4
    },
    {
        "problem_type": "محرك",
        "vehicle_info": "تويوتا هايلوكس 2017",
        "problem_description": "استهلاك زائد للوقود",
        "solution": "تنظيف البخاخات وفحص فلتر الهواء وتبديله. فحص شمعات الاحتراق وتبديلها إذا كانت متسخة.",
        "technician_name": "محمد علي",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "كهرباء",
        "vehicle_info": "مرسيدس E-Class 2019",
        "problem_description": "مشكلة في بداية التشغيل في الصباح",
        "solution": "فحص البطارية وقوة الشحن. تنظيف أقطاب البطارية. فحص السلف (المارش).",
        "technician_name": "عبدالله سعد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "تعليق",
        "vehicle_info": "هونداي توسان 2018",
        "problem_description": "صوت طقطقة من الأمام عند المطبات",
        "solution": "فحص المساعدات والمقصات. تبديل جلد المقصات أو البلي حسب الفحص.",
        "technician_name": "سعود فهد",
        "effectiveness_rating": 4
    },
    {
        "problem_type": "محرك",
        "vehicle_info": "نيسان التيما 2016",
        "problem_description": "ارتفاع حرارة المحرك",
        "solution": "فحص مستوى ماء الرديتر والتأكد من عدم وجود تسريب. فحص الثرموستات والمروحة الكهربائية.",
        "technician_name": "أحمد محمد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "عادم",
        "vehicle_info": "فورد اكسبلورر 2015",
        "problem_description": "صوت عالٍ من العادم",
        "solution": "فحص الشكمان بحثاً عن ثقوب أو صدأ. لحام أو تبديل الشكمان حسب الحالة.",
        "technician_name": "سعود فهد",
        "effectiveness_rating": 4
    },
    {
        "problem_type": "كهرباء",
        "vehicle_info": "تويوتا كورولا 2020",
        "problem_description": "مشكلة في برمجة مفتاح السيارة",
        "solution": "إعادة برمجة المفتاح باستخدام الماسح التشخيصي. في حالة فشل البرمجة، تبديل بطارية المفتاح.",
        "technician_name": "محمد علي",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "فرامل",
        "vehicle_info": "شيفروليه تاهو 2018",
        "problem_description": "صوت صرير عند الفرملة",
        "solution": "تبديل فحمات الفرامل. تنظيف أو تبديل ديسكات الفرامل إذا كانت مخدوشة.",
        "technician_name": "عبدالله سعد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "إطارات",
        "vehicle_info": "هونداي اكسنت 2017",
        "problem_description": "اهتزاز في السيارة عند السرعات العالية",
        "solution": "عمل ترصيص للإطارات الأربعة. فحص ضغط الإطارات وضبطه حسب المواصفات.",
        "technician_name": "سعود فهد",
        "effectiveness_rating": 4
    },
    {
        "problem_type": "محرك",
        "vehicle_info": "بي ام دبليو X5 2019",
        "problem_description": "لمبة المكينة مضيئة",
        "solution": "فحص الماسح التشخيصي لقراءة الأعطال. الحلول الشائعة: تبديل حساس الأكسجين، تنظيف صمام EGR، فحص نظام العادم.",
        "technician_name": "أحمد محمد",
        "effectiveness_rating": 5
    },
    {
        "problem_type": "تبريد",
        "vehicle_info": "تويوتا لاندكروزر 2021",
        "problem_description": "تسريب ماء من الرديتر",
        "solution": "فحص الرديتر والخراطيم. تبديل الخراطيم المتشققة أو الرديتر إذا كان تالفاً. إضافة مادة Stop Leak كحل مؤقت.",
        "technician_name": "خالد أحمد",
        "effectiveness_rating": 4
    }
]
