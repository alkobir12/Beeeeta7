"""
Test MoltBot Page Manifest Integration - Iteration 127
Tests the page_manifest field in customization API and MoltBot editor functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMoltBotManifestAPI:
    """Tests for page_manifest in customization API"""
    
    def test_health_check(self):
        """Verify alkabeer-bot health endpoint"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Health check passed: {data}")
    
    def test_get_customization_returns_page_manifest(self):
        """GET /api/alkabeer-bot/customization should return page_manifest field"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "manager", "path": "/moltbot"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify page_manifest field exists in response
        customization_data = data.get("data", {})
        assert "page_manifest" in customization_data, "page_manifest field missing from response"
        print(f"✓ GET customization returns page_manifest: {customization_data.get('page_manifest')}")
    
    def test_save_customization_with_page_manifest(self):
        """PUT /api/alkabeer-bot/customization should accept and save page_manifest"""
        test_manifest = {
            "pageId": "test-page",
            "version": {"current": "draft", "published": None},
            "status": "active",
            "device": "desktop",
            "meta": {
                "title": "Test Page",
                "description": "Test description",
                "slug": "test-page"
            },
            "activeFlags": {
                "editable": True,
                "locked": False,
                "published": False,
                "previewMode": False
            },
            "timestamps": {
                "createdAt": None,
                "updatedAt": "2026-01-01T00:00:00Z",
                "publishedAt": None
            },
            "uiState": {
                "selectedElementId": None,
                "hoverElementId": None,
                "zoom": 100,
                "grid": True,
                "snap": True
            },
            "security": {
                "isValid": True,
                "lastValidatedAt": None
            }
        }
        
        payload = {
            "user_id": "TEST_manifest_user",
            "path": "/test-manifest-page",
            "labels": {"test-label": "Test Label Value"},
            "hidden": {},
            "contents": {},
            "custom_cards": [],
            "block_order": [],
            "positions": {},
            "page_manifest": test_manifest
        }
        
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify page_manifest was saved
        saved_data = data.get("data", {})
        assert "page_manifest" in saved_data
        saved_manifest = saved_data.get("page_manifest", {})
        assert saved_manifest.get("pageId") == "test-page"
        assert saved_manifest.get("status") == "active"
        assert saved_manifest.get("device") == "desktop"
        print(f"✓ PUT customization saved page_manifest correctly")
    
    def test_get_saved_manifest_persists(self):
        """Verify saved page_manifest persists on GET"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": "TEST_manifest_user", "path": "/test-manifest-page"}
        )
        assert response.status_code == 200
        data = response.json()
        
        customization_data = data.get("data", {})
        manifest = customization_data.get("page_manifest", {})
        assert manifest.get("pageId") == "test-page"
        print(f"✓ GET returns persisted page_manifest: pageId={manifest.get('pageId')}")
    
    def test_update_manifest_version_to_published(self):
        """Test updating manifest version from draft to published"""
        updated_manifest = {
            "pageId": "test-page",
            "version": {"current": "draft", "published": "published"},
            "status": "active",
            "device": "desktop",
            "meta": {
                "title": "Test Page Updated",
                "description": "Updated description",
                "slug": "test-page"
            },
            "activeFlags": {
                "editable": True,
                "locked": False,
                "published": True,
                "previewMode": False
            },
            "timestamps": {
                "createdAt": None,
                "updatedAt": "2026-01-01T12:00:00Z",
                "publishedAt": "2026-01-01T12:00:00Z"
            }
        }
        
        payload = {
            "user_id": "TEST_manifest_user",
            "path": "/test-manifest-page",
            "page_manifest": updated_manifest
        }
        
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        saved_manifest = data.get("data", {}).get("page_manifest", {})
        assert saved_manifest.get("activeFlags", {}).get("published") == True
        assert saved_manifest.get("version", {}).get("published") == "published"
        print(f"✓ Manifest updated to published state")
    
    def test_customization_with_all_fields(self):
        """Test saving customization with all fields including page_manifest"""
        payload = {
            "user_id": "TEST_full_config",
            "path": "/test-full-page",
            "labels": {"header-title": "Custom Header"},
            "hidden": {"footer-section": True},
            "contents": {"main-content": "Custom content text"},
            "custom_cards": [
                {
                    "id": "card-test-1",
                    "title": "Test Card",
                    "description": "Test description",
                    "fields": [
                        {"id": "field-1", "label": "Field 1", "value": "Value 1"}
                    ]
                }
            ],
            "block_order": ["header-title", "main-content", "footer-section"],
            "positions": {"header-title": {"left": 10, "top": 20}},
            "page_manifest": {
                "pageId": "test-full-page",
                "version": {"current": "draft", "published": None},
                "status": "active",
                "device": "tablet"
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        saved = data.get("data", {})
        assert saved.get("labels", {}).get("header-title") == "Custom Header"
        assert saved.get("hidden", {}).get("footer-section") == True
        assert len(saved.get("custom_cards", [])) >= 1
        assert saved.get("page_manifest", {}).get("device") == "tablet"
        print(f"✓ Full customization with page_manifest saved correctly")
    
    def test_cleanup_test_data(self):
        """Cleanup test data created during tests"""
        # Reset test user configs
        for path in ["/test-manifest-page", "/test-full-page"]:
            payload = {
                "user_id": "TEST_manifest_user",
                "path": path,
                "labels": {},
                "hidden": {},
                "contents": {},
                "custom_cards": [],
                "block_order": [],
                "positions": {},
                "page_manifest": {}
            }
            requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=payload)
        
        payload = {
            "user_id": "TEST_full_config",
            "path": "/test-full-page",
            "labels": {},
            "hidden": {},
            "contents": {},
            "custom_cards": [],
            "block_order": [],
            "positions": {},
            "page_manifest": {}
        }
        requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=payload)
        print("✓ Test data cleanup completed")


class TestMoltBotChatDevMode:
    """Tests for MoltBot chat developer mode with page_manifest context"""
    
    def test_chat_health(self):
        """Verify chat endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        print("✓ Chat health check passed")
    
    def test_chat_normal_mode(self):
        """Test normal chat mode (non-developer)"""
        payload = {
            "message": "مرحبا",
            "sessionId": "test-session-normal",
            "role": "user",
            "userId": "test-user",
            "currentPath": "/",
            "uiSnapshot": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data.get("mode") == "user"
        print(f"✓ Normal chat mode works: mode={data.get('mode')}")
    
    def test_dev_mode_entry_requires_manager(self):
        """Test that dev mode (rrr) requires manager role"""
        # Non-manager should be denied
        payload = {
            "message": "rrr",
            "sessionId": "test-session-dev-denied",
            "role": "user",
            "userId": "regular-user",
            "currentPath": "/",
            "uiSnapshot": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "وضع المطور متاح للمدير فقط" in data.get("response", "") or data.get("mode") == "user"
        print(f"✓ Dev mode correctly restricted for non-managers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
