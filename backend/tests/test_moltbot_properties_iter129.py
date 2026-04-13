"""
Test MoltBot Properties Panel Schema - Iteration 129
Tests for Content/Style/Layout/Effects schema and asset upload/download endpoints
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMoltBotCustomizationAPI:
    """Test customization API with styles and assets fields"""
    
    def test_health_endpoint(self):
        """Verify alkabeer-bot health endpoint"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Health endpoint working")
    
    def test_get_customization_returns_styles_and_assets(self):
        """GET /customization should return styles and assets fields"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/customization", params={
            "user_id": "test_iter129",
            "path": "/test-page"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify all expected fields are present
        result = data.get("data", {})
        assert "labels" in result
        assert "hidden" in result
        assert "contents" in result
        assert "custom_cards" in result
        assert "block_order" in result
        assert "positions" in result
        assert "styles" in result  # NEW: Style field
        assert "assets" in result  # NEW: Assets field
        assert "page_manifest" in result
        
        print("✓ GET customization returns styles and assets fields")
    
    def test_save_customization_with_styles(self):
        """PUT /customization should save and return styles"""
        test_styles = {
            "test-block-1": {
                "color": "#ff0000",
                "backgroundColor": "#ffffff",
                "fontSize": "16px",
                "fontWeight": "bold",
                "opacity": "0.9",
                "padding": "10px",
                "margin": "5px",
                "width": "100%",
                "height": "auto",
                "textAlign": "center",
                "borderRadius": "8px",
                "boxShadow": "0 2px 4px rgba(0,0,0,0.1)",
                "backdropFilter": "blur(4px)"
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json={
            "user_id": "test_iter129",
            "path": "/test-styles-page",
            "styles": test_styles
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify styles were saved
        result = data.get("data", {})
        saved_styles = result.get("styles", {})
        assert "test-block-1" in saved_styles
        assert saved_styles["test-block-1"]["color"] == "#ff0000"
        assert saved_styles["test-block-1"]["fontSize"] == "16px"
        assert saved_styles["test-block-1"]["borderRadius"] == "8px"
        
        print("✓ PUT customization saves styles correctly")
    
    def test_save_customization_with_assets(self):
        """PUT /customization should save and return assets"""
        test_assets = {
            "test-block-2": {
                "src": "https://example.com/image.png",
                "href": "https://example.com/link"
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json={
            "user_id": "test_iter129",
            "path": "/test-assets-page",
            "assets": test_assets
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify assets were saved
        result = data.get("data", {})
        saved_assets = result.get("assets", {})
        assert "test-block-2" in saved_assets
        assert saved_assets["test-block-2"]["src"] == "https://example.com/image.png"
        assert saved_assets["test-block-2"]["href"] == "https://example.com/link"
        
        print("✓ PUT customization saves assets correctly")
    
    def test_save_full_schema(self):
        """PUT /customization with full Content/Style/Layout/Effects schema"""
        full_config = {
            "user_id": "test_iter129",
            "path": "/test-full-schema",
            "labels": {"block-a": "Custom Label"},
            "hidden": {"block-b": True},
            "contents": {"block-c": "Custom text content"},
            "custom_cards": [{"id": "card-1", "title": "Test Card", "fields": []}],
            "block_order": ["block-a", "block-b", "block-c"],
            "positions": {"block-a": {"left": 10, "top": 20}},
            "styles": {
                "block-a": {
                    "color": "#333",
                    "backgroundColor": "#f0f0f0",
                    "fontSize": "14px",
                    "fontWeight": "normal",
                    "opacity": "1",
                    "padding": "8px",
                    "margin": "4px",
                    "width": "200px",
                    "height": "100px",
                    "textAlign": "left",
                    "borderRadius": "4px",
                    "boxShadow": "none",
                    "backdropFilter": "none"
                }
            },
            "assets": {
                "block-a": {
                    "src": "https://example.com/test.jpg",
                    "href": "https://example.com"
                }
            },
            "page_manifest": {
                "pageId": "test-full-schema",
                "version": {"current": "draft", "published": None}
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=full_config)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        result = data.get("data", {})
        # Verify all fields persisted
        assert result.get("labels", {}).get("block-a") == "Custom Label"
        assert result.get("hidden", {}).get("block-b") == True
        assert result.get("contents", {}).get("block-c") == "Custom text content"
        assert len(result.get("custom_cards", [])) >= 1
        assert "block-a" in result.get("styles", {})
        assert "block-a" in result.get("assets", {})
        
        print("✓ Full schema (Content/Style/Layout/Effects) saved correctly")
    
    def test_get_persisted_data(self):
        """Verify data persists after save"""
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/customization", params={
            "user_id": "test_iter129",
            "path": "/test-full-schema"
        })
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", {})
        
        # Verify persisted data
        assert "styles" in result
        assert "assets" in result
        
        print("✓ Data persists correctly after save")


class TestAssetUploadEndpoint:
    """Test asset upload/download endpoints"""
    
    def test_upload_endpoint_exists(self):
        """Verify /api/alkabeer-bot/assets/upload endpoint exists"""
        # Send a minimal request to check endpoint exists (will fail without file but should not 404)
        response = requests.post(f"{BASE_URL}/api/alkabeer-bot/assets/upload", params={
            "user_id": "test_iter129"
        })
        # Should return 422 (validation error for missing file) not 404
        assert response.status_code in [422, 400, 500], f"Expected 422/400/500 for missing file, got {response.status_code}"
        print(f"✓ Upload endpoint exists (returns {response.status_code} for missing file)")
    
    def test_upload_small_image(self):
        """Test uploading a small test image"""
        # Create a minimal valid PNG (1x1 pixel transparent)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # bit depth, color type, etc
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,  # compressed data
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,  # checksum
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,  # IEND chunk
            0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {
            'file': ('test_iter129.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/alkabeer-bot/assets/upload",
            params={"user_id": "test_iter129"},
            files=files
        )
        
        # Check response
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            asset = data.get("asset", {})
            assert "id" in asset
            assert "download_url" in asset
            assert asset.get("filename") == "test_iter129.png"
            print(f"✓ Image upload successful, asset_id: {asset.get('id')}")
            return asset
        elif response.status_code == 500:
            # May fail if EMERGENT_LLM_KEY not configured for storage
            error_detail = response.json().get("detail", "")
            if "EMERGENT_LLM_KEY" in error_detail or "storage" in error_detail.lower():
                print(f"⚠ Upload endpoint exists but storage not configured: {error_detail}")
                pytest.skip("Storage not configured - EMERGENT_LLM_KEY missing")
            else:
                pytest.fail(f"Upload failed with 500: {error_detail}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_download_endpoint_format(self):
        """Verify download endpoint URL format is correct"""
        # The download URL should be /api/alkabeer-bot/assets/{asset_id}/download
        # Test with a fake asset_id to verify endpoint exists
        response = requests.get(f"{BASE_URL}/api/alkabeer-bot/assets/fake-asset-id/download")
        # Should return 404 (asset not found) not 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404 for non-existent asset, got {response.status_code}"
        print("✓ Download endpoint exists and returns 404 for non-existent asset")


class TestStyleSchemaFields:
    """Verify all style schema fields are supported"""
    
    def test_content_fields(self):
        """Test Content section fields: text, image_upload, image_url, link"""
        config = {
            "user_id": "test_iter129_content",
            "path": "/test-content-fields",
            "contents": {"block-content": "Test text content"},
            "assets": {
                "block-content": {
                    "src": "https://example.com/image.jpg",  # image_url
                    "href": "https://example.com/link"       # link
                }
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=config)
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", {})
        
        assert result.get("contents", {}).get("block-content") == "Test text content"
        assert result.get("assets", {}).get("block-content", {}).get("src") == "https://example.com/image.jpg"
        assert result.get("assets", {}).get("block-content", {}).get("href") == "https://example.com/link"
        
        print("✓ Content fields (text, image_url, link) work correctly")
    
    def test_style_fields(self):
        """Test Style section fields: color, background, fontSize, fontWeight, opacity"""
        config = {
            "user_id": "test_iter129_style",
            "path": "/test-style-fields",
            "styles": {
                "block-style": {
                    "color": "#ff5500",
                    "backgroundColor": "#eee",
                    "fontSize": "18px",
                    "fontWeight": "600",
                    "opacity": "0.85"
                }
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=config)
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", {})
        styles = result.get("styles", {}).get("block-style", {})
        
        assert styles.get("color") == "#ff5500"
        assert styles.get("backgroundColor") == "#eee"
        assert styles.get("fontSize") == "18px"
        assert styles.get("fontWeight") == "600"
        assert styles.get("opacity") == "0.85"
        
        print("✓ Style fields (color, background, fontSize, fontWeight, opacity) work correctly")
    
    def test_layout_fields(self):
        """Test Layout section fields: padding, margin, width, height, alignment"""
        config = {
            "user_id": "test_iter129_layout",
            "path": "/test-layout-fields",
            "styles": {
                "block-layout": {
                    "padding": "12px 16px",
                    "margin": "8px auto",
                    "width": "300px",
                    "height": "150px",
                    "textAlign": "center"
                }
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=config)
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", {})
        styles = result.get("styles", {}).get("block-layout", {})
        
        assert styles.get("padding") == "12px 16px"
        assert styles.get("margin") == "8px auto"
        assert styles.get("width") == "300px"
        assert styles.get("height") == "150px"
        assert styles.get("textAlign") == "center"
        
        print("✓ Layout fields (padding, margin, width, height, alignment) work correctly")
    
    def test_effects_fields(self):
        """Test Effects section fields: borderRadius, shadow, blur"""
        config = {
            "user_id": "test_iter129_effects",
            "path": "/test-effects-fields",
            "styles": {
                "block-effects": {
                    "borderRadius": "12px",
                    "boxShadow": "0 4px 6px rgba(0,0,0,0.1)",
                    "backdropFilter": "blur(8px)"
                }
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json=config)
        assert response.status_code == 200
        data = response.json()
        result = data.get("data", {})
        styles = result.get("styles", {}).get("block-effects", {})
        
        assert styles.get("borderRadius") == "12px"
        assert styles.get("boxShadow") == "0 4px 6px rgba(0,0,0,0.1)"
        assert styles.get("backdropFilter") == "blur(8px)"
        
        print("✓ Effects fields (borderRadius, shadow, blur) work correctly")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Reset test pages to clean state"""
        test_paths = [
            "/test-page",
            "/test-styles-page", 
            "/test-assets-page",
            "/test-full-schema",
            "/test-content-fields",
            "/test-style-fields",
            "/test-layout-fields",
            "/test-effects-fields"
        ]
        
        for path in test_paths:
            for user_id in ["test_iter129", "test_iter129_content", "test_iter129_style", "test_iter129_layout", "test_iter129_effects"]:
                requests.put(f"{BASE_URL}/api/alkabeer-bot/customization", json={
                    "user_id": user_id,
                    "path": path,
                    "labels": {},
                    "hidden": {},
                    "contents": {},
                    "custom_cards": [],
                    "block_order": [],
                    "positions": {},
                    "styles": {},
                    "assets": {},
                    "page_manifest": {}
                })
        
        print("✓ Test data cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
