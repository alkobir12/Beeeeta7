"""
Tests for Account Toggle (activate/deactivate) and Delete functionality
Features tested:
- PATCH /api/accounts/{id}/active - toggle account active status
- DELETE /api/accounts/{id} - delete non-system accounts
- GET /api/accounts/status-overrides - get account status overrides map
- Authorization check (x-user-role: manager/admin required)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestAccountStatusOverrides:
    """Test GET /api/accounts/status-overrides endpoint"""

    def test_get_status_overrides_returns_map(self):
        """GET /api/accounts/status-overrides returns overrides map"""
        response = requests.get(f"{BASE_URL}/api/accounts/status-overrides")
        assert response.status_code == 200
        data = response.json()
        assert "overrides" in data
        assert isinstance(data["overrides"], dict)
        print(f"✅ Status overrides endpoint works, {len(data['overrides'])} overrides found")


class TestAccountToggleActive:
    """Test PATCH /api/accounts/{id}/active endpoint"""

    def test_toggle_unauthorized_fails_403(self):
        """Unauthorized user (viewer role) gets 403 Forbidden"""
        # Get any existing non-system account
        accounts_res = requests.get(f"{BASE_URL}/api/accounts")
        assert accounts_res.status_code == 200
        accounts = accounts_res.json()
        non_system = [a for a in accounts if not a.get("is_system")]
        if not non_system:
            pytest.skip("No non-system accounts to test toggle")
        
        account_id = non_system[0]["id"]
        response = requests.patch(
            f"{BASE_URL}/api/accounts/{account_id}/active",
            headers={"Content-Type": "application/json", "x-user-role": "viewer"},
            json={"isActive": False}
        )
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        # Arabic message: accessible to manager only
        assert len(data["detail"]) > 0
        print(f"✅ Unauthorized toggle returns 403 with message: {data['detail']}")

    def test_toggle_authorized_manager_success(self):
        """Manager role can toggle account active status"""
        # Create test account first
        create_res = requests.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"code": f"TEST{uuid.uuid4().hex[:6].upper()}", "name": "حساب اختبار تفعيل", "type": "expense"}
        )
        assert create_res.status_code == 200
        created = create_res.json()
        assert created.get("success")
        account_id = created["data"]["id"]
        
        try:
            # Toggle to inactive
            response = requests.patch(
                f"{BASE_URL}/api/accounts/{account_id}/active",
                headers={"Content-Type": "application/json", "x-user-role": "manager"},
                json={"isActive": False}
            )
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") is True
            assert data.get("accountId") == account_id
            assert data.get("isActive") is False
            print("✅ Manager can toggle account to inactive")

            # Verify in status-overrides
            overrides_res = requests.get(f"{BASE_URL}/api/accounts/status-overrides")
            assert overrides_res.status_code == 200
            overrides = overrides_res.json().get("overrides", {})
            assert account_id in overrides
            assert overrides[account_id] is False
            print("✅ Status override persisted correctly")

            # Toggle back to active
            response2 = requests.patch(
                f"{BASE_URL}/api/accounts/{account_id}/active",
                headers={"Content-Type": "application/json", "x-user-role": "manager"},
                json={"isActive": True}
            )
            assert response2.status_code == 200
            data2 = response2.json()
            assert data2.get("isActive") is True
            print("✅ Manager can toggle account back to active")

        finally:
            # Cleanup
            requests.delete(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers={"x-user-role": "manager"}
            )

    def test_toggle_admin_role_success(self):
        """Admin role can also toggle account active status"""
        # Create test account
        create_res = requests.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync",
            headers={"Content-Type": "application/json", "x-user-role": "admin"},
            json={"code": f"TSTA{uuid.uuid4().hex[:6].upper()}", "name": "حساب اختبار أدمن", "type": "revenue"}
        )
        if create_res.status_code != 200:
            pytest.skip("Could not create test account")
        account_id = create_res.json()["data"]["id"]
        
        try:
            response = requests.patch(
                f"{BASE_URL}/api/accounts/{account_id}/active",
                headers={"Content-Type": "application/json", "x-user-role": "admin"},
                json={"isActive": False}
            )
            assert response.status_code == 200
            assert response.json().get("success") is True
            print("✅ Admin role can toggle account active status")
        finally:
            requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers={"x-user-role": "admin"})

    def test_toggle_nonexistent_account_404(self):
        """Toggle on nonexistent account returns 404"""
        response = requests.patch(
            f"{BASE_URL}/api/accounts/nonexistent-account-id/active",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"isActive": False}
        )
        assert response.status_code == 404
        print("✅ Toggle nonexistent account returns 404")

    def test_toggle_system_account_blocked(self):
        """Cannot disable system accounts"""
        # Find a system account
        accounts_res = requests.get(f"{BASE_URL}/api/accounts")
        accounts = accounts_res.json()
        system_accs = [a for a in accounts if a.get("is_system")]
        if not system_accs:
            pytest.skip("No system accounts to test")
        
        system_id = system_accs[0]["id"]
        response = requests.patch(
            f"{BASE_URL}/api/accounts/{system_id}/active",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"isActive": False}
        )
        assert response.status_code == 400
        data = response.json()
        assert "نظام" in data.get("detail", "")  # Cannot disable system account
        print("✅ System accounts cannot be disabled")


class TestAccountDelete:
    """Test DELETE /api/accounts/{id} endpoint"""

    def test_delete_unauthorized_fails_403(self):
        """Unauthorized user (viewer role) gets 403 Forbidden on delete"""
        # Create account to test delete
        create_res = requests.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"code": f"TSTD{uuid.uuid4().hex[:6].upper()}", "name": "حساب اختبار حذف", "type": "expense"}
        )
        if create_res.status_code != 200:
            pytest.skip("Could not create test account")
        account_id = create_res.json()["data"]["id"]
        
        try:
            response = requests.delete(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers={"x-user-role": "viewer"}
            )
            assert response.status_code == 403
            data = response.json()
            assert "detail" in data
            assert len(data["detail"]) > 0  # Arabic message about manager access
            print(f"✅ Unauthorized delete returns 403 with message: {data['detail']}")
        finally:
            # Cleanup with manager
            requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers={"x-user-role": "manager"})

    def test_delete_authorized_manager_success(self):
        """Manager can delete non-system account"""
        # Create test account
        create_res = requests.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"code": f"TDEL{uuid.uuid4().hex[:6].upper()}", "name": "حساب للحذف", "type": "expense"}
        )
        assert create_res.status_code == 200
        account_id = create_res.json()["data"]["id"]
        
        # First toggle to inactive to test cleanup
        requests.patch(
            f"{BASE_URL}/api/accounts/{account_id}/active",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"isActive": False}
        )
        
        # Delete account
        response = requests.delete(
            f"{BASE_URL}/api/accounts/{account_id}",
            headers={"x-user-role": "manager"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print("✅ Manager can delete account")
        
        # Verify status override was cleaned up
        overrides_res = requests.get(f"{BASE_URL}/api/accounts/status-overrides")
        overrides = overrides_res.json().get("overrides", {})
        assert account_id not in overrides, "Status override should be cleaned up after delete"
        print("✅ Status override cleaned up after delete")

    def test_delete_nonexistent_account_404(self):
        """Delete nonexistent account returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/accounts/nonexistent-account-xyz",
            headers={"x-user-role": "manager"}
        )
        assert response.status_code == 404
        print("✅ Delete nonexistent account returns 404")

    def test_delete_system_account_blocked(self):
        """Cannot delete system accounts"""
        accounts_res = requests.get(f"{BASE_URL}/api/accounts")
        accounts = accounts_res.json()
        system_accs = [a for a in accounts if a.get("is_system")]
        if not system_accs:
            pytest.skip("No system accounts to test")
        
        system_id = system_accs[0]["id"]
        response = requests.delete(
            f"{BASE_URL}/api/accounts/{system_id}",
            headers={"x-user-role": "manager"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "نظام" in data.get("detail", "")
        print("✅ System accounts cannot be deleted")


class TestRegressionAccountCRUD:
    """Regression tests for existing account create/update functionality"""

    def test_create_account_still_works(self):
        """Creating new account still works"""
        code = f"REGC{uuid.uuid4().hex[:6].upper()}"
        response = requests.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"code": code, "name": "حساب اختبار انحدار", "type": "asset"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert data["data"]["code"] == code
        print("✅ Create account regression test passed")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/accounts/{data['data']['id']}", headers={"x-user-role": "manager"})

    def test_update_account_still_works(self):
        """Updating account still works"""
        # Create
        code = f"REGU{uuid.uuid4().hex[:6].upper()}"
        create_res = requests.post(
            f"{BASE_URL}/api/finance/chart-of-accounts?workshop_id=finmodule-sync",
            headers={"Content-Type": "application/json", "x-user-role": "manager"},
            json={"code": code, "name": "حساب قبل التعديل", "type": "liability"}
        )
        assert create_res.status_code == 200
        account_id = create_res.json()["data"]["id"]
        
        try:
            # Update
            update_res = requests.put(
                f"{BASE_URL}/api/accounts/{account_id}",
                headers={"Content-Type": "application/json", "x-user-role": "manager"},
                json={"name": "حساب بعد التعديل", "balance": 1500}
            )
            assert update_res.status_code == 200
            updated = update_res.json()
            assert updated.get("name") == "حساب بعد التعديل" or updated.get("name_ar") == "حساب بعد التعديل"
            print("✅ Update account regression test passed")
        finally:
            requests.delete(f"{BASE_URL}/api/accounts/{account_id}", headers={"x-user-role": "manager"})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
