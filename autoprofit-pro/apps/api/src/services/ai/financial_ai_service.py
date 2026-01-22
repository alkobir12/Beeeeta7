"""
OpenAI Integration Service for Financial AI Analysis
"""
import os
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage


class FinancialAIService:
    """AI-powered financial analysis service using OpenAI GPT-5.2"""
    
    def __init__(self):
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
    
    def _create_chat(self, session_id: str, system_message: str) -> LlmChat:
        """Create a new chat instance with OpenAI GPT-5.2"""
        chat = LlmChat(
            api_key=self.api_key,
            session_id=session_id,
            system_message=system_message
        )
        chat.with_model("openai", "gpt-5.2")
        return chat
    
    async def analyze_balance_sheet(
        self,
        balance_sheet_data: Dict[str, Any],
        workshop_id: str,
        question: Optional[str] = None
    ) -> Dict[str, Any]:
        """Analyze balance sheet and provide insights"""
        
        system_message = """أنت محلل مالي خبير متخصص في ورش السيارات والأعمال التجارية الصغيرة في المملكة العربية السعودية.
        مهمتك تحليل الميزانية العمومية وتقديم رؤى مالية واضحة ومفيدة باللغة العربية.
        قدم تحليلاً عملياً يساعد صاحب الورشة على اتخاذ قرارات مالية أفضل.
        كن محدداً في نصائحك واقتراحاتك."""
        
        chat = self._create_chat(
            session_id=f"balance-sheet-{workshop_id}",
            system_message=system_message
        )
        
        prompt = f"""حلل الميزانية العمومية التالية:

بيانات الميزانية:
- إجمالي الأصول: {balance_sheet_data.get('assets', {}).get('total', 0)} ريال
- الأصول المتداولة: {sum(item.get('amount', 0) for item in balance_sheet_data.get('assets', {}).get('current_assets', []))} ريال
- الأصول الثابتة: {sum(item.get('amount', 0) for item in balance_sheet_data.get('assets', {}).get('fixed_assets', []))} ريال
- إجمالي الخصوم: {balance_sheet_data.get('liabilities', {}).get('total', 0)} ريال
- حقوق الملكية: {balance_sheet_data.get('equity', {}).get('total', 0)} ريال

{f'سؤال محدد: {question}' if question else ''}

قدم تحليلاً يشمل:
1. تقييم الوضع المالي العام
2. نسب السيولة والملاءة المالية
3. نقاط القوة والضعف
4. توصيات عملية للتحسين
5. مخاطر يجب الانتباه لها"""

        try:
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            return {
                "success": True,
                "analysis": response,
                "recommendations": self._extract_recommendations(response)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "analysis": None,
                "recommendations": []
            }
    
    async def analyze_income_statement(
        self,
        income_data: Dict[str, Any],
        workshop_id: str,
        period: str,
        question: Optional[str] = None
    ) -> Dict[str, Any]:
        """Analyze income statement and provide insights"""
        
        system_message = """أنت محلل مالي خبير متخصص في تحليل قوائم الدخل لورش السيارات.
        قدم تحليلاً شاملاً للأداء المالي مع التركيز على هوامش الربح والتكاليف.
        استخدم اللغة العربية وقدم نصائح عملية."""
        
        chat = self._create_chat(
            session_id=f"income-statement-{workshop_id}",
            system_message=system_message
        )
        
        prompt = f"""حلل قائمة الدخل التالية للفترة {period}:

- إجمالي الإيرادات: {sum(item.get('amount', 0) for item in income_data.get('revenues', []))} ريال
- تكلفة المبيعات: {sum(item.get('amount', 0) for item in income_data.get('cost_of_goods_sold', []))} ريال
- مجمل الربح: {income_data.get('gross_profit', 0)} ريال
- المصروفات التشغيلية: {sum(item.get('amount', 0) for item in income_data.get('operating_expenses', []))} ريال
- الربح التشغيلي: {income_data.get('operating_income', 0)} ريال
- صافي الدخل: {income_data.get('net_income', 0)} ريال

{f'سؤال محدد: {question}' if question else ''}

قدم تحليلاً يشمل:
1. تقييم الربحية وهوامش الربح
2. تحليل التكاليف وفرص التخفيض
3. مقارنة بمعايير الصناعة
4. توصيات لزيادة الإيرادات
5. استراتيجيات لتحسين الربحية"""

        try:
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            return {
                "success": True,
                "analysis": response,
                "recommendations": self._extract_recommendations(response)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "analysis": None,
                "recommendations": []
            }
    
    async def get_financial_recommendations(
        self,
        workshop_id: str,
        financial_summary: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get AI-powered financial recommendations"""
        
        system_message = """أنت مستشار مالي متخصص في ورش السيارات.
        قدم توصيات عملية ومحددة يمكن تنفيذها فوراً.
        رتب التوصيات حسب الأولوية والتأثير المتوقع."""
        
        chat = self._create_chat(
            session_id=f"recommendations-{workshop_id}",
            system_message=system_message
        )
        
        prompt = f"""بناءً على الملخص المالي التالي، قدم توصيات عملية:

الملخص المالي:
- إجمالي الإيرادات: {financial_summary.get('total_revenue', 0)} ريال
- إجمالي المصروفات: {financial_summary.get('total_expenses', 0)} ريال
- صافي الربح: {financial_summary.get('net_profit', 0)} ريال
- الفواتير المعلقة: {financial_summary.get('pending_invoices', 0)} فاتورة
- المبالغ المعلقة: {financial_summary.get('pending_amount', 0)} ريال

قدم 5 توصيات عملية بالتنسيق التالي لكل توصية:
[نوع: insight/warning/recommendation]
[الأولوية: high/medium/low]
[العنوان: عنوان قصير]
[الوصف: شرح مفصل للتوصية وكيفية تنفيذها]"""

        try:
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            return self._parse_recommendations(response)
        except Exception as e:
            return [{
                "type": "warning",
                "title": "خطأ في التحليل",
                "description": f"تعذر الحصول على التوصيات: {str(e)}",
                "priority": "low"
            }]
    
    async def answer_financial_question(
        self,
        question: str,
        context: Dict[str, Any],
        workshop_id: str
    ) -> str:
        """Answer a specific financial question with context"""
        
        system_message = """أنت مساعد مالي ذكي متخصص في ورش السيارات.
        أجب على الأسئلة المالية بشكل واضح ومفيد باللغة العربية.
        استخدم البيانات المتاحة لتقديم إجابات دقيقة."""
        
        chat = self._create_chat(
            session_id=f"qa-{workshop_id}",
            system_message=system_message
        )
        
        context_str = "\n".join([f"- {k}: {v}" for k, v in context.items()])
        
        prompt = f"""السياق المالي:
{context_str}

السؤال: {question}

قدم إجابة واضحة ومفيدة."""

        try:
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            return response
        except Exception as e:
            return f"عذراً، تعذرت الإجابة على سؤالك: {str(e)}"
    
    def _extract_recommendations(self, analysis: str) -> List[Dict[str, Any]]:
        """Extract structured recommendations from analysis text"""
        recommendations = []
        
        # Simple extraction - look for numbered recommendations
        lines = analysis.split('\n')
        current_rec = None
        
        for line in lines:
            line = line.strip()
            if any(line.startswith(f"{i}.") or line.startswith(f"{i}-") for i in range(1, 10)):
                if current_rec:
                    recommendations.append(current_rec)
                current_rec = {
                    "type": "recommendation",
                    "title": line[2:].strip()[:50],
                    "description": line[2:].strip(),
                    "priority": "medium"
                }
            elif current_rec and line:
                current_rec["description"] += " " + line
        
        if current_rec:
            recommendations.append(current_rec)
        
        # Assign priorities based on keywords
        priority_keywords = {
            "high": ["فوراً", "عاجل", "ضروري", "مهم جداً", "خطر"],
            "low": ["لاحقاً", "مستقبلاً", "تدريجياً", "بسيط"]
        }
        
        for rec in recommendations:
            desc_lower = rec["description"].lower()
            for priority, keywords in priority_keywords.items():
                if any(kw in desc_lower for kw in keywords):
                    rec["priority"] = priority
                    break
        
        return recommendations[:5]  # Limit to 5 recommendations
    
    def _parse_recommendations(self, response: str) -> List[Dict[str, Any]]:
        """Parse structured recommendations from response"""
        recommendations = []
        
        # Try to parse structured format
        current_rec = {}
        for line in response.split('\n'):
            line = line.strip()
            if line.startswith('[نوع:'):
                if current_rec:
                    recommendations.append(current_rec)
                current_rec = {"type": line.split(':')[1].strip().rstrip(']')}
            elif line.startswith('[الأولوية:'):
                current_rec["priority"] = line.split(':')[1].strip().rstrip(']')
            elif line.startswith('[العنوان:'):
                current_rec["title"] = line.split(':')[1].strip().rstrip(']')
            elif line.startswith('[الوصف:'):
                current_rec["description"] = line.split(':')[1].strip().rstrip(']')
        
        if current_rec and "title" in current_rec:
            recommendations.append(current_rec)
        
        # Fallback: extract from numbered list
        if not recommendations:
            recommendations = self._extract_recommendations(response)
        
        # Ensure all fields exist
        for rec in recommendations:
            rec.setdefault("type", "recommendation")
            rec.setdefault("priority", "medium")
            rec.setdefault("title", "توصية")
            rec.setdefault("description", "")
        
        return recommendations


# Singleton instance
_ai_service: Optional[FinancialAIService] = None


def get_ai_service() -> FinancialAIService:
    """Get or create AI service instance"""
    global _ai_service
    if _ai_service is None:
        _ai_service = FinancialAIService()
    return _ai_service
