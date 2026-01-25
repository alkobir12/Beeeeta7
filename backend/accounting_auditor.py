import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import json
import re

class AccountingSystemAuditor:
    """
    مدقق النظام المحاسبي للخدمات - يركز على الاختبار والتدقيق والتصحيح
    """
    
    def __init__(self, system_name="نظام محاسبي للخدمات"):
        self.system_name = system_name
        self.audit_log = []
        self.corrections_needed = []
        self.missing_items = []
        self.system_health_score = 100
        self.detected_issues = []
        
    def log_audit(self, message: str, status: str = "INFO"):
        """تسجيل رسائل التدقيق"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{status}] {message}"
        self.audit_log.append(log_entry)
        
        if status == "ERROR":
            self.system_health_score -= 10
            self.detected_issues.append(message)
        elif status == "WARNING":
            self.system_health_score -= 5
            self.detected_issues.append(message)
        
        return log_entry
    
    def check_accounting_equation(self, assets: float, liabilities: float, equity: float) -> Tuple[bool, str]:
        """
        التحقق من معادلة المحاسبة الأساسية
        """
        try:
            total_liabilities_equity = liabilities + equity
            
            if abs(assets - total_liabilities_equity) < 0.01:
                msg = self.log_audit("✅ معادلة المحاسبة متوازنة: الأصول = الخصوم + حقوق الملكية", "SUCCESS")
                return True, "متوازن"
            else:
                imbalance = assets - total_liabilities_equity
                correction = f"تحتاج تصحيح بمقدار: {abs(imbalance):,.2f} ريال"
                
                if imbalance > 0:
                    suggestion = "اقتراح: زيادة حقوق الملكية أو الخصوم"
                else:
                    suggestion = "اقتراح: زيادة الأصول"
                
                msg = self.log_audit(
                    f"❌ الميزانية غير متوازنة: الأصول ({assets:,.2f}) ≠ الخصوم+الملكية ({total_liabilities_equity:,.2f})",
                    "ERROR"
                )
                self.corrections_needed.append({
                    "issue": "عدم توازن الميزانية",
                    "amount": imbalance,
                    "correction": correction,
                    "suggestion": suggestion
                })
                return False, f"غير متوازن - {correction}"
                
        except Exception as e:
            msg = self.log_audit(f"❌ خطأ في فحص معادلة المحاسبة: {str(e)}", "ERROR")
            return False, f"خطأ: {str(e)}"
    
    def analyze_financial_statements_consistency(self, 
                                                 balance_sheet: Dict,
                                                 income_statement: Dict,
                                                 cash_flow: Dict) -> Dict:
        """
        تحليل اتساق القوائم المالية مع بعضها
        """
        consistency_report = {
            "issues": [],
            "warnings": [],
            "recommendations": []
        }
        
        try:
            # التحقق من ارتباط صافي الربح بحقوق الملكية
            if 'net_profit' in income_statement and 'equity' in balance_sheet:
                net_profit = income_statement.get('net_profit', 0)
                
                if net_profit > balance_sheet.get('equity', 0) * 10:
                    consistency_report["warnings"].append(
                        "صافي الربح كبير جداً مقارنة بحقوق الملكية - تحقق من صحة التسجيلات"
                    )
                    self.log_audit("⚠️ صافي الربح كبير جداً مقارنة بحقوق الملكية", "WARNING")
            
            # التحقق من الربحية غير العادية
            if 'revenue' in income_statement and 'expenses' in income_statement:
                revenue = income_statement.get('revenue', 0)
                expenses = income_statement.get('expenses', 0)
                
                if revenue > 0 and expenses > 0:
                    profit_margin = (revenue - expenses) / revenue * 100
                    
                    if profit_margin > 95:
                        consistency_report["issues"].append(
                            f"هامش ربح غير واقعي: {profit_margin:.1f}%"
                        )
                        self.corrections_needed.append({
                            "issue": "هامش ربح غير واقعي",
                            "details": f"هامش الربح {profit_margin:.1f}% مرتفع جداً",
                            "suggestion": "تحقق من تسجيل جميع المصروفات"
                        })
                    
                    elif profit_margin < 0:
                        consistency_report["issues"].append(
                            f"خسارة: هامش ربح سلبي {profit_margin:.1f}%"
                        )
            
            if not consistency_report["issues"]:
                consistency_report["recommendations"].append("القوائم المالية متسقة بشكل عام")
                self.log_audit("✅ القوائم المالية متسقة مع بعضها", "SUCCESS")
            
        except Exception as e:
            self.log_audit(f"❌ خطأ في تحليل اتساق القوائم: {str(e)}", "ERROR")
        
        return consistency_report
    
    def run_comprehensive_audit(self, financial_data: Dict) -> Dict:
        """
        تشغيل تدقيق شامل للنظام المحاسبي
        """
        audit_report = {
            "audit_date": datetime.now().isoformat(),
            "system_name": self.system_name,
            "health_score": 100,
            "summary": {},
            "details": {},
            "correction_plan": {}
        }
        
        try:
            # 1. فحص الميزانية
            if 'balance_sheet' in financial_data:
                bs = financial_data['balance_sheet']
                balance_result, balance_message = self.check_accounting_equation(
                    bs.get('assets', 0),
                    bs.get('liabilities', 0),
                    bs.get('equity', 0)
                )
                audit_report["details"]["balance_sheet_check"] = {
                    "result": balance_result,
                    "message": balance_message
                }
            
            # 2. تحليل اتساق القوائم
            if all(key in financial_data for key in ['balance_sheet', 'income_statement', 'cash_flow']):
                consistency = self.analyze_financial_statements_consistency(
                    financial_data['balance_sheet'],
                    financial_data['income_statement'],
                    financial_data['cash_flow']
                )
                audit_report["details"]["consistency_analysis"] = consistency
            
            # 3. حساب درجة الصحة النهائية
            audit_report["health_score"] = max(0, min(100, self.system_health_score))
            
            # 4. إنشاء الملخص
            audit_report["summary"] = {
                "total_issues": len(self.detected_issues),
                "corrections_needed": len(self.corrections_needed),
                "missing_items": len(self.missing_items),
                "audit_log_entries": len(self.audit_log),
                "final_verdict": self.get_final_verdict()
            }
            
            audit_report["corrections_needed"] = self.corrections_needed
            audit_report["audit_log"] = self.audit_log
            
        except Exception as e:
            error_msg = f"❌ خطأ في التدقيق الشامل: {str(e)}"
            self.log_audit(error_msg, "ERROR")
            audit_report["error"] = error_msg
        
        return audit_report
    
    def get_final_verdict(self) -> str:
        """الحكم النهائي على حالة النظام"""
        if self.system_health_score >= 90:
            return "✅ النظام يعمل بشكل جيد مع تحسينات طفيفة مطلوبة"
        elif self.system_health_score >= 70:
            return "⚠️ النظام يعمل لكن يحتاج تصحيحات"
        elif self.system_health_score >= 50:
            return "🔶 النظام يحتاج مراجعة شاملة"
        else:
            return "❌ النظام يحتاج إعادة هيكلة"
