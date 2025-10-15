"""
Enhanced AI Routes with Knowledge Base Integration
Provides intelligent automotive assistance with learning capabilities
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Optional, List
import uuid
import os

from emergentintegrations.llm.chat import LlmChat, UserMessage
from ai_knowledge_base import AIKnowledgeBase, INITIAL_KNOWLEDGE
from pydantic import BaseModel

router = APIRouter(prefix="/api")

db = None
knowledge_base = None

def set_db(database):
    global db, knowledge_base
    db = database
    knowledge_base = AIKnowledgeBase(db)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    vehicle_info: Optional[str] = None


class SolutionFeedback(BaseModel):
    solution_id: str
    was_helpful: bool
    additional_notes: Optional[str] = None


class NewSolution(BaseModel):
    problem_type: str
    vehicle_info: str
    problem_description: str
    solution: str
    technician_name: Optional[str] = None
    effectiveness_rating: int = 5


@router.post("/ai/enhanced-chat")
async def enhanced_ai_chat(request: ChatRequest):
    """
    Enhanced AI chat with knowledge base integration
    - Searches knowledge base first for known solutions
    - Falls back to Claude AI for complex queries
    - Learns from interactions
    """
    try:
        session_id = request.session_id or str(uuid.uuid4())
        
        # Step 1: Search knowledge base for relevant solutions
        relevant_solutions = await knowledge_base.search_solutions(
            query=request.message,
            vehicle_info=request.vehicle_info,
            limit=3
        )
        
        # Step 2: Build context from knowledge base
        kb_context = ""
        if relevant_solutions:
            kb_context = "\n\n=== حلول من قاعدة المعرفة ===\n"
            for i, solution in enumerate(relevant_solutions, 1):
                kb_context += f"\n{i}. المشكلة: {solution.get('problem_description')}"
                kb_context += f"\n   المركبة: {solution.get('vehicle_info')}"
                kb_context += f"\n   الحل: {solution.get('solution')}"
                kb_context += f"\n   التقييم: {solution.get('effectiveness_rating')}/5"
                if solution.get('technician_name'):
                    kb_context += f"\n   الفني: {solution.get('technician_name')}"
                kb_context += "\n"
        
        # Step 3: Build enhanced system prompt
        system_prompt = f"""أنت مساعد ذكي متخصص في صيانة وإصلاح السيارات.

مهامك:
1. مساعدة الفنيين في تشخيص مشاكل السيارات
2. تقديم حلول مجربة وفعالة
3. توفير معلومات دقيقة عن قطع الغيار والخدمات
4. تقديم نصائح الصيانة الوقائية

إذا وجدت حلول مشابهة في قاعدة المعرفة، اعتمد عليها وقدمها بشكل واضح.

{kb_context}

قدم إجابات:
- واضحة ومباشرة
- مبنية على خبرة عملية
- باللغة العربية
- مع خطوات محددة عند الحاجة

إذا لم تكن متأكداً من الإجابة، اذكر ذلك واقترح استشارة فني متخصص."""

        # Step 4: Use Claude AI
        llm_key = os.getenv('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=system_prompt
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)
        
        # Step 5: Save conversation
        conversation_entry = {
            "session_id": session_id,
            "user_message": request.message,
            "ai_response": response,
            "vehicle_info": request.vehicle_info,
            "relevant_solutions_count": len(relevant_solutions),
            "timestamp": datetime.utcnow()
        }
        await db.ai_conversations.insert_one(conversation_entry)
        
        return {
            "response": response,
            "session_id": session_id,
            "knowledge_base_used": len(relevant_solutions) > 0,
            "relevant_solutions": len(relevant_solutions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/add-solution")
async def add_solution_to_knowledge_base(solution: NewSolution):
    """
    Add a new solution to the knowledge base
    Allows technicians to teach the AI
    """
    try:
        entry = await knowledge_base.add_solution(
            problem_type=solution.problem_type,
            vehicle_info=solution.vehicle_info,
            problem_description=solution.problem_description,
            solution=solution.solution,
            technician_name=solution.technician_name,
            effectiveness_rating=solution.effectiveness_rating
        )
        
        return {
            "success": True,
            "message": "تم إضافة الحل إلى قاعدة المعرفة بنجاح",
            "entry_id": str(entry.get("_id"))
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/solution-feedback")
async def submit_solution_feedback(feedback: SolutionFeedback):
    """
    Submit feedback on a solution's effectiveness
    Helps improve AI recommendations
    """
    try:
        await knowledge_base.mark_solution_used(
            solution_id=feedback.solution_id,
            was_successful=feedback.was_helpful
        )
        
        return {
            "success": True,
            "message": "شكراً لتقييمك! سيساعد ذلك في تحسين الإجابات المستقبلية"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/search-solutions")
async def search_knowledge_base(
    query: str,
    vehicle_info: Optional[str] = None,
    problem_type: Optional[str] = None,
    limit: int = 10
):
    """
    Search the knowledge base directly
    """
    try:
        solutions = await knowledge_base.search_solutions(
            query=query,
            vehicle_info=vehicle_info,
            problem_type=problem_type,
            limit=limit
        )
        
        return {
            "results": solutions,
            "count": len(solutions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/common-problems")
async def get_common_problems(limit: int = 10):
    """
    Get most common problems and solutions
    """
    try:
        problems = await knowledge_base.get_common_problems(limit=limit)
        return {
            "problems": problems,
            "count": len(problems)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/vehicle-issues/{vehicle_info}")
async def get_vehicle_specific_issues(vehicle_info: str):
    """
    Get common issues for a specific vehicle
    """
    try:
        issues = await knowledge_base.get_vehicle_specific_issues(vehicle_info)
        return {
            "vehicle": vehicle_info,
            "common_issues": issues,
            "count": len(issues)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/initialize-knowledge-base")
async def initialize_knowledge_base():
    """
    Initialize knowledge base with predefined solutions
    Run once on first setup
    """
    try:
        count = 0
        for solution_data in INITIAL_KNOWLEDGE:
            await knowledge_base.add_solution(**solution_data)
            count += 1
        
        return {
            "success": True,
            "message": f"تم تهيئة قاعدة المعرفة بـ {count} حل مسبق",
            "count": count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
