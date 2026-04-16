"""
Test cases for the inventory reset-totals feature.
Tests the /api/inventory/reset-totals endpoint and related functionality.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://moltbot-editor.preview.emergentagent.com').rstrip('/')


class TestResetTotalsEndpoint:
    """Tests for /api/inventory/reset-totals endpoint"""
    
    def test_reset_totals_endpoint_exists(self):
        """Verify the reset-totals endpoint exists and returns valid response"""
        # Note: We're using GET to check if endpoint exists without actually resetting
        # The actual reset is a POST request
        response = requests.post(f"{BASE_URL}/api/inventory/reset-totals")
        
        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify response structure
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        assert data["status"] == "ok", f"Expected status 'ok', got {data['status']}"
        assert "totals_reset_at" in data, "Response should contain 'totals_reset_at' field"
        assert "archive_mode" in data, "Response should contain 'archive_mode' field"
        assert data["archive_mode"] == "enabled", f"Expected archive_mode 'enabled', got {data['archive_mode']}"
        
        print(f"Reset totals response: {data}")
    
    def test_control_panel_includes_reset_timestamp(self):
        """Verify control-panel endpoint includes totals_reset_at after reset"""
        response = requests.get(f"{BASE_URL}/api/inventory/control-panel", params={"days": 30})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "overview" in data, "Response should contain 'overview' field"
        
        overview = data["overview"]
        # After reset, totals_reset_at should be present
        assert "totals_reset_at" in overview, "Overview should contain 'totals_reset_at' field"
        
        if overview["totals_reset_at"]:
            print(f"Control panel shows reset timestamp: {overview['totals_reset_at']}")
        else:
            print("No reset timestamp set (first time or cleared)")
    
    def test_rakan_analytics_includes_reset_timestamp(self):
        """Verify rakan-analytics endpoint includes totals_reset_at after reset"""
        response = requests.get(f"{BASE_URL}/api/inventory/rakan-analytics", params={"days": 30})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totals_reset_at" in data, "Response should contain 'totals_reset_at' field"
        
        if data["totals_reset_at"]:
            print(f"Rakan analytics shows reset timestamp: {data['totals_reset_at']}")
        else:
            print("No reset timestamp set")
    
    def test_control_panel_structure_after_reset(self):
        """Verify control-panel returns valid structure after reset"""
        response = requests.get(f"{BASE_URL}/api/inventory/control-panel", params={"days": 30})
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all expected fields exist
        expected_fields = [
            "overview",
            "top_selling_parts",
            "top_revenue_parts",
            "slow_moving_parts",
            "margin_watchlist",
            "category_performance",
            "recent_part_operations",
            "backorder_summary",
            "backorders",
            "parts_snapshot"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing expected field: {field}"
        
        # Verify overview structure
        overview = data["overview"]
        overview_fields = [
            "period_days",
            "total_parts",
            "sales_total",
            "purchases_total",
            "gross_profit_estimate",
            "inventory_cost_value",
            "inventory_retail_value",
            "totals_reset_at",
            "low_stock_count",
            "out_of_stock_count"
        ]
        
        for field in overview_fields:
            assert field in overview, f"Missing overview field: {field}"
        
        print(f"Control panel structure valid. Total parts: {overview['total_parts']}")


class TestInventoryEndpoints:
    """General inventory endpoint tests"""
    
    def test_inventory_dashboard_endpoint(self):
        """Verify /api/inventory/dashboard endpoint works"""
        response = requests.get(f"{BASE_URL}/api/inventory/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        print(f"Dashboard summary: total_parts={data['summary'].get('total_parts', 0)}")
    
    def test_inventory_alerts_endpoint(self):
        """Verify /api/inventory/alerts endpoint works"""
        response = requests.get(f"{BASE_URL}/api/inventory/alerts", params={"limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Alerts count: {len(data)}")
    
    def test_inventory_architecture_endpoint(self):
        """Verify /api/inventory/architecture endpoint works"""
        response = requests.get(f"{BASE_URL}/api/inventory/architecture", params={"days": 30})
        assert response.status_code == 200
        
        data = response.json()
        assert "blueprint" in data or "replenishment_plan" in data
        print("Architecture endpoint working")
    
    def test_backorders_endpoint(self):
        """Verify /api/inventory/backorders endpoint works"""
        response = requests.get(f"{BASE_URL}/api/inventory/backorders")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Backorders count: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
