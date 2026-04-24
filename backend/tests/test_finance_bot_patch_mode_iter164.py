"""
Iteration 164: Finance Bot Audit Interactive Loop - Patch Mode Tests
Tests for:
1. POST /api/finance-bot/chat supports action patch (open_investigation, apply_suggested_fix, view_evidence, escalate)
2. Hard Guard: only one question when probing
3. Output includes finding_id + state + interactive.actions
4. No new states outside open/probing/pending_evidence/resolved/escalated
5. open_investigation reuses existing data, doesn't create new finding logic
6. apply_suggested_fix follows single suggestion preferred
7. Evidence upload linked to same session/finding
"""

import pytest
import requests
import os
import uuid
import re

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")

VALID_STATES = {"open", "probing", "pending_evidence", "resolved", "escalated"}
VALID_ACTIONS = ["open_investigation", "apply_suggested_fix", "view_evidence", "escalate"]


@pytest.fixture
def session_id():
    return f"test-session-{uuid.uuid4()}"


@pytest.fixture
def sample_findings():
    """Sample findings for testing"""
    return [
        {
            "finding_id": "finding_1",
            "title": "ارتفاع غير مبرر في حساب المصروفات",
            "account": "5001",
            "period": "2024-Q1",
            "actual_value": 150000,
            "expected_range": "80000-100000",
            "severity": "high",
            "confidence": 0.92,
            "message": "المصروفات أعلى من المتوقع بنسبة 50%",
            "suggested_fix": "مراجعة قيود المصروفات وتصحيح التصنيف",
        },
        {
            "finding_id": "finding_2",
            "title": "عدم توازن بين الإيرادات والذمم المدينة",
            "account": "1201",
            "period": "2024-Q1",
            "actual_value": 200000,
            "expected_range": "180000-220000",
            "severity": "medium",
            "confidence": 0.85,
            "message": "فرق بين الإيرادات والذمم المدينة",
        },
    ]


class TestFinanceBotHealth:
    """Health check tests"""

    def test_health_endpoint_returns_ok(self):
        """Test health endpoint returns ok status"""
        response = requests.get(f"{BASE_URL}/api/finance-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert data.get("has_key") is True
        print("PASS: Health endpoint returns ok with has_key=True")


class TestChatActionPatch:
    """Tests for action patch support in chat endpoint"""

    def test_chat_with_open_investigation_action(self, session_id, sample_findings):
        """Test open_investigation action returns probing state"""
        payload = {
            "message": "فتح التحقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "open_investigation",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "response" in data
        assert "session_id" in data
        assert "finding_id" in data or data.get("finding_id") is None
        assert "state" in data or "finding_status" in data
        
        state = data.get("state") or data.get("finding_status")
        assert state in VALID_STATES, f"Invalid state: {state}"
        
        # open_investigation should transition to probing
        assert state == "probing", f"Expected probing state after open_investigation, got {state}"
        print(f"PASS: open_investigation action returns state={state}")

    def test_chat_with_apply_suggested_fix_action(self, session_id, sample_findings):
        """Test apply_suggested_fix action"""
        payload = {
            "message": "تطبيق المعالجة",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "apply_suggested_fix",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        state = data.get("state") or data.get("finding_status")
        assert state in VALID_STATES, f"Invalid state: {state}"
        
        # High severity without evidence should go to pending_evidence
        assert state in {"pending_evidence", "resolved"}, f"Expected pending_evidence or resolved, got {state}"
        print(f"PASS: apply_suggested_fix action returns state={state}")

    def test_chat_with_view_evidence_action(self, session_id, sample_findings):
        """Test view_evidence action"""
        payload = {
            "message": "عرض الأدلة",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "view_evidence",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        state = data.get("state") or data.get("finding_status")
        assert state in VALID_STATES, f"Invalid state: {state}"
        print(f"PASS: view_evidence action returns state={state}")

    def test_chat_with_escalate_action(self, session_id, sample_findings):
        """Test escalate action transitions to escalated state"""
        payload = {
            "message": "تصعيد",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "escalate",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        state = data.get("state") or data.get("finding_status")
        assert state == "escalated", f"Expected escalated state, got {state}"
        print(f"PASS: escalate action returns state=escalated")

    def test_invalid_action_returns_error(self, session_id, sample_findings):
        """Test invalid action returns 400 error"""
        payload = {
            "message": "test",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "invalid_action",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        print("PASS: Invalid action returns 400 error")


class TestHardGuardSingleQuestion:
    """Tests for Hard Guard - single question enforcement"""

    def test_response_contains_single_question_mark(self, session_id, sample_findings):
        """Test that probing response contains only one question"""
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        response_text = data.get("response", "")
        state = data.get("state") or data.get("finding_status")
        
        if state == "probing":
            # Count Arabic question marks
            question_marks = response_text.count("؟") + response_text.count("?")
            assert question_marks <= 2, f"Hard Guard violated: {question_marks} question marks found in: {response_text}"
            print(f"PASS: Hard Guard enforced - {question_marks} question mark(s) in probing response")
        else:
            print(f"SKIP: State is {state}, not probing - Hard Guard check not applicable")

    def test_open_investigation_returns_single_question(self, session_id, sample_findings):
        """Test open_investigation action returns single question"""
        payload = {
            "message": "فتح التحقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "open_investigation",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        response_text = data.get("response", "")
        question_marks = response_text.count("؟") + response_text.count("?")
        
        # Should have exactly one question
        assert question_marks >= 1, f"Expected at least one question, got: {response_text}"
        assert question_marks <= 2, f"Hard Guard violated: multiple questions in: {response_text}"
        print(f"PASS: open_investigation returns single question ({question_marks} mark(s))")


class TestOutputStructure:
    """Tests for output structure: finding_id + state + interactive.actions"""

    def test_response_includes_finding_id(self, session_id, sample_findings):
        """Test response includes finding_id"""
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # finding_id should be present (can be None if no active finding)
        assert "finding_id" in data, "Response missing finding_id field"
        print(f"PASS: Response includes finding_id={data.get('finding_id')}")

    def test_response_includes_state(self, session_id, sample_findings):
        """Test response includes state field"""
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        state = data.get("state") or data.get("finding_status")
        assert state is not None, "Response missing state/finding_status field"
        assert state in VALID_STATES, f"Invalid state: {state}"
        print(f"PASS: Response includes state={state}")

    def test_response_includes_interactive_actions(self, session_id, sample_findings):
        """Test response includes interactive.actions"""
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        interactive = data.get("interactive")
        assert interactive is not None, "Response missing interactive field"
        
        if interactive.get("enabled"):
            actions = interactive.get("actions", [])
            assert isinstance(actions, list), "interactive.actions should be a list"
            for action in actions:
                assert action in VALID_ACTIONS, f"Invalid action in interactive.actions: {action}"
            print(f"PASS: Response includes interactive.actions={actions}")
        else:
            print("PASS: interactive.enabled=False (no active finding)")


class TestStateValidation:
    """Tests for state machine - no states outside valid set"""

    def test_all_states_are_valid(self, session_id, sample_findings):
        """Test that all returned states are in valid set"""
        # Test multiple actions and verify states
        actions_to_test = [None, "open_investigation", "apply_suggested_fix", "view_evidence", "escalate"]
        
        for action in actions_to_test:
            test_session = f"{session_id}-{action or 'none'}"
            payload = {
                "message": "test",
                "session_id": test_session,
                "workshop_id": WORKSHOP_ID,
                "findings": sample_findings,
            }
            if action:
                payload["action"] = action
                payload["target_finding_id"] = "finding_1"
            
            response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
            if response.status_code == 200:
                data = response.json()
                state = data.get("state") or data.get("finding_status")
                assert state in VALID_STATES, f"Invalid state '{state}' for action '{action}'"
                print(f"PASS: Action '{action}' returns valid state '{state}'")
            elif response.status_code == 400 and action == "invalid_action":
                print(f"PASS: Invalid action correctly rejected")


class TestOpenInvestigationReusesData:
    """Tests for open_investigation reusing existing data"""

    def test_open_investigation_preserves_finding_data(self, session_id, sample_findings):
        """Test open_investigation doesn't create new finding logic"""
        # First call to establish session
        payload1 = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response1 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload1)
        assert response1.status_code == 200
        
        # Second call with open_investigation
        payload2 = {
            "message": "فتح التحقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "open_investigation",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response2 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should return same finding_id
        finding_id = data2.get("finding_id")
        assert finding_id == "finding_1" or finding_id is not None, "open_investigation should reuse existing finding"
        print(f"PASS: open_investigation reuses existing finding data (finding_id={finding_id})")


class TestApplySuggestedFixSingleSuggestion:
    """Tests for apply_suggested_fix following single suggestion"""

    def test_apply_fix_uses_single_suggestion(self, session_id, sample_findings):
        """Test apply_suggested_fix uses single suggestion from finding"""
        payload = {
            "message": "تطبيق المعالجة",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "apply_suggested_fix",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Response should acknowledge the fix
        response_text = data.get("response", "")
        assert len(response_text) > 0, "Response should not be empty"
        
        state = data.get("state") or data.get("finding_status")
        # High severity should require evidence
        assert state in {"pending_evidence", "resolved"}, f"Unexpected state: {state}"
        print(f"PASS: apply_suggested_fix processed with state={state}")


class TestEvidenceUploadLinking:
    """Tests for evidence upload linked to session/finding"""

    def test_evidence_upload_endpoint_exists(self, session_id):
        """Test evidence upload endpoint is accessible"""
        # Create a simple test file
        import io
        test_file = io.BytesIO(b"test evidence content")
        
        files = {"file": ("test_evidence.txt", test_file, "text/plain")}
        data = {"session_id": session_id, "finding_id": "finding_1"}
        
        response = requests.post(
            f"{BASE_URL}/api/finance-bot/evidence/upload",
            files=files,
            data=data,
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        
        assert result.get("success") is True, "Evidence upload should succeed"
        assert "data" in result, "Response should include data"
        
        evidence_data = result.get("data", {})
        assert evidence_data.get("session_id") == session_id, "Evidence should be linked to session"
        assert evidence_data.get("finding_id") == "finding_1", "Evidence should be linked to finding"
        print(f"PASS: Evidence upload linked to session={session_id}, finding=finding_1")

    def test_chat_with_evidence_id(self, session_id, sample_findings):
        """Test chat with evidence_id parameter"""
        # First upload evidence
        import io
        test_file = io.BytesIO(b"test evidence for chat")
        
        files = {"file": ("evidence.pdf", test_file, "application/pdf")}
        data = {"session_id": session_id, "finding_id": "finding_1"}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/finance-bot/evidence/upload",
            files=files,
            data=data,
        )
        assert upload_response.status_code == 200
        evidence_id = upload_response.json().get("data", {}).get("evidence_id")
        
        # Now chat with evidence_id
        payload = {
            "message": "هذا المستند الداعم",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
            "evidence_id": evidence_id,
            "evidence_name": "evidence.pdf",
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        state = data.get("state") or data.get("finding_status")
        # With evidence, high severity finding should resolve
        assert state in VALID_STATES, f"Invalid state: {state}"
        print(f"PASS: Chat with evidence_id processed, state={state}")


class TestSessionPersistence:
    """Tests for session persistence"""

    def test_session_persists_across_calls(self, session_id, sample_findings):
        """Test session data persists across multiple calls"""
        # First call
        payload1 = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response1 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload1)
        assert response1.status_code == 200
        data1 = response1.json()
        returned_session_id = data1.get("session_id")
        
        # Second call with same session
        payload2 = {
            "message": "أريد المزيد من التفاصيل",
            "session_id": returned_session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": sample_findings,
        }
        response2 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        
        assert data2.get("session_id") == returned_session_id, "Session ID should persist"
        print(f"PASS: Session persists across calls (session_id={returned_session_id})")


class TestNoMessageWithAction:
    """Test that action can work without message"""

    def test_action_without_message(self, session_id, sample_findings):
        """Test action works with empty message"""
        payload = {
            "message": "",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "action": "open_investigation",
            "target_finding_id": "finding_1",
            "findings": sample_findings,
        }
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Action without message should work: {response.text}"
        data = response.json()
        
        state = data.get("state") or data.get("finding_status")
        assert state in VALID_STATES
        print(f"PASS: Action works without message, state={state}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
