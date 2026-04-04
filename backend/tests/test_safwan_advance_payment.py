"""
Test Safwan Customer Advance Payment (دفعة مقدمة)
Verifies that advance payments from visit_payment source appear correctly
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestSafwanAdvancePayment:
    """Test صفوان customer has دفعة مقدمة in movements"""

    def test_safwan_customer_exists(self):
        """Test صفوان ناصر السكاكر customer exists"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        safwan_customers = [c for c in data if 'صفوان' in c.get('name', '')]
        assert len(safwan_customers) >= 1, "صفوان customer not found"
        
        safwan = safwan_customers[0]
        print(f"✅ Found صفوان customer: {safwan['name']} (ID: {safwan['id']})")
        return safwan

    def test_safwan_has_advance_payment(self):
        """Test صفوان has دفعة مقدمة in movements"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        safwan_customers = [c for c in data if 'صفوان' in c.get('name', '')]
        assert len(safwan_customers) >= 1, "صفوان customer not found"
        
        safwan = safwan_customers[0]
        movements = safwan.get('movements', [])
        
        # Find دفعة مقدمة movement
        advance_payments = [m for m in movements if m.get('label') == 'دفعة مقدمة']
        assert len(advance_payments) >= 1, "No دفعة مقدمة found in صفوان movements"
        
        advance = advance_payments[0]
        print(f"✅ Found دفعة مقدمة: amount={advance['amount']}, source={advance['source']}")
        
        # Verify advance payment structure
        assert advance['source'] == 'visit_payment', f"Expected source='visit_payment', got '{advance['source']}'"
        assert advance['direction'] == 'credit', f"Expected direction='credit', got '{advance['direction']}'"
        assert 'visitId' in advance, "Missing visitId in advance payment"
        assert 'vehicleId' in advance, "Missing vehicleId in advance payment"
        assert 'flow' in advance, "Missing flow in advance payment"
        assert 'flowLabel' in advance, "Missing flowLabel in advance payment"
        
        print(f"✅ Advance payment has all required fields: visitId={advance['visitId'][:8]}...")

    def test_safwan_movements_have_flow_fields(self):
        """Test all صفوان movements have flow/flowLabel/visitId/vehicleId"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        safwan_customers = [c for c in data if 'صفوان' in c.get('name', '')]
        assert len(safwan_customers) >= 1
        
        safwan = safwan_customers[0]
        movements = safwan.get('movements', [])
        
        required_fields = ['flow', 'flowLabel', 'visitId', 'vehicleId']
        
        for movement in movements:
            for field in required_fields:
                assert field in movement, f"Movement {movement.get('id')} missing '{field}'"
            
            # Validate flow values
            assert movement['flow'] in ['in', 'out'], f"Invalid flow: {movement['flow']}"
            assert movement['flowLabel'] in ['داخل', 'خارج'], f"Invalid flowLabel: {movement['flowLabel']}"
        
        print(f"✅ All {len(movements)} movements have flow/flowLabel/visitId/vehicleId")

    def test_safwan_financial_summary(self):
        """Test صفوان has correct financial summary"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        safwan_customers = [c for c in data if 'صفوان' in c.get('name', '')]
        assert len(safwan_customers) >= 1
        
        safwan = safwan_customers[0]
        
        # Verify financial fields exist
        financial_fields = ['debitBalance', 'creditBalance', 'overdueBalance', 'ajelBalance', 'settledAmount']
        for field in financial_fields:
            assert field in safwan, f"Missing financial field: {field}"
        
        # Verify credit balance includes advance payment
        assert safwan['creditBalance'] > 0, "creditBalance should be > 0 (has advance payment)"
        
        print(f"✅ صفوان financial summary: debit={safwan['debitBalance']}, credit={safwan['creditBalance']}, net={safwan.get('netBalance', 'N/A')}")


class TestAdvancePaymentSource:
    """Test visit_payment source movements"""

    def test_visit_payment_movements_exist(self):
        """Test that visit_payment source movements exist in customers"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        visit_payment_movements = []
        for customer in data:
            for movement in customer.get('movements', []):
                if movement.get('source') == 'visit_payment':
                    visit_payment_movements.append({
                        'customer': customer['name'],
                        'label': movement['label'],
                        'amount': movement['amount']
                    })
        
        print(f"✅ Found {len(visit_payment_movements)} visit_payment movements")
        for m in visit_payment_movements[:5]:
            print(f"   - {m['customer']}: {m['label']} = {m['amount']}")

    def test_advance_payment_label_correct(self):
        """Test دفعة مقدمة label is used for advance payments"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"workshop_id": WORKSHOP_ID})
        assert response.status_code == 200
        data = response.json()
        
        advance_payments = []
        for customer in data:
            for movement in customer.get('movements', []):
                if movement.get('label') == 'دفعة مقدمة':
                    advance_payments.append({
                        'customer': customer['name'],
                        'source': movement['source'],
                        'amount': movement['amount']
                    })
        
        assert len(advance_payments) >= 1, "No دفعة مقدمة movements found"
        
        # All advance payments should be from visit_payment source
        for ap in advance_payments:
            assert ap['source'] == 'visit_payment', f"Advance payment should be from visit_payment, got {ap['source']}"
        
        print(f"✅ Found {len(advance_payments)} دفعة مقدمة movements, all from visit_payment source")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
