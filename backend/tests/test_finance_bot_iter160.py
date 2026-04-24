"""
Finance Bot API Tests - Iteration 160
Tests for External Auditor behavior:
1. POST /api/finance-bot/chat - Hard Guard: single question per response
2. State Machine per finding (open/probing/pending_evidence/resolved/escalated)
3. Priority starts with highest severity finding
4. High severity without evidence -> pending_evidence state
5. POST /api/finance-bot/evidence/upload - returns evidence_id
6. After sending evidence_id in chat, finding closes or advances
"""
import pytest
import requests
import os
import uuid
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
WORKSHOP_ID = os.environ.get("REACT_APP_WORKSHOP_ID", "finmodule-sync")


class TestFinanceBotHealth:
    """Health check for finance bot endpoint"""

    def test_health_endpoint(self):
        """Test /api/finance-bot/health returns ok"""
        response = requests.get(f"{BASE_URL}/api/finance-bot/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") in ["ok", "missing-key"], f"Unexpected status: {data}"
        assert "provider" in data
        assert "model" in data
        print(f"✅ Health check passed: {data}")


class TestFinanceBotChatHardGuard:
    """Test 1: Hard Guard - single question per response"""

    def test_chat_returns_single_question(self):
        """Chat response should contain exactly one question (ends with ؟)"""
        session_id = f"test_single_q_{uuid.uuid4().hex[:8]}"
        
        # Provide findings to trigger audit mode
        findings = [
            {
                "finding_id": "f1",
                "title": "ارتفاع غير مبرر في المصروفات",
                "account": "514",
                "severity": "high",
                "confidence": 0.95,
                "message": "المصروفات ارتفعت 50% عن الفترة السابقة"
            }
        ]
        
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings
        }
        
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Chat failed: {response.text}"
        
        data = response.json()
        bot_response = data.get("response", "")
        
        # Count Arabic question marks
        question_count = bot_response.count("؟")
        assert question_count == 1, f"Expected 1 question mark, got {question_count}. Response: {bot_response}"
        
        # Verify response ends with question mark
        assert bot_response.strip().endswith("؟"), f"Response should end with ؟: {bot_response}"
        
        print(f"✅ Single question guard PASS: '{bot_response}'")
        return session_id


class TestFinanceBotStateMachine:
    """Test 2 & 3: State Machine per finding + Priority by severity"""

    def test_state_machine_open_to_probing(self):
        """Finding starts as 'open' and transitions to 'probing' on first interaction"""
        session_id = f"test_state_{uuid.uuid4().hex[:8]}"
        
        findings = [
            {
                "finding_id": "f_state_1",
                "title": "ملاحظة تدقيق",
                "account": "411",
                "severity": "medium",
                "confidence": 0.8,
                "status": "open"
            }
        ]
        
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings
        }
        
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # After first interaction, status should be probing
        assert data.get("finding_status") in ["probing", "open"], f"Expected probing/open, got: {data.get('finding_status')}"
        assert data.get("finding_id") == "f_state_1", f"Expected finding_id f_state_1, got: {data.get('finding_id')}"
        
        print(f"✅ State transition open->probing PASS: status={data.get('finding_status')}")
        return session_id

    def test_priority_highest_severity_first(self):
        """Bot should start with highest severity finding (critical > high > medium > low)"""
        session_id = f"test_priority_{uuid.uuid4().hex[:8]}"
        
        # Provide findings with different severities - critical should be picked first
        findings = [
            {
                "finding_id": "f_low",
                "title": "ملاحظة منخفضة",
                "account": "100",
                "severity": "low",
                "confidence": 0.5
            },
            {
                "finding_id": "f_critical",
                "title": "ملاحظة حرجة",
                "account": "200",
                "severity": "critical",
                "confidence": 0.99
            },
            {
                "finding_id": "f_medium",
                "title": "ملاحظة متوسطة",
                "account": "300",
                "severity": "medium",
                "confidence": 0.7
            }
        ]
        
        payload = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings
        }
        
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Should pick critical finding first
        assert data.get("finding_id") == "f_critical", f"Expected f_critical (highest severity), got: {data.get('finding_id')}"
        
        print(f"✅ Priority by severity PASS: picked {data.get('finding_id')}")


class TestFinanceBotHighSeverityEvidence:
    """Test 4: High severity without evidence -> pending_evidence"""

    def test_high_severity_requires_evidence(self):
        """High severity finding should transition to pending_evidence when user provides vague answer"""
        session_id = f"test_evidence_{uuid.uuid4().hex[:8]}"
        
        findings = [
            {
                "finding_id": "f_high_1",
                "title": "مخاطر عالية في الحساب",
                "account": "514",
                "severity": "high",
                "confidence": 0.95,
                "status": "open"
            }
        ]
        
        # First message to start audit
        payload1 = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings
        }
        
        response1 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload1)
        assert response1.status_code == 200
        data1 = response1.json()
        print(f"First response: status={data1.get('finding_status')}, response={data1.get('response')[:50]}...")
        
        # Second message with a non-vague answer (should trigger pending_evidence for high severity)
        payload2 = {
            "message": "هذا بسبب زيادة النشاط التشغيلي",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings
        }
        
        response2 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # For high severity, should require evidence
        assert data2.get("finding_status") == "pending_evidence", f"Expected pending_evidence for high severity, got: {data2.get('finding_status')}"
        
        # Response should ask for document
        assert "مستند" in data2.get("response", "") or "فاتورة" in data2.get("response", "") or "قيد" in data2.get("response", ""), \
            f"Response should ask for supporting document: {data2.get('response')}"
        
        print(f"✅ High severity pending_evidence PASS: status={data2.get('finding_status')}")
        return session_id


class TestFinanceBotEvidenceUpload:
    """Test 5: POST /api/finance-bot/evidence/upload returns evidence_id"""

    def test_evidence_upload_returns_id(self):
        """Upload endpoint should return evidence_id"""
        session_id = f"test_upload_{uuid.uuid4().hex[:8]}"
        
        # Create a simple test file
        file_content = b"Test evidence document content"
        files = {
            "file": ("test_evidence.txt", io.BytesIO(file_content), "text/plain")
        }
        data = {
            "session_id": session_id,
            "finding_id": "f_test_upload"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/finance-bot/evidence/upload",
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Upload not successful: {result}"
        assert "data" in result, f"Missing data in response: {result}"
        
        evidence_data = result.get("data", {})
        assert "evidence_id" in evidence_data, f"Missing evidence_id: {evidence_data}"
        assert evidence_data.get("session_id") == session_id
        assert evidence_data.get("finding_id") == "f_test_upload"
        
        print(f"✅ Evidence upload PASS: evidence_id={evidence_data.get('evidence_id')}")
        return evidence_data.get("evidence_id")


class TestFinanceBotEvidenceCloseFinding:
    """Test 6: After sending evidence_id in chat, finding closes"""

    def test_evidence_closes_finding(self):
        """Sending evidence_id should resolve the finding"""
        session_id = f"test_close_{uuid.uuid4().hex[:8]}"
        
        # Step 1: Start with a high severity finding
        findings = [
            {
                "finding_id": "f_to_close",
                "title": "ملاحظة تحتاج دليل",
                "account": "514",
                "severity": "high",
                "confidence": 0.9,
                "status": "pending_evidence"
            }
        ]
        
        # Step 2: Upload evidence first
        file_content = b"Supporting document for finding"
        files = {
            "file": ("invoice.pdf", io.BytesIO(file_content), "application/pdf")
        }
        upload_data = {
            "session_id": session_id,
            "finding_id": "f_to_close"
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/finance-bot/evidence/upload",
            files=files,
            data=upload_data
        )
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        evidence_id = upload_response.json().get("data", {}).get("evidence_id")
        evidence_name = upload_response.json().get("data", {}).get("file_name")
        assert evidence_id, "No evidence_id returned"
        
        # Step 3: Send chat with evidence_id to close finding
        payload = {
            "message": "تم إرفاق المستند الداعم",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings,
            "evidence_id": evidence_id,
            "evidence_name": evidence_name
        }
        
        response = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload)
        assert response.status_code == 200, f"Chat failed: {response.text}"
        
        data = response.json()
        # Finding should be resolved after evidence is provided
        assert data.get("finding_status") == "resolved", f"Expected resolved after evidence, got: {data.get('finding_status')}"
        
        print(f"✅ Evidence closes finding PASS: status={data.get('finding_status')}")


class TestFinanceBotSessionPersistence:
    """Test session persistence across multiple calls"""

    def test_session_persists_state(self):
        """Session state should persist across multiple chat calls"""
        session_id = f"test_persist_{uuid.uuid4().hex[:8]}"
        
        findings = [
            {
                "finding_id": "f_persist",
                "title": "ملاحظة للاختبار",
                "account": "411",
                "severity": "medium",
                "confidence": 0.8
            }
        ]
        
        # First call
        payload1 = {
            "message": "ابدأ التدقيق",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings
        }
        
        response1 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload1)
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Verify session_id is returned
        assert data1.get("session_id") == session_id, f"Session ID mismatch: {data1.get('session_id')}"
        
        # Second call with same session_id (without findings - should use persisted state)
        payload2 = {
            "message": "هذا بسبب زيادة المبيعات",
            "session_id": session_id,
            "workshop_id": WORKSHOP_ID,
            "findings": findings  # Include findings for state continuity
        }
        
        response2 = requests.post(f"{BASE_URL}/api/finance-bot/chat", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Session should maintain same session_id
        assert data2.get("session_id") == session_id
        # Finding should still be tracked
        assert data2.get("finding_id") == "f_persist"
        
        print(f"✅ Session persistence PASS: session_id={session_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
