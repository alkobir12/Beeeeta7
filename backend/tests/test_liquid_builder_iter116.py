"""
Iteration 116 - Liquid Site Builder API Tests
Tests for GET/PUT /api/alkabeer-bot/customization with labels/hidden/contents/custom_cards
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user ID for cleanup
TEST_USER_ID = f"builder_test_user_{uuid.uuid4().hex[:8]}"
TEST_PATH = "/ai-financial"


class TestCustomizationAPI:
    """Tests for /api/alkabeer-bot/customization endpoint"""

    def test_health_check(self):
        """Verify alkabeer-bot health endpoint"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Health check passed: {data}")

    def test_get_customization_default(self):
        """GET customization returns default empty config for new user"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": TEST_USER_ID, "path": TEST_PATH}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        cfg = data["data"]
        assert cfg.get("user_id") == TEST_USER_ID
        assert cfg.get("path") == TEST_PATH
        assert "labels" in cfg
        assert "hidden" in cfg
        assert "contents" in cfg
        assert "custom_cards" in cfg
        print(f"✓ GET customization default: {cfg}")

    def test_put_customization_labels(self):
        """PUT customization with labels updates correctly"""
        payload = {
            "user_id": TEST_USER_ID,
            "path": TEST_PATH,
            "labels": {"test-element-1": "تسمية جديدة", "test-element-2": "عنوان مخصص"},
            "hidden": {},
            "contents": {},
            "custom_cards": []
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        cfg = data["data"]
        assert cfg["labels"].get("test-element-1") == "تسمية جديدة"
        assert cfg["labels"].get("test-element-2") == "عنوان مخصص"
        print(f"✓ PUT labels: {cfg['labels']}")

    def test_put_customization_hidden(self):
        """PUT customization with hidden elements"""
        payload = {
            "user_id": TEST_USER_ID,
            "path": TEST_PATH,
            "labels": {"test-element-1": "تسمية جديدة"},
            "hidden": {"test-hidden-element": True, "test-visible-element": False},
            "contents": {},
            "custom_cards": []
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        cfg = data["data"]
        assert cfg["hidden"].get("test-hidden-element") is True
        assert cfg["hidden"].get("test-visible-element") is False
        print(f"✓ PUT hidden: {cfg['hidden']}")

    def test_put_customization_contents(self):
        """PUT customization with contents override"""
        payload = {
            "user_id": TEST_USER_ID,
            "path": TEST_PATH,
            "labels": {},
            "hidden": {},
            "contents": {"test-content-element": "محتوى مخصص جديد"},
            "custom_cards": []
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        cfg = data["data"]
        assert cfg["contents"].get("test-content-element") == "محتوى مخصص جديد"
        print(f"✓ PUT contents: {cfg['contents']}")

    def test_put_customization_custom_cards(self):
        """PUT customization with custom_cards"""
        test_card = {
            "id": f"card-{uuid.uuid4().hex[:8]}",
            "title": "كرت اختباري",
            "description": "وصف الكرت الاختباري",
            "fields": [
                {"id": "field-1", "label": "حقل 1", "value": "قيمة 1"},
                {"id": "field-2", "label": "حقل 2", "value": "قيمة 2"}
            ]
        }
        payload = {
            "user_id": TEST_USER_ID,
            "path": TEST_PATH,
            "labels": {},
            "hidden": {},
            "contents": {},
            "custom_cards": [test_card]
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        cfg = data["data"]
        assert len(cfg["custom_cards"]) >= 1
        saved_card = cfg["custom_cards"][0]
        assert saved_card["title"] == "كرت اختباري"
        assert saved_card["description"] == "وصف الكرت الاختباري"
        assert len(saved_card["fields"]) == 2
        print(f"✓ PUT custom_cards: {saved_card['title']} with {len(saved_card['fields'])} fields")

    def test_get_customization_after_put(self):
        """GET customization returns previously saved data"""
        # First save some data
        test_card = {
            "id": f"card-verify-{uuid.uuid4().hex[:8]}",
            "title": "كرت التحقق",
            "description": "للتحقق من الحفظ",
            "fields": [{"id": "f1", "label": "اسم", "value": "قيمة"}]
        }
        payload = {
            "user_id": TEST_USER_ID,
            "path": TEST_PATH,
            "labels": {"verify-label": "تسمية التحقق"},
            "hidden": {"verify-hidden": True},
            "contents": {"verify-content": "محتوى التحقق"},
            "custom_cards": [test_card]
        }
        put_response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=payload
        )
        assert put_response.status_code == 200

        # Now GET and verify
        get_response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": TEST_USER_ID, "path": TEST_PATH}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        cfg = data["data"]
        
        assert cfg["labels"].get("verify-label") == "تسمية التحقق"
        assert cfg["hidden"].get("verify-hidden") is True
        assert cfg["contents"].get("verify-content") == "محتوى التحقق"
        assert len(cfg["custom_cards"]) >= 1
        print(f"✓ GET after PUT verified: labels={len(cfg['labels'])}, hidden={len(cfg['hidden'])}, contents={len(cfg['contents'])}, cards={len(cfg['custom_cards'])}")

    def test_put_customization_full_schema(self):
        """PUT customization with all fields populated"""
        full_payload = {
            "user_id": TEST_USER_ID,
            "path": TEST_PATH,
            "labels": {
                "element-a": "تسمية أ",
                "element-b": "تسمية ب",
                "element-c": "تسمية ج"
            },
            "hidden": {
                "hide-1": True,
                "hide-2": True,
                "show-1": False
            },
            "contents": {
                "content-1": "محتوى مخصص 1",
                "content-2": "محتوى مخصص 2"
            },
            "custom_cards": [
                {
                    "id": "card-full-1",
                    "title": "كرت كامل 1",
                    "description": "وصف كامل",
                    "fields": [
                        {"id": "f1", "label": "حقل أول", "value": "100"},
                        {"id": "f2", "label": "حقل ثاني", "value": "200"}
                    ]
                },
                {
                    "id": "card-full-2",
                    "title": "كرت كامل 2",
                    "description": "",
                    "fields": []
                }
            ]
        }
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json=full_payload
        )
        assert response.status_code == 200
        data = response.json()
        cfg = data["data"]
        
        assert len(cfg["labels"]) == 3
        assert len(cfg["hidden"]) == 3
        assert len(cfg["contents"]) == 2
        assert len(cfg["custom_cards"]) == 2
        print(f"✓ Full schema PUT: labels={len(cfg['labels'])}, hidden={len(cfg['hidden'])}, contents={len(cfg['contents'])}, cards={len(cfg['custom_cards'])}")

    def test_customization_different_paths(self):
        """Customization is path-specific"""
        path_a = "/test-path-a"
        path_b = "/test-path-b"
        
        # Save to path A
        requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json={
                "user_id": TEST_USER_ID,
                "path": path_a,
                "labels": {"path-a-label": "مسار أ"},
                "hidden": {},
                "contents": {},
                "custom_cards": []
            }
        )
        
        # Save to path B
        requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json={
                "user_id": TEST_USER_ID,
                "path": path_b,
                "labels": {"path-b-label": "مسار ب"},
                "hidden": {},
                "contents": {},
                "custom_cards": []
            }
        )
        
        # Verify path A
        res_a = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": TEST_USER_ID, "path": path_a}
        )
        cfg_a = res_a.json()["data"]
        assert cfg_a["labels"].get("path-a-label") == "مسار أ"
        assert "path-b-label" not in cfg_a["labels"]
        
        # Verify path B
        res_b = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"user_id": TEST_USER_ID, "path": path_b}
        )
        cfg_b = res_b.json()["data"]
        assert cfg_b["labels"].get("path-b-label") == "مسار ب"
        assert "path-a-label" not in cfg_b["labels"]
        
        print(f"✓ Path-specific customization verified: path_a has {len(cfg_a['labels'])} labels, path_b has {len(cfg_b['labels'])} labels")

    def test_customization_manager_default_user(self):
        """Default user_id is 'manager' when not specified"""
        response = requests.get(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            params={"path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should default to manager
        assert data["data"]["user_id"] == "manager"
        print(f"✓ Default user_id is 'manager'")

    def test_cleanup_test_data(self):
        """Cleanup: Reset test user's customizations"""
        # Reset the test path
        response = requests.put(
            f"{BASE_URL}/api/alkabeer-bot/customization",
            json={
                "user_id": TEST_USER_ID,
                "path": TEST_PATH,
                "labels": {},
                "hidden": {},
                "contents": {},
                "custom_cards": []
            }
        )
        assert response.status_code == 200
        print(f"✓ Cleanup: Reset {TEST_USER_ID} customizations for {TEST_PATH}")


class TestChatWidgetRRRIntegration:
    """Tests for ChatWidget rrr developer mode integration"""

    def test_rrr_mode_requires_manager_role(self):
        """rrr command requires manager/admin role"""
        # Test with non-manager role
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": f"test-session-{uuid.uuid4().hex[:8]}",
                "role": "user",  # Not manager
                "userId": "test-user",
                "currentPath": "/",
                "uiSnapshot": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Should be denied
        assert "وضع المطور متاح للمدير فقط" in data.get("response", "") or data.get("mode") == "user"
        print(f"✓ rrr denied for non-manager: {data.get('response', '')[:50]}...")

    def test_rrr_mode_activates_for_manager(self):
        """rrr command activates dev mode for manager"""
        session_id = f"test-session-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": session_id,
                "role": "manager",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mode") == "dev"
        assert "تم تفعيل وضع المطور" in data.get("response", "")
        print(f"✓ rrr activated for manager: mode={data.get('mode')}")

    def test_dev_mode_exit(self):
        """EXIT command exits dev mode"""
        session_id = f"test-session-{uuid.uuid4().hex[:8]}"
        
        # First activate dev mode
        requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "rrr",
                "sessionId": session_id,
                "role": "manager",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": []
            }
        )
        
        # Now exit
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/chat",
            json={
                "message": "EXIT",
                "sessionId": session_id,
                "role": "manager",
                "userId": "manager",
                "currentPath": "/",
                "uiSnapshot": []
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mode") == "user"
        assert "تم الخروج من وضع المطور" in data.get("response", "")
        print(f"✓ EXIT command works: mode={data.get('mode')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
