"""
Iteration 114 - Backend Tests for Audit Log and AR Export Features
Tests:
1. GET /api/finance/audit-logs - returns 200 with rows/count structure
2. GET /api/finance/ar/ledger/export - returns valid xlsx file
3. GET /api/alkabeer-bot/health - returns 200 (bot regression check)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
WORKSHOP_ID = os.environ.get('REACT_APP_WORKSHOP_ID', 'finmodule-sync')


class TestAuditLogEndpoint:
    """Tests for /api/finance/audit-logs endpoint"""

    def test_audit_logs_returns_200(self):
        """GET /api/finance/audit-logs should return 200"""
        response = requests.get(f"{BASE_URL}/api/finance/audit-logs", params={"limit": 10})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ audit-logs returned 200")

    def test_audit_logs_structure(self):
        """Response should have success, data.rows, data.count"""
        response = requests.get(f"{BASE_URL}/api/finance/audit-logs", params={"limit": 10})
        data = response.json()
        
        assert data.get("success") is True, "Expected success=True"
        assert "data" in data, "Expected 'data' key in response"
        assert "rows" in data["data"], "Expected 'rows' in data"
        assert "count" in data["data"], "Expected 'count' in data"
        assert isinstance(data["data"]["rows"], list), "rows should be a list"
        assert isinstance(data["data"]["count"], int), "count should be an integer"
        print(f"✅ audit-logs structure valid: {data['data']['count']} rows")

    def test_audit_logs_with_workshop_filter(self):
        """Should accept workshop_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/finance/audit-logs",
            params={"workshop_id": WORKSHOP_ID, "limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print(f"✅ audit-logs with workshop filter works")

    def test_audit_logs_with_action_filter(self):
        """Should accept action filter"""
        response = requests.get(
            f"{BASE_URL}/api/finance/audit-logs",
            params={"action": "reset_all_financial_data", "limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        print(f"✅ audit-logs with action filter works")


class TestARExportEndpoint:
    """Tests for /api/finance/ar/ledger/export endpoint"""

    def test_ar_export_returns_200(self):
        """GET /api/finance/ar/ledger/export should return 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/ar/ledger/export",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2025-01-31"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ ar/ledger/export returned 200")

    def test_ar_export_content_type(self):
        """Response should have xlsx content-type"""
        response = requests.get(
            f"{BASE_URL}/api/finance/ar/ledger/export",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2025-01-31"
            }
        )
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type, \
            f"Expected xlsx content-type, got {content_type}"
        print(f"✅ ar/ledger/export content-type: {content_type}")

    def test_ar_export_valid_xlsx(self):
        """Response should be a valid xlsx file"""
        import io
        import openpyxl
        
        response = requests.get(
            f"{BASE_URL}/api/finance/ar/ledger/export",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2025-01-31"
            }
        )
        
        # Try to load as xlsx
        try:
            wb = openpyxl.load_workbook(io.BytesIO(response.content))
            sheets = wb.sheetnames
            assert len(sheets) > 0, "Expected at least one sheet"
            assert "AR-1103-Summary" in sheets, "Expected AR-1103-Summary sheet"
            print(f"✅ ar/ledger/export valid xlsx with sheets: {sheets}")
        except Exception as e:
            pytest.fail(f"Failed to parse xlsx: {e}")

    def test_ar_export_with_customer_filter(self):
        """Should accept customer filter"""
        response = requests.get(
            f"{BASE_URL}/api/finance/ar/ledger/export",
            params={
                "workshop_id": WORKSHOP_ID,
                "start_date": "2024-01-01",
                "end_date": "2025-01-31",
                "customer": "test-customer"
            }
        )
        # Should still return 200 even if customer doesn't exist
        assert response.status_code == 200
        print(f"✅ ar/ledger/export with customer filter works")


class TestAlKabeerBotHealth:
    """Regression tests for AlKabeer Bot"""

    def test_alkabeer_bot_health(self):
        """GET /api/alkabeer-bot/health should return 200"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ alkabeer-bot/health returned 200")

    def test_alkabeer_bot_health_structure(self):
        """Health response should have status=ok"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        data = response.json()
        
        assert data.get("status") == "ok", f"Expected status=ok, got {data.get('status')}"
        assert "bot" in data, "Expected 'bot' key in response"
        print(f"✅ alkabeer-bot health structure valid: {data.get('bot')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
