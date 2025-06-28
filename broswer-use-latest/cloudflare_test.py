import asyncio
import os
import nodriver as uc

async def main():
    """
    Starts a browser, navigates to a site with Cloudflare, and waits for manual interaction.
    """
    browser = None
    try:
        # --- NATIVE BRAVE CONFIGURATION ---
        # Now using the native Brave installation instead of Flatpak
        # 1. Native executable path
        brave_executable_path = "/usr/bin/brave-browser"  # Native installation path

        # 2. Native user data directory (standard location, not Flatpak)
        brave_user_data_dir = os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/")

        print("🚀 Starting NATIVE Brave browser with your profile...")
        print(f"   Using native executable: {brave_executable_path}")
        print(f"   Using profile from: {brave_user_data_dir}")
        browser = await uc.start(
            headless=False,
            browser_executable_path=brave_executable_path,
            user_data_dir=brave_user_data_dir, # Now we can safely use your real profile!
            browser_args=[
                '--no-sandbox', # This is now safe to use with native installation
                '--window-size=1920,1080',
                '--start-maximized',
                '--remote-debugging-port=9235',
                '--disable-features=SameSiteByDefaultCookies',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
            ]
        )

        # URL to a site known to use Cloudflare. Change this to your target site.
        target_url = "https://apply.workable.com/zirtual-llc/j/7686016A64/" # This is a good test site
        # Or you can use another site by uncommenting below
        # target_url = "https://nowsecure.nl"
        
        print(f"📍 Navigating to: {target_url}")
        tab = await browser.get(target_url)
        
        print("\n✅ Browser is ready for manual interaction.")
        print("   INSTRUCTIONS:")
        print("   1. If you see a Cloudflare challenge, try to solve it manually")
        print("   2. If it works, you can log into Google or other accounts to build trust")
        print("   3. Then test other job sites to see if they also work")
        print("   4. The script will keep the browser open for 15 minutes")
        print("   5. Press Ctrl+C in the terminal to close the browser sooner")
        
        await asyncio.sleep(900) # Keep browser open for 15 minutes

    except asyncio.CancelledError:
        print("\nScript interrupted by user.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if browser:
            print("🛑 Closing browser...")
            browser.stop()
            print("✅ Browser closed.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Exiting.") 