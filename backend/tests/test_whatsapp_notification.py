"""
Test WhatsApp Auto-Notification Feature on Visit Close

Tests the new feature where closing a visit (status=completed) returns
a whatsappNotification object with url, phone, message, and customerName.
"""
import pytest
import requests
import json
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
# Vehicle with known customer data
TEST_VEHICLE_ID = "ca81024e-195b-464e-9671-0f532aad1545"
# Expected customer: 997///محمد شعبان, phone: 0505887917


class TestWhatsAppNotificationOnVisitClose:
    """Test WhatsApp notification feature when closing a visit"""

    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    @pytest.fixture
    def created_visit(self, api_client):
        """Create a test visit to be closed"""
        create_payload = {
            "entryDate": datetime.utcnow().isoformat(),
            "status": "in_progress",
            "mileage": 100000,
            "notes": json.dumps({
                "text": "Test visit for WhatsApp notification",
                "items": [
                    {"itemType": "service", "name": "تبديل زيت", "quantity": 1, "price": 150},
                    {"itemType": "part", "name": "فلتر زيت", "quantity": 2, "price": 50}
                ]
            })
        }
        response = api_client.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/visits",
            json=create_payload
        )
        assert response.status_code in [200, 201], f"Failed to create visit: {response.text}"
        visit = response.json()
        yield visit
        # Cleanup - delete the visit after test
        try:
            api_client.delete(f"{BASE_URL}/api/visits/{visit['id']}")
        except Exception:
            pass

    def test_close_visit_returns_whatsapp_notification(self, api_client, created_visit):
        """Test: PUT /api/visits/{id} with status=completed returns whatsappNotification"""
        visit_id = created_visit["id"]
        
        # Close the visit with status=completed
        close_payload = {
            "status": "completed",
            "exitDate": datetime.utcnow().isoformat(),
            "mileage": created_visit.get("mileage", 100000),
            "notes": created_visit.get("notes", "")
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/visits/{visit_id}",
            json=close_payload
        )
        
        # Status check
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify whatsappNotification is in response
        assert "whatsappNotification" in data, f"whatsappNotification not in response. Keys: {data.keys()}"
        
        notification = data["whatsappNotification"]
        print(f"WhatsApp Notification: {json.dumps(notification, ensure_ascii=False, indent=2)}")

    def test_whatsapp_notification_has_required_fields(self, api_client, created_visit):
        """Test: whatsappNotification contains url, phone, message, customerName fields"""
        visit_id = created_visit["id"]
        
        close_payload = {
            "status": "completed",
            "exitDate": datetime.utcnow().isoformat(),
            "mileage": created_visit.get("mileage", 100000),
            "notes": created_visit.get("notes", "")
        }
        
        response = api_client.put(f"{BASE_URL}/api/visits/{visit_id}", json=close_payload)
        assert response.status_code == 200
        
        notification = response.json().get("whatsappNotification", {})
        
        # Required fields
        required_fields = ["url", "phone", "message", "customerName"]
        for field in required_fields:
            assert field in notification, f"Missing field '{field}' in whatsappNotification"
            assert notification[field], f"Field '{field}' is empty"
        
        print(f"✓ All required fields present: {required_fields}")
        print(f"  url: {notification['url'][:80]}...")
        print(f"  phone: {notification['phone']}")
        print(f"  customerName: {notification['customerName']}")
        print(f"  message length: {len(notification['message'])} chars")

    def test_whatsapp_phone_normalized_to_966_format(self, api_client, created_visit):
        """Test: Phone number is normalized to 966 format"""
        visit_id = created_visit["id"]
        
        close_payload = {
            "status": "completed",
            "exitDate": datetime.utcnow().isoformat()
        }
        
        response = api_client.put(f"{BASE_URL}/api/visits/{visit_id}", json=close_payload)
        assert response.status_code == 200
        
        notification = response.json().get("whatsappNotification", {})
        phone = notification.get("phone", "")
        
        # Phone should start with 966 (Saudi country code)
        assert phone.startswith("966"), f"Phone '{phone}' should start with 966"
        # Phone should be digits only
        assert phone.isdigit(), f"Phone '{phone}' should be digits only"
        # Saudi mobile: 9665xxxxxxxx (12 digits)
        assert len(phone) == 12, f"Phone '{phone}' should be 12 digits for Saudi mobile"
        
        print(f"✓ Phone normalized correctly: {phone}")

    def test_whatsapp_message_contains_customer_info(self, api_client, created_visit):
        """Test: WhatsApp message includes customer name, vehicle plate, and total amount"""
        visit_id = created_visit["id"]
        
        # Get vehicle info first
        vehicle_response = api_client.get(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}")
        vehicle = vehicle_response.json()
        plate_number = vehicle.get("plateNumber", "")
        customer_name = vehicle.get("customerName", "")
        
        close_payload = {
            "status": "completed",
            "exitDate": datetime.utcnow().isoformat(),
            "mileage": 100000,
            "notes": json.dumps({
                "text": "Test",
                "items": [
                    {"itemType": "service", "name": "خدمة", "quantity": 1, "price": 200},
                    {"itemType": "part", "name": "قطعة", "quantity": 2, "price": 100}
                ]
            })  # Total: 200 + 200 = 400
        }
        
        response = api_client.put(f"{BASE_URL}/api/visits/{visit_id}", json=close_payload)
        assert response.status_code == 200
        
        notification = response.json().get("whatsappNotification", {})
        message = notification.get("message", "")
        
        # Message should contain customer name
        # Note: customer_name from vehicle might be "997///محمد شعبان"
        # The message may use the full name or part of it
        assert "محمد" in message or "شعبان" in message or customer_name in message, \
            f"Message should contain customer name. Message: {message}"
        
        # Message should contain plate number
        assert plate_number in message or "ب ح ر" in message or "7042" in message, \
            f"Message should contain plate number '{plate_number}'. Message: {message}"
        
        # Message should contain total amount (400 or formatted)
        assert "400" in message or "٤٠٠" in message, \
            f"Message should contain total amount 400. Message: {message}"
        
        print(f"✓ Message contains required info:")
        print(f"  Message: {message[:200]}...")

    def test_whatsapp_url_is_valid_wa_me_format(self, api_client, created_visit):
        """Test: WhatsApp URL uses correct format (wa.me or api.whatsapp.com)"""
        visit_id = created_visit["id"]
        
        close_payload = {
            "status": "completed",
            "exitDate": datetime.utcnow().isoformat()
        }
        
        response = api_client.put(f"{BASE_URL}/api/visits/{visit_id}", json=close_payload)
        assert response.status_code == 200
        
        notification = response.json().get("whatsappNotification", {})
        url = notification.get("url", "")
        
        # URL should be valid WhatsApp deeplink
        valid_prefixes = ("https://wa.me/", "https://api.whatsapp.com/send")
        assert any(url.startswith(prefix) for prefix in valid_prefixes), \
            f"URL should start with wa.me or api.whatsapp.com. Got: {url[:50]}"
        
        # URL should contain phone parameter
        assert "966" in url, f"URL should contain normalized phone. URL: {url[:80]}"
        
        # URL should contain text/message parameter
        assert "text=" in url, f"URL should contain text parameter. URL: {url[:80]}"
        
        print(f"✓ URL is valid WhatsApp deeplink: {url[:80]}...")

    def test_visit_items_persist_when_closing(self, api_client, created_visit):
        """Regression test: Items should be saved correctly when closing visit"""
        visit_id = created_visit["id"]
        
        # Items to save
        items = [
            {"itemType": "service", "name": "فحص كمبيوتر", "quantity": 1, "price": 100},
            {"itemType": "part", "name": "بطارية", "quantity": 1, "price": 500}
        ]
        
        close_payload = {
            "status": "completed",
            "exitDate": datetime.utcnow().isoformat(),
            "mileage": 150000,
            "notes": json.dumps({"text": "ملاحظة اختبار", "items": items})
        }
        
        response = api_client.put(f"{BASE_URL}/api/visits/{visit_id}", json=close_payload)
        assert response.status_code == 200
        
        # Verify items persisted by fetching the visit
        get_response = api_client.get(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/visits")
        assert get_response.status_code == 200
        
        visits = get_response.json()
        closed_visit = next((v for v in visits if v.get("id") == visit_id), None)
        assert closed_visit, "Closed visit not found in list"
        
        # Parse notes to verify items
        notes_raw = closed_visit.get("notes", "")
        notes_parsed = json.loads(notes_raw) if notes_raw else {}
        saved_items = notes_parsed.get("items", [])
        
        assert len(saved_items) == 2, f"Expected 2 items, got {len(saved_items)}"
        assert saved_items[0]["name"] == "فحص كمبيوتر"
        assert saved_items[1]["name"] == "بطارية"
        
        print(f"✓ Items persisted correctly: {len(saved_items)} items saved")

    def test_no_notification_when_status_not_completed(self, api_client, created_visit):
        """Test: No whatsappNotification when status is not 'completed'"""
        visit_id = created_visit["id"]
        
        # Update to in_progress (not completed)
        update_payload = {
            "status": "in_progress",
            "mileage": 110000
        }
        
        response = api_client.put(f"{BASE_URL}/api/visits/{visit_id}", json=update_payload)
        assert response.status_code == 200
        
        data = response.json()
        
        # whatsappNotification should NOT be present for non-completed status
        assert "whatsappNotification" not in data, \
            f"whatsappNotification should not be present for in_progress status"
        
        print("✓ No notification for non-completed status (as expected)")


class TestVehicleVisitRegressionWithWhatsApp:
    """Regression tests to ensure existing visit CRUD still works with WhatsApp feature"""

    @pytest.fixture
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    def test_visit_crud_full_flow(self, api_client):
        """Test full CRUD flow for visits still works"""
        # CREATE
        create_response = api_client.post(
            f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/visits",
            json={
                "entryDate": datetime.utcnow().isoformat(),
                "status": "in_progress",
                "mileage": 200000,
                "notes": json.dumps({"text": "CRUD test", "items": []})
            }
        )
        assert create_response.status_code in [200, 201]
        visit = create_response.json()
        visit_id = visit["id"]
        
        # READ
        read_response = api_client.get(f"{BASE_URL}/api/vehicles/{TEST_VEHICLE_ID}/visits")
        assert read_response.status_code == 200
        visits = read_response.json()
        assert any(v["id"] == visit_id for v in visits), "Created visit not found"
        
        # UPDATE (not completing)
        update_response = api_client.put(
            f"{BASE_URL}/api/visits/{visit_id}",
            json={"mileage": 200100}
        )
        assert update_response.status_code == 200
        
        # UPDATE (completing - should get notification)
        complete_response = api_client.put(
            f"{BASE_URL}/api/visits/{visit_id}",
            json={
                "status": "completed",
                "exitDate": datetime.utcnow().isoformat()
            }
        )
        assert complete_response.status_code == 200
        complete_data = complete_response.json()
        assert "whatsappNotification" in complete_data
        
        # DELETE
        delete_response = api_client.delete(f"{BASE_URL}/api/visits/{visit_id}")
        assert delete_response.status_code == 200
        
        print("✓ Full CRUD flow with WhatsApp notification works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
