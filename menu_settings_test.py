#!/usr/bin/env python3
"""
Menu Settings Persistence Test for Workshop Management System
Tests the specific menu settings persistence functionality as requested in review
"""

import requests
import json
import sys

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

BASE_URL = get_backend_url()
if not BASE_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

API_URL = f"{BASE_URL}/api"
print(f"🔗 Testing Menu Settings API at: {API_URL}")

class MenuSettingsTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_result(self, test_name, success, message=""):
        if success:
            print(f"✅ {test_name}")
            self.test_results['passed'] += 1
        else:
            print(f"❌ {test_name}: {message}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"{test_name}: {message}")

    def test_menu_settings_persistence(self):
        """Test menu settings persistence as specified in review request"""
        print("\n⚙️ Testing Menu Settings Persistence...")
        
        # Step 1: GET /api/settings -> capture current menuConfig
        current_menu_config = None
        original_settings = None
        
        try:
            response = self.session.get(f"{API_URL}/settings")
            if response.status_code == 200:
                original_settings = response.json()
                current_menu_config = original_settings.get('menuConfig')
                if current_menu_config:
                    self.log_result("Menu Settings - GET current menuConfig", True)
                    print(f"📋 Current menuConfig captured with {len(current_menu_config.get('items', []))} items")
                else:
                    self.log_result("Menu Settings - GET current menuConfig", False, "No menuConfig found in settings")
                    return
            else:
                self.log_result("Menu Settings - GET current menuConfig", False, f"Status: {response.status_code}")
                return
        except Exception as e:
            self.log_result("Menu Settings - GET current menuConfig", False, str(e))
            return

        # Step 2: POST /api/settings with modified menuConfig (simple true, 2 custom items: Dashboard and Customers)
        modified_menu_config = {
            "simple": True,
            "inventoryGrouped": False,
            "consolidateServices": False,
            "showImport": False,
            "items": [
                {"path": "/", "label": "Dashboard", "enabled": True},
                {"path": "/customers", "label": "Customers", "enabled": True}
            ]
        }
        
        # Create update payload with only menuConfig (don't change other settings)
        update_payload = {
            "menuConfig": modified_menu_config
        }
        
        try:
            response = self.session.post(f"{API_URL}/settings", json=update_payload)
            if response.status_code == 200:
                updated_settings = response.json()
                updated_menu_config = updated_settings.get('menuConfig')
                
                # Verify the structure was updated correctly
                if (updated_menu_config and 
                    updated_menu_config.get('simple') == True and
                    len(updated_menu_config.get('items', [])) == 2 and
                    updated_menu_config['items'][0]['label'] == 'Dashboard' and
                    updated_menu_config['items'][1]['label'] == 'Customers'):
                    self.log_result("Menu Settings - POST update menuConfig", True)
                    print(f"📝 MenuConfig updated: simple={updated_menu_config.get('simple')}, items={len(updated_menu_config.get('items', []))}")
                else:
                    self.log_result("Menu Settings - POST update menuConfig", False, "MenuConfig not updated correctly")
                    return
            else:
                self.log_result("Menu Settings - POST update menuConfig", False, f"Status: {response.status_code}")
                return
        except Exception as e:
            self.log_result("Menu Settings - POST update menuConfig", False, str(e))
            return

        # Step 3: GET /api/settings again -> verify the values persisted
        try:
            response = self.session.get(f"{API_URL}/settings")
            if response.status_code == 200:
                persisted_settings = response.json()
                persisted_menu_config = persisted_settings.get('menuConfig')
                
                # Verify persistence
                if (persisted_menu_config and 
                    persisted_menu_config.get('simple') == True and
                    len(persisted_menu_config.get('items', [])) == 2 and
                    persisted_menu_config['items'][0]['label'] == 'Dashboard' and
                    persisted_menu_config['items'][1]['label'] == 'Customers' and
                    persisted_menu_config['items'][0]['path'] == '/' and
                    persisted_menu_config['items'][1]['path'] == '/customers'):
                    self.log_result("Menu Settings - GET verify persistence", True)
                    print(f"✅ MenuConfig persisted correctly:")
                    print(f"   - simple: {persisted_menu_config.get('simple')}")
                    print(f"   - items count: {len(persisted_menu_config.get('items', []))}")
                    print(f"   - item 1: {persisted_menu_config['items'][0]['label']} ({persisted_menu_config['items'][0]['path']})")
                    print(f"   - item 2: {persisted_menu_config['items'][1]['label']} ({persisted_menu_config['items'][1]['path']})")
                    
                    # Verify other settings fields were not changed
                    other_fields_unchanged = True
                    for key in ['currency', 'taxRate', 'language', 'timezone', 'workshopName']:
                        if key in original_settings and key in persisted_settings:
                            if original_settings[key] != persisted_settings[key]:
                                other_fields_unchanged = False
                                print(f"⚠️  Field {key} changed: {original_settings[key]} -> {persisted_settings[key]}")
                    
                    if other_fields_unchanged:
                        self.log_result("Menu Settings - Other fields unchanged", True)
                    else:
                        self.log_result("Menu Settings - Other fields unchanged", False, "Some other settings fields were modified")
                        
                else:
                    self.log_result("Menu Settings - GET verify persistence", False, "MenuConfig values not persisted correctly")
                    if persisted_menu_config:
                        print(f"❌ Expected: simple=True, 2 items (Dashboard, Customers)")
                        print(f"❌ Got: simple={persisted_menu_config.get('simple')}, {len(persisted_menu_config.get('items', []))} items")
                        if persisted_menu_config.get('items'):
                            for i, item in enumerate(persisted_menu_config['items']):
                                print(f"   Item {i+1}: {item.get('label')} ({item.get('path')})")
            else:
                self.log_result("Menu Settings - GET verify persistence", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Menu Settings - GET verify persistence", False, str(e))

    def run_tests(self):
        """Run all menu settings tests"""
        print("🚀 Starting Menu Settings Persistence Tests...")
        
        # Test API health first
        try:
            response = self.session.get(f"{API_URL}/")
            if response.status_code == 200:
                self.log_result("API Health Check", True)
            else:
                self.log_result("API Health Check", False, f"Status: {response.status_code}")
                return
        except Exception as e:
            self.log_result("API Health Check", False, str(e))
            return

        # Run the main test
        self.test_menu_settings_persistence()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results['errors']:
            print(f"\n🔍 Errors:")
            for error in self.test_results['errors']:
                print(f"   - {error}")
        
        return self.test_results['failed'] == 0

if __name__ == "__main__":
    tester = MenuSettingsTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)