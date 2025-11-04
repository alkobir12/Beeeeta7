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
    """استخراج بطاقات الأعطال الذكية بالذكاء الاصطناعي"""
    try:
        import os
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid
        from datetime import datetime
        
        query = payload.get('query', '')
        # use_web = payload.get('use_web', True)  # Reserved for future web search integration
        
        # Get all documents
        docs = await db.knowledge_documents.find({}).to_list(length=500)
        
        dtc_cards = []
        
        # DTC pattern (P0xxx, P1xxx, etc.)
        dtc_pattern = re.compile(r'\b(P[0-9A-F]{4}|U[0-9A-F]{4}|C[0-9A-F]{4}|B[0-9A-F]{4})\b', re.IGNORECASE)
        
        # Find all DTC codes in all documents
        all_found_codes = {}
        
        for doc in docs:
            content = doc.get('content', '')
            
            # Find all DTC codes
            found_codes = set(dtc_pattern.findall(content.upper()))
            
            # If query is a DTC code, filter
            if query and query.upper() in found_codes:
                found_codes = {query.upper()}
            elif query:
                # Search for query in content
                if query.lower() not in content.lower():
                    continue
            
            # Store codes with their context
            for code in found_codes:
                if code not in all_found_codes:
                    code_index = content.upper().find(code)
                    if code_index != -1:
                        start = max(0, code_index - 1000)
                        end = min(len(content), code_index + 2000)
                        all_found_codes[code] = {
                            'context': content[start:end],
                            'source': doc.get('filename'),
                            'sourceId': doc.get('id'),
                            'vehicle': extract_vehicle_info(doc.get('filename'))
                        }
        
        # Use AI to analyze each DTC code
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        if llm_key and all_found_codes:
            llm = LlmChat(
                api_key=llm_key,
                session_id=str(uuid.uuid4()),
                system_message="You are an automotive DTC (Diagnostic Trouble Code) expert. Provide detailed, accurate information in Arabic."
            ).with_model("anthropic", "claude-3-7-sonnet-20250219")
            
            # Process each code
            for code, info in list(all_found_codes.items())[:10]:  # Limit to 10 codes
                try:
                    analysis_prompt = f"""حلل كود العطل {code} بالتفصيل:

السياق من المستند ({info['source']}):
{info['context'][:1500]}

قدم تحليل شامل بالعربية:
1. اسم العطل بالعربية والإنجليزية
2. الأسباب المحتملة (3-5 أسباب محددة)
3. طرق الإصلاح (خطوات عملية محددة)
4. ملاحظات مهمة

كن دقيقاً ومحدداً بناءً على السياق المعطى."""

                    response = await llm.send_message(UserMessage(text=analysis_prompt))
                    response_text = response if isinstance(response, str) else response.text
                    
                    # Parse AI response
                    card = parse_ai_dtc_response(code, response_text, info)
                    dtc_cards.append(card)
                    
                except Exception as e:
                    print(f"⚠️ AI analysis failed for {code}: {e}")
                    # Fallback to basic extraction
                    card = {
                        'code': code,
                        'name': extract_fault_name(code, info['context']),
                        'causes': extract_causes(info['context']),
                        'fixes': extract_fixes(info['context']),
                        'related': extract_related_issues(info['context'], code),
                        'source': info['source'],
                        'sourceId': info['sourceId'],
                        'context': info['context'][:500],
                        'vehicle': info['vehicle']
                    }
                    dtc_cards.append(card)
        
        return {
            'cards': dtc_cards[:20],
            'count': len(dtc_cards),
            'query': query
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def parse_ai_dtc_response(code: str, ai_text: str, info: dict) -> dict:
    """تحليل استجابة AI واستخراج البطاقة"""
    lines = ai_text.split('\n')
    
    name = ""
    causes = []
    fixes = []
    notes = ""
    
    current_section = None
    
    for line in lines:
        line_clean = line.strip()
        
        # Detect sections
        if 'اسم العطل' in line or 'الاسم' in line or 'Name' in line.lower():
            current_section = 'name'
            # Try to extract name from same line
            if ':' in line:
                name = line.split(':', 1)[1].strip()
        elif 'الأسباب' in line or 'Causes' in line.lower() or 'أسباب' in line:
            current_section = 'causes'
        elif 'الإصلاح' in line or 'Fix' in line.lower() or 'طرق' in line:
            current_section = 'fixes'
        elif 'ملاحظات' in line or 'Notes' in line.lower():
            current_section = 'notes'
        elif line_clean:
            # Add content to current section
            if current_section == 'name' and not name:
                name = line_clean
            elif current_section == 'causes' and (line_clean.startswith('-') or line_clean.startswith('•') or line_clean.startswith(('1', '2', '3', '4', '5'))):
                causes.append(line_clean.lstrip('-•123456789. '))
            elif current_section == 'fixes' and (line_clean.startswith('-') or line_clean.startswith('•') or line_clean.startswith(('1', '2', '3', '4', '5'))):
                fixes.append(line_clean.lstrip('-•123456789. '))
            elif current_section == 'notes':
                notes += line_clean + " "
    
    related = extract_related_issues(info['context'], code)
    
    return {
        'code': code,
        'name': name or f"كود العطل {code}",
        'causes': causes[:5] if causes else ["تحقق من المستند للتفاصيل"],
        'fixes': fixes[:5] if fixes else ["راجع دليل الإصلاح"],
        'related': related,
        'notes': notes.strip()[:200],
        'source': info['source'],
        'sourceId': info['sourceId'],
        'context': info['context'][:500],
        'vehicle': info['vehicle']
    }


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
