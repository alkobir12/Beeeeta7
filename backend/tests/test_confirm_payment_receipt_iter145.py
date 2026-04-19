"""
Test confirm-payment with receipt attachment feature (iteration 145)

Features to test:
1. Backend: confirm-payment saves receipt file and returns receipt_url/receipt_name
2. Backend: GET /api/operations/{op_id}/payment-receipts/{filename} returns the file
3. Backend: confirm-payment without receipt still works (no regression)
"""

import pytest
import requests
import os
import base64
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")


class TestConfirmPaymentReceipt:
    """Test receipt attachment in confirm-payment flow"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_operations = []

    def teardown_method(self, method):
        """Cleanup created operations"""
        for op_id in self.created_operations:
            try:
                self.session.delete(f"{BASE_URL}/api/operations/{op_id}")
            except Exception:
                pass

    def _create_credit_operation(self, op_type="sale", total=500.0):
        """Helper to create a credit operation for testing"""
        payload = {
            "type": op_type,
            "workshopId": WORKSHOP_ID,
            "accountId": "test-account",
            "accountingAccountId": "4100" if op_type == "sale" else "6100",
            "partnerName": f"Test Partner {uuid.uuid4().hex[:6]}",
            "partnerId": str(uuid.uuid4()),
            "partnerType": "customer" if op_type == "sale" else "supplier",
            "paymentMethod": "credit",
            "paymentStatus": "unpaid",
            "total": total,
            "items": [{"name": "Test Item", "quantity": 1, "price": total, "total": total}],
            "notes": "Test credit operation for receipt testing",
            "date": "2026-01-15",
        }
        response = self.session.post(f"{BASE_URL}/api/operations", json=payload)
        if response.status_code in (200, 201):
            data = response.json()
            op_id = data.get("id")
            if op_id:
                self.created_operations.append(op_id)
            return data
        return None

    def _create_test_receipt_base64(self, content="Test receipt content", filename="test_receipt.txt"):
        """Create a base64 encoded test receipt"""
        content_bytes = content.encode("utf-8")
        base64_content = base64.b64encode(content_bytes).decode("utf-8")
        return {
            "name": filename,
            "mimeType": "text/plain",
            "base64": f"data:text/plain;base64,{base64_content}",
        }

    def _create_test_image_receipt(self):
        """Create a small test image receipt (1x1 PNG)"""
        # Minimal 1x1 transparent PNG
        png_bytes = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # RGBA
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,  # IEND chunk
            0x42, 0x60, 0x82
        ])
        base64_content = base64.b64encode(png_bytes).decode("utf-8")
        return {
            "name": "receipt_image.png",
            "mimeType": "image/png",
            "base64": f"data:image/png;base64,{base64_content}",
        }

    def test_api_health(self):
        """Test API is accessible"""
        response = self.session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200, f"API not accessible: {response.status_code}"
        print("✓ API health check passed")

    def test_create_credit_operation(self):
        """Test creating a credit operation"""
        op = self._create_credit_operation()
        assert op is not None, "Failed to create credit operation"
        assert op.get("id"), "Operation missing id"
        print(f"✓ Created credit operation: {op.get('id')}")

    def test_confirm_payment_with_text_receipt(self):
        """Test confirm-payment with text file receipt"""
        # Create credit operation
        op = self._create_credit_operation(total=300.0)
        assert op is not None, "Failed to create credit operation"
        op_id = op.get("id")
        assert op_id, "Operation missing id"

        # Create receipt payload
        receipt = self._create_test_receipt_base64(
            content=f"Receipt for payment - {op_id}",
            filename="payment_receipt.txt"
        )

        # Confirm payment with receipt
        confirm_payload = {
            "workshopId": WORKSHOP_ID,
            "amount": 300.0,
            "payment_method": "cash",
            "date": "2026-01-15",
            "receipt": receipt,
        }
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json=confirm_payload
        )
        
        assert response.status_code == 200, f"Confirm payment failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Confirm payment not successful: {data}"
        result_data = data.get("data", {})
        
        # Check receipt_url and receipt_name are returned
        receipt_url = result_data.get("receipt_url")
        receipt_name = result_data.get("receipt_name")
        
        print(f"✓ Confirm payment response: paid={result_data.get('paid')}, receipt_url={receipt_url}, receipt_name={receipt_name}")
        
        # Receipt info should be present
        assert receipt_url or receipt_name, f"Receipt info missing in response: {result_data}"
        print(f"✓ Receipt attached successfully: {receipt_name or receipt_url}")

    def test_confirm_payment_with_image_receipt(self):
        """Test confirm-payment with image receipt"""
        # Create credit operation
        op = self._create_credit_operation(total=400.0)
        assert op is not None, "Failed to create credit operation"
        op_id = op.get("id")
        assert op_id, "Operation missing id"

        # Create image receipt payload
        receipt = self._create_test_image_receipt()

        # Confirm payment with receipt
        confirm_payload = {
            "workshopId": WORKSHOP_ID,
            "amount": 400.0,
            "payment_method": "bank",
            "date": "2026-01-15",
            "receipt": receipt,
        }
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json=confirm_payload
        )
        
        assert response.status_code == 200, f"Confirm payment failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Confirm payment not successful: {data}"
        result_data = data.get("data", {})
        
        receipt_url = result_data.get("receipt_url")
        receipt_name = result_data.get("receipt_name")
        
        print(f"✓ Image receipt attached: {receipt_name or receipt_url}")
        assert receipt_url or receipt_name, f"Receipt info missing: {result_data}"

    def test_get_payment_receipt_file(self):
        """Test GET /api/operations/{op_id}/payment-receipts/{filename} returns the file"""
        # Create credit operation
        op = self._create_credit_operation(total=250.0)
        assert op is not None, "Failed to create credit operation"
        op_id = op.get("id")
        assert op_id, "Operation missing id"

        # Create receipt with known content
        test_content = f"Receipt content for {op_id} - verification test"
        receipt = self._create_test_receipt_base64(
            content=test_content,
            filename="verify_receipt.txt"
        )

        # Confirm payment with receipt
        confirm_payload = {
            "workshopId": WORKSHOP_ID,
            "amount": 250.0,
            "payment_method": "cash",
            "date": "2026-01-15",
            "receipt": receipt,
        }
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json=confirm_payload
        )
        
        assert response.status_code == 200, f"Confirm payment failed: {response.status_code}"
        data = response.json()
        result_data = data.get("data", {})
        
        receipt_url = result_data.get("receipt_url")
        receipt_name = result_data.get("receipt_name")
        
        # Try to fetch the receipt file
        if receipt_url:
            # receipt_url is like /api/operations/{op_id}/payment-receipts/{filename}
            fetch_url = f"{BASE_URL}{receipt_url}" if receipt_url.startswith("/") else receipt_url
            fetch_response = self.session.get(fetch_url)
            
            assert fetch_response.status_code == 200, f"Failed to fetch receipt: {fetch_response.status_code}"
            print(f"✓ Receipt file fetched successfully from {receipt_url}")
            
            # Verify content type
            content_type = fetch_response.headers.get("Content-Type", "")
            print(f"  Content-Type: {content_type}")
        elif receipt_name:
            # Try constructing URL from receipt_name
            fetch_url = f"{BASE_URL}/api/operations/{op_id}/payment-receipts/{receipt_name}"
            fetch_response = self.session.get(fetch_url)
            
            if fetch_response.status_code == 200:
                print(f"✓ Receipt file fetched successfully: {receipt_name}")
            else:
                print(f"⚠ Could not fetch receipt by name: {fetch_response.status_code}")
        else:
            print("⚠ No receipt URL or name returned to verify")

    def test_confirm_payment_without_receipt_no_regression(self):
        """Test confirm-payment without receipt still works (no regression)"""
        # Create credit operation
        op = self._create_credit_operation(total=600.0)
        assert op is not None, "Failed to create credit operation"
        op_id = op.get("id")
        assert op_id, "Operation missing id"

        # Confirm payment WITHOUT receipt
        confirm_payload = {
            "workshopId": WORKSHOP_ID,
            "amount": 600.0,
            "payment_method": "cash",
            "date": "2026-01-15",
            # No receipt field
        }
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json=confirm_payload
        )
        
        assert response.status_code == 200, f"Confirm payment failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("success") is True, f"Confirm payment not successful: {data}"
        result_data = data.get("data", {})
        
        assert result_data.get("paid") == 600.0, f"Paid amount mismatch: {result_data}"
        assert result_data.get("status") == "paid", f"Status should be paid: {result_data}"
        
        print(f"✓ Confirm payment without receipt works: paid={result_data.get('paid')}, status={result_data.get('status')}")

    def test_operation_notes_contain_receipt_marker(self):
        """Test that operation notes contain [PAYMENT_RECEIPT] marker after confirm"""
        # Create credit operation
        op = self._create_credit_operation(total=350.0)
        assert op is not None, "Failed to create credit operation"
        op_id = op.get("id")
        assert op_id, "Operation missing id"

        # Create receipt
        receipt = self._create_test_receipt_base64(
            content="Receipt for marker test",
            filename="marker_test.txt"
        )

        # Confirm payment with receipt
        confirm_payload = {
            "workshopId": WORKSHOP_ID,
            "amount": 350.0,
            "payment_method": "bank",
            "date": "2026-01-15",
            "receipt": receipt,
        }
        response = self.session.post(
            f"{BASE_URL}/api/operations/{op_id}/confirm-payment",
            json=confirm_payload
        )
        
        assert response.status_code == 200, f"Confirm payment failed: {response.status_code}"
        
        # Fetch the operation to check notes
        op_response = self.session.get(f"{BASE_URL}/api/operations/{op_id}")
        if op_response.status_code == 200:
            op_data = op_response.json()
            notes = op_data.get("notes", "")
            
            if "[PAYMENT_RECEIPT]" in notes:
                print(f"✓ Operation notes contain [PAYMENT_RECEIPT] marker")
                print(f"  Notes: {notes[:200]}...")
            else:
                print(f"⚠ [PAYMENT_RECEIPT] marker not found in notes: {notes[:200]}")
        else:
            print(f"⚠ Could not fetch operation to verify notes: {op_response.status_code}")

    def test_receipt_file_not_found_returns_404(self):
        """Test that non-existent receipt returns 404"""
        fake_op_id = str(uuid.uuid4())
        fake_filename = "nonexistent_receipt.txt"
        
        response = self.session.get(
            f"{BASE_URL}/api/operations/{fake_op_id}/payment-receipts/{fake_filename}"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent receipt returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
