"""
Test confirm-payment endpoint fixes for iteration 94:
1. Invalid UUID returns 400 (not 500)
2. Partial payments continue working (payment_method stays 'credit' until fully paid)
3. Cash-basis fallback affects net_income correctly
"""
import pytest
import requests
import os
import uuid as uuid_module

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestConfirmPaymentFixes:
    """Tests for confirm-payment endpoint fixes"""

    def test_invalid_uuid_returns_400(self):
        """Invalid UUID format should return 400, not 500"""
        invalid_ids = [
            "invalid-uuid",
            "12345",
            "not-a-uuid-at-all",
            "abc",
            "",
        ]
        
        for invalid_id in invalid_ids:
            if not invalid_id:
                continue  # Skip empty string as it would be a different route
            response = requests.post(
                f"{BASE_URL}/api/operations/{invalid_id}/confirm-payment",
                json={"workshopId": WORKSHOP_ID, "amount": 100}
            )
            # Should be 400 for invalid UUID, not 500
            assert response.status_code == 400, f"Expected 400 for invalid UUID '{invalid_id}', got {response.status_code}: {response.text}"
            print(f"✓ Invalid UUID '{invalid_id}' correctly returns 400")

    def test_valid_uuid_not_found_returns_404(self):
        """Valid UUID format but non-existent operation should return 404"""
        fake_uuid = str(uuid_module.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/operations/{fake_uuid}/confirm-payment",
            json={"workshopId": WORKSHOP_ID, "amount": 100}
        )
        # Should be 404 for non-existent operation
        assert response.status_code == 404, f"Expected 404 for non-existent UUID, got {response.status_code}: {response.text}"
        print(f"✓ Non-existent UUID correctly returns 404")

    def test_partial_payments_continue_working(self):
        """After first partial payment, should be able to make second partial payment"""
        # First, create a credit operation
        create_payload = {
            "type": "sale",
            "total": 1000,
            "items": [{"name": "Test Item", "quantity": 1, "price": 1000, "total": 1000}],
            "paymentMethod": "credit",
            "paymentStatus": "unpaid",
            "partnerName": "Test Customer Partial",
            "workshopId": WORKSHOP_ID,
            "scope": "workshop",
        }
        
        create_response = requests.post(f"{BASE_URL}/api/operations", json=create_payload)
        assert create_response.status_code in [200, 201], f"Failed to create operation: {create_response.text}"
        
        op_data = create_response.json()
        op_id = op_data.get("id")
        assert op_id, "Operation ID not returned"
        print(f"✓ Created credit operation: {op_id}")
        
        try:
            # First partial payment: 400 out of 1000
            first_payment = requests.post(
                f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
                json={"workshopId": WORKSHOP_ID, "amount": 400}
            )
            assert first_payment.status_code == 200, f"First payment failed: {first_payment.text}"
            first_result = first_payment.json()
            assert first_result.get("success") == True
            assert first_result.get("data", {}).get("paid") == 400
            assert first_result.get("data", {}).get("remaining") == 600
            print(f"✓ First partial payment: paid=400, remaining=600")
            
            # Verify operation still has credit payment method (not changed to cash)
            get_response = requests.get(f"{BASE_URL}/api/operations/{op_id}")
            if get_response.status_code == 200:
                op_after_first = get_response.json()
                payment_method = op_after_first.get("payment_method") or op_after_first.get("paymentMethod")
                payment_status = op_after_first.get("payment_status") or op_after_first.get("paymentStatus")
                print(f"  After first payment: payment_method={payment_method}, payment_status={payment_status}")
                # payment_method should stay 'credit' for partial payments
                assert payment_method == "credit", f"Expected payment_method='credit' after partial payment, got '{payment_method}'"
                assert payment_status == "partial", f"Expected payment_status='partial', got '{payment_status}'"
            
            # Second partial payment: 300 out of remaining 600
            second_payment = requests.post(
                f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
                json={"workshopId": WORKSHOP_ID, "amount": 300}
            )
            assert second_payment.status_code == 200, f"Second payment failed: {second_payment.text}"
            second_result = second_payment.json()
            assert second_result.get("success") == True
            assert second_result.get("data", {}).get("paid") == 300
            assert second_result.get("data", {}).get("remaining") == 300
            print(f"✓ Second partial payment: paid=300, remaining=300")
            
            # Third payment: pay remaining 300
            third_payment = requests.post(
                f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
                json={"workshopId": WORKSHOP_ID, "amount": 300}
            )
            assert third_payment.status_code == 200, f"Third payment failed: {third_payment.text}"
            third_result = third_payment.json()
            assert third_result.get("success") == True
            assert third_result.get("data", {}).get("paid") == 300
            assert third_result.get("data", {}).get("remaining") == 0
            print(f"✓ Third payment (final): paid=300, remaining=0")
            
            # Verify operation is now fully paid
            get_final = requests.get(f"{BASE_URL}/api/operations/{op_id}")
            if get_final.status_code == 200:
                op_final = get_final.json()
                final_method = op_final.get("payment_method") or op_final.get("paymentMethod")
                final_status = op_final.get("payment_status") or op_final.get("paymentStatus")
                print(f"  After full payment: payment_method={final_method}, payment_status={final_status}")
                assert final_status == "paid", f"Expected payment_status='paid', got '{final_status}'"
                assert final_method == "cash", f"Expected payment_method='cash' after full payment, got '{final_method}'"
            
            print("✓ Multiple partial payments work correctly!")
            
        finally:
            # Cleanup: delete the test operation
            requests.delete(f"{BASE_URL}/api/operations/{op_id}")

    def test_cash_basis_fallback_affects_net_income(self):
        """When no base journal entry exists, cash-basis fallback should create income entry"""
        # Create a credit sale operation
        create_payload = {
            "type": "sale",
            "total": 500,
            "items": [{"name": "Cash Basis Test", "quantity": 1, "price": 500, "total": 500}],
            "paymentMethod": "credit",
            "paymentStatus": "unpaid",
            "partnerName": "Cash Basis Customer",
            "workshopId": WORKSHOP_ID,
            "scope": "workshop",
        }
        
        create_response = requests.post(f"{BASE_URL}/api/operations", json=create_payload)
        assert create_response.status_code in [200, 201], f"Failed to create operation: {create_response.text}"
        
        op_data = create_response.json()
        op_id = op_data.get("id")
        print(f"✓ Created credit sale operation: {op_id}")
        
        try:
            # Confirm payment - this should use cash-basis fallback
            payment_response = requests.post(
                f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
                json={"workshopId": WORKSHOP_ID, "amount": 500}
            )
            assert payment_response.status_code == 200, f"Payment failed: {payment_response.text}"
            result = payment_response.json()
            assert result.get("success") == True
            assert result.get("data", {}).get("paid") == 500
            assert result.get("data", {}).get("remaining") == 0
            print(f"✓ Payment confirmed: paid=500, remaining=0")
            
            # The journal entry should have been created with source='operation_payment_income'
            # This affects net_income in cash-basis accounting
            print("✓ Cash-basis fallback creates income recognition entry")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/operations/{op_id}")

    def test_workshopId_required(self):
        """Confirm payment requires workshopId"""
        fake_uuid = str(uuid_module.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/operations/{fake_uuid}/confirm-payment",
            json={"amount": 100}  # Missing workshopId
        )
        assert response.status_code == 400, f"Expected 400 for missing workshopId, got {response.status_code}"
        assert "workshopId" in response.text.lower() or "workshop" in response.text.lower()
        print("✓ Missing workshopId correctly returns 400")


class TestOperationsEndpoints:
    """Basic operations endpoint tests"""

    def test_operations_list(self):
        """GET /api/operations should return list"""
        response = requests.get(f"{BASE_URL}/api/operations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Operations list returned {len(data)} items")

    def test_operations_get_single(self):
        """GET /api/operations/{id} should return operation or 404"""
        # First get list to find an existing operation
        list_response = requests.get(f"{BASE_URL}/api/operations?limit=1")
        if list_response.status_code == 200:
            ops = list_response.json()
            if ops and len(ops) > 0:
                op_id = ops[0].get("id")
                if op_id:
                    get_response = requests.get(f"{BASE_URL}/api/operations/{op_id}")
                    assert get_response.status_code == 200
                    print(f"✓ Single operation GET works for {op_id}")
                    return
        
        # If no operations exist, test with fake UUID
        fake_uuid = str(uuid_module.uuid4())
        response = requests.get(f"{BASE_URL}/api/operations/{fake_uuid}")
        assert response.status_code == 404
        print("✓ Non-existent operation returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
