"""
خدمة التحليلات المالية المتقدمة
Advanced Financial Analytics Service
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

class FinancialAnalytics:
    """تحليلات مالية متقدمة"""
    
    def __init__(self):
        pass
    
    def calculate_financial_ratios(
        self,
        assets: float,
        current_assets: float,
        inventory: float,
        liabilities: float,
        current_liabilities: float,
        revenue: float,
        expenses: float,
        cogs: float
    ) -> Dict:
        """
        حساب النسب المالية
        """
        
        # نسبة التداول = الأصول المتداولة / الالتزامات المتداولة
        current_ratio = current_assets / current_liabilities if current_liabilities > 0 else 0
        
        # النسبة السريعة = (الأصول المتداولة - المخزون) / الالتزامات المتداولة
        quick_ratio = (current_assets - inventory) / current_liabilities if current_liabilities > 0 else 0
        
        # هامش الربح الإجمالي = (الإيرادات - تكلفة البضاعة المباعة) / الإيرادات
        gross_margin = ((revenue - cogs) / revenue * 100) if revenue > 0 else 0
        
        # هامش الربح الصافي = (الإيرادات - المصروفات) / الإيرادات
        net_margin = ((revenue - expenses) / revenue * 100) if revenue > 0 else 0
        
        # معدل دوران المخزون = تكلفة البضاعة المباعة / متوسط المخزون
        inventory_turnover = cogs / inventory if inventory > 0 else 0
        
        # نسبة الدين = الالتزامات / الأصول
        debt_ratio = (liabilities / assets * 100) if assets > 0 else 0
        
        return {
            "current_ratio": round(current_ratio, 2),
            "quick_ratio": round(quick_ratio, 2),
            "gross_margin": round(gross_margin, 2),
            "net_margin": round(net_margin, 2),
            "inventory_turnover": round(inventory_turnover, 2),
            "debt_ratio": round(debt_ratio, 2)
        }
    
    def analyze_operations(
        self,
        operations: List[Dict],
        parts: List[Dict],
        services: List[Dict],
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict:
        """
        تحليل العمليات والإيرادات
        """
        
        # إذا لم يُحدد تاريخ، استخدم آخر 30 يوم
        if not date_to:
            date_to = datetime.now()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        # تصفية العمليات حسب التاريخ
        filtered_ops = []
        for op in operations:
            op_date = op.get('date')
            if isinstance(op_date, str):
                op_date = datetime.fromisoformat(op_date.replace('Z', '+00:00'))
            elif not isinstance(op_date, datetime):
                continue
            
            if date_from <= op_date <= date_to:
                filtered_ops.append(op)
        
        # حساب الإيرادات والمصروفات
        total_revenue = 0
        total_expenses = 0
        services_revenue = defaultdict(lambda: {'name': '', 'revenue': 0, 'count': 0})
        parts_revenue = defaultdict(lambda: {'name': '', 'revenue': 0, 'quantity': 0})
        
        for op in filtered_ops:
            op_type = op.get('type', '')
            
            if op_type in ['sale', 'income']:
                total_revenue += op.get('total', 0)
                
                # تحليل البنود
                for item in op.get('items', []):
                    item_type = item.get('itemType', item.get('type', 'part'))
                    item_name = item.get('itemName', item.get('name', ''))
                    item_total = item.get('total', 0)
                    item_qty = item.get('quantity', 1)
                    
                    if item_type == 'service':
                        services_revenue[item_name]['name'] = item_name
                        services_revenue[item_name]['revenue'] += item_total
                        services_revenue[item_name]['count'] += 1
                    else:
                        parts_revenue[item_name]['name'] = item_name
                        parts_revenue[item_name]['revenue'] += item_total
                        parts_revenue[item_name]['quantity'] += item_qty
            
            elif op_type in ['expense', 'purchase']:
                total_expenses += op.get('total', op.get('amount', 0))
        
        # ترتيب Top Services
        top_services = sorted(
            services_revenue.values(),
            key=lambda x: x['revenue'],
            reverse=True
        )[:5]
        
        # ترتيب Top Parts
        top_parts = sorted(
            parts_revenue.values(),
            key=lambda x: x['revenue'],
            reverse=True
        )[:5]
        
        return {
            'total_revenue': round(total_revenue, 2),
            'total_expenses': round(total_expenses, 2),
            'net_profit': round(total_revenue - total_expenses, 2),
            'operations_count': len(filtered_ops),
            'top_services': top_services,
            'top_parts': top_parts,
            'date_from': date_from.strftime('%Y-%m-%d'),
            'date_to': date_to.strftime('%Y-%m-%d')
        }
    
    def generate_analytics_report(
        self,
        operations: List[Dict],
        accounts: List[Dict],
        parts: List[Dict],
        services: List[Dict],
        customers: List[Dict],
        suppliers: List[Dict]
    ) -> Dict:
        """
        توليد تقرير تحليلي شامل
        """
        
        # حساب الأرصدة
        cash_balance = sum(a['balance'] for a in accounts if a['code'] == '1001')
        receivables = sum(a['balance'] for a in accounts if a['code'] == '2001')
        inventory_value = sum(a['balance'] for a in accounts if a['code'] == '3001')
        payables = sum(a['balance'] for a in accounts if a['code'] == '6001')
        
        # تحليل العمليات
        ops_analysis = self.analyze_operations(operations, parts, services)
        
        # حساب النسب المالية
        total_assets = sum(a['balance'] for a in accounts if a['type'] == 'asset')
        total_liabilities = sum(a['balance'] for a in accounts if a['type'] == 'liability')
        current_assets = cash_balance + receivables + inventory_value
        current_liabilities = payables
        
        revenue = sum(a['balance'] for a in accounts if a['type'] == 'revenue')
        expenses_total = sum(a['balance'] for a in accounts if a['type'] == 'expense')
        cogs = sum(a['balance'] for a in accounts if a['code'] == '5001')
        
        financial_ratios = self.calculate_financial_ratios(
            assets=total_assets,
            current_assets=current_assets,
            inventory=inventory_value,
            liabilities=total_liabilities,
            current_liabilities=current_liabilities,
            revenue=revenue,
            expenses=expenses_total,
            cogs=cogs
        )
        
        return {
            'date_range': f"{ops_analysis['date_from']} إلى {ops_analysis['date_to']}",
            'total_revenue': ops_analysis['total_revenue'],
            'total_expenses': ops_analysis['total_expenses'],
            'net_profit': ops_analysis['net_profit'],
            'cash_balance': cash_balance,
            'customer_receivables': receivables,
            'supplier_payables': payables,
            'inventory_value': inventory_value,
            'top_services': ops_analysis['top_services'],
            'top_parts': ops_analysis['top_parts'],
            'financial_ratios': financial_ratios
        }

# Instance للاستخدام
financial_analytics = FinancialAnalytics()
