"""
Test Iteration 121: Liquid Builder API Tests
Tests for Canvas, Copy/Paste, Move Cards, Bot Local Commands
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAlkabeerBotHealth:
    """Health check for alkabeer-bot"""
    
    def test_health_endpoint(self):
        """Test bot health endpoint"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "bot" in data
        print(f"✅ Health check passed: {data}")


class TestCustomizationAPI:
    """Test customization CRUD operations"""
    
    def test_get_customization_default(self):
        """Test getting default customization"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "test_user_121", "path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "data" in data
        assert "labels" in data["data"]
        assert "hidden" in data["data"]
        assert "contents" in data["data"]
        assert "custom_cards" in data["data"]
        assert "block_order" in data["data"]
        print(f"✅ Get customization passed")
    
    def test_save_customization_with_custom_card(self):
        """Test saving customization with custom card"""
        payload = {
            "user_id": "test_user_121",
            "path": "/test-page",
            "labels": {"test-element": "Test Label"},
            "hidden": {"hidden-element": True},
            "contents": {"content-element": "Test Content"},
            "custom_cards": [
                {
                    "id": "test-card-121",
                    "title": "Test Card 121",
                    "description": "Test description",
                    "fields": [
                        {"id": "field-1", "label": "Field 1", "value": "Value 1"}
                    ]
                }
            ],
            "block_order": ["block-1", "block-2"]
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data["data"]["labels"].get("test-element") == "Test Label"
        assert len(data["data"]["custom_cards"]) >= 1
        print(f"✅ Save customization with custom card passed")
    
    def test_get_saved_customization(self):
        """Test retrieving saved customization"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "test_user_121", "path": "/test-page"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data["data"]["labels"].get("test-element") == "Test Label"
        print(f"✅ Get saved customization passed")
    
    def test_update_customization_move_card(self):
        """Test updating customization (simulating card move)"""
        # First save to source page
        source_payload = {
            "user_id": "test_user_121",
            "path": "/source-page",
            "labels": {},
            "hidden": {},
            "contents": {},
            "custom_cards": [
                {
                    "id": "card-to-move",
                    "title": "Card to Move",
                    "description": "This card will be moved",
                    "fields": []
                }
            ],
            "block_order": []
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=source_payload
        )
        assert response.status_code == 200
        
        # Then save to target page (simulating move)
        target_payload = {
            "user_id": "test_user_121",
            "path": "/target-page",
            "labels": {},
            "hidden": {},
            "contents": {},
            "custom_cards": [
                {
                    "id": "card-moved",
                    "title": "Card to Move",
                    "description": "This card was moved",
                    "fields": []
                }
            ],
            "block_order": []
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=target_payload
        )
        assert response.status_code == 200
        
        # Verify target has the card
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "test_user_121", "path": "/target-page"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["custom_cards"]) >= 1
        print(f"✅ Card move simulation passed")


class TestBotChat:
    """Test bot chat functionality"""
    
    def test_chat_rrr_developer_mode(self):
        """Test entering developer mode with rrr"""
        payload = {
            "message": "rrr",
            "sessionId": "test-session-121",
            "role": "manager",
            "userId": "test_user_121",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mode") == "dev"
        assert "وضع المطور" in data.get("response", "")
        print(f"✅ Developer mode (rrr) passed")
    
    def test_chat_exit_developer_mode(self):
        """Test exiting developer mode"""
        # First enter dev mode
        requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": "test-session-exit-121",
                "role": "manager",
                "userId": "test_user_121",
                "currentPath": "/",
                "uiSnapshot": []
            }
        )
        
        # Then exit
        payload = {
            "message": "EXIT",
            "sessionId": "test-session-exit-121",
            "role": "manager",
            "userId": "test_user_121",
            "currentPath": "/",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mode") == "user"
        assert "الخروج" in data.get("response", "")
        print(f"✅ Exit developer mode passed")
    
    def test_chat_add_card_command(self):
        """Test adding card via bot command"""
        # Enter dev mode
        requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": "test-session-addcard-121",
                "role": "manager",
                "userId": "test_user_121",
                "currentPath": "/test-bot-page",
                "uiSnapshot": []
            }
        )
        
        # Add card command
        payload = {
            "message": "اضف كرت متابعة سريعة",
            "sessionId": "test-session-addcard-121",
            "role": "manager",
            "userId": "test_user_121",
            "currentPath": "/test-bot-page",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mode") == "dev"
        # Check if customization was returned
        if data.get("customization"):
            assert "custom_cards" in data["customization"]
        print(f"✅ Add card command passed")
    
    def test_chat_reset_page_command(self):
        """Test reset page command"""
        # Enter dev mode
        requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": "test-session-reset-121",
                "role": "manager",
                "userId": "test_user_121",
                "currentPath": "/test-reset-page",
                "uiSnapshot": []
            }
        )
        
        # Reset page command
        payload = {
            "message": "reset_page",
            "sessionId": "test-session-reset-121",
            "role": "manager",
            "userId": "test_user_121",
            "currentPath": "/test-reset-page",
            "uiSnapshot": []
        }
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "إعادة" in data.get("response", "") or "reset" in data.get("response", "").lower()
        print(f"✅ Reset page command passed")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Clean up test customizations"""
        # Reset test pages
        for path in ["/test-page", "/source-page", "/target-page", "/test-bot-page", "/test-reset-page"]:
            payload = {
                "user_id": "test_user_121",
                "path": path,
                "labels": {},
                "hidden": {},
                "contents": {},
                "custom_cards": [],
                "block_order": []
            }
            response = requests.put(
                f"{BASE_URL}/api/alkabeer-bot/customization",
                json=payload
            )
            assert response.status_code == 200
        print(f"✅ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
