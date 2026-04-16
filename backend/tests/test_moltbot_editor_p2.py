"""
MoltBot Editor P2 Tests - Supabase basics: save/history/comments
Tests for /api/alkabeer-bot/editor/* endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMoltBotEditorDraft:
    """Tests for editor draft endpoints"""
    
    def test_get_editor_draft_default(self):
        """GET /api/alkabeer-bot/editor/draft - default user/path"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/editor/draft", params={
            "user_id": "manager",
            "path": "/"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        draft = data["data"]
        assert "user_id" in draft
        assert "path" in draft
        assert "version" in draft
        assert "status" in draft
        assert "config" in draft
        print(f"✓ GET draft: version={draft.get('version')}, status={draft.get('status')}")
    
    def test_save_editor_draft(self):
        """POST /api/alkabeer-bot/editor/draft/save - save a new draft"""
        test_path = f"/test-page-{uuid.uuid4().hex[:8]}"
        test_config = {
            "labels": {"test-block-1": "عنوان تجريبي"},
            "contents": {"test-block-1": "محتوى تجريبي"},
            "hidden": {},
            "styles": {"test-block-1": {"backgroundColor": "#f0f0f0"}},
            "assets": {},
            "custom_cards": [],
            "block_order": [],
            "positions": {},
            "page_manifest": {}
        }
        
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/draft/save", json={
            "user_id": "manager",
            "path": test_path,
            "config": test_config,
            "note": "test_save",
            "status": "draft"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        saved = data.get("data", {})
        assert saved.get("version") >= 1
        assert saved.get("status") == "draft"
        assert saved.get("path") == test_path
        print(f"✓ Save draft: version={saved.get('version')}, id={saved.get('id')}")
        return test_path, saved
    
    def test_save_draft_then_get_verifies_persistence(self):
        """Save draft then GET to verify persistence"""
        test_path = f"/persist-test-{uuid.uuid4().hex[:8]}"
        test_config = {
            "labels": {"persist-block": "تسمية للحفظ"},
            "contents": {"persist-block": "محتوى للحفظ"},
            "hidden": {},
            "styles": {},
            "assets": {},
            "custom_cards": [],
            "block_order": [],
            "positions": {},
            "page_manifest": {}
        }
        
        # Save
        save_response = requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/draft/save", json={
            "user_id": "manager",
            "path": test_path,
            "config": test_config,
            "note": "persistence_test",
            "status": "draft"
        })
        assert save_response.status_code == 200
        saved = save_response.json().get("data", {})
        saved_version = saved.get("version")
        
        # GET to verify
        get_response = requests.get(f"{BASE_URL}/api/alkabeer-bot/editor/draft", params={
            "user_id": "manager",
            "path": test_path
        })
        assert get_response.status_code == 200
        fetched = get_response.json().get("data", {})
        assert fetched.get("version") == saved_version
        assert fetched.get("config", {}).get("labels", {}).get("persist-block") == "تسمية للحفظ"
        print(f"✓ Draft persistence verified: version={saved_version}")


class TestMoltBotEditorPublish:
    """Tests for editor publish endpoint"""
    
    def test_publish_editor_draft(self):
        """POST /api/alkabeer-bot/editor/publish - publish changes"""
        test_path = f"/publish-test-{uuid.uuid4().hex[:8]}"
        test_config = {
            "labels": {"publish-block": "عنوان منشور"},
            "contents": {"publish-block": "محتوى منشور"},
            "hidden": {},
            "styles": {},
            "assets": {},
            "custom_cards": [],
            "block_order": [],
            "positions": {},
            "page_manifest": {}
        }
        
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/publish", json={
            "user_id": "manager",
            "path": test_path,
            "config": test_config,
            "note": "publish_test",
            "status": "published"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        published = data.get("data", {})
        assert published.get("status") == "published"
        print(f"✓ Publish: version={published.get('version')}, status={published.get('status')}")
        
        # Verify customization was updated
        custom_response = requests.get(f"{BASE_URL}/api/alkabeer-bot/customization", params={
            "user_id": "manager",
            "path": test_path
        })
        assert custom_response.status_code == 200
        custom_data = custom_response.json().get("data", {})
        assert custom_data.get("labels", {}).get("publish-block") == "عنوان منشور"
        print(f"✓ Publish reflected in customization")


class TestMoltBotEditorHistory:
    """Tests for editor history endpoint"""
    
    def test_get_editor_history(self):
        """GET /api/alkabeer-bot/editor/history - get save history"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/editor/history", params={
            "user_id": "manager",
            "path": "/",
            "limit": 10
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        history = data["data"]
        assert isinstance(history, list)
        print(f"✓ GET history: {len(history)} entries")
    
    def test_save_creates_history_entry(self):
        """Save draft should create a history entry"""
        test_path = f"/history-test-{uuid.uuid4().hex[:8]}"
        
        # Get initial history count
        initial_response = requests.get(f"{BASE_URL}/api/alkabeer-bot/editor/history", params={
            "user_id": "manager",
            "path": test_path,
            "limit": 50
        })
        initial_count = len(initial_response.json().get("data", []))
        
        # Save a draft
        requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/draft/save", json={
            "user_id": "manager",
            "path": test_path,
            "config": {"labels": {"history-block": "تاريخ"}},
            "note": "history_test_1",
            "status": "draft"
        })
        
        # Check history increased
        after_response = requests.get(f"{BASE_URL}/api/alkabeer-bot/editor/history", params={
            "user_id": "manager",
            "path": test_path,
            "limit": 50
        })
        after_count = len(after_response.json().get("data", []))
        assert after_count > initial_count, f"History should increase: {initial_count} -> {after_count}"
        print(f"✓ History entry created: {initial_count} -> {after_count}")


class TestMoltBotEditorComments:
    """Tests for editor comments endpoints"""
    
    def test_get_editor_comments(self):
        """GET /api/alkabeer-bot/editor/comments - get comments"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/editor/comments", params={
            "path": "/",
            "limit": 50
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        comments = data["data"]
        assert isinstance(comments, list)
        print(f"✓ GET comments: {len(comments)} entries")
    
    def test_add_editor_comment(self):
        """POST /api/alkabeer-bot/editor/comments - add a comment"""
        test_message = f"تعليق تجريبي {uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/comments", json={
            "user_id": "manager",
            "path": "/",
            "block_id": "test-block",
            "message": test_message,
            "author_name": "مدير"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        comment = data.get("data", {})
        assert comment.get("message") == test_message
        assert comment.get("resolved") is False
        assert "id" in comment
        print(f"✓ Add comment: id={comment.get('id')}")
        return comment.get("id")
    
    def test_update_comment_resolved(self):
        """PUT /api/alkabeer-bot/editor/comments/{id} - toggle resolved"""
        # First add a comment
        add_response = requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/comments", json={
            "user_id": "manager",
            "path": "/",
            "block_id": "resolve-test-block",
            "message": f"تعليق للحل {uuid.uuid4().hex[:8]}",
            "author_name": "مدير"
        })
        comment_id = add_response.json().get("data", {}).get("id")
        assert comment_id, "Comment ID should exist"
        
        # Update to resolved
        update_response = requests.put(f"{BASE_URL}/api/alkabeer-bot/editor/comments/{comment_id}", json={
            "resolved": True
        })
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        updated = update_response.json().get("data", {})
        assert updated.get("resolved") is True
        print(f"✓ Comment resolved: id={comment_id}")
        
        # Toggle back to unresolved
        toggle_response = requests.put(f"{BASE_URL}/api/alkabeer-bot/editor/comments/{comment_id}", json={
            "resolved": False
        })
        assert toggle_response.status_code == 200
        toggled = toggle_response.json().get("data", {})
        assert toggled.get("resolved") is False
        print(f"✓ Comment reopened: id={comment_id}")
    
    def test_delete_editor_comment(self):
        """DELETE /api/alkabeer-bot/editor/comments/{id} - delete comment"""
        # First add a comment
        add_response = requests.post(f"{BASE_URL}/api/alkabeer-bot/editor/comments", json={
            "user_id": "manager",
            "path": "/",
            "block_id": "delete-test-block",
            "message": f"تعليق للحذف {uuid.uuid4().hex[:8]}",
            "author_name": "مدير"
        })
        comment_id = add_response.json().get("data", {}).get("id")
        assert comment_id, "Comment ID should exist"
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/alkabeer-bot/editor/comments/{comment_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        print(f"✓ Comment deleted: id={comment_id}")


class TestMoltBotCustomization:
    """Tests for customization endpoint (used by publish)"""
    
    def test_get_customization(self):
        """GET /api/alkabeer-bot/customization"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/customization", params={
            "user_id": "manager",
            "path": "/"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "data" in data
        custom = data["data"]
        assert "labels" in custom
        assert "hidden" in custom
        assert "contents" in custom
        print(f"✓ GET customization: path=/")
    
    def test_put_customization(self):
        """PUT /api/alkabeer-bot/customization"""
        test_path = f"/custom-test-{uuid.uuid4().hex[:8]}"
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json={
            "user_id": "manager",
            "path": test_path,
            "labels": {"custom-block": "تسمية مخصصة"},
            "hidden": {"hidden-block": True},
            "contents": {"content-block": "محتوى مخصص"}
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        custom = data.get("data", {})
        assert custom.get("labels", {}).get("custom-block") == "تسمية مخصصة"
        print(f"✓ PUT customization: path={test_path}")


class TestMoltBotHealth:
    """Health check test"""
    
    def test_health_endpoint(self):
        """GET /api/alkabeer-bot/health"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Health check: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
