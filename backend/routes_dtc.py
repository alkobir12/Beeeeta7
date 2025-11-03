from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import re

router = APIRouter(prefix="/api")
db = None

def set_db(database):
    global db
    db = database

@router.post("/ai/kb/extract-dtc-cards")
async def extract_dtc_cards(payload: Dict[str, Any]):
    """استخراج بطاقات الأعطال من المستندات"""
    try:
        query = payload.get('query', '')
        
        # Get all documents
        docs = await db.knowledge_documents.find({}).to_list(length=500)
        
        dtc_cards = []
        
        # DTC pattern (P0xxx, P1xxx, etc.)
        dtc_pattern = re.compile(r'\b(P[0-9A-F]{4}|U[0-9A-F]{4}|C[0-9A-F]{4}|B[0-9A-F]{4})\b', re.IGNORECASE)
        
        for doc in docs:
            content = doc.get('content', '')
            summary = doc.get('summary', '')
            
            # Find all DTC codes
            found_codes = set(dtc_pattern.findall(content.upper()))
            
            # If query is a DTC code, filter
            if query and query.upper() in found_codes:
                found_codes = {query.upper()}
            elif query:
                # Search for query in content
                if query.lower() not in content.lower() and query.lower() not in summary.lower():
                    continue
            
            # Extract information for each DTC code
            for code in found_codes:
                # Find context around the code
                code_index = content.upper().find(code)
                if code_index == -1:
                    continue
                
                # Extract surrounding text (500 chars before and after)
                start = max(0, code_index - 500)
                end = min(len(content), code_index + 1000)
                context = content[start:end]
                
                # Try to extract structured info
                card = {
                    'code': code,
                    'name': extract_fault_name(code, context),
                    'causes': extract_causes(context),
                    'fixes': extract_fixes(context),
                    'related': extract_related_issues(context, code),
                    'source': doc.get('filename'),
                    'sourceId': doc.get('id'),
                    'context': context[:500],
                    'vehicle': extract_vehicle_info(doc.get('filename'))
                }
                
                dtc_cards.append(card)
        
        return {
            'cards': dtc_cards[:20],  # Limit to 20 cards
            'count': len(dtc_cards),
            'query': query
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def extract_fault_name(code: str, context: str) -> str:
    """استخراج اسم العطل"""
    lines = context.split('\n')
    for i, line in enumerate(lines):
        if code in line.upper():
            # Try to find description in same line or next line
            desc = line.split(code, 1)[-1].strip()
            if len(desc) > 10:
                return desc[:100]
            if i + 1 < len(lines):
                return lines[i + 1].strip()[:100]
    return "وصف غير متوفر"


def extract_causes(context: str) -> List[str]:
    """استخراج الأسباب"""
    causes = []
    keywords = ['cause', 'سبب', 'reason', 'due to', 'نتيجة', 'بسبب']
    
    lines = context.lower().split('\n')
    for i, line in enumerate(lines):
        if any(kw in line for kw in keywords):
            # Get next 3 lines as potential causes
            for j in range(i, min(i + 3, len(lines))):
                cleaned = lines[j].strip()
                if len(cleaned) > 10 and len(cleaned) < 200:
                    causes.append(cleaned)
            break
    
    return causes[:5] if causes else ["تحقق من المستند للتفاصيل"]


def extract_fixes(context: str) -> List[str]:
    """استخراج طرق الإصلاح"""
    fixes = []
    keywords = ['fix', 'repair', 'solution', 'إصلاح', 'حل', 'علاج', 'replace', 'check', 'فحص', 'استبدال']
    
    lines = context.lower().split('\n')
    for i, line in enumerate(lines):
        if any(kw in line for kw in keywords):
            for j in range(i, min(i + 4, len(lines))):
                cleaned = lines[j].strip()
                if len(cleaned) > 10 and len(cleaned) < 200:
                    fixes.append(cleaned)
            break
    
    return fixes[:5] if fixes else ["راجع دليل الإصلاح"]


def extract_related_issues(context: str, code: str) -> List[str]:
    """استخراج مشاكل مشابهة"""
    related = []
    dtc_pattern = re.compile(r'\b(P[0-9A-F]{4}|U[0-9A-F]{4})\b', re.IGNORECASE)
    
    # Find other DTC codes in context
    all_codes = set(dtc_pattern.findall(context.upper()))
    all_codes.discard(code)  # Remove the main code
    
    return list(all_codes)[:5]


def extract_vehicle_info(filename: str) -> str:
    """استخراج معلومات السيارة من اسم الملف"""
    vehicle_keywords = {
        'hilux': 'Toyota Hilux',
        'innova': 'Toyota Innova',
        'land cruiser': 'Toyota Land Cruiser 200',
        'landcruiser': 'Toyota Land Cruiser',
        '1kd': '1KD-FTV',
        '2kd': '2KD-FTV',
        '1vd': '1VD-FTV'
    }
    
    filename_lower = filename.lower()
    for key, value in vehicle_keywords.items():
        if key in filename_lower:
            return value
    
    return "عام"
