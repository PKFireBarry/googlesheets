#!/usr/bin/env python3
"""
Resume Upload Test Script
Tests multiple upload methods to avoid automation detection on Ashby job sites.
Run directly from terminal: python resume_upload_test.py
"""

import asyncio
import os
import tempfile
import time
import uuid
import sys
import subprocess
from pathlib import Path
import aiofiles

# Add the parent directory to the path to import nodriver
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import nodriver as uc
from playwright.async_api import async_playwright

# Test URL
TEST_URL = "https://jobs.ashbyhq.com/crogl/9ea48b7b-bf3c-4eae-9338-524f71ef5b0b/application"

def kill_existing_brave_instances():
    """Kill any existing Brave browser instances to ensure clean start."""
    try:
        print("🔍 Checking for existing Brave browser instances...")
        subprocess.run(['pkill', '-f', 'brave-browser'], capture_output=True)
        subprocess.run(['pkill', '-f', 'chrome'], capture_output=True)
        time.sleep(2)
        print("✅ Cleaned up existing browser instances")
    except Exception as e:
        print(f"⚠️  Note: Could not clean up existing instances: {e}")

async def create_test_resume():
    """Create a test resume file for upload testing."""
    test_content = b"""Test Resume Content
    
Name: Test User
Email: test@example.com
Phone: 123-456-7890

Experience:
- Software Developer at Test Company (2020-2024)
- Built web applications using Python and JavaScript
- Worked with databases and APIs

Skills:
- Python, JavaScript, React, Node.js
- SQL, MongoDB, PostgreSQL
- Git, Docker, AWS

Education:
- Bachelor's Degree in Computer Science
- University of Test (2016-2020)
"""
    
    temp_dir = tempfile.mkdtemp()
    test_file_path = os.path.join(temp_dir, "Test-Resume.pdf")
    
    # Create a simple PDF-like file (for testing purposes)
    async with aiofiles.open(test_file_path, 'wb') as f:
        await f.write(test_content)
    
    print(f"📄 Created test resume at: {test_file_path}")
    return test_file_path, temp_dir

async def method_1_nodriver_send_file(tab, file_path):
    """Method 1: Current nodriver send_file method (baseline)"""
    print("\n🧪 METHOD 1: NoDriver send_file() - Current Method")
    try:
        # Find file inputs
        file_inputs = await tab.select_all('input[type=file]', timeout=10)
        if not file_inputs:
            print("❌ No file inputs found")
            return False
        
        print(f"📁 Found {len(file_inputs)} file input(s)")
        
        # Use the first file input
        file_input = file_inputs[0]
        await file_input.send_file(file_path)
        await tab.sleep(2)
        
        print("✅ Method 1: Upload completed")
        return True
        
    except Exception as e:
        print(f"❌ Method 1 failed: {e}")
        return False

async def method_2_javascript_file_upload(tab, file_path):
    """Method 2: JavaScript-based file upload simulation"""
    print("\n🧪 METHOD 2: JavaScript File Upload Simulation")
    try:
        # Read file content
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        # Convert to base64 for JavaScript
        import base64
        file_content_b64 = base64.b64encode(file_content).decode()
        filename = os.path.basename(file_path)
        
        # JavaScript to create and set file
        result = await tab.evaluate(f"""
        (async function() {{
            const fileInputs = document.querySelectorAll('input[type="file"]');
            if (fileInputs.length === 0) return false;
            
            const fileInput = fileInputs[0];
            
            // Convert base64 to blob
            const byteCharacters = atob('{file_content_b64}');
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {{
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }}
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {{ type: 'application/pdf' }});
            
            // Create file object
            const file = new File([blob], '{filename}', {{ type: 'application/pdf' }});
            
            // Create FileList
            const dt = new DataTransfer();
            dt.items.add(file);
            
            // Set files property
            fileInput.files = dt.files;
            
            // Trigger events
            const changeEvent = new Event('change', {{ bubbles: true }});
            fileInput.dispatchEvent(changeEvent);
            
            const inputEvent = new Event('input', {{ bubbles: true }});
            fileInput.dispatchEvent(inputEvent);
            
            return true;
        }})();
        """)
        
        if result:
            await tab.sleep(2)
            print("✅ Method 2: JavaScript upload completed")
            return True
        else:
            print("❌ Method 2: No file inputs found")
            return False
            
    except Exception as e:
        print(f"❌ Method 2 failed: {e}")
        return False

async def method_3_drag_drop_simulation(tab, file_path):
    """Method 3: Drag and drop simulation"""
    print("\n🧪 METHOD 3: Drag and Drop Simulation")
    try:
        # Read file content
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        import base64
        file_content_b64 = base64.b64encode(file_content).decode()
        filename = os.path.basename(file_path)
        
        # JavaScript to simulate drag and drop
        result = await tab.evaluate(f"""
        (async function() {{
            const fileInputs = document.querySelectorAll('input[type="file"]');
            if (fileInputs.length === 0) return false;
            
            const target = fileInputs[0].parentElement || fileInputs[0];
            
            // Convert base64 to blob
            const byteCharacters = atob('{file_content_b64}');
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {{
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }}
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {{ type: 'application/pdf' }});
            
            // Create file object
            const file = new File([blob], '{filename}', {{ type: 'application/pdf' }});
            
            // Create DataTransfer object
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            // Simulate drag events
            const dragEnterEvent = new DragEvent('dragenter', {{
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            }});
            
            const dragOverEvent = new DragEvent('dragover', {{
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            }});
            
            const dropEvent = new DragEvent('drop', {{
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            }});
            
            // Dispatch events
            target.dispatchEvent(dragEnterEvent);
            target.dispatchEvent(dragOverEvent);
            target.dispatchEvent(dropEvent);
            
            // Also set the file input directly as backup
            const fileInput = fileInputs[0];
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            
            const changeEvent = new Event('change', {{ bubbles: true }});
            fileInput.dispatchEvent(changeEvent);
            
            return true;
        }})();
        """)
        
        if result:
            await tab.sleep(2)
            print("✅ Method 3: Drag and drop simulation completed")
            return True
        else:
            print("❌ Method 3: No file inputs found")
            return False
            
    except Exception as e:
        print(f"❌ Method 3 failed: {e}")
        return False

async def method_4_human_like_click_upload(tab, file_path):
    """Method 4: Human-like click and upload with delays"""
    print("\n🧪 METHOD 4: Human-like Click and Upload")
    try:
        # Find file inputs
        file_inputs = await tab.select_all('input[type=file]', timeout=10)
        if not file_inputs:
            print("❌ No file inputs found")
            return False
        
        file_input = file_inputs[0]
        
        # Human-like interaction: scroll to element, hover, then click
        await file_input.scroll_into_view()
        await tab.sleep(1)  # Human-like pause
        
        # Move mouse to element (hover)
        await file_input.mouse_move()
        await tab.sleep(0.5)  # Human-like pause
        
        # Click with human-like timing
        await file_input.mouse_click()
        await tab.sleep(1)  # Wait for file dialog
        
        # Send file with additional delay
        await file_input.send_file(file_path)
        await tab.sleep(3)  # Longer wait to simulate human file selection time
        
        print("✅ Method 4: Human-like upload completed")
        return True
        
    except Exception as e:
        print(f"❌ Method 4 failed: {e}")
        return False

async def method_5_playwright_upload(tab, file_path, debug_port):
    """Method 5: Playwright-based upload"""
    print("\n🧪 METHOD 5: Playwright Upload")
    try:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{debug_port}")
        context = browser.contexts[0]
        page = context.pages[-1]
        
        # Find file input using Playwright
        file_input = await page.locator('input[type="file"]').first
        
        # Upload file using Playwright's method
        await file_input.set_input_files(file_path)
        await page.wait_for_timeout(2000)
        
        await browser.close()
        await playwright.stop()
        
        print("✅ Method 5: Playwright upload completed")
        return True
        
    except Exception as e:
        print(f"❌ Method 5 failed: {e}")
        return False

async def method_6_gradual_form_fill(tab, file_path):
    """Method 6: Gradual form filling with file upload"""
    print("\n🧪 METHOD 6: Gradual Form Fill with Upload")
    try:
        # First, fill some basic form fields to look more human
        print("📝 Filling basic form fields first...")
        
        # Try to fill name field
        try:
            name_inputs = await tab.select_all('input[type="text"], input[name*="name"], input[id*="name"]', timeout=5)
            if name_inputs:
                for name_input in name_inputs[:2]:  # Fill first 2 name fields
                    await name_input.send_keys("Test User")
                    await tab.sleep(1)
                    print("   ✅ Filled name field")
        except:
            pass
        
        # Try to fill email field
        try:
            email_inputs = await tab.select_all('input[type="email"], input[name*="email"], input[id*="email"]', timeout=5)
            if email_inputs:
                await email_inputs[0].send_keys("test@example.com")
                await tab.sleep(1)
                print("   ✅ Filled email field")
        except:
            pass
        
        # Now upload resume after filling other fields
        await tab.sleep(2)
        print("📄 Now uploading resume...")
        
        file_inputs = await tab.select_all('input[type=file]', timeout=10)
        if not file_inputs:
            print("❌ No file inputs found")
            return False
        
        file_input = file_inputs[0]
        await file_input.scroll_into_view()
        await tab.sleep(1)
        await file_input.send_file(file_path)
        await tab.sleep(2)
        
        print("✅ Method 6: Gradual form fill completed")
        return True
        
    except Exception as e:
        print(f"❌ Method 6 failed: {e}")
        return False

async def method_7_stealth_upload(tab, file_path):
    """Method 7: Stealth upload with anti-detection measures"""
    print("\n🧪 METHOD 7: Stealth Upload with Anti-Detection")
    try:
        # Inject anti-detection scripts first
        await tab.evaluate("""
        (() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Override automation flags
            window.chrome = {
                runtime: {}
            };
            
            // Remove automation indicators
            delete window.__webdriver_script_fn;
            delete window.__webdriver_evaluate;
            delete window.__selenium_evaluate;
            delete window.__webdriver_unwrapped;
            delete window.__fxdriver_evaluate;
            delete window.__driver_unwrapped;
            delete window.__webdriver_script_func;
            delete window.__webdriver_script_function;
            
            console.log('🕵️ Anti-detection scripts injected');
        })();
        """)
        
        await tab.sleep(1)
        
        # Random delays to simulate human behavior
        import random
        await tab.sleep(random.uniform(0.5, 2.0))
        
        # Find and upload file with random timing
        file_inputs = await tab.select_all('input[type=file]', timeout=10)
        if not file_inputs:
            print("❌ No file inputs found")
            return False
        
        file_input = file_inputs[0]
        
        # Random mouse movements before upload
        await file_input.scroll_into_view()
        await tab.sleep(random.uniform(0.5, 1.5))
        
        # Simulate human-like file selection time
        await file_input.send_file(file_path)
        await tab.sleep(random.uniform(2.0, 4.0))
        
        print("✅ Method 7: Stealth upload completed")
        return True
        
    except Exception as e:
        print(f"❌ Method 7 failed: {e}")
        return False

async def check_upload_success(tab):
    """Check if upload was successful by looking for indicators"""
    try:
        # Look for common success indicators
        success_indicators = await tab.evaluate("""
        (() => {
            const indicators = {
                fileNameVisible: false,
                uploadButton: false,
                successMessage: false,
                errorMessage: false,
                fileName: ''
            };
            
            // Check for file name display
            const text = document.body.textContent.toLowerCase();
            if (text.includes('test-resume.pdf') || text.includes('uploaded') || text.includes('attached')) {
                indicators.fileNameVisible = true;
                indicators.fileName = 'File appears to be uploaded';
            }
            
            // Check for upload/remove buttons
            const buttons = Array.from(document.querySelectorAll('button, a'));
            for (const button of buttons) {
                const buttonText = button.textContent.toLowerCase();
                if (buttonText.includes('remove') || buttonText.includes('delete') || buttonText.includes('replace')) {
                    indicators.uploadButton = true;
                    break;
                }
            }
            
            // Check for success messages
            if (text.includes('success') || text.includes('uploaded successfully')) {
                indicators.successMessage = true;
            }
            
            // Check for error messages
            if (text.includes('error') || text.includes('failed') || text.includes('invalid')) {
                indicators.errorMessage = true;
            }
            
            return indicators;
        })();
        """)
        
        return success_indicators
        
    except Exception as e:
        print(f"⚠️  Could not check upload success: {e}")
        return {"fileNameVisible": False, "uploadButton": False, "successMessage": False, "errorMessage": False}

async def test_all_methods():
    """Test all upload methods on the Ashby job site"""
    print("🚀 Starting Resume Upload Method Testing")
    print(f"🎯 Target URL: {TEST_URL}")
    print("=" * 80)
    
    # Create test resume
    test_file_path, temp_dir = await create_test_resume()
    
    # Setup browser
    kill_existing_brave_instances()
    
    brave_executable_path = "/usr/bin/brave-browser"
    main_profile_dir = os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/")
    debug_port = 9238  # Use different port for testing
    
    browser_args = [
        f'--remote-debugging-port={debug_port}',
        '--window-size=1920,1080',
        '--start-maximized',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
    ]
    
    results = {}
    
    try:
        print("🌐 Starting browser...")
        browser = await uc.start(
            headless=False,
            browser_executable_path=brave_executable_path,
            user_data_dir=main_profile_dir,
            browser_args=browser_args,
        )
        
        print("📍 Navigating to test URL...")
        tab = await browser.get(TEST_URL)
        await tab.sleep(5)
        
        print("✅ Page loaded successfully")
        
        # Test each method
        methods = [
            ("Method 1: NoDriver send_file", method_1_nodriver_send_file),
            ("Method 2: JavaScript Upload", method_2_javascript_file_upload),
            ("Method 3: Drag & Drop", method_3_drag_drop_simulation),
            ("Method 4: Human-like Click", method_4_human_like_click_upload),
            ("Method 5: Playwright Upload", lambda tab, file_path: method_5_playwright_upload(tab, file_path, debug_port)),
            ("Method 6: Gradual Form Fill", method_6_gradual_form_fill),
            ("Method 7: Stealth Upload", method_7_stealth_upload),
        ]
        
        for method_name, method_func in methods:
            print(f"\n{'='*60}")
            print(f"🧪 TESTING: {method_name}")
            print(f"{'='*60}")
            
            # Refresh page for clean state
            await tab.reload()
            await tab.sleep(3)
            
            # Run the method
            success = await method_func(tab, test_file_path)
            
            # Check for upload success
            await tab.sleep(2)
            upload_status = await check_upload_success(tab)
            
            # Store results
            results[method_name] = {
                'method_completed': success,
                'upload_indicators': upload_status,
                'overall_success': success and (upload_status['fileNameVisible'] or upload_status['uploadButton']) and not upload_status['errorMessage']
            }
            
            # Print results
            print(f"\n📊 RESULTS FOR {method_name}:")
            print(f"   Method completed: {'✅' if success else '❌'}")
            print(f"   File name visible: {'✅' if upload_status['fileNameVisible'] else '❌'}")
            print(f"   Upload button found: {'✅' if upload_status['uploadButton'] else '❌'}")
            print(f"   Success message: {'✅' if upload_status['successMessage'] else '❌'}")
            print(f"   Error message: {'❌' if upload_status['errorMessage'] else '✅'}")
            print(f"   Overall success: {'✅' if results[method_name]['overall_success'] else '❌'}")
            
            # Wait between tests
            await tab.sleep(3)
        
        # Print final summary
        print(f"\n{'='*80}")
        print("📊 FINAL RESULTS SUMMARY")
        print(f"{'='*80}")
        
        successful_methods = []
        failed_methods = []
        
        for method_name, result in results.items():
            if result['overall_success']:
                successful_methods.append(method_name)
                print(f"✅ {method_name}: SUCCESS")
            else:
                failed_methods.append(method_name)
                print(f"❌ {method_name}: FAILED")
        
        print(f"\n🎯 RECOMMENDATIONS:")
        if successful_methods:
            print(f"✅ Use these methods (least likely to trigger detection):")
            for method in successful_methods:
                print(f"   - {method}")
        else:
            print("❌ All methods failed - the site may have strong anti-automation measures")
        
        if failed_methods:
            print(f"\n⚠️  Avoid these methods:")
            for method in failed_methods:
                print(f"   - {method}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        try:
            if 'browser' in locals():
                await browser.stop()
            
            # Clean up test files
            import shutil
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                print(f"🧹 Cleaned up test files")
                
        except Exception as e:
            print(f"⚠️  Cleanup error: {e}")

if __name__ == "__main__":
    print("🧪 Resume Upload Method Tester")
    print("Testing multiple upload approaches to avoid automation detection")
    print("=" * 80)
    
    # Run the test
    asyncio.run(test_all_methods()) 