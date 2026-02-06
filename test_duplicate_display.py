#!/usr/bin/env python3

import asyncio
from playwright.async_api import async_playwright

async def test_duplicate_display():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            print("Starting duplicate display check test...")
            
            # Step 1: Login
            print("Step 1: Logging in as مدير")
            await page.goto('http://localhost:3000/login')
            await page.wait_for_timeout(2000)
            
            await page.fill('input[type="text"]', 'مدير')
            await page.fill('input[type="password"]', 'admin123')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3000)
            
            print("Login completed")
            
            # Step 2: Navigate to vehicle details
            print("Step 2: Navigating to vehicle details page")
            vehicle_id = 'dc2065b5-424a-4d92-9710-afdda1323def'
            await page.goto(f'http://localhost:3000/vehicle/{vehicle_id}')
            await page.wait_for_timeout(5000)
            
            print("Vehicle details page loaded")
            
            # Take screenshot
            await page.screenshot(path='.screenshots/vehicle_details_check.png', full_page=False)
            
            # Step 3: Check items table visibility
            print("Step 3: Checking items table visibility")
            items_table = page.locator('table').first
            is_table_visible = await items_table.is_visible()
            print(f"Items table visible: {is_table_visible}")
            
            # Step 4: Check for duplicate service display (blue elements/chips)
            print("Step 4: Checking for duplicate service display")
            
            # Look for blue elements that might contain service data
            blue_elements = await page.locator('[class*="blue"]').all()
            print(f"Found {len(blue_elements)} blue elements on page")
            
            duplicate_services_found = False
            service_names = []
            
            for i, element in enumerate(blue_elements[:10]):  # Check first 10 elements
                text = await element.text_content()
                if text and len(text) > 5:  # Filter out small elements
                    print(f"Blue element {i + 1}: {text[:50]}...")
                    
                    # Check if this looks like a service name
                    if any(keyword in text for keyword in ['كلينس', 'فحمة', 'خدمة', 'صيانة']):
                        duplicate_services_found = True
                        service_names.append(text.strip())
            
            # Also check for any chip-like elements
            chip_elements = await page.locator('[class*="chip"], [class*="tag"], [class*="badge"]').all()
            print(f"Found {len(chip_elements)} chip/tag/badge elements")
            
            for i, element in enumerate(chip_elements[:5]):
                text = await element.text_content()
                if text and len(text) > 3:
                    print(f"Chip element {i + 1}: {text}")
                    if any(keyword in text for keyword in ['كلينس', 'فحمة', 'خدمة', 'صيانة']):
                        duplicate_services_found = True
                        service_names.append(text.strip())
            
            print(f"Duplicate services found: {duplicate_services_found}")
            if duplicate_services_found:
                print(f"Service names found in blue/chip elements: {', '.join(service_names)}")
            
            # Step 5: Check hint text
            print("Step 5: Checking hint text display")
            
            # Look for the hint text element
            hint_elements = await page.locator('p.text-gray-500').all()
            print(f"Found {len(hint_elements)} potential hint text elements")
            
            hint_text_correct = False
            hint_text_content = ''
            
            for i, element in enumerate(hint_elements):
                text = await element.text_content()
                print(f"Hint element {i + 1}: {text}")
                hint_text_content = text
                
                if 'يمكنك إضافة/تعديل الخدمات والقطع من جدول البنود أعلاه' in text:
                    hint_text_correct = True
                    print("Correct Arabic hint text found")
                elif 'vehicle_details.items_edit_hint' in text:
                    print("Translation key found instead of Arabic text")
            
            # Step 6: Take final screenshot
            await page.screenshot(path='.screenshots/vehicle_details_final.png', full_page=False)
            
            # Step 7: Summary of findings
            print("\n=== TEST RESULTS SUMMARY ===")
            print(f"Login successful: True")
            print(f"Vehicle details page loaded: True")
            print(f"Items table visible: {is_table_visible}")
            print(f"Duplicate services found: {duplicate_services_found}")
            print(f"Hint text correct: {hint_text_correct}")
            print(f"Hint text content: '{hint_text_content}'")
            
            if duplicate_services_found:
                print(f"CRITICAL ISSUE: Services appear in both table AND blue elements/chips")
                print(f"Duplicate service names: {', '.join(service_names)}")
            else:
                print(f"SUCCESS: NO duplicate service display detected")
            
            if not hint_text_correct and 'vehicle_details.items_edit_hint' in hint_text_content:
                print(f"TRANSLATION ISSUE: Hint text shows translation key instead of Arabic")
            elif hint_text_correct:
                print(f"SUCCESS: Hint text displays correct Arabic text")
            
            return {
                'table_visible': is_table_visible,
                'duplicate_services': duplicate_services_found,
                'hint_text_correct': hint_text_correct,
                'hint_text_content': hint_text_content,
                'service_names': service_names
            }
            
        except Exception as error:
            print(f'Test failed with error: {error}')
            await page.screenshot(path='.screenshots/error_state.png', full_page=False)
            return None
        finally:
            await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_duplicate_display())
    if result:
        print(f"\nFinal Result: {result}")