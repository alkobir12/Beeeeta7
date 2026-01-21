"""
خدمة القيود المحاسبية التلقائية
Automatic Accounting Entries Service
"""

from typing import List, Dict, Optional
from datetime import datetime
from models_financial import JournalEntry, JournalEntryLine, LinkedAccount

class AccountingService:
    """خدمة توليد القيود المحاسبية تلقائياً"""
    
    def __init__(self):
        # رموز الحسابات الافتراضية
        self.accounts = {
            'cash': {'id': 'ACC001', 'code': '1001', 'name': 'الصندوق'},
            'receivables': {'id': 'ACC002', 'code': '2001', 'name': 'حسابات العملاء'},
            'inventory': {'id': 'ACC003', 'code': '3001', 'name': 'مخزون قطع الغيار'},
            'service_revenue': {'id': 'ACC004', 'code': '4001', 'name': 'إيرادات خدمات الصيانة'},
            'parts_revenue': {'id': 'ACC005', 'code': '4002', 'name': 'إيرادات بيع قطع الغيار'},
            'cogs': {'id': 'ACC006', 'code': '5001', 'name': 'تكلفة قطع الغيار المباعة'},
            'salaries': {'id': 'ACC007', 'code': '5002', 'name': 'رواتب الموظفين'},
            'operating_expenses': {'id': 'ACC008', 'code': '5003', 'name': 'مصاريف التشغيل'},
            'payables': {'id': 'ACC009', 'code': '6001', 'name': 'حسابات الموردين'},
        }
    
    def generate_sale_entry(
        self, 
        operation: Dict,
        parts_cost: float = 0
    ) -> List[LinkedAccount]:
        """
        توليد قيد محاسبي لعملية بيع
        
        القيد:
        من ح/ الصندوق (أو حسابات العملاء)
            إلى ح/ إيرادات الخدمات
            إلى ح/ إيرادات قطع الغيار
            إلى ح/ ضريبة القيمة المضافة
        
        من ح/ تكلفة قطع الغيار المباعة
            إلى ح/ مخزون قطع الغيار
        """
        entries = []
        
        total = operation.get('total', 0)
        subtotal = operation.get('subtotal', total)
        tax = operation.get('tax', 0)
        payment_method = operation.get('paymentMethod', 'cash')
        payment_status = operation.get('paymentStatus', 'paid')
        
        # تحديد الحساب المدين (حسب طريقة الدفع)
        if payment_method == 'cash' and payment_status == 'paid':
            debit_account = self.accounts['cash']
        else:
            debit_account = self.accounts['receivables']
        
        # 1. الطرف المدين (الصندوق أو حسابات العملاء)
        entries.append(LinkedAccount(
            accountId=debit_account['id'],
            accountName=debit_account['name'],
            accountCode=debit_account['code'],
            debit=total,
            credit=0
        ))
        
        # حساب إيرادات الخدمات والقطع
        services_revenue = 0
        parts_revenue = 0
        
        for item in operation.get('items', []):
            item_type = item.get('itemType', item.get('type', 'part'))
            item_total = item.get('total', 0)
            
            if item_type == 'service':
                services_revenue += item_total
            else:
                parts_revenue += item_total
        
        # 2. الطرف الدائن - إيرادات الخدمات
        if services_revenue > 0:
            entries.append(LinkedAccount(
                accountId=self.accounts['service_revenue']['id'],
                accountName=self.accounts['service_revenue']['name'],
                accountCode=self.accounts['service_revenue']['code'],
                debit=0,
                credit=services_revenue
            ))
        
        # 3. الطرف الدائن - إيرادات قطع الغيار
        if parts_revenue > 0:
            entries.append(LinkedAccount(
                accountId=self.accounts['parts_revenue']['id'],
                accountName=self.accounts['parts_revenue']['name'],
                accountCode=self.accounts['parts_revenue']['code'],
                debit=0,
                credit=parts_revenue
            ))
        
        # 4. ضريبة القيمة المضافة (إذا كانت موجودة)
        if tax > 0:
            # ملاحظة: يمكن إضافة حساب منفصل للضريبة
            # لكن حالياً سنعتبرها جزء من الإيرادات الإجمالية
            pass
        
        # 5. قيد تكلفة البضاعة المباعة (إذا كان هناك قطع)
        if parts_cost > 0:
            entries.append(LinkedAccount(
                accountId=self.accounts['cogs']['id'],
                accountName=self.accounts['cogs']['name'],
                accountCode=self.accounts['cogs']['code'],
                debit=parts_cost,
                credit=0
            ))
            
            entries.append(LinkedAccount(
                accountId=self.accounts['inventory']['id'],
                accountName=self.accounts['inventory']['name'],
                accountCode=self.accounts['inventory']['code'],
                debit=0,
                credit=parts_cost
            ))
        
        return entries
    
    def generate_purchase_entry(self, operation: Dict) -> List[LinkedAccount]:
        """
        توليد قيد محاسبي لعملية شراء
        
        القيد:
        من ح/ مخزون قطع الغيار
            إلى ح/ الصندوق (أو حسابات الموردين)
        """
        entries = []
        
        total = operation.get('total', 0)
        payment_method = operation.get('paymentMethod', 'cash')
        payment_status = operation.get('paymentStatus', 'paid')
        
        # 1. الطرف المدين - المخزون
        entries.append(LinkedAccount(
            accountId=self.accounts['inventory']['id'],
            accountName=self.accounts['inventory']['name'],
            accountCode=self.accounts['inventory']['code'],
            debit=total,
            credit=0
        ))
        
        # 2. الطرف الدائن - الصندوق أو الموردين
        if payment_method == 'cash' and payment_status == 'paid':
            credit_account = self.accounts['cash']
        else:
            credit_account = self.accounts['payables']
        
        entries.append(LinkedAccount(
            accountId=credit_account['id'],
            accountName=credit_account['name'],
            accountCode=credit_account['code'],
            debit=0,
            credit=total
        ))
        
        return entries
    
    def generate_expense_entry(self, operation: Dict) -> List[LinkedAccount]:
        """
        توليد قيد محاسبي لمصروف
        
        القيد:
        من ح/ المصروف (حسب النوع)
            إلى ح/ الصندوق
        """
        entries = []
        
        total = operation.get('total', operation.get('amount', 0))
        category = operation.get('category', 'operating_expenses')
        
        # تحديد حساب المصروف
        if category in ['salary', 'salaries', 'رواتب']:
            expense_account = self.accounts['salaries']
        else:
            expense_account = self.accounts['operating_expenses']
        
        # 1. الطرف المدين - المصروف
        entries.append(LinkedAccount(
            accountId=expense_account['id'],
            accountName=expense_account['name'],
            accountCode=expense_account['code'],
            debit=total,
            credit=0
        ))
        
        # 2. الطرف الدائن - الصندوق
        entries.append(LinkedAccount(
            accountId=self.accounts['cash']['id'],
            accountName=self.accounts['cash']['name'],
            accountCode=self.accounts['cash']['code'],
            debit=0,
            credit=total
        ))
        
        return entries
    
    def generate_collection_entry(self, operation: Dict) -> List[LinkedAccount]:
        """
        توليد قيد محاسبي لتحصيل من عميل
        
        القيد:
        من ح/ الصندوق
            إلى ح/ حسابات العملاء
        """
        entries = []
        
        amount = operation.get('amount', operation.get('total', 0))
        
        # 1. الطرف المدين - الصندوق
        entries.append(LinkedAccount(
            accountId=self.accounts['cash']['id'],
            accountName=self.accounts['cash']['name'],
            accountCode=self.accounts['cash']['code'],
            debit=amount,
            credit=0
        ))
        
        # 2. الطرف الدائن - حسابات العملاء
        entries.append(LinkedAccount(
            accountId=self.accounts['receivables']['id'],
            accountName=self.accounts['receivables']['name'],
            accountCode=self.accounts['receivables']['code'],
            debit=0,
            credit=amount
        ))
        
        return entries
    
    def generate_payment_entry(self, operation: Dict) -> List[LinkedAccount]:
        """
        توليد قيد محاسبي لدفع لمورد
        
        القيد:
        من ح/ حسابات الموردين
            إلى ح/ الصندوق
        """
        entries = []
        
        amount = operation.get('amount', operation.get('total', 0))
        
        # 1. الطرف المدين - حسابات الموردين
        entries.append(LinkedAccount(
            accountId=self.accounts['payables']['id'],
            accountName=self.accounts['payables']['name'],
            accountCode=self.accounts['payables']['code'],
            debit=amount,
            credit=0
        ))
        
        # 2. الطرف الدائن - الصندوق
        entries.append(LinkedAccount(
            accountId=self.accounts['cash']['id'],
            accountName=self.accounts['cash']['name'],
            accountCode=self.accounts['cash']['code'],
            debit=0,
            credit=amount
        ))
        
        return entries
    
    def generate_journal_entry(
        self, 
        operation_type: str, 
        operation_data: Dict,
        parts_cost: float = 0
    ) -> List[LinkedAccount]:
        """
        توليد القيد المحاسبي حسب نوع العملية
        """
        
        if operation_type == 'sale':
            return self.generate_sale_entry(operation_data, parts_cost)
        elif operation_type == 'purchase':
            return self.generate_purchase_entry(operation_data)
        elif operation_type == 'expense':
            return self.generate_expense_entry(operation_data)
        elif operation_type == 'collection':
            return self.generate_collection_entry(operation_data)
        elif operation_type == 'payment':
            return self.generate_payment_entry(operation_data)
        else:
            return []
    
    def validate_entry(self, linked_accounts: List[LinkedAccount]) -> bool:
        """
        التحقق من توازن القيد (المدين = الدائن)
        """
        total_debit = sum(acc.debit for acc in linked_accounts)
        total_credit = sum(acc.credit for acc in linked_accounts)
        
        return abs(total_debit - total_credit) < 0.01  # تفاوت بسيط مسموح

# Instance واحدة للاستخدام
accounting_service = AccountingService()
