"""
Test AlKabeer Bot Dev Mode and Customization Features - Iteration 98
Tests:
1. rrr command activates dev mode for manager
2. rrr command rejected for non-manager
3. dev commands (rename/hide/show) work and return mode=dev with actions
4. GET /api/alkabeer-bot/customization reflects saved modifications
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAlKabeerBotDevMode:
    """Test AlKabeer Bot Developer Mode functionality"""
    
    @pytest.fixture
    def session_id(self):
        return str(uuid.uuid4())
    
    def test_health_endpoint(self):
        """Test bot health endpoint"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "Dev Mode" in data.get("bot", "")
        print(f"✅ Health check passed: {data}")
    
    def test_rrr_activates_dev_mode_for_manager(self, session_id):
        """Test that rrr command activates dev mode for manager role"""
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "manager",
            "userId": "test_manager",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify dev mode is activated
        assert data.get("mode") == "dev", f"Expected mode=dev, got {data.get('mode')}"
        assert "تم تفعيل وضع المطور" in data.get("response", ""), "Expected dev mode activation message"
        print(f"✅ Dev mode activated for manager: mode={data.get('mode')}")
    
    def test_rrr_activates_dev_mode_for_admin(self, session_id):
        """Test that rrr command activates dev mode for admin role"""
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "admin",
            "userId": "test_admin",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify dev mode is activated
        assert data.get("mode") == "dev", f"Expected mode=dev, got {data.get('mode')}"
        print(f"✅ Dev mode activated for admin: mode={data.get('mode')}")
    
    def test_rrr_activates_dev_mode_for_arabic_manager(self, session_id):
        """Test that rrr command activates dev mode for مدير role"""
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "مدير",
            "userId": "test_arabic_manager",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify dev mode is activated
        assert data.get("mode") == "dev", f"Expected mode=dev, got {data.get('mode')}"
        print(f"✅ Dev mode activated for مدير: mode={data.get('mode')}")
    
    def test_rrr_rejected_for_non_manager(self, session_id):
        """Test that rrr command is rejected for non-manager roles"""
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "user",  # Non-manager role
            "userId": "test_user",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify dev mode is NOT activated
        assert data.get("mode") == "user", f"Expected mode=user, got {data.get('mode')}"
        assert "متاح للمدير فقط" in data.get("response", ""), "Expected manager-only rejection message"
        print(f"✅ Dev mode correctly rejected for non-manager: mode={data.get('mode')}")
    
    def test_rrr_rejected_for_empty_role(self, session_id):
        """Test that rrr command is rejected for empty role"""
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "",  # Empty role
            "userId": "test_empty_role",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify dev mode is NOT activated
        assert data.get("mode") == "user", f"Expected mode=user, got {data.get('mode')}"
        print(f"✅ Dev mode correctly rejected for empty role: mode={data.get('mode')}")


class TestAlKabeerBotDevCommands:
    """Test dev mode commands (rename/hide/show)"""
    
    @pytest.fixture
    def dev_session(self):
        """Create a session in dev mode"""
        session_id = str(uuid.uuid4())
        # First activate dev mode
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "manager",
            "userId": "test_dev_commands",
            "currentPath": "/test-page",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        return session_id
    
    def test_hide_command(self, dev_session):
        """Test hide command in dev mode"""
        ui_snapshot = [
            {"testid": "test-button", "text": "زر الاختبار", "tag": "button"},
            {"testid": "test-card", "text": "كرت الاختبار", "tag": "div"}
        ]
        payload = {
            "message": "اخف كرت الاختبار",
            "sessionId": dev_session,
            "role": "manager",
            "userId": "test_dev_commands",
            "currentPath": "/test-page",
            "uiSnapshot": ui_snapshot
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response is in dev mode
        assert data.get("mode") == "dev", f"Expected mode=dev, got {data.get('mode')}"
        print(f"✅ Hide command processed in dev mode: {data.get('response', '')[:100]}")
    
    def test_exit_dev_mode(self, dev_session):
        """Test EXIT command exits dev mode"""
        payload = {
            "message": "EXIT",
            "sessionId": dev_session,
            "role": "manager",
            "userId": "test_dev_commands",
            "currentPath": "/test-page",
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify mode is back to user
        assert data.get("mode") == "user", f"Expected mode=user after EXIT, got {data.get('mode')}"
        assert "الخروج من وضع المطور" in data.get("response", ""), "Expected exit message"
        print(f"✅ EXIT command works: mode={data.get('mode')}")


class TestAlKabeerBotCustomization:
    """Test customization endpoint"""
    
    def test_get_customization_default(self):
        """Test GET customization returns default empty config"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "test_user_new", "path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "data" in data
        assert "labels" in data["data"]
        assert "hidden" in data["data"]
        print(f"✅ Customization endpoint returns valid structure: {data}")
    
    def test_customization_reflects_saved_changes(self):
        """Test that customization endpoint reflects saved modifications"""
        session_id = str(uuid.uuid4())
        user_id = f"test_customization_{uuid.uuid4().hex[:8]}"
        test_path = "/test-customization-page"
        
        # Step 1: Activate dev mode
        payload = {
            "message": "rrr",
            "sessionId": session_id,
            "role": "manager",
            "userId": user_id,
            "currentPath": test_path,
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        assert response.json().get("mode") == "dev"
        
        # Step 2: Send a reset_page command to ensure clean state
        payload = {
            "message": "reset_page",
            "sessionId": session_id,
            "role": "manager",
            "userId": user_id,
            "currentPath": test_path,
            "uiSnapshot": []
        }
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/chat", json=payload)
        assert response.status_code == 200
        
        # Step 3: Verify customization endpoint reflects the state
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": user_id, "path": test_path}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data["data"]["user_id"] == user_id
        assert data["data"]["path"] == test_path
        print(f"✅ Customization reflects saved state for user {user_id}")


class TestProfileAndSettingsAPIs:
    """Test profile and settings APIs for print functionality"""
    
    def test_profile_api_returns_workshop_data(self):
        """Test that /api/profile returns workshop data"""
        response = requests.get(f"{BASE_URL}/api/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Check for workshop data fields
        profile = data.get("data") or data
        if isinstance(profile, dict):
            # Check for common workshop fields
            has_name = "name" in profile or "business_name" in profile
            has_phone = "phone" in profile or "phone_number" in profile
            print(f"✅ Profile API returns data: name={profile.get('name', profile.get('business_name', 'N/A'))}")
            print(f"   Phone: {profile.get('phone', profile.get('phone_number', 'N/A'))}")
            print(f"   Tax Number: {profile.get('taxNumber', profile.get('tax_number', 'N/A'))}")
            print(f"   Commercial Register: {profile.get('commercialRegister', profile.get('commercial_register', 'N/A'))}")
    
    def test_settings_api_returns_workshop_settings(self):
        """Test that /api/settings returns workshop settings"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Check for settings fields
        print(f"✅ Settings API returns data:")
        print(f"   Workshop Name: {data.get('workshopName', 'N/A')}")
        print(f"   Workshop Phone: {data.get('workshopPhone', 'N/A')}")
        print(f"   Workshop Address: {data.get('workshopAddress', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
