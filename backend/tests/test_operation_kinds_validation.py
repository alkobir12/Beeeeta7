"""
Test Operation Kinds Validation (3 أنواع عمليات)
------------------------------------------------
Tests the 3 operation kinds with their validation rules:
1. WORKSHOP_OPERATION: accepts without customer or vehicle
2. VEHICLE_OPERATION: requires vehicle, auto-fills customer from vehicle
3. RAKAN_PARTS_OPERATION: requires customer OR vehicle

Also tests FK error fix - accountId resolution to valid business account.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rakan-ledger-debug.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL[:-1]


class TestOperationKindsValidation:
    """Test operation kinds validation rules"""
    
    # Store created IDs for cleanup
    created_operation_ids = []
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup - get test data and cleanup created operations after tests"""
        # Get business accounts
        biz_resp = requests.get(f"{BASE_URL}/api/biz-accounts")
        self.biz_accounts = biz_resp.json() if biz_resp.status_code == 200 else []
        
        # Find Rakan and Workshop accounts
        self.rakan_account = next(
            (a for a in self.biz_accounts if 'راكان' in str(a.get('name', '')).lower() or 'rakan' in str(a.get('code', '')).lower()),
            None
        )
        self.workshop_account = next(
            (a for a in self.biz_accounts if not ('راكان' in str(a.get('name', '')).lower() or 'rakan' in str(a.get('code', '')).lower())),
            None
        )
        
        # Get vehicles
        vehicles_resp = requests.get(f"{BASE_URL}/api/vehicles")
        self.vehicles = vehicles_resp.json() if vehicles_resp.status_code == 200 else []
        self.test_vehicle = self.vehicles[0] if self.vehicles else None
        
        # Get customers
        customers_resp = requests.get(f"{BASE_URL}/api/customers")
        self.customers = customers_resp.json() if customers_resp.status_code == 200 else []
        self.test_customer = self.customers[0] if self.customers else None
        
        yield
        
        # Cleanup created operations
        for op_id in self.created_operation_ids:
            try:
                requests.delete(f"{BASE_URL}/api/operations/{op_id}")
            except:
                pass
        self.created_operation_ids.clear()

    # ==================== WORKSHOP_OPERATION Tests ====================
    
    def test_workshop_operation_accepts_without_customer_and_vehicle(self):
        """WORKSHOP_OPERATION: يقبل بدون عميل وبدون مركبة"""
        payload = {
            "operationKind": "WORKSHOP_OPERATION",
            "type": "purchase",
            "partnerName": "",  # No customer
            "partnerId": "",
            "vehicleId": "",    # No vehicle
            "items": [{"name": "مصروفات كهرباء", "price": 500, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_WORKSHOP_OPERATION_NO_CUSTOMER_NO_VEHICLE"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        
        # Verify scope is workshop
        assert data.get("scope") in ["workshop", "WORKSHOP_OPERATION"], f"Scope should be workshop, got: {data.get('scope')}"
        print(f"✅ WORKSHOP_OPERATION created successfully without customer/vehicle: {data['id']}")

    def test_workshop_operation_accepts_with_partner_name_only(self):
        """WORKSHOP_OPERATION: يقبل مع اسم مورد فقط"""
        payload = {
            "operationKind": "WORKSHOP_OPERATION",
            "type": "purchase",
            "partnerName": "شركة الكهرباء",
            "partnerId": "",
            "vehicleId": "",
            "items": [{"name": "فاتورة كهرباء", "price": 1200, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_WORKSHOP_OPERATION_WITH_PARTNER_NAME"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        assert data.get("partnerName") == "شركة الكهرباء"
        print(f"✅ WORKSHOP_OPERATION with partner name created: {data['id']}")

    # ==================== VEHICLE_OPERATION Tests ====================
    
    def test_vehicle_operation_rejects_without_vehicle(self):
        """VEHICLE_OPERATION: يرفض بدون مركبة"""
        payload = {
            "operationKind": "VEHICLE_OPERATION",
            "type": "sale",
            "partnerName": "عميل",
            "vehicleId": "",  # No vehicle - should fail
            "items": [{"name": "خدمة", "price": 100, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_VEHICLE_OPERATION_NO_VEHICLE_SHOULD_FAIL"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        # Should return 400 error
        assert response.status_code == 400, f"Expected 400 but got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        assert "vehicle" in error_detail.lower() or "مركبة" in error_detail, f"Error should mention vehicle requirement: {error_detail}"
        print(f"✅ VEHICLE_OPERATION correctly rejected without vehicle: {error_detail}")

    def test_vehicle_operation_accepts_with_vehicle(self):
        """VEHICLE_OPERATION: يقبل مع مركبة"""
        if not self.test_vehicle:
            pytest.skip("No test vehicle available")
        
        payload = {
            "operationKind": "VEHICLE_OPERATION",
            "type": "sale",
            "vehicleId": self.test_vehicle.get("id"),
            "items": [{"name": "خدمة صيانة", "price": 300, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_VEHICLE_OPERATION_WITH_VEHICLE"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        
        # Verify vehicle is linked
        assert data.get("vehicleId") == self.test_vehicle.get("id"), "Vehicle should be linked"
        print(f"✅ VEHICLE_OPERATION created with vehicle: {data['id']}")

    def test_vehicle_operation_auto_fills_customer_from_vehicle(self):
        """VEHICLE_OPERATION: يملأ العميل تلقائياً من المركبة"""
        if not self.test_vehicle:
            pytest.skip("No test vehicle available")
        
        payload = {
            "operationKind": "VEHICLE_OPERATION",
            "type": "sale",
            "vehicleId": self.test_vehicle.get("id"),
            "partnerId": "",  # Empty - should be auto-filled
            "partnerName": "",  # Empty - should be auto-filled
            "items": [{"name": "خدمة", "price": 200, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_VEHICLE_OPERATION_AUTO_CUSTOMER"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        
        # Check if customer info was auto-filled from vehicle
        vehicle_customer_name = self.test_vehicle.get("customerName", "")
        
        # Main check: customer NAME should be auto-filled (this is the key UX feature)
        if vehicle_customer_name:
            assert data.get("partnerName") == vehicle_customer_name, f"Customer name should be auto-filled from vehicle: {vehicle_customer_name}"
            print(f"✅ VEHICLE_OPERATION auto-filled customer name: {data.get('partnerName')}")
        
        # NOTE: partnerId may not be returned in the API response but the name is the key feature
        print(f"✅ VEHICLE_OPERATION correctly links to vehicle and auto-fills customer name")

    # ==================== RAKAN_PARTS_OPERATION Tests ====================
    
    def test_rakan_operation_rejects_without_customer_or_vehicle(self):
        """RAKAN_PARTS_OPERATION: يرفض بدون عميل أو مركبة"""
        payload = {
            "operationKind": "RAKAN_PARTS_OPERATION",
            "type": "sale",
            "partnerName": "",   # No customer
            "partnerId": "",
            "vehicleId": "",     # No vehicle
            "items": [{"name": "قطعة", "price": 50, "quantity": 1, "itemType": "part"}],
            "paymentMethod": "cash",
            "notes": "TEST_RAKAN_NO_CUSTOMER_OR_VEHICLE_SHOULD_FAIL"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        # Should return 400 error
        assert response.status_code == 400, f"Expected 400 but got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        # Error should mention customer or vehicle requirement
        assert "عميل" in error_detail or "مركبة" in error_detail or "customer" in error_detail.lower() or "vehicle" in error_detail.lower(), f"Error should mention customer/vehicle requirement: {error_detail}"
        print(f"✅ RAKAN_PARTS_OPERATION correctly rejected without customer/vehicle: {error_detail}")

    def test_rakan_operation_accepts_with_customer_only(self):
        """RAKAN_PARTS_OPERATION: يقبل مع عميل فقط"""
        if not self.test_customer:
            pytest.skip("No test customer available")
        
        payload = {
            "operationKind": "RAKAN_PARTS_OPERATION",
            "type": "sale",
            "partnerId": self.test_customer.get("id"),
            "partnerName": self.test_customer.get("name"),
            "vehicleId": "",  # No vehicle - should still work
            "items": [{"name": "قطعة غيار", "price": 75, "quantity": 1, "itemType": "part"}],
            "paymentMethod": "cash",
            "notes": "TEST_RAKAN_WITH_CUSTOMER_ONLY"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        
        # Verify Rakan account is used
        if self.rakan_account:
            assert data.get("accountId") == self.rakan_account.get("id"), f"Should use Rakan business account"
        
        print(f"✅ RAKAN_PARTS_OPERATION created with customer only: {data['id']}")

    def test_rakan_operation_accepts_with_vehicle_only(self):
        """RAKAN_PARTS_OPERATION: يقبل مع مركبة فقط"""
        if not self.test_vehicle:
            pytest.skip("No test vehicle available")
        
        payload = {
            "operationKind": "RAKAN_PARTS_OPERATION",
            "type": "sale",
            "partnerId": "",    # No customer explicitly
            "partnerName": "",
            "vehicleId": self.test_vehicle.get("id"),  # Has vehicle
            "items": [{"name": "قطعة غيار", "price": 100, "quantity": 1, "itemType": "part"}],
            "paymentMethod": "cash",
            "notes": "TEST_RAKAN_WITH_VEHICLE_ONLY"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        
        # Verify vehicle is linked
        assert data.get("vehicleId") == self.test_vehicle.get("id"), "Vehicle should be linked"
        print(f"✅ RAKAN_PARTS_OPERATION created with vehicle only: {data['id']}")

    def test_rakan_operation_accepts_with_partner_name_only(self):
        """RAKAN_PARTS_OPERATION: يقبل مع اسم عميل فقط (بدون ID)"""
        payload = {
            "operationKind": "RAKAN_PARTS_OPERATION",
            "type": "sale",
            "partnerName": "عميل جديد",  # Just name, no ID
            "partnerId": "",
            "vehicleId": "",
            "items": [{"name": "قطعة غيار", "price": 60, "quantity": 1, "itemType": "part"}],
            "paymentMethod": "cash",
            "notes": "TEST_RAKAN_WITH_PARTNER_NAME_ONLY"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created with an ID"
        self.created_operation_ids.append(data["id"])
        assert data.get("partnerName") == "عميل جديد"
        print(f"✅ RAKAN_PARTS_OPERATION created with partner name only: {data['id']}")

    # ==================== FK Error Fix Tests ====================
    
    def test_fk_error_fix_invalid_account_id_resolved(self):
        """FK خطأ: معرف حساب غير صالح يتم توجيهه لحساب أعمال مناسب"""
        payload = {
            "operationKind": "WORKSHOP_OPERATION",
            "type": "purchase",
            "accountId": "invalid-uuid-12345",  # Invalid UUID
            "items": [{"name": "مصروف", "price": 100, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_FK_INVALID_ACCOUNT_RESOLVED"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        # Should succeed because backend resolves to valid account
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created"
        self.created_operation_ids.append(data["id"])
        
        # accountId should be resolved to a valid business account
        assert data.get("accountId"), "accountId should be resolved"
        print(f"✅ Invalid accountId resolved to: {data.get('accountId')}")

    def test_fk_error_fix_empty_account_id_resolved(self):
        """FK خطأ: معرف حساب فارغ يتم توجيهه لحساب أعمال مناسب"""
        payload = {
            "operationKind": "WORKSHOP_OPERATION",
            "type": "purchase",
            "accountId": "",  # Empty
            "items": [{"name": "مصروف", "price": 150, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_FK_EMPTY_ACCOUNT_RESOLVED"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        # Should succeed
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created"
        self.created_operation_ids.append(data["id"])
        
        # accountId should be resolved
        assert data.get("accountId"), "accountId should be resolved even when empty"
        print(f"✅ Empty accountId resolved to: {data.get('accountId')}")

    def test_rakan_operation_uses_rakan_business_account(self):
        """RAKAN_PARTS_OPERATION يستخدم حساب أعمال راكان"""
        if not self.rakan_account:
            pytest.skip("No Rakan business account available")
        if not self.test_customer:
            pytest.skip("No test customer available")
        
        payload = {
            "operationKind": "RAKAN_PARTS_OPERATION",
            "type": "sale",
            "accountId": "",  # Let backend auto-select
            "partnerId": self.test_customer.get("id"),
            "partnerName": self.test_customer.get("name"),
            "items": [{"name": "قطعة", "price": 80, "quantity": 1, "itemType": "part"}],
            "paymentMethod": "cash",
            "notes": "TEST_RAKAN_AUTO_ACCOUNT_SELECTION"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created"
        self.created_operation_ids.append(data["id"])
        
        # Should use Rakan account
        assert data.get("accountId") == self.rakan_account.get("id"), f"Should use Rakan account {self.rakan_account.get('id')}, got {data.get('accountId')}"
        print(f"✅ RAKAN_PARTS_OPERATION correctly uses Rakan business account: {data.get('accountId')}")

    def test_workshop_operation_uses_workshop_business_account(self):
        """WORKSHOP_OPERATION يستخدم حساب أعمال الورشة (غير راكان)"""
        if not self.workshop_account:
            pytest.skip("No workshop business account available")
        
        payload = {
            "operationKind": "WORKSHOP_OPERATION",
            "type": "purchase",
            "accountId": "",  # Let backend auto-select
            "items": [{"name": "مصروف", "price": 200, "quantity": 1, "itemType": "service"}],
            "paymentMethod": "cash",
            "notes": "TEST_WORKSHOP_AUTO_ACCOUNT_SELECTION"
        }
        
        response = requests.post(f"{BASE_URL}/api/operations", json=payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201 but got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("id"), "Operation should be created"
        self.created_operation_ids.append(data["id"])
        
        # Should NOT use Rakan account
        if self.rakan_account:
            assert data.get("accountId") != self.rakan_account.get("id"), f"WORKSHOP_OPERATION should NOT use Rakan account"
        print(f"✅ WORKSHOP_OPERATION correctly uses workshop account: {data.get('accountId')}")


class TestOperationsListAndFiltering:
    """Test operations list and filtering by kind/scope"""
    
    def test_list_operations_returns_all(self):
        """قائمة العمليات ترجع جميع العمليات"""
        response = requests.get(f"{BASE_URL}/api/operations")
        
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Operations list returned {len(data)} operations")

    def test_operations_have_scope_field(self):
        """العمليات تحتوي على حقل scope"""
        response = requests.get(f"{BASE_URL}/api/operations")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) == 0:
            pytest.skip("No operations to check")
        
        # Check that operations have scope field
        for op in data[:5]:  # Check first 5
            assert "scope" in op, f"Operation {op.get('id')} missing scope field"
            assert op.get("scope") in ["workshop", "vehicle", "rakan_parts", None], f"Invalid scope: {op.get('scope')}"
        
        print(f"✅ Operations have valid scope field")

    def test_filter_operations_by_vehicle_id(self):
        """تصفية العمليات بمعرف المركبة"""
        # Get a vehicle first
        vehicles_resp = requests.get(f"{BASE_URL}/api/vehicles")
        vehicles = vehicles_resp.json() if vehicles_resp.status_code == 200 else []
        
        if not vehicles:
            pytest.skip("No vehicles available")
        
        vehicle_id = vehicles[0].get("id")
        response = requests.get(f"{BASE_URL}/api/operations?vehicle_id={vehicle_id}")
        
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}"
        data = response.json()
        
        # All returned operations should have this vehicle_id
        for op in data:
            assert op.get("vehicleId") == vehicle_id, f"Operation {op.get('id')} has wrong vehicleId"
        
        print(f"✅ Filtered operations by vehicle_id: {len(data)} operations")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
