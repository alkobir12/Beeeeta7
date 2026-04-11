"""
Iteration 117 - Liquid Builder Page Selector and Bot Tab Tests
Tests for:
- Page selector inside Liquid Builder with navigation between pages
- 4 tabs: العناصر / الكروت / التخطيط / البوت
- Elements tab with search + group filter + customized-only filter + pagination
- Bot tab inside builder working with rrr commands
- Customization API for different pages
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLiquidBuilderHealth:
    """Health check tests"""
    
    def test_health_check(self):
        """Test alkabeer-bot health endpoint"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "bot" in data
        print(f"✅ Health check passed: {data}")


class TestPageCustomization:
    """Tests for page-specific customization API"""
    
    def test_get_customization_dashboard(self):
        """Test getting customization for dashboard page"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["path"] == "/"
        assert "labels" in data["data"]
        assert "hidden" in data["data"]
        assert "contents" in data["data"]
        assert "custom_cards" in data["data"]
        print(f"✅ Dashboard customization: {data['data']}")
    
    def test_get_customization_customers(self):
        """Test getting customization for customers page"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": "/customers"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["path"] == "/customers"
        print(f"✅ Customers customization: {data['data']}")
    
    def test_get_customization_operations(self):
        """Test getting customization for operations page"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": "/operations"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["path"] == "/operations"
        print(f"✅ Operations customization: {data['data']}")
    
    def test_save_customization_for_page(self):
        """Test saving customization for a specific page"""
        test_path = "/test-page-117"
        payload = {
            "user_id": "manager",
            "path": test_path,
            "labels": {"test-element": "تسمية اختبارية"},
            "hidden": {"test-hidden": True},
            "contents": {"test-content": "محتوى اختباري"},
            "custom_cards": []
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["labels"]["test-element"] == "تسمية اختبارية"
        assert data["data"]["hidden"]["test-hidden"] == True
        assert data["data"]["contents"]["test-content"] == "محتوى اختباري"
        print(f"✅ Saved customization for {test_path}")
    
    def test_get_saved_customization(self):
        """Test retrieving saved customization"""
        test_path = "/test-page-117"
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": test_path}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["labels"].get("test-element") == "تسمية اختبارية"
        print(f"✅ Retrieved saved customization")


class TestBotTabRRRMode:
    """Tests for bot tab rrr developer mode"""
    
    def test_rrr_activates_dev_mode_for_manager(self):
        """Test that rrr command activates dev mode for manager role"""
        session_id = f"test-rrr-{uuid.uuid4()}"
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "مدير",
            "userId": "manager",
            "currentPath": "/customers",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "dev"
        assert "وضع المطور" in data["response"] or "RRR" in data["response"]
        print(f"✅ rrr activated dev mode: {data['response'][:100]}...")
        return session_id
    
    def test_exit_deactivates_dev_mode(self):
        """Test that EXIT command deactivates dev mode"""
        # First activate dev mode
        session_id = f"test-exit-{uuid.uuid4()}"
        activate_payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "مدير",
            "userId": "manager",
            "currentPath": "/",
            "uiSnapshot": []
        }
        requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=activate_payload)
        
        # Then exit
        exit_payload = {
            "message": "EXIT",
            "sessionId": session_id,
            "role": "مدير",
            "userId": "manager",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=exit_payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "user"
        assert "الخروج" in data["response"] or "خدمة العملاء" in data["response"]
        print(f"✅ EXIT deactivated dev mode: {data['response']}")
    
    def test_rrr_denied_for_non_manager(self):
        """Test that rrr command is denied for non-manager roles"""
        session_id = f"test-denied-{uuid.uuid4()}"
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "user",
            "userId": "regular_user",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "user"
        assert "المدير" in data["response"] or "غير متاح" in data["response"] or "⛔" in data["response"]
        print(f"✅ rrr denied for non-manager: {data['response']}")
    
    def test_dev_mode_hide_command(self):
        """Test hide command in dev mode"""
        session_id = f"test-hide-{uuid.uuid4()}"
        
        # Activate dev mode
        requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": session_id,
                "role": "مدير",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": [{"testid": "test-button", "text": "زر اختبار"}]
            }
        )
        
        # Send hide command
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "اخف زر اختبار",
                "sessionId": session_id,
                "role": "مدير",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": [{"testid": "test-button", "text": "زر اختبار"}]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "dev"
        print(f"✅ Hide command processed: {data['response']}")
    
    def test_dev_mode_reset_page(self):
        """Test reset_page command in dev mode"""
        session_id = f"test-reset-{uuid.uuid4()}"
        
        # Activate dev mode
        requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": session_id,
                "role": "مدير",
                "userId": "manager",
                "currentPath": "/test-reset-page",
                "uiSnapshot": []
            }
        )
        
        # Send reset command
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "reset_page",
                "sessionId": session_id,
                "role": "مدير",
                "userId": "manager",
                "currentPath": "/test-reset-page",
                "uiSnapshot": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "dev"
        assert "إعادة" in data["response"] or "الأصلي" in data["response"] or "✅" in data["response"]
        print(f"✅ Reset page command processed: {data['response']}")


class TestMultiPageCustomization:
    """Tests for customization across multiple pages"""
    
    def test_different_pages_have_separate_configs(self):
        """Test that different pages maintain separate configurations"""
        # Save config for page 1
        requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json={
                "user_id": "manager",
                "path": "/page-a-117",
                "labels": {"element-a": "Label A"},
                "hidden": {},
                "contents": {},
                "custom_cards": []
            }
        )
        
        # Save config for page 2
        requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json={
                "user_id": "manager",
                "path": "/page-b-117",
                "labels": {"element-b": "Label B"},
                "hidden": {},
                "contents": {},
                "custom_cards": []
            }
        )
        
        # Verify page 1 config
        response_a = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": "/page-a-117"}
        )
        data_a = response_a.json()
        assert data_a["data"]["labels"].get("element-a") == "Label A"
        assert "element-b" not in data_a["data"]["labels"]
        
        # Verify page 2 config
        response_b = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": "/page-b-117"}
        )
        data_b = response_b.json()
        assert data_b["data"]["labels"].get("element-b") == "Label B"
        assert "element-a" not in data_b["data"]["labels"]
        
        print("✅ Different pages have separate configurations")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_pages(self):
        """Clean up test page configurations"""
        test_paths = ["/test-page-117", "/page-a-117", "/page-b-117", "/test-reset-page"]
        for path in test_paths:
            requests.put(
                f"{BASE_URL}/api/alkabeer-bot/customization",
                json={
                    "user_id": "manager",
                    "path": path,
                    "labels": {},
                    "hidden": {},
                    "contents": {},
                    "custom_cards": []
                }
            )
        print("✅ Test data cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
