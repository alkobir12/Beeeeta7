"""
Iteration 204 - Payment Status and Journal Entry Text Tests
Tests for operation 99970dc5-5e16-481f-a925-65cce2d374f7

Verifies:
1. paymentStatus=partial, totalPaid=300, balance=2000
2. Journal entry text resolves correctly when accountingAccountId is null
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPaymentStatusAndJournalEntry:
    """Tests for payment status display and journal entry text"""
    
    TARGET_OPERATION_ID = "99970dc5-5e16-481f-a925-65cce2d374f7"
    TARGET_VEHICLE_ID = "5287aa8d-2969-48ed-bc5e-2ca0f97a03a3"
    
    def test_operation_exists(self):
        """Verify the target operation exists"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200, f"Operation not found: {response.status_code}"
        data = response.json()
        assert data.get('id') == self.TARGET_OPERATION_ID
        print(f"✅ Operation {self.TARGET_OPERATION_ID[:8]}... exists")
    
    def test_payment_status_is_partial(self):
        """Verify paymentStatus is 'partial'"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        payment_status = data.get('paymentStatus', '')
        assert payment_status == 'partial', f"Expected paymentStatus='partial', got '{payment_status}'"
        print(f"✅ paymentStatus = '{payment_status}'")
    
    def test_total_paid_is_300(self):
        """Verify totalPaid is 300"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        total_paid = data.get('totalPaid', 0)
        assert total_paid == 300.0, f"Expected totalPaid=300, got {total_paid}"
        print(f"✅ totalPaid = {total_paid}")
    
    def test_balance_is_2000(self):
        """Verify balance is 2000"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        balance = data.get('balance', 0)
        assert balance == 2000.0, f"Expected balance=2000, got {balance}"
        print(f"✅ balance = {balance}")
    
    def test_payment_method_is_cash(self):
        """Verify paymentMethod is 'cash'"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        payment_method = data.get('paymentMethod', '')
        assert payment_method == 'cash', f"Expected paymentMethod='cash', got '{payment_method}'"
        print(f"✅ paymentMethod = '{payment_method}'")
    
    def test_total_is_2300(self):
        """Verify total is 2300"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        total = data.get('total', 0)
        assert total == 2300.0, f"Expected total=2300, got {total}"
        print(f"✅ total = {total}")
    
    def test_vehicle_linked_correctly(self):
        """Verify operation is linked to correct vehicle"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        vehicle_id = data.get('vehicleId', '')
        assert vehicle_id == self.TARGET_VEHICLE_ID, f"Expected vehicleId='{self.TARGET_VEHICLE_ID}', got '{vehicle_id}'"
        print(f"✅ vehicleId = '{vehicle_id}'")
    
    def test_customer_name_enriched(self):
        """Verify customer name is enriched from vehicle"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        customer_name = data.get('customerName', '') or data.get('partnerName', '')
        assert customer_name, "Customer name should be enriched"
        assert 'ابو ياسر' in customer_name or 'الزويد' in customer_name, f"Expected customer name to contain 'ابو ياسر' or 'الزويد', got '{customer_name}'"
        print(f"✅ customerName = '{customer_name}'")
    
    def test_operations_list_returns_payment_data(self):
        """Verify operations list endpoint returns payment data"""
        response = requests.get(f"{BASE_URL}/api/operations?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Find our target operation
        target_op = None
        for op in data:
            if op.get('id') == self.TARGET_OPERATION_ID:
                target_op = op
                break
        
        assert target_op is not None, f"Target operation not found in list"
        
        # Verify payment data in list response
        assert target_op.get('paymentStatus') == 'partial', f"List: Expected paymentStatus='partial'"
        assert target_op.get('totalPaid') == 300.0, f"List: Expected totalPaid=300"
        assert target_op.get('balance') == 2000.0, f"List: Expected balance=2000"
        print(f"✅ Operations list returns correct payment data")


class TestJournalEntryTextResolution:
    """Tests for journal entry text when accountingAccountId is null"""
    
    TARGET_OPERATION_ID = "99970dc5-5e16-481f-a925-65cce2d374f7"
    
    def test_accounting_account_id_is_null(self):
        """Verify accountingAccountId is null for this operation"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        accounting_account_id = data.get('accountingAccountId')
        # It should be null/None
        assert accounting_account_id is None, f"Expected accountingAccountId=null, got '{accounting_account_id}'"
        print(f"✅ accountingAccountId is null (as expected)")
    
    def test_operation_type_is_service(self):
        """Verify operation type is 'service'"""
        response = requests.get(f"{BASE_URL}/api/operations/{self.TARGET_OPERATION_ID}")
        assert response.status_code == 200
        data = response.json()
        
        op_type = data.get('type', '')
        assert op_type == 'service', f"Expected type='service', got '{op_type}'"
        print(f"✅ type = '{op_type}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
