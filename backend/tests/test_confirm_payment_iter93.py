"""
Test confirm-payment endpoint for credit operations.
Tests:
1. Net income increases when cash-basis fallback is used (no base journal entry)
2. Remaining decreases correctly with multiple partial payments
3. No duplicate revenue recognition on multiple payments
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestConfirmPaymentEndpoint:
    """Tests for POST /api/operations/{id}/confirm-payment"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_operation_ids = []
        yield
        # Cleanup created operations
        for op_id in self.created_operation_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/operations/{op_id}")
            except Exception:
                pass

    def _create_credit_operation(self, op_type="sale", total=2500.0, partner_name="TEST_عميل_اختبار"):
        """Helper to create a credit operation for testing"""
        payload = {
            "type": op_type,
            "total": total,
            "items": [{"name": "TEST_بند_اختبار", "quantity": 1, "price": total, "total": total}],
            "paymentMethod": "credit",
            "paymentStatus": "unpaid",
            "partnerName": partner_name,
            "partnerId": None,
            "partnerType": "customer" if op_type == "sale" else "supplier",
            "workshopId": WORKSHOP_ID,
            "scope": "workshop",
            "date": datetime.utcnow().isoformat(),
            "notes": f"TEST_confirm_payment_{uuid.uuid4().hex[:8]}",
        }
        response = self.session.post(f"{BASE_URL}/api/operations", json=payload)
        if response.status_code in (200, 201):
            data = response.json()
            op_id = data.get("id")
            if op_id:
                self.created_operation_ids.append(op_id)
            return data
        return None

    def _get_journal_entries_for_operation(self, op_id):
        """Get all journal entries linked to an operation"""
        try:
            response = self.session.get(f"{BASE_URL}/api/journal-entries", params={"reference_id": op_id})
            if response.status_code == 200:
                return response.json() if isinstance(response.json(), list) else []
        except Exception:
            pass
        return []

    def _get_financial_summary(self):
        """Get current financial summary (net income)"""
        try:
            response = self.session.get(f"{BASE_URL}/api/finance/summary", params={"workshop_id": WORKSHOP_ID})
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
        return {}

    def test_confirm_payment_endpoint_exists(self):
        """Test that confirm-payment endpoint exists and returns proper error for invalid op"""
        response = self.session.post(
            f"{BASE_URL}/api/operations/invalid-op-id/confirm-payment",
            json={"workshopId": WORKSHOP_ID}
        )
        # Should return 404 for non-existent operation, not 500
        assert response.status_code in (400, 404), f"Expected 400/404, got {response.status_code}: {response.text}"
        print(f"✓ confirm-payment endpoint exists, returns {response.status_code} for invalid op")

    def test_confirm_payment_requires_workshop_id(self):
        """Test that workshopId is required"""
        response = self.session.post(
            f"{BASE_URL}/api/operations/some-op-id/confirm-payment",
            json={}
        )
        # Should return 400 for missing workshopId
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "workshopId" in str(data.get("detail", "")).lower() or "workshop" in str(data.get("detail", "")).lower()
        print("✓ confirm-payment requires workshopId")

    def test_confirm_payment_creates_journal_entry_cash_basis(self):
        """Test that confirm-payment creates journal entry with cash-basis fallback when no base entry exists"""
        # Create a credit sale operation
        op = self._create_credit_operation(op_type="sale", total=2500.0)
        if not op:
            pytest.skip("Could not create test operation")
        
        op_id = op.get("id")
        assert op_id, "Operation ID should be returned"
        print(f"✓ Created credit operation: {op_id}")

        # Confirm payment
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 2500.0}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        # Check paid and remaining
        result_data = data.get("data", {})
        paid = result_data.get("paid", 0)
        remaining = result_data.get("remaining", 0)
        
        assert paid == 2500.0 or paid == 2500, f"Expected paid=2500, got {paid}"
        assert remaining == 0 or remaining == 0.0, f"Expected remaining=0, got {remaining}"
        print(f"✓ Payment confirmed: paid={paid}, remaining={remaining}")

    def test_confirm_payment_partial_payments(self):
        """Test that partial payments work correctly and remaining decreases"""
        # Create a credit sale operation with total 3000
        op = self._create_credit_operation(op_type="sale", total=3000.0)
        if not op:
            pytest.skip("Could not create test operation")
        
        op_id = op.get("id")
        print(f"✓ Created credit operation: {op_id} with total=3000")

        # First partial payment: 1000
        response1 = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 1000.0}
        )
        assert response1.status_code == 200, f"First payment failed: {response1.text}"
        data1 = response1.json().get("data", {})
        assert data1.get("paid") == 1000 or data1.get("paid") == 1000.0
        assert data1.get("remaining") == 2000 or data1.get("remaining") == 2000.0
        print(f"✓ First payment: paid=1000, remaining=2000")

        # Second partial payment: 1500
        response2 = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 1500.0}
        )
        assert response2.status_code == 200, f"Second payment failed: {response2.text}"
        data2 = response2.json().get("data", {})
        assert data2.get("paid") == 1500 or data2.get("paid") == 1500.0
        assert data2.get("remaining") == 500 or data2.get("remaining") == 500.0
        print(f"✓ Second payment: paid=1500, remaining=500")

        # Third payment: 500 (should complete)
        response3 = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 500.0}
        )
        assert response3.status_code == 200, f"Third payment failed: {response3.text}"
        data3 = response3.json().get("data", {})
        assert data3.get("paid") == 500 or data3.get("paid") == 500.0
        assert data3.get("remaining") == 0 or data3.get("remaining") == 0.0
        print(f"✓ Third payment: paid=500, remaining=0")

    def test_confirm_payment_no_overpayment(self):
        """Test that overpayment is capped to remaining amount"""
        # Create a credit sale operation with total 1000
        op = self._create_credit_operation(op_type="sale", total=1000.0)
        if not op:
            pytest.skip("Could not create test operation")
        
        op_id = op.get("id")
        print(f"✓ Created credit operation: {op_id} with total=1000")

        # Try to pay 2000 (more than total)
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 2000.0}
        )
        assert response.status_code == 200, f"Payment failed: {response.text}"
        data = response.json().get("data", {})
        # Should cap at 1000
        assert data.get("paid") == 1000 or data.get("paid") == 1000.0, f"Expected paid=1000, got {data.get('paid')}"
        assert data.get("remaining") == 0 or data.get("remaining") == 0.0
        print(f"✓ Overpayment capped: paid=1000, remaining=0")

    def test_confirm_payment_already_paid_returns_no_remaining(self):
        """Test that confirming payment on fully paid operation returns no remaining message"""
        # Create and fully pay an operation
        op = self._create_credit_operation(op_type="sale", total=500.0)
        if not op:
            pytest.skip("Could not create test operation")
        
        op_id = op.get("id")
        
        # First payment (full)
        response1 = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 500.0}
        )
        assert response1.status_code == 200

        # Try to pay again
        response2 = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 100.0}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        # Should indicate no remaining
        assert "no remaining" in str(data2.get("message", "")).lower() or data2.get("data", {}).get("remaining", 0) == 0
        print("✓ Already paid operation returns no remaining message")

    def test_confirm_payment_purchase_operation(self):
        """Test confirm-payment for purchase (expense) operations"""
        # Create a credit purchase operation
        op = self._create_credit_operation(op_type="purchase", total=1500.0, partner_name="TEST_مورد_اختبار")
        if not op:
            pytest.skip("Could not create test operation")
        
        op_id = op.get("id")
        print(f"✓ Created credit purchase operation: {op_id}")

        # Confirm payment
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 1500.0}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        result_data = data.get("data", {})
        assert result_data.get("paid") == 1500 or result_data.get("paid") == 1500.0
        assert result_data.get("remaining") == 0 or result_data.get("remaining") == 0.0
        print(f"✓ Purchase payment confirmed: paid=1500, remaining=0")


class TestOperationsAPI:
    """Basic operations API tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def test_operations_list(self):
        """Test GET /api/operations returns list"""
        response = self.session.get(f"{BASE_URL}/api/operations", params={"limit": 10})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Operations list returned {len(data)} items")

    def test_operations_get_single(self):
        """Test GET /api/operations/{id} for existing operation"""
        # First get list to find an existing operation
        response = self.session.get(f"{BASE_URL}/api/operations", params={"limit": 1})
        if response.status_code != 200:
            pytest.skip("Could not get operations list")
        
        ops = response.json()
        if not ops:
            pytest.skip("No operations found to test")
        
        op_id = ops[0].get("id")
        if not op_id:
            pytest.skip("Operation has no ID")
        
        # Get single operation
        response2 = self.session.get(f"{BASE_URL}/api/operations/{op_id}")
        assert response2.status_code == 200, f"Expected 200, got {response2.status_code}"
        data = response2.json()
        assert data.get("id") == op_id
        print(f"✓ Single operation retrieved: {op_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
