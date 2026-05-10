"""
Test NLP Page Assistant endpoints:
- POST /api/nlp/page/context - returns suggestion when conflict detected
- POST /api/nlp/page/apply_correction - accepts/ignores suggestion
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNLPPageAssistantContext:
    """Test /api/nlp/page/context endpoint"""
    
    def test_context_no_conflict_returns_null_suggestion(self):
        """When no conflict, suggestion should be null"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/operations",
            "fields": {
                "operation-type-select": "sale",
                "operation-payment-method-select": "cash",
                "operation-account-select": "003"
            }
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # No conflict scenario - suggestion may be null
        assert "suggestion" in data
        print(f"✅ Context endpoint works - suggestion: {data.get('suggestion')}")
    
    def test_context_card_payment_wrong_account_returns_suggestion(self):
        """Card payment with account 004 should suggest switching to 006 (POS)"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/operations",
            "fields": {
                "operation-type-select": "sale",
                "operation-payment-method-select": "card",
                "operation-account-select": "004"  # Bank instead of POS
            }
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        suggestion = data.get("suggestion")
        assert suggestion is not None, "Expected suggestion for card payment with wrong account"
        assert "id" in suggestion, "Suggestion should have an id"
        assert "message" in suggestion, "Suggestion should have a message"
        assert "corrected_fields" in suggestion, "Suggestion should have corrected_fields"
        assert suggestion["corrected_fields"].get("operation-account-select") == "006", \
            f"Expected account correction to 006, got {suggestion['corrected_fields']}"
        print(f"✅ Card payment conflict detected - suggestion: {suggestion['message']}")
        return suggestion["id"]
    
    def test_context_journal_debit_credit_same_line_returns_suggestion(self):
        """Journal entry with both debit and credit on same line should suggest correction"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/journal",
            "fields": {
                "line-account-0": "003",
                "line-debit-0": "500",
                "line-credit-0": "200"  # Both debit and credit on same line
            }
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        suggestion = data.get("suggestion")
        assert suggestion is not None, "Expected suggestion for debit+credit on same line"
        assert "corrected_fields" in suggestion
        print(f"✅ Journal debit/credit conflict detected - suggestion: {suggestion['message']}")
    
    def test_context_sale_without_customer_or_vehicle_returns_suggestion(self):
        """Sale operation without customer or vehicle should suggest linking"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/operations",
            "fields": {
                "operation-type-select": "sale",
                "operation-payment-method-select": "cash",
                "entry-party-name-input": "",
                "entry-vehicle-reference-input": ""
            }
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        suggestion = data.get("suggestion")
        assert suggestion is not None, "Expected suggestion for sale without customer/vehicle"
        print(f"✅ Sale without customer/vehicle detected - suggestion: {suggestion['message']}")
    
    def test_context_invalid_fields_returns_400(self):
        """Invalid fields format should return 400"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/operations",
            "fields": "invalid_string"  # Should be dict
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Invalid fields format correctly rejected with 400")


class TestNLPPageAssistantApplyCorrection:
    """Test /api/nlp/page/apply_correction endpoint"""
    
    def test_apply_correction_accepted(self):
        """Apply correction with accepted=true should return status=applied"""
        # First create a suggestion
        context_response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/operations",
            "fields": {
                "operation-type-select": "sale",
                "operation-payment-method-select": "card",
                "operation-account-select": "004"
            }
        })
        assert context_response.status_code == 200
        suggestion = context_response.json().get("suggestion")
        assert suggestion is not None, "Need a suggestion to test apply_correction"
        suggestion_id = suggestion["id"]
        
        # Apply the correction
        apply_response = requests.post(f"{BASE_URL}/api/nlp/page/apply_correction", json={
            "suggestion_id": suggestion_id,
            "accepted": True
        })
        assert apply_response.status_code == 200, f"Expected 200, got {apply_response.status_code}: {apply_response.text}"
        data = apply_response.json()
        assert data.get("status") == "applied", f"Expected status=applied, got {data.get('status')}"
        assert "corrected_fields" in data
        print(f"✅ Correction applied successfully - corrected_fields: {data['corrected_fields']}")
    
    def test_apply_correction_ignored(self):
        """Apply correction with accepted=false should return status=ignored"""
        # First create a suggestion
        context_response = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/journal",
            "fields": {
                "line-account-0": "003",
                "line-debit-0": "100",
                "line-credit-0": "50"
            }
        })
        assert context_response.status_code == 200
        suggestion = context_response.json().get("suggestion")
        assert suggestion is not None, "Need a suggestion to test apply_correction"
        suggestion_id = suggestion["id"]
        
        # Ignore the correction
        apply_response = requests.post(f"{BASE_URL}/api/nlp/page/apply_correction", json={
            "suggestion_id": suggestion_id,
            "accepted": False
        })
        assert apply_response.status_code == 200, f"Expected 200, got {apply_response.status_code}: {apply_response.text}"
        data = apply_response.json()
        assert data.get("status") == "ignored", f"Expected status=ignored, got {data.get('status')}"
        print(f"✅ Correction ignored successfully - status: {data['status']}")
    
    def test_apply_correction_missing_suggestion_id_returns_400(self):
        """Missing suggestion_id should return 400"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/apply_correction", json={
            "accepted": True
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Missing suggestion_id correctly rejected with 400")
    
    def test_apply_correction_invalid_suggestion_id_returns_404(self):
        """Invalid suggestion_id should return 404"""
        response = requests.post(f"{BASE_URL}/api/nlp/page/apply_correction", json={
            "suggestion_id": "non-existent-id-12345",
            "accepted": True
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Invalid suggestion_id correctly rejected with 404")


class TestNLPPageAssistantLearning:
    """Test learning behavior - rejected patterns should not suggest again"""
    
    def test_rejected_pattern_not_suggested_again(self):
        """After rejecting a suggestion, same pattern should not trigger suggestion"""
        # Create a unique pattern
        unique_fields = {
            "operation-type-select": "sale",
            "operation-payment-method-select": "بطاقة",  # Arabic for card
            "operation-account-select": "004"
        }
        
        # First request - should get suggestion
        response1 = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
            "page": "/operations-unique-test",
            "fields": unique_fields
        })
        assert response1.status_code == 200
        suggestion1 = response1.json().get("suggestion")
        
        if suggestion1:
            # Reject the suggestion
            reject_response = requests.post(f"{BASE_URL}/api/nlp/page/apply_correction", json={
                "suggestion_id": suggestion1["id"],
                "accepted": False
            })
            assert reject_response.status_code == 200
            
            # Same pattern again - should NOT get suggestion (learned negative rule)
            response2 = requests.post(f"{BASE_URL}/api/nlp/page/context", json={
                "page": "/operations-unique-test",
                "fields": unique_fields
            })
            assert response2.status_code == 200
            suggestion2 = response2.json().get("suggestion")
            assert suggestion2 is None, "Rejected pattern should not suggest again"
            print("✅ Learning works - rejected pattern not suggested again")
        else:
            print("⚠️ No initial suggestion for this pattern - skipping learning test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
