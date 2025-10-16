#!/usr/bin/env python3
"""
Specific tests for Budget Report and Customer Receipts APIs
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys
import os

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

BASE_URL = get_backend_url()
if not BASE_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

API_URL = f"{BASE_URL}/api"
print(f"🔗 Testing API at: {API_URL}")

class SpecificTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def test_budget_report_api(self):
        """Test Budget Report API with business account, transactions, and budget creation"""
        print("\n📊 Testing Budget Report API...")
        
        # Step 1: Create a business account
        account_data = {
            "name": "Test Budget Branch",
            "code": "TBB001",
            "currency": "SAR",
            "isActive": True
        }
        
        response = self.session.post(f"{API_URL}/biz-accounts", json=account_data)
        if response.status_code != 200:
            print(f"❌ Failed to create business account: {response.status_code} - {response.text}")
            return False
        
        account = response.json()
        account_id = account.get('id')
        print(f"✅ Created business account: {account_id}")

        # Step 2: Create transactions for that account (income and expense)
        current_month = datetime.now().strftime('%Y-%m')
        
        # Create income transactions
        income_transactions = [
            {
                "type": "income",
                "category": "service",
                "amount": 1500.0,
                "description": "Service income for budget test",
                "paymentMethod": "cash",
                "reference": "INC001",
                "accountId": account_id
            },
            {
                "type": "income", 
                "category": "parts",
                "amount": 800.0,
                "description": "Parts sales for budget test",
                "paymentMethod": "card",
                "reference": "INC002",
                "accountId": account_id
            }
        ]
        
        # Create expense transactions
        expense_transactions = [
            {
                "type": "expense",
                "category": "supplies",
                "amount": 500.0,
                "description": "Office supplies for budget test",
                "paymentMethod": "cash",
                "reference": "EXP001",
                "accountId": account_id
            },
            {
                "type": "expense",
                "category": "utilities",
                "amount": 300.0,
                "description": "Utilities for budget test",
                "paymentMethod": "bank",
                "reference": "EXP002",
                "accountId": account_id
            }
        ]
        
        # Post all transactions
        for tx in income_transactions + expense_transactions:
            response = self.session.post(f"{API_URL}/transactions", json=tx)
            if response.status_code != 200:
                print(f"❌ Failed to create transaction: {response.status_code} - {response.text}")
                return False
        
        print("✅ Created transactions")

        # Step 3: Create a budget for current month
        budget_data = {
            "accountId": account_id,
            "period": current_month,
            "incomeTarget": 3000.0,
            "expenseTarget": 1000.0,
            "notes": "Test budget for API testing"
        }
        
        response = self.session.post(f"{API_URL}/budgets", json=budget_data)
        if response.status_code != 200:
            print(f"❌ Failed to create budget: {response.status_code} - {response.text}")
            return False
        
        budget = response.json()
        budget_id = budget.get('id')
        print(f"✅ Created budget: {budget_id}")

        # Step 4: GET /api/budgets/{id}/report and verify values
        response = self.session.get(f"{API_URL}/budgets/{budget_id}/report")
        if response.status_code != 200:
            print(f"❌ Failed to get budget report: {response.status_code} - {response.text}")
            return False
        
        report = response.json()
        summary = report.get('summary', {})
        
        # Verify expected values
        expected_income = 2300.0  # 1500 + 800
        expected_expense = 800.0  # 500 + 300
        expected_profit = expected_income - expected_expense  # 1500
        
        income_actual = summary.get('incomeActual', 0)
        expense_actual = summary.get('expenseActual', 0)
        profit_actual = summary.get('profitActual', 0)
        income_pct = summary.get('incomeAchievedPct')
        expense_pct = summary.get('expenseAchievedPct')
        
        print(f"📊 Report Summary:")
        print(f"   Income Actual: {income_actual} (expected {expected_income})")
        print(f"   Expense Actual: {expense_actual} (expected {expected_expense})")
        print(f"   Profit Actual: {profit_actual} (expected {expected_profit})")
        print(f"   Income %: {income_pct}")
        print(f"   Expense %: {expense_pct}")
        
        if (abs(income_actual - expected_income) < 0.01 and 
            abs(expense_actual - expected_expense) < 0.01 and
            abs(profit_actual - expected_profit) < 0.01 and
            income_pct is not None and expense_pct is not None):
            print("✅ Budget Report JSON - PASS")
        else:
            print("❌ Budget Report JSON - FAIL")
            return False

        # Step 5: Request format=html and verify returns HTML string
        response = self.session.get(f"{API_URL}/budgets/{budget_id}/report?format=html")
        if response.status_code != 200:
            print(f"❌ Failed to get budget report HTML: {response.status_code} - {response.text}")
            return False
        
        html_content = response.text
        if (html_content.startswith('<!DOCTYPE html') and 
            'تقرير الميزانية' in html_content and
            'الإيرادات الفعلية' in html_content and
            'المصروفات الفعلية' in html_content):
            print("✅ Budget Report HTML - PASS")
        else:
            print("❌ Budget Report HTML - FAIL")
            print(f"HTML preview: {html_content[:200]}...")
            return False
        
        return True

    def test_customer_receipts_api(self):
        """Test Customer Receipts API with customer creation and transaction verification"""
        print("\n🧾 Testing Customer Receipts API...")
        
        # Step 1: Create a customer
        customer_data = {
            "name": "Khalid Al-Mansouri",
            "phone": "+966509876543",
            "email": "khalid.mansouri@email.com"
        }
        
        response = self.session.post(f"{API_URL}/customers", json=customer_data)
        if response.status_code != 200:
            print(f"❌ Failed to create customer: {response.status_code} - {response.text}")
            return False
        
        customer = response.json()
        customer_id = customer.get('id')
        print(f"✅ Created customer: {customer_id}")

        # Create a business account for optional accountId testing
        account_data = {
            "name": "Receipt Test Branch",
            "code": "RTB001", 
            "currency": "SAR",
            "isActive": True
        }
        
        response = self.session.post(f"{API_URL}/biz-accounts", json=account_data)
        account_id = None
        if response.status_code == 200:
            account = response.json()
            account_id = account.get('id')
            print(f"✅ Created business account: {account_id}")

        # Step 2: POST /api/customer-receipts with customerId and optional accountId
        receipt_data = {
            "customerId": customer_id,
            "accountId": account_id,  # Optional
            "amount": 750.0,
            "paymentMethod": "cash",
            "reference": "REC001",
            "notes": "Test customer receipt"
        }
        
        response = self.session.post(f"{API_URL}/customer-receipts", json=receipt_data)
        if response.status_code != 200:
            print(f"❌ Failed to create customer receipt: {response.status_code} - {response.text}")
            return False
        
        receipt = response.json()
        receipt_id = receipt.get('id')
        print(f"✅ Created customer receipt: {receipt_id}")

        # Step 3: GET /api/customer-receipts filtered by customer_id
        response = self.session.get(f"{API_URL}/customer-receipts?customer_id={customer_id}")
        if response.status_code != 200:
            print(f"❌ Failed to get customer receipts by customer_id: {response.status_code}")
            return False
        
        receipts = response.json()
        found_receipt = any(r.get('id') == receipt_id for r in receipts)
        if found_receipt:
            print("✅ Customer receipts filter by customer_id - PASS")
        else:
            print("❌ Customer receipts filter by customer_id - FAIL")
            return False

        # Step 4: GET /api/customer-receipts filtered by account_id (if account was created)
        if account_id:
            response = self.session.get(f"{API_URL}/customer-receipts?account_id={account_id}")
            if response.status_code != 200:
                print(f"❌ Failed to get customer receipts by account_id: {response.status_code}")
                return False
            
            receipts = response.json()
            found_receipt = any(r.get('id') == receipt_id for r in receipts)
            if found_receipt:
                print("✅ Customer receipts filter by account_id - PASS")
            else:
                print("❌ Customer receipts filter by account_id - FAIL")
                return False

        # Step 5: Verify a transaction with category=customer_receipt was created
        response = self.session.get(f"{API_URL}/transactions")
        if response.status_code != 200:
            print(f"❌ Failed to get transactions: {response.status_code}")
            return False
        
        tx_data = response.json()
        transactions = tx_data.get('transactions', []) if isinstance(tx_data, dict) else tx_data
        
        # Find transaction with category=customer_receipt and matching amount
        customer_receipt_tx = None
        for tx in transactions:
            if (tx.get('category') == 'customer_receipt' and 
                abs(tx.get('amount', 0) - 750.0) < 0.01 and
                tx.get('type') == 'income'):
                customer_receipt_tx = tx
                break
        
        if customer_receipt_tx:
            # Verify it has the correct accountId if provided
            tx_account_id = customer_receipt_tx.get('accountId')
            print(f"📊 Transaction found: accountId={tx_account_id}, expected={account_id}")
            
            if account_id and tx_account_id == account_id:
                print("✅ Customer receipt transaction verification - PASS")
            elif not account_id and not tx_account_id:
                print("✅ Customer receipt transaction verification - PASS")
            else:
                print("❌ Customer receipt transaction verification - FAIL (accountId mismatch)")
                return False
        else:
            print("❌ Customer receipt transaction verification - FAIL (no transaction found)")
            return False
        
        return True

    def run_tests(self):
        """Run the specific tests"""
        print("🚀 Testing Budget Report and Customer Receipts APIs")
        print("=" * 60)
        
        # Test API health first
        try:
            response = self.session.get(f"{API_URL}/")
            if response.status_code != 200:
                print(f"❌ API Health Check failed: {response.status_code}")
                return False
            print("✅ API Health Check")
        except Exception as e:
            print(f"❌ API Health Check failed: {e}")
            return False
        
        # Run tests
        budget_pass = self.test_budget_report_api()
        receipts_pass = self.test_customer_receipts_api()
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        if budget_pass and receipts_pass:
            print("✅ All tests PASSED")
            return True
        else:
            print("❌ Some tests FAILED")
            if not budget_pass:
                print("  • Budget Report API - FAILED")
            if not receipts_pass:
                print("  • Customer Receipts API - FAILED")
            return False

if __name__ == "__main__":
    tester = SpecificTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)