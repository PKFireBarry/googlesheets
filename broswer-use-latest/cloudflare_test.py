import asyncio
import os
import subprocess
import time
import nodriver as uc

def kill_existing_brave_instances():
    """Kill any existing Brave browser instances to ensure clean start."""
    try:
        print("🔍 Checking for existing Brave browser instances...")
        # Kill all brave-browser processes
        subprocess.run(['pkill', '-f', 'brave-browser'], capture_output=True)
        # Also kill any chrome processes that might be related
        subprocess.run(['pkill', '-f', 'chrome'], capture_output=True)
        time.sleep(2)  # Give processes time to close
        print("✅ Cleaned up existing browser instances")
    except Exception as e:
        print(f"⚠️  Note: Could not clean up existing instances: {e}")



async def main():
    """
    Starts a browser with your main profile directly, navigates to a site with Cloudflare, and waits for manual interaction.
    """
    try:
        # Kill any existing browser instances first
        kill_existing_brave_instances()
        
        print("🚀 Starting browser with your main profile...")
        await use_profile_directly()
            
    except asyncio.CancelledError:
        print("\nScript interrupted by user.")
    except Exception as e:
        print(f"❌ An error occurred: {e}")

async def use_profile_directly():
    """Use your main Brave profile directly (requires closing main browser first)."""
    browser = None
    
    try:
        brave_executable_path = "/usr/bin/brave-browser"
        main_profile_dir = os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/")
        
        print("⚠️  IMPORTANT: Using your main Brave profile directly.")
        print("   Any existing Brave instances have been automatically closed.")
        
        # Check if profile directory exists
        if not os.path.exists(main_profile_dir):
            print(f"❌ Profile directory not found: {main_profile_dir}")
            return
        
        # Remove any lingering lock files
        lock_files = ['SingletonLock', 'SingletonSocket', 'SingletonCookie']
        for lock_file in lock_files:
            lock_path = os.path.join(main_profile_dir, lock_file)
            if os.path.exists(lock_path):
                try:
                    os.remove(lock_path)
                    print(f"🧹 Removed lock file: {lock_file}")
                except Exception as e:
                    print(f"⚠️  Could not remove lock file {lock_file}: {e}")
        
        # Use a unique debugging port
        debug_port = 9237
        
        print("🚀 Starting Brave browser with your main profile...")
        print(f"   Using native executable: {brave_executable_path}")
        print(f"   Using main profile: {main_profile_dir}")
        print(f"   Using debugging port: {debug_port}")
        
        # Enhanced browser arguments for better compatibility with main profile
        browser_args = [
            f'--remote-debugging-port={debug_port}',
            '--window-size=1920,1080',
            '--start-maximized',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',  # Prevent background issues
            '--disable-renderer-backgrounding',       # Prevent tab backgrounding issues
            '--disable-backgrounding-occluded-windows',  # Prevent window management issues
        ]

        # Test URL
        target_url = "https://apply.workable.com/zirtual-llc/j/7686016A64/"

        # OPTIMAL APPROACH: Start browser with target URL directly
        print(f"🔧 Launching browser with target URL: {target_url}")
        browser = await uc.start(
            headless=False,
            browser_executable_path=brave_executable_path,
            user_data_dir=main_profile_dir,
            browser_args=browser_args,
        )
        
        # Navigate to target URL immediately after browser starts
        print("📍 Navigating to target URL...")
        tab = await browser.get(target_url)
        print("✅ Browser launched and navigated successfully")

        # Wait for page load
        print("⏳ Waiting for page to load...")
        await asyncio.sleep(5)
        
        # Verify we're on the right page
        try:
            current_url = await tab.evaluate("window.location.href")
            print(f"📍 Final URL: {current_url}")
            
            if "workable.com" in current_url:
                print("✅ Successfully navigated to target!")
            else:
                print(f"⚠️  Navigation may not have completed fully")
                
        except Exception as verify_error:
            print(f"⚠️  Could not verify final URL: {verify_error}")
            print("   Browser is open - check manually if navigation worked")
        
        print("\n✅ Browser is ready with your MAIN profile.")
        print("   CURRENT STATUS:")
        print("   📱 Browser window should be open")
        print("   🌐 Check if the target URL loaded correctly")
        print("   ADVANTAGES:")
        print("   ✅ All your real cookies, logins, and extensions are active")
        print("   ✅ Faster startup (no copying required)")
        print("   ✅ Authentic browser fingerprint")
        print("   RISKS:")
        print("   ⚠️  Your main profile is being used directly")
        print("   ⚠️  If script crashes, it might affect your browser data")
        print("   ⚠️  Make sure not to open main Brave while this is running")
        print("\n🕐 Keeping browser open for 15 minutes...")
        print("   Press Ctrl+C to close sooner")
        
        await asyncio.sleep(900) # Keep browser open for 15 minutes

    except Exception as e:
        print(f"❌ Direct profile usage failed: {e}")
        import traceback
        traceback.print_exc()
        print("\n🔧 TROUBLESHOOTING:")
        print("   - Make sure your main Brave browser is completely closed")
        print("   - Check if any Brave processes are still running: ps aux | grep brave")
        print("   - The profile might be corrupted or have permission issues")
        print("   - Try the safe copy approach instead")
        
    finally:
        if browser:
            print("🛑 Closing browser...")
            try:
                browser.stop()
            except:
                pass
            print("✅ Browser closed.")



if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Exiting.")

async def test_profile_navigation():
    """Simple test to diagnose navigation issues with direct profile usage."""
    print("🧪 DIAGNOSTIC TEST: Direct Profile Navigation")
    print("=" * 50)
    
    browser = None
    try:
        # Kill existing instances
        kill_existing_brave_instances()
        
        brave_executable_path = "/usr/bin/brave-browser"
        main_profile_dir = os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/")
        
        print(f"📁 Profile directory: {main_profile_dir}")
        print(f"📁 Profile exists: {os.path.exists(main_profile_dir)}")
        
        # Clean lock files
        lock_files = ['SingletonLock', 'SingletonSocket', 'SingletonCookie']
        for lock_file in lock_files:
            lock_path = os.path.join(main_profile_dir, lock_file)
            if os.path.exists(lock_path):
                os.remove(lock_path)
                print(f"🧹 Removed: {lock_file}")
        
        # Start browser
        print("\n🚀 Starting browser...")
        browser = await uc.start(
            headless=False,
            browser_executable_path=brave_executable_path,
            user_data_dir=main_profile_dir,
            browser_args=[
                '--remote-debugging-port=9238',
                '--window-size=1280,720',
                '--no-first-run',
            ]
        )
        print("✅ Browser started")
        
        # Wait and check
        await asyncio.sleep(3)
        print(f"🔍 Browser object: {browser}")
        print(f"🔍 Has main_tab: {hasattr(browser, 'main_tab')}")
        
        if hasattr(browser, 'main_tab'):
            print(f"🔍 Main tab: {browser.main_tab}")
        
        # Try simple navigation
        print("\n📍 Testing navigation to Google...")
        try:
            tab = await browser.get("https://www.google.com")
            print("✅ Google navigation successful")
            
            await asyncio.sleep(3)
            
            # Check current URL
            current_url = await tab.evaluate("window.location.href")
            print(f"📍 Current URL: {current_url}")
            
        except Exception as e:
            print(f"❌ Google navigation failed: {e}")
        
        # Try target URL
        print("\n📍 Testing navigation to target URL...")
        try:
            target_url = "https://apply.workable.com/zirtual-llc/j/7686016A64/"
            tab = await browser.get(target_url)
            print("✅ Target URL navigation successful")
            
            await asyncio.sleep(5)
            
            # Check current URL
            current_url = await tab.evaluate("window.location.href")
            print(f"📍 Final URL: {current_url}")
            
        except Exception as e:
            print(f"❌ Target URL navigation failed: {e}")
        
        print("\n⏳ Test complete. Browser will stay open for 30 seconds...")
        await asyncio.sleep(30)
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        if browser:
            try:
                browser.stop()
                print("✅ Browser closed")
            except:
                pass

# Uncomment the line below to run the diagnostic test instead of the main function
# asyncio.run(test_profile_navigation()) 