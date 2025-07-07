import asyncio
import os
import subprocess
import tempfile
import time
import uuid
import re
import base64
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import textwrap
from difflib import get_close_matches
import shutil

import nodriver as uc
from playwright.async_api import async_playwright
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
import uvicorn
import aiofiles
import httpx
import google.generativeai as genai

app = FastAPI()

# In-memory task storage for status tracking
tasks = {}

# Disable browser_use telemetry calls to avoid network failures
os.environ["BROWSER_USE_DISABLE_TELEMETRY"] = "1"

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

# --- Pydantic Models for API Request ---
class UserData(BaseModel):
    first_name: str = Field(..., example="John")
    last_name: str = Field(..., example="Doe")
    email: str = Field(..., example="john.doe.example@email.com")
    phone: str = Field(..., example="123-456-7890")
    linkedin: str | None = Field(None, example="https://linkedin.com/in/johndoe")
    github: str | None = Field(None, example="https://github.com/johndoe")
    portfolio: str | None = Field(None, example="https://johndoe.dev")
    address: str | None = Field(None, example="123 Main St, Anytown, USA 12345")

    # Additional fields for comprehensive form filling
    summary: str = Field(default="Experienced professional with strong technical expertise and proven track record. Skilled in modern technologies with excellent problem-solving abilities and commitment to deliver high-quality results.")
    cover_letter: str = Field(default="""Dear Hiring Manager,

I am writing to express my strong interest in this position. With my background and skills, I believe I would be a valuable addition to your team.

I am excited about the opportunity to contribute to your organization and look forward to discussing how my experience can benefit your company.

Thank you for your consideration.

Best regards,""")

    def to_context_string(self) -> str:
        """Converts user data to a string for LLM context."""
        return f"""
- Name: {self.first_name} {self.last_name}
- Email: {self.email}
- Phone: {self.phone}
- Location: {self.address}
- Links: LinkedIn ({self.linkedin}), GitHub ({self.github}), Portfolio ({self.portfolio})
- Summary: {self.summary}
"""

@dataclass
class ElementInfo:
    """Comprehensive element information."""
    element_type: str
    data_ui: str
    selector: str
    label_text: str
    is_required: bool
    interaction_method: str
    purpose: str = "unknown"
    available_options: List[str] = field(default_factory=list)
    attributes: Dict[str, Any] = field(default_factory=dict)
    section: str = "Unknown Section"
    validation_rules: Dict[str, Any] = field(default_factory=dict)
    max_selections: int = 1  # For checkbox groups


async def handle_cookie_banner(tab):
    """
    Finds and clicks common cookie consent buttons, then waits for page to stabilize.
    """
    print("Checking for cookie consent banners...")
    accept_keywords = ["accept all", "allow all", "i agree", "accept"]
    
    for keyword in accept_keywords:
        try:
            cookie_button = await tab.find(keyword, best_match=True, timeout=2)
            if cookie_button:
                print(f"Found cookie button with text: '{keyword}'")
                try:
                    # Move mouse to element before clicking
                    print("Moving mouse to cookie button...")
                    await cookie_button.mouse_move()
                    await asyncio.sleep(0.2)
                    
                    print("Clicking cookie button...")
                    await cookie_button.click()
                    
                    # Wait for the page to process the click and potentially reload.
                    print("Waiting for page to stabilize after cookie consent...")
                    try:
                        # Wait for the main load event to fire, indicating a page reload/update is complete.
                        await tab.wait_for('Page.loadEventFired', timeout=4)
                        print("Page load event detected.")
                    except asyncio.TimeoutError:
                        # If the page doesn't fully reload, it's fine. We still need to wait.
                        print("Page load event did not fire, waiting for animations.")
                    
                    # Add a final sleep for animations to finish.
                    await tab.sleep(2) 
                    print("Page should now be stable.")
                    return True # A button was clicked and we waited.
                except Exception as click_error:
                    print(f"Error clicking cookie button '{keyword}': {click_error}")
                    # Continue to try other keywords
                    continue
        except Exception as find_error:
            # This exception is for tab.find failing, which is normal.
            print(f"Could not find cookie button with keyword '{keyword}': {find_error}")
            continue # Keyword not found, try the next one.
            
    print("No cookie banner found or handled.")
    return False # No button was clicked


async def process_hybrid_apply(task_id: str, job_url: str, api_key: str, user_data: UserData, resume_file: UploadFile | None, file_url: str | None):
    """The main background task for the hybrid auto-apply process."""
    tasks[task_id] = {"status": "starting", "message": "Starting hybrid auto-apply process."}
    browser = None
    temp_file_path = None
    temp_dir = None
    resume_content = None
    resume_filename = None
    
    try:
        # --- Setup Browser ---
        tasks[task_id].update({"status": "processing", "message": "Initializing browser..."})
        # Note: LLM is no longer used in main process - comprehensive system uses LLMAnswerGenerator with direct genai integration
        
        # Kill any existing browser instances first
        kill_existing_brave_instances()
        
        # Setup profile paths
        brave_executable_path = "/usr/bin/brave-browser"
        main_profile_dir = os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/")
        
        print("⚠️  IMPORTANT: Using your main Brave profile directly.")
        print("   Any existing Brave instances have been automatically closed.")
        print("   ADVANTAGES:")
        print("   ✅ All your real cookies, logins, and extensions are active")
        print("   ✅ Faster startup (no copying required)")
        print("   ✅ Authentic browser fingerprint")
        print("   RISKS:")
        print("   ⚠️  Your main profile is being used directly")
        print("   ⚠️  If script crashes, it might affect your browser data")
        print("   ⚠️  Make sure not to open main Brave while this is running")
        
        # Check if profile directory exists
        if not os.path.exists(main_profile_dir):
            print(f"❌ Profile directory not found: {main_profile_dir}")
            raise Exception(f"Brave profile directory not found: {main_profile_dir}")
        
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
            '--disable-features=SameSiteByDefaultCookies',  # Allow third-party cookies for Turnstile
            '--disable-blink-features=AutomationControlled',  # Hide automation
            '--disable-web-security',  # Disable web security for iframe access
            '--disable-features=VizDisplayCompositor',  # Improve rendering
        ]

        # Use NATIVE Brave browser with main profile for Cloudflare compatibility
        browser = await uc.start(
            headless=False,
            browser_executable_path=brave_executable_path,
            user_data_dir=main_profile_dir,
            browser_args=browser_args,
        )
        
        # Navigate to target URL immediately after browser starts
        print("📍 Navigating to target URL...")
        tab = await browser.get(job_url)
        print(f"✅ Navigated to: {job_url}")
        
        # Wait for page to fully load and stabilize
        print("⏳ Waiting for page to fully load...")
        await tab.sleep(5)
        
        # Wait for any dynamic content to load
        try:
            await tab.wait_for('Page.loadEventFired', timeout=3)
            print("✅ Page load event detected")
        except:
            print("⚠️  Page load event timeout, continuing...")
        
        await tab.sleep(2) # Additional wait for dynamic content
        
        # Verify we're on the right page
        try:
            current_url = await tab.evaluate("window.location.href")
            print(f"📍 Final URL: {current_url}")
            
            if job_url.split('/')[-1] in current_url or job_url.split('/')[-2] in current_url:
                print("✅ Successfully navigated to target!")
            else:
                print(f"⚠️  Navigation may not have completed fully")
                print(f"   Expected: {job_url}")
                print(f"   Actual: {current_url}")
                
        except Exception as verify_error:
            print(f"⚠️  Could not verify final URL: {verify_error}")
            print("   Browser is open - check manually if navigation worked")

        # --- Handle Cookie Banner on Initial Load ---
        await handle_cookie_banner(tab)

        # Re-acquire a handle to the active tab, in case the cookie banner opened a new one.
        if browser.tabs:
            tab = browser.tabs[-1] # Assume the last tab is the active one.
            await tab.bring_to_front()
            print("Switched to the most recent tab to ensure it's active.")

        # --- FIND AND CLICK APPLY BUTTON USING NATIVE NODRIVER ---
        tasks[task_id].update({"status": "processing", "message": "Looking for apply button..."})
        
        # Wait a moment for page to fully load
        await tab.sleep(2)
        
        # Try different variations of "apply" text
        apply_keywords = [
            "apply now",
            "apply for this job", 
            "apply to this job",
            "apply",
            "submit application",
            "apply for position"
        ]
        
        button_found = False
        for keyword in apply_keywords:
            try:
                print(f"Searching for button with text: '{keyword}'")
                apply_button = await tab.find(keyword, best_match=True, timeout=3)
                if apply_button:
                    print(f"Found apply button with text: '{keyword}'")
                    print("Moving mouse to apply button...")
                    await apply_button.mouse_move()
                    await tab.sleep(0.5)
                    
                    print("Clicking apply button...")
                    await apply_button.click()
                    await tab.sleep(1)
                    
                    print("Apply button clicked successfully!")
                    button_found = True
                    break
            except Exception as e:
                print(f"Could not find button with text '{keyword}': {e}")
                continue
        
        if not button_found:
            print("Could not find apply button with text search. Trying CSS selectors...")
            
            # Try common CSS selectors for apply buttons
            selectors = [
                "button[class*='apply']",
                "a[class*='apply']", 
                "button[id*='apply']",
                "a[id*='apply']",
                ".apply-button",
                ".btn-apply",
                "button[type='submit']"
            ]
            
            for selector in selectors:
                try:
                    print(f"Trying selector: {selector}")
                    element = await tab.select(selector, timeout=2)
                    if element:
                        print(f"Found element with selector: {selector}")
                        print("Clicking element...")
                        await element.mouse_move()
                        await tab.sleep(0.5)
                        await element.click()
                        await tab.sleep(2)
                        print("Element clicked successfully!")
                        button_found = True
                        break
                except Exception as e:
                    print(f"Selector '{selector}' failed: {e}")
                    continue
        
        if not button_found:
            raise Exception("Could not find any apply button on the page.")

        # --- Handle Resume Upload ---
        tasks[task_id].update({"status": "processing", "message": "Looking for resume upload field..."})
        
        if resume_file or file_url:
            original_filename = ""
            content = b""

            if resume_file:
                original_filename = resume_file.filename
                content = await resume_file.read()
            elif file_url:
                if file_url.startswith('data:'):
                    try:
                        match = re.match(r'data:(?P<mime>[^;]+);filename=(?P<filename>[^;]+);base64,(?P<data>.+)', file_url)
                        original_filename = match.group('filename')
                        content = base64.b64decode(match.group('data'))
                    except Exception as e:
                        print(f"Failed to parse data URL: {e}")
                else:
                    # Download file from HTTP(S) URL
                    async with httpx.AsyncClient() as client:
                        response = await client.get(file_url)
                        response.raise_for_status()
                        content = response.content
                        original_filename = file_url.split("/")[-1]

            if original_filename and content:
                resume_content = content
                
                # Get file extension
                suffix = os.path.splitext(original_filename)[-1]

                # Sanitize names for the filename
                first_name = re.sub(r'[^a-zA-Z0-9]', '', user_data.first_name)
                last_name = re.sub(r'[^a-zA-Z0-9]', '', user_data.last_name)
                
                # Create the new filename
                new_resume_filename = f"{first_name}-{last_name}-Resume{suffix}"
                resume_filename = new_resume_filename # For LLM context

                # Create a temporary directory to hold the renamed file
                temp_dir = tempfile.mkdtemp()
                temp_file_path = os.path.join(temp_dir, new_resume_filename)

                # Write the resume content to the new file path
                async with aiofiles.open(temp_file_path, 'wb') as tmp:
                    await tmp.write(content)

                print(f"📄 Renamed resume to '{new_resume_filename}' and saved to temporary path.")

        if temp_file_path:
            print(f"📄 Looking for resume upload field...")
            
            # Find ALL file inputs on the page
            all_file_inputs = await tab.select_all('input[type=file]', timeout=5)
            
            if not all_file_inputs:
                print("❌ No file inputs found on the page")
            else:
                print(f"🔍 Found {len(all_file_inputs)} file input(s), analyzing each one...")
                
                resume_input = None
                
                for i, file_input in enumerate(all_file_inputs):
                    try:
                        await file_input.update()
                        
                        # Get element attributes
                        input_id = file_input.attrs.get('id', '')
                        input_name = file_input.attrs.get('name', '')
                        input_class = file_input.attrs.get('class', '')
                        input_accept = file_input.attrs.get('accept', '')
                        input_placeholder = file_input.attrs.get('placeholder', '')
                        
                        print(f"📋 File input {i+1}:")
                        print(f"   ID: {input_id}")
                        print(f"   Name: {input_name}")
                        print(f"   Class: {input_class}")
                        print(f"   Accept: {input_accept}")
                        print(f"   Placeholder: {input_placeholder}")
                        
                        # Look for associated label
                        label_text = ""
                        if input_id:
                            try:
                                label = await tab.select(f"label[for='{input_id}']", timeout=1)
                                if label:
                                    await label.update()
                                    label_text = label.text.strip().lower()
                                    print(f"   Label: {label_text}")
                            except:
                                pass
                        
                        # Get surrounding context using JavaScript
                        context_info = await tab.evaluate(f"""
                        (function() {{
                            const input = document.querySelector('input[id="{input_id}"], input[name="{input_name}"]');
                            if (!input) return {{}};
                            
                            let contextText = '';
                            let parent = input.parentElement;
                            
                            // Look for text in parent elements
                            for (let i = 0; i < 3 && parent; i++) {{
                                const textNodes = Array.from(parent.childNodes)
                                    .filter(node => node.nodeType === 3)
                                    .map(node => node.textContent.trim())
                                    .filter(text => text.length > 0);
                                    
                                if (textNodes.length > 0) {{
                                    contextText += textNodes.join(' ') + ' ';
                                }}
                                
                                // Also check for text in sibling elements
                                const siblings = Array.from(parent.children);
                                siblings.forEach(sibling => {{
                                    if (sibling !== input && sibling.textContent.trim()) {{
                                        contextText += sibling.textContent.trim() + ' ';
                                    }}
                                }});
                                
                                parent = parent.parentElement;
                            }}
                            
                            return {{
                                contextText: contextText.toLowerCase(),
                                parentClasses: input.parentElement ? input.parentElement.className : '',
                                grandparentClasses: input.parentElement && input.parentElement.parentElement ? 
                                                  input.parentElement.parentElement.className : ''
                            }};
                        }})();
                        """)
                        
                        context_text = context_info.get('contextText', '').lower()
                        parent_classes = context_info.get('parentClasses', '').lower()
                        grandparent_classes = context_info.get('grandparentClasses', '').lower()
                        
                        print(f"   Context: {context_text[:100]}...")
                        print(f"   Parent classes: {parent_classes}")
                        
                        # Score this input based on resume-related keywords
                        resume_score = 0
                        photo_score = 0
                        
                        # Resume indicators (positive scoring)
                        resume_keywords = [
                            'resume', 'cv', 'curriculum', 'vitae', 'document', 'upload resume',
                            'attach resume', 'resume file', 'your resume', 'upload cv', 'attach cv'
                        ]
                        
                        # Photo/image indicators (negative scoring for resume)
                        photo_keywords = [
                            'photo', 'image', 'picture', 'avatar', 'profile picture', 'headshot',
                            'upload photo', 'attach photo', 'profile image', 'your photo'
                        ]
                        
                        # Check all text sources for keywords
                        all_text = f"{input_id} {input_name} {input_class} {input_accept} {input_placeholder} {label_text} {context_text} {parent_classes} {grandparent_classes}"
                        
                        for keyword in resume_keywords:
                            if keyword in all_text:
                                resume_score += 2
                                print(f"   ✅ Found resume keyword: '{keyword}' (+2 points)")
                        
                        for keyword in photo_keywords:
                            if keyword in all_text:
                                photo_score += 2
                                print(f"   ❌ Found photo keyword: '{keyword}' (+2 photo points)")
                        
                        # File type scoring
                        if input_accept:
                            if any(ext in input_accept.lower() for ext in ['.pdf', '.doc', '.docx', 'application/pdf']):
                                resume_score += 3
                                print(f"   ✅ Accepts document formats (+3 points)")
                            if any(ext in input_accept.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', 'image/']):
                                photo_score += 3
                                print(f"   ❌ Accepts image formats (+3 photo points)")
                        
                        final_score = resume_score - photo_score
                        print(f"   📊 Final score: {final_score} (resume: {resume_score}, photo penalty: -{photo_score})")
                        
                        # Select the input with the highest resume score (and lowest photo score)
                        if final_score > 0 and (resume_input is None or final_score > getattr(resume_input, '_score', 0)):
                            resume_input = file_input
                            resume_input._score = final_score
                            print(f"   🎯 This is currently the best resume input candidate!")
                        
                        print()  # Empty line for readability
                        
                    except Exception as e:
                        print(f"   ❌ Error analyzing file input {i+1}: {e}")
                        continue
                
                # Upload to the selected resume input
                if resume_input:
                    print(f"✅ Selected resume input with score {getattr(resume_input, '_score', 0)}")
                    print(f"📤 Uploading resume from {temp_file_path}...")
                    try:
                        await resume_input.send_file(temp_file_path)
                        await tab.sleep(2)
                        print("✅ Resume uploaded successfully!")
                    except Exception as upload_error:
                        print(f"❌ Error uploading resume: {upload_error}")
                else:
                    print("❌ Could not identify a suitable resume upload field")
                    print("🔄 Falling back to first file input...")
                    try:
                        await all_file_inputs[0].send_file(temp_file_path)
                        await tab.sleep(2)
                        print("✅ Resume uploaded to first file input as fallback")
                    except Exception as fallback_error:
                        print(f"❌ Fallback upload also failed: {fallback_error}")
        else:
            print("⚠️  No resume file provided")

        # --- COMPREHENSIVE FORM FILLING WITH PROVEN CLOUDFLARE METHODOLOGY ---
        tasks[task_id].update({"status": "processing", "message": "Discovering and analyzing form elements..."})
        
        # Initialize the comprehensive form filling system
        print("🔍 Initializing comprehensive element discovery system...")
        element_discovery = WorkableElementDiscovery(tab)
        
        # Discover all form elements using the proven methodology
        print("🔎 Discovering all form elements...")
        discovered_elements = await element_discovery.discover_all_elements()
        
        # Log discovered elements for debugging
        print(f"📋 Discovered {len(discovered_elements)} form elements")
        element_discovery.log_element_summary()
        
        # Initialize LLM answer generator with API key from request
        print("🤖 Initializing LLM answer generator...")
        llm_generator = LLMAnswerGenerator('gemini-2.5-flash', api_key)
        
        # Initialize form filling agent
        print("🤖 Initializing form filling agent...")
        form_agent = FormFillingAgent(tab, llm_generator, user_data, resume_file_content=resume_content, resume_filename=resume_filename)
        
        # Fill the form using the comprehensive system
        tasks[task_id].update({"status": "processing", "message": "Filling form fields with comprehensive system..."})
        print("📝 Starting comprehensive form filling...")
        await form_agent.fill_form(discovered_elements)
        
        print("✅ Comprehensive form filling completed!")

        # --- SUBMIT THE FORM ---
        tasks[task_id].update({"status": "processing", "message": "Submitting application..."})
        
        # Try to find and click submit button
        submit_keywords = [
            "submit application",
            "submit",
            "send application", 
            "apply",
            "continue",
            "next"
        ]
        
        submitted = False
        for keyword in submit_keywords:
            try:
                print(f"Looking for submit button with text: '{keyword}'")
                submit_button = await tab.find(keyword, best_match=True, timeout=2)
                if submit_button:
                    print(f"Found submit button: '{keyword}'")
                    await submit_button.mouse_move()
                    await tab.sleep(0.5)
                    await submit_button.click()
                    await tab.sleep(3)
                    print("Submit button clicked!")
                    submitted = True
                    break
            except Exception as e:
                print(f"Could not find submit button with text '{keyword}': {e}")
        
        if not submitted:
            # Try CSS selectors for submit buttons
            submit_selectors = [
                "button[type='submit']",
                "input[type='submit']",
                ".submit-btn",
                ".btn-submit",
                "button[class*='submit']"
            ]
            
            for selector in submit_selectors:
                try:
                    print(f"Trying submit selector: {selector}")
                    submit_element = await tab.select(selector, timeout=2)
                    if submit_element:
                        print(f"Found submit element with selector: {selector}")
                        await submit_element.mouse_move()
                        await tab.sleep(0.5)
                        await submit_element.click()
                        await tab.sleep(3)
                        print("Submit element clicked!")
                        submitted = True
                        break
                except Exception as e:
                    print(f"Submit selector '{selector}' failed: {e}")
        
        # --- HANDLE CLOUDFLARE VERIFICATION ---
        if submitted:
            tasks[task_id].update({"status": "processing", "message": "Handling verification challenge..."})
            await tab.sleep(3)
            try:
                print("Attempting visual solve of verification challenge ...")
                # Create LLM instance for verification (reuse the same one from form filling)
                llm_generator = LLMAnswerGenerator('gemini-2.5-flash', api_key)
                cf_solved = await solve_verification_visually(tab, llm_generator)
                if cf_solved:
                    print("✅ Verification challenge solved visually.")
                else:
                    print("⚠️  Verification challenge could not be solved visually.")
            except Exception as e:
                print(f"Error during visual verification: {e}")

        # --- VERIFY SUBMISSION SUCCESS ---
        await tab.sleep(3)  # Wait for any final redirects
        
        try:
            print("🔍 Performing comprehensive submission verification...")
            
            # More thorough success check
            success_check = await tab.evaluate("""
            (function() {
                const bodyText = document.body.textContent.toLowerCase();
                const currentUrl = window.location.href.toLowerCase();
                
                console.log('Current URL:', currentUrl);
                console.log('Current page text sample:', bodyText.substring(0, 500));
                
                // Look for success indicators in text
                const successIndicators = [
                    'success', 'verified', 'complete', 'passed', 'submitted',
                    'thank you', 'application received', 'application submitted',
                    'congratulations', 'we have received', 'successfully submitted',
                    'your application has been', 'application complete'
                ];
                
                const hasSuccessText = successIndicators.some(indicator => 
                    bodyText.includes(indicator)
                );
                
                // Look for success indicators in URL
                const urlSuccessIndicators = [
                    'success', 'complete', 'submitted', 'thank', 'confirmation'
                ];
                
                const hasSuccessUrl = urlSuccessIndicators.some(indicator => 
                    currentUrl.includes(indicator)
                );
                
                // Look for failure indicators
                const failureIndicators = [
                    'verify you are human', 'security check', 'not a robot', 
                    'please verify', 'complete the verification', 'prove you are human',
                    'verification required', 'challenge', 'captcha', 'blocked',
                    'access denied', 'error occurred', 'something went wrong'
                ];
                
                const hasFailureText = failureIndicators.some(indicator => 
                    bodyText.includes(indicator)
                );
                
                // Check for verification elements still present
                const cfIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
                const turnstileIframe = document.querySelector('iframe[src*="turnstile"]');
                const verifyElements = document.querySelectorAll('[data-turnstile], [data-cf-turnstile], [id*="turnstile"], [class*="turnstile"]');
                
                const hasVerificationElements = cfIframe || turnstileIframe || verifyElements.length > 0;
                
                // Check for Turnstile tokens (indicates successful verification)
                const turnstileTokens = document.querySelectorAll('input[name="cf-turnstile-response"]');
                let hasValidToken = false;
                let tokenInfo = [];
                
                turnstileTokens.forEach((token, index) => {
                    const value = token.value || '';
                    tokenInfo.push({
                        index: index,
                        hasValue: value.length > 0,
                        valueLength: value.length,
                        isValid: value.length > 50  // Turnstile tokens are typically long
                    });
                    
                    if (value.length > 50) {
                        hasValidToken = true;
                    }
                });
                
                // Check for form submission indicators
                const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
                let submitButtonStates = [];
                
                submitButtons.forEach((btn, index) => {
                    submitButtonStates.push({
                        index: index,
                        disabled: btn.disabled,
                        text: btn.textContent || btn.value || '',
                        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
                    });
                });
                
                // Check for loading or processing indicators
                const loadingIndicators = document.querySelectorAll('.loading, .spinner, [role="progressbar"], .cf-loading, .submitting');
                const isLoading = loadingIndicators.length > 0;
                
                // Look for redirect indicators
                const hasRedirectMeta = document.querySelector('meta[http-equiv="refresh"]');
                const hasRedirectScript = bodyText.includes('window.location') || bodyText.includes('redirect');
                
                const result = {
                    currentUrl: currentUrl,
                    hasSuccessText: hasSuccessText,
                    hasSuccessUrl: hasSuccessUrl,
                    hasFailureText: hasFailureText,
                    hasVerificationElements: hasVerificationElements,
                    hasValidToken: hasValidToken,
                    tokenInfo: tokenInfo,
                    submitButtonStates: submitButtonStates,
                    isLoading: isLoading,
                    hasRedirectMeta: !!hasRedirectMeta,
                    hasRedirectScript: hasRedirectScript,
                    verificationElementCount: verifyElements.length,
                    pageTitle: document.title
                };
                
                console.log('Comprehensive verification check result:', result);
                
                // Determine success based on multiple factors
                let isSuccessful = false;
                let confidence = 'low';
                let reason = '';
                
                if (hasSuccessText || hasSuccessUrl) {
                    isSuccessful = true;
                    confidence = 'high';
                    reason = 'Success indicators found in text/URL';
                } else if (hasValidToken && !hasVerificationElements && !hasFailureText) {
                    isSuccessful = true;
                    confidence = 'medium';
                    reason = 'Valid Turnstile token present, no verification elements';
                } else if (!hasVerificationElements && !hasFailureText && !isLoading) {
                    isSuccessful = true;
                    confidence = 'medium';
                    reason = 'No verification elements or failure indicators';
                } else if (hasFailureText || hasVerificationElements) {
                    isSuccessful = false;
                    confidence = 'high';
                    reason = 'Failure indicators or verification elements still present';
                }
                
                return {
                    success: isSuccessful,
                    confidence: confidence,
                    reason: reason,
                    details: result
                };
            })();
            """)
            
            print(f"📊 Comprehensive verification result:")
            print(f"   Success: {success_check['success']}")
            print(f"   Confidence: {success_check['confidence']}")
            print(f"   Reason: {success_check['reason']}")
            print(f"   Current URL: {success_check['details']['currentUrl']}")
            print(f"   Page Title: {success_check['details']['pageTitle']}")
            print(f"   Valid Token: {success_check['details']['hasValidToken']}")
            print(f"   Verification Elements: {success_check['details']['hasVerificationElements']}")
            
            if success_check['success']:
                if success_check['confidence'] == 'high':
                    print("✅ Application submitted successfully with high confidence!")
                    tasks[task_id].update({"status": "completed", "message": "Application submitted successfully! Strong confirmation detected."})
                else:
                    print("✅ Application likely submitted successfully!")
                    tasks[task_id].update({"status": "completed", "message": "Application submitted successfully! Moderate confirmation detected."})
            else:
                print("⚠️  Application submission unclear or failed")
                print(f"   Reason: {success_check['reason']}")
                tasks[task_id].update({"status": "completed", "message": f"Application status unclear: {success_check['reason']} - please verify manually."})
                
        except Exception as e:
            print(f"Error checking submission status: {e}")
            tasks[task_id].update({"status": "completed", "message": "Application submitted! Please check for any final confirmations."})

        print("--- Application Process Complete ---")
        print("Application has been submitted. Keeping browser open for 30 seconds to see results...")
        await asyncio.sleep(30)

    except Exception as e:
        error_message = f"An error occurred: {e}"
        print(error_message)
        print("\n🔧 TROUBLESHOOTING:")
        print("   - Make sure your main Brave browser is completely closed")
        print("   - Check if any Brave processes are still running: ps aux | grep brave")
        print("   - The profile might be corrupted or have permission issues")
        print("   - Verify that the Brave profile directory exists and is accessible")
        import traceback
        traceback.print_exc()
        tasks[task_id].update({"status": "failed", "message": error_message})
    finally:
        if browser:
            print("🛑 Closing browser...")
            try:
                # Try multiple methods to ensure browser closes
                await browser.stop()
                print("✅ Browser.stop() called")
                
                # Give it a moment to close
                await asyncio.sleep(2)
                
                # Force kill any remaining processes as backup
                try:
                    subprocess.run(['pkill', '-f', 'brave-browser'], capture_output=True)
                    subprocess.run(['pkill', '-f', f'remote-debugging-port=9237'], capture_output=True)
                    print("✅ Backup process cleanup completed")
                except Exception as cleanup_error:
                    print(f"⚠️  Backup cleanup failed: {cleanup_error}")
                    
            except Exception as close_error:
                print(f"⚠️  Error closing browser: {close_error}")
                # Force kill as fallback
                try:
                    subprocess.run(['pkill', '-f', 'brave-browser'], capture_output=True)
                    print("✅ Force killed browser processes")
                except:
                    print("⚠️  Could not force kill browser processes")
            
            print("✅ Browser cleanup completed.")
            
        if temp_dir and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)
            print(f"🧹 Cleaned up temporary directory: {temp_dir}")
        elif temp_file_path and os.path.exists(temp_file_path):
            # Fallback for old logic if temp_dir wasn't created
            os.remove(temp_file_path)


async def parse_prompt_to_user_data(api_key: str, prompt: str) -> UserData:
    """Uses the LLM to parse the unstructured prompt into a structured UserData object."""
    print("Parsing prompt to extract structured user data...")
    parsing_prompt = (
        "You are a data extraction expert. Parse the following text from a job application prompt "
        "and extract the user's personal information. Return ONLY a valid JSON object with the following keys: "
        "'first_name', 'last_name', 'email', 'phone', 'linkedin', 'github', 'portfolio', 'address'. "
        "If a value is not found, omit the key or set it to null.\n\n"
        f"Text to parse:\n---\n{prompt}\n---\n\n"
        "JSON object:"
    )
    
    try:
        # Configure and use Google Generative AI directly
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        response = model.generate_content(parsing_prompt)
        # Clean the response to ensure it's valid JSON
        json_string = response.text.strip().replace("```json", "").replace("```", "")
        user_data_model = UserData.model_validate_json(json_string)
        print("Successfully parsed user data from prompt.")
        return user_data_model
    except Exception as e:
        print(f"Failed to parse user data from prompt: {e}. Proceeding with empty data.")
        # Return a default/empty model if parsing fails
        return UserData(first_name="N/A", last_name="N/A", email="N/A", phone="N/A")


@app.post("/auto-apply")
async def hybrid_auto_apply(
    url: str = Form(...),
    api_key: str = Form(...),
    prompt: str = Form(...),
    resume: UploadFile = File(None),
    file_url: str = Form(None)
):
    """
    Endpoint to trigger the hybrid auto-application process.
    Receives user data and job info, then starts a background task.
    """
    # Use the LLM to parse the unstructured prompt into structured data
    user_data_model = await parse_prompt_to_user_data(api_key, prompt)

    task_id = str(uuid.uuid4())
    # Pass the file_url to the background task
    asyncio.create_task(process_hybrid_apply(task_id, url, api_key, user_data_model, resume, file_url))
    
    return {"task_id": task_id, "status": "starting"}


@app.get("/auto-apply-status/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a task by its ID."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

# --- LLM + Playwright Verification System ---
async def check_turnstile_with_llm(tab, llm):
    """Use LLM to check if Turnstile verification is still visible on the page."""
    try:
        print("👁️  Using LLM to check if Turnstile is still visible...")
        
        # Take screenshot
        screenshot_path = f"/tmp/turnstile_check_{uuid.uuid4().hex}.png"
        await tab.save_screenshot(screenshot_path)
        
        # Read screenshot
        from PIL import Image
        import io
        with open(screenshot_path, 'rb') as f:
            screenshot_bytes = f.read()
        img = Image.open(io.BytesIO(screenshot_bytes))
        
        # Clean up
        os.remove(screenshot_path)
        
        # Create LLM prompt
        check_prompt = """
        You are analyzing a web page to determine if a Cloudflare Turnstile verification challenge is still visible.

        Look for these indicators that Turnstile is STILL PRESENT:
        1. Text "Verify you are human" 
        2. An unchecked checkbox with Cloudflare branding
        3. Cloudflare logo with verification elements
        4. Any visible verification challenge UI

        Look for these indicators that verification is COMPLETE:
        1. No "Verify you are human" text visible
        2. Checked checkbox or checkmark
        3. Success messages like "Verified", "Complete", "Thank you"
        4. The verification widget has disappeared
        5. Page has moved to next step/form

        Respond with this exact JSON format:
        {
            "turnstile_still_visible": true/false,
            "verification_complete": true/false,
            "confidence": "high/medium/low",
            "reason": "Brief explanation of what you see"
        }
        """
        
        # Use the model from the LLMAnswerGenerator instance
        response = await llm.model.generate_content_async(
            [check_prompt, img],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        # Parse response
        response_text = response.text.strip()
        result = json.loads(response_text)
        
        print(f"👁️  LLM Check Result:")
        print(f"   Turnstile still visible: {result.get('turnstile_still_visible')}")
        print(f"   Verification complete: {result.get('verification_complete')}")
        print(f"   Confidence: {result.get('confidence')}")
        print(f"   Reason: {result.get('reason')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error in LLM Turnstile check: {e}")
        import traceback
        traceback.print_exc()
        return {"turnstile_still_visible": True, "verification_complete": False, "confidence": "low", "reason": f"Error occurred: {e}"}

async def solve_verification_visually(tab, llm):
    """Use DOM inspection and coordinate guessing to solve Turnstile verification."""

    print("🔍 DOM Inspection and Coordinate Guessing Method...")
    try:
        # Inspect DOM and create visual highlights
        turnstile_info, best_target = await inspect_and_highlight_turnstile(tab)
        
        # Wait a moment for highlights to be visible
        await tab.sleep(3)
        
        # Try coordinate guessing method if we found containers
        if turnstile_info and turnstile_info.get('containers'):
            print("🎯 Using coordinate guessing method based on detected Turnstile elements...")
            guessing_success = await try_coordinate_guessing_method(tab, turnstile_info, llm)
            if guessing_success:
                print("✅ Coordinate guessing succeeded!")
                return True
            else:
                print("❌ Coordinate guessing failed")
        else:
            print("❌ No Turnstile containers found for coordinate guessing")
        
    except Exception as e:
        print(f"❌ DOM inspection and coordinate guessing failed: {e}")

    print("❌ All verification methods failed")
    return False

async def get_active_debug_port():
    """Find the active Chrome/Brave debug port by checking running processes."""
    try:
        import psutil
        import re
        
        print("🔍 Searching for active Brave/Chrome debug ports...")
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] and ('brave' in proc.info['name'].lower() or 'chrome' in proc.info['name'].lower()):
                    cmdline = ' '.join(proc.info['cmdline'] or [])
                    if '--remote-debugging-port=' in cmdline:
                        port_match = re.search(r'--remote-debugging-port=(\d+)', cmdline)
                        if port_match:
                            port = int(port_match.group(1))
                            print(f"🔍 Found process {proc.info['name']} (PID: {proc.info['pid']}) with debug port: {port}")
                            
                            # Test if port is actually listening
                            import socket
                            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            sock.settimeout(1)
                            result = sock.connect_ex(('127.0.0.1', port))
                            sock.close()
                            
                            if result == 0:  # Port is open
                                print(f"✅ Port {port} is active and listening")
                                
                                # Test if we can actually connect to the debug endpoint
                                try:
                                    import httpx
                                    async with httpx.AsyncClient(timeout=5.0) as client:
                                        response = await client.get(f"http://127.0.0.1:{port}/json/version")
                                        if response.status_code == 200:
                                            version_info = response.json()
                                            print(f"✅ Debug endpoint responding: {version_info.get('Browser', 'Unknown')}")
                                            return port
                                        else:
                                            print(f"⚠️  Port {port} not responding to debug requests")
                                except Exception as e:
                                    print(f"⚠️  Port {port} connection test failed: {e}")
                            else:
                                print(f"⚠️  Port {port} not listening")
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception as e:
                print(f"Error checking process: {e}")
                continue
                
    except ImportError:
        print("❌ psutil not available for port detection")
    except Exception as e:
        print(f"❌ Error detecting debug port: {e}")
    
    print("❌ No active debug ports found")
    return None

async def inspect_and_highlight_turnstile(tab):
    """Inspect the DOM for Turnstile elements and create visual highlights around them."""
    print("🔍 Inspecting DOM for Turnstile/Cloudflare verification elements...")
    
    try:
        # Comprehensive DOM inspection for Turnstile elements
        turnstile_info = await tab.evaluate("""
        (function() {
            const results = {
                iframes: [],
                containers: [],
                checkboxes: [],
                textElements: [],
                allElements: []
            };
            
            // 1. Find all iframes (Turnstile often uses iframes)
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach((iframe, index) => {
                const rect = iframe.getBoundingClientRect();
                const src = iframe.src || '';
                const id = iframe.id || '';
                const className = iframe.className || '';
                
                if (rect.width > 0 && rect.height > 0) {
                    results.iframes.push({
                        index: index,
                        src: src,
                        id: id,
                        className: className,
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        isTurnstile: src.includes('turnstile') || src.includes('cloudflare') || 
                                   id.includes('turnstile') || className.includes('turnstile'),
                        isVisible: rect.width > 0 && rect.height > 0
                    });
                }
            });
            
            // 2. Find containers with Turnstile-related attributes AND actual Turnstile widgets
            const turnstileSelectors = [
                '[id*="turnstile"]', '[class*="turnstile"]', '[data-turnstile]', 
                '[data-cf-turnstile]', '[id*="cloudflare"]', '[class*="cloudflare"]'
            ];
            
            turnstileSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((element, index) => {
                        const rect = element.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            // Check if this looks like an actual Turnstile widget (small size)
                            const isTurnstileWidget = rect.width < 400 && rect.height < 200;
                            const isLargeContainer = rect.width > 400 || rect.height > 200;
                            
                            // Look for actual Turnstile widgets inside large containers
                            let actualWidget = null;
                            if (isLargeContainer) {
                                // Search for smaller elements that might be the actual widget
                                const childElements = element.querySelectorAll('*');
                                for (let child of childElements) {
                                    const childRect = child.getBoundingClientRect();
                                    const childText = child.textContent || '';
                                    
                                    // Look for elements with verification text and reasonable size
                                    if (childText.toLowerCase().includes('verify') || 
                                        childText.toLowerCase().includes('human') ||
                                        child.querySelector('input[type="checkbox"]') ||
                                        (childRect.width > 200 && childRect.width < 400 && 
                                         childRect.height > 50 && childRect.height < 150)) {
                                        actualWidget = {
                                            element: child,
                                            x: Math.round(childRect.x),
                                            y: Math.round(childRect.y),
                                            width: Math.round(childRect.width),
                                            height: Math.round(childRect.height)
                                        };
                                        break;
                                    }
                                }
                            }
                            
                            results.containers.push({
                                selector: selector,
                                index: index,
                                tagName: element.tagName,
                                id: element.id || '',
                                className: element.className || '',
                                x: Math.round(rect.x),
                                y: Math.round(rect.y),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height),
                                innerHTML: element.innerHTML.substring(0, 200),
                                isVisible: rect.width > 0 && rect.height > 0,
                                isTurnstileWidget: isTurnstileWidget,
                                isLargeContainer: isLargeContainer,
                                actualWidget: actualWidget
                            });
                        }
                    });
                } catch (e) {
                    console.log('Error with selector:', selector, e);
                }
            });
            
            // 3. Find all checkboxes and checkbox-like elements
            const checkboxSelectors = [
                'input[type="checkbox"]', '[role="checkbox"]', 
                '[aria-checked]', '.checkbox', '.check-box'
            ];
            
            checkboxSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((element, index) => {
                        const rect = element.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            results.checkboxes.push({
                                selector: selector,
                                index: index,
                                tagName: element.tagName,
                                type: element.type || '',
                                id: element.id || '',
                                className: element.className || '',
                                x: Math.round(rect.x),
                                y: Math.round(rect.y),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height),
                                checked: element.checked || element.getAttribute('aria-checked') === 'true',
                                isVisible: rect.width > 0 && rect.height > 0,
                                outerHTML: element.outerHTML.substring(0, 300)
                            });
                        }
                    });
                } catch (e) {
                    console.log('Error with checkbox selector:', selector, e);
                }
            });
            
            // 4. Find text elements containing verification text
            const verificationTexts = [
                'verify you are human', 'verify you are not a robot', 'i am human',
                'security check', 'prove you are human', 'complete verification'
            ];
            
            verificationTexts.forEach(searchText => {
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.toLowerCase().includes(searchText)) {
                        const parent = node.parentElement;
                        if (parent) {
                            const rect = parent.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                results.textElements.push({
                                    text: searchText,
                                    content: node.textContent.trim(),
                                    parentTag: parent.tagName,
                                    parentId: parent.id || '',
                                    parentClass: parent.className || '',
                                    x: Math.round(rect.x),
                                    y: Math.round(rect.y),
                                    width: Math.round(rect.width),
                                    height: Math.round(rect.height)
                                });
                            }
                        }
                    }
                }
            });
            
            // 5. Find ALL clickable elements in the verification area
            const allClickable = document.querySelectorAll('*');
            allClickable.forEach((element, index) => {
                const rect = element.getBoundingClientRect();
                const text = element.textContent || '';
                const hasVerifyText = text.toLowerCase().includes('verify') || 
                                    text.toLowerCase().includes('human') ||
                                    text.toLowerCase().includes('robot');
                
                if (hasVerifyText && rect.width > 0 && rect.height > 0 && rect.width < 500 && rect.height < 200) {
                    results.allElements.push({
                        index: index,
                        tagName: element.tagName,
                        id: element.id || '',
                        className: element.className || '',
                        text: text.substring(0, 100),
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        clickable: element.onclick !== null || element.style.cursor === 'pointer' ||
                                 element.tagName === 'BUTTON' || element.tagName === 'A' ||
                                 element.type === 'checkbox' || element.role === 'checkbox'
                    });
                }
            });
            
            return results;
        })();
        """)
        
        print(f"📊 DOM Inspection Results:")
        print(f"   - Found {len(turnstile_info['iframes'])} iframes")
        print(f"   - Found {len(turnstile_info['containers'])} Turnstile containers")
        print(f"   - Found {len(turnstile_info['checkboxes'])} checkboxes")
        print(f"   - Found {len(turnstile_info['textElements'])} verification text elements")
        print(f"   - Found {len(turnstile_info['allElements'])} verification-related elements")
        
        # Create visual highlights for all found elements
        highlight_id = f"highlight_{uuid.uuid4().hex[:8]}"
        
        # Convert Python booleans to JavaScript booleans
        turnstile_info_js = json.dumps(turnstile_info)
        
        await tab.evaluate(f"""
        (function() {{
            // Remove any existing highlights
            const existingHighlights = document.querySelectorAll('[id^="highlight_"]');
            existingHighlights.forEach(h => h.remove());
            
            const results = {turnstile_info_js};
            let highlightIndex = 0;
            
            // Helper function to create highlight outline (no fill)
            function createHighlight(x, y, width, height, color, label, zIndex = 999999) {{
                const highlight = document.createElement('div');
                highlight.id = '{highlight_id}_' + highlightIndex++;
                highlight.style.position = 'fixed';
                highlight.style.left = x + 'px';
                highlight.style.top = y + 'px';
                highlight.style.width = width + 'px';
                highlight.style.height = height + 'px';
                highlight.style.border = '2px solid ' + color;
                highlight.style.backgroundColor = 'transparent';  // No fill - outline only
                highlight.style.zIndex = zIndex;
                highlight.style.pointerEvents = 'none';
                highlight.style.boxSizing = 'border-box';
                highlight.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.8)';  // White outline for visibility
                
                // Add label
                const labelDiv = document.createElement('div');
                labelDiv.style.position = 'absolute';
                labelDiv.style.top = '-25px';
                labelDiv.style.left = '0px';
                labelDiv.style.backgroundColor = color;
                labelDiv.style.color = 'white';
                labelDiv.style.padding = '2px 6px';
                labelDiv.style.fontSize = '12px';
                labelDiv.style.fontWeight = 'bold';
                labelDiv.style.borderRadius = '3px';
                labelDiv.style.whiteSpace = 'nowrap';
                labelDiv.textContent = label;
                highlight.appendChild(labelDiv);
                
                document.body.appendChild(highlight);
                return highlight;
            }}
            
            // Highlight iframes (red)
            results.iframes.forEach((iframe, index) => {{
                const label = iframe.isTurnstile ? `TURNSTILE IFRAME ${{index + 1}}` : `IFRAME ${{index + 1}}`;
                const color = iframe.isTurnstile ? 'red' : 'orange';
                createHighlight(iframe.x, iframe.y, iframe.width, iframe.height, color, label);
                console.log('Highlighted iframe:', label, iframe);
            }});
            
            // Highlight Turnstile containers (blue for large, green for widgets)
            results.containers.forEach((container, index) => {{
                if (container.isTurnstileWidget) {{
                    // Small widget - highlight in bright green
                    createHighlight(container.x, container.y, container.width, container.height, 
                                  'lime', `WIDGET ${{index + 1}}`);
                    console.log('Highlighted Turnstile widget:', container);
                }} else if (container.isLargeContainer) {{
                    // Large container - highlight in blue with transparency
                    createHighlight(container.x, container.y, container.width, container.height, 
                                  'blue', `LARGE CONTAINER ${{index + 1}}`, 999990);
                    console.log('Highlighted large container:', container);
                    
                    // If we found an actual widget inside, highlight it in bright green
                    if (container.actualWidget) {{
                        createHighlight(container.actualWidget.x, container.actualWidget.y, 
                                      container.actualWidget.width, container.actualWidget.height, 
                                      'lime', `ACTUAL WIDGET ${{index + 1}}`, 999995);
                        console.log('Highlighted actual widget inside container:', container.actualWidget);
                    }}
                }} else {{
                    // Regular container
                    createHighlight(container.x, container.y, container.width, container.height, 
                                  'blue', `CONTAINER ${{index + 1}}`);
                    console.log('Highlighted container:', container);
                }}
            }});
            
            // Highlight checkboxes (green)
            results.checkboxes.forEach((checkbox, index) => {{
                const label = `CHECKBOX ${{index + 1}}${{checkbox.checked ? ' ✓' : ''}}`;
                createHighlight(checkbox.x, checkbox.y, checkbox.width, checkbox.height, 
                              'green', label);
                console.log('Highlighted checkbox:', label, checkbox);
            }});
            
            // Highlight verification text (purple)
            results.textElements.forEach((textEl, index) => {{
                createHighlight(textEl.x, textEl.y, textEl.width, textEl.height, 
                              'purple', `TEXT ${{index + 1}}`);
                console.log('Highlighted text:', textEl);
            }});
            
            // Highlight all verification elements (yellow)
            results.allElements.forEach((element, index) => {{
                if (element.clickable) {{
                    createHighlight(element.x, element.y, element.width, element.height, 
                                  'yellow', `CLICKABLE ${{index + 1}}`);
                    console.log('Highlighted clickable element:', element);
                }}
            }});
            
            console.log('All highlights created. Check the page for colored boxes.');
            return {{
                totalHighlights: highlightIndex,
                iframes: results.iframes.length,
                containers: results.containers.length,
                checkboxes: results.checkboxes.length,
                textElements: results.textElements.length,
                clickableElements: results.allElements.filter(e => e.clickable).length
            }};
        }})();
        """)
        
        # Print detailed information about found elements
        if turnstile_info['iframes']:
            print("\n🖼️  IFRAMES FOUND:")
            for i, iframe in enumerate(turnstile_info['iframes']):
                print(f"   {i+1}. {'🎯 TURNSTILE' if iframe['isTurnstile'] else '📄 REGULAR'} - "
                      f"Position: ({iframe['x']}, {iframe['y']}) Size: {iframe['width']}x{iframe['height']}")
                print(f"      SRC: {iframe['src'][:100]}...")
                print(f"      ID: {iframe['id']}, Class: {iframe['className']}")
        
        if turnstile_info['containers']:
            print("\n📦 TURNSTILE CONTAINERS FOUND:")
            for i, container in enumerate(turnstile_info['containers']):
                container_type = "🎯 WIDGET" if container.get('isTurnstileWidget') else ("📦 LARGE CONTAINER" if container.get('isLargeContainer') else "📦 CONTAINER")
                print(f"   {i+1}. {container_type} - {container['tagName']} - Position: ({container['x']}, {container['y']}) "
                      f"Size: {container['width']}x{container['height']}")
                print(f"      ID: {container['id']}, Class: {container['className']}")
                
                if container.get('actualWidget'):
                    widget = container['actualWidget']
                    print(f"      🎯 ACTUAL WIDGET INSIDE: Position: ({widget['x']}, {widget['y']}) "
                          f"Size: {widget['width']}x{widget['height']}")
                    print(f"         This will be used for coordinate guessing!")
        
        if turnstile_info['checkboxes']:
            print("\n☑️  CHECKBOXES FOUND:")
            for i, checkbox in enumerate(turnstile_info['checkboxes']):
                status = "✅ CHECKED" if checkbox['checked'] else "⬜ UNCHECKED"
                print(f"   {i+1}. {status} - Position: ({checkbox['x']}, {checkbox['y']}) "
                      f"Size: {checkbox['width']}x{checkbox['height']}")
                print(f"      Type: {checkbox['type']}, ID: {checkbox['id']}")
                print(f"      HTML: {checkbox['outerHTML'][:100]}...")
        
        if turnstile_info['textElements']:
            print("\n📝 VERIFICATION TEXT FOUND:")
            for i, text_el in enumerate(turnstile_info['textElements']):
                print(f"   {i+1}. Text: '{text_el['content'][:50]}...'")
                print(f"      Position: ({text_el['x']}, {text_el['y']}) Size: {text_el['width']}x{text_el['height']}")
        
        # Return the most promising element for clicking
        best_target = None
        
        # Priority 1: Turnstile iframes
        turnstile_iframes = [iframe for iframe in turnstile_info['iframes'] if iframe['isTurnstile']]
        if turnstile_iframes:
            best_target = {
                'type': 'turnstile_iframe',
                'element': turnstile_iframes[0],
                'click_x': turnstile_iframes[0]['x'] + 20,  # Click near left edge
                'click_y': turnstile_iframes[0]['y'] + turnstile_iframes[0]['height'] // 2
            }
        
        # Priority 2: Unchecked checkboxes near verification text
        elif turnstile_info['checkboxes']:
            unchecked_boxes = [cb for cb in turnstile_info['checkboxes'] if not cb['checked']]
            if unchecked_boxes:
                best_target = {
                    'type': 'checkbox',
                    'element': unchecked_boxes[0],
                    'click_x': unchecked_boxes[0]['x'] + unchecked_boxes[0]['width'] // 2,
                    'click_y': unchecked_boxes[0]['y'] + unchecked_boxes[0]['height'] // 2
                }
        
        # Priority 3: Turnstile containers
        elif turnstile_info['containers']:
            best_target = {
                'type': 'container',
                'element': turnstile_info['containers'][0],
                'click_x': turnstile_info['containers'][0]['x'] + 20,
                'click_y': turnstile_info['containers'][0]['y'] + turnstile_info['containers'][0]['height'] // 2
            }
        
        if best_target:
            print(f"\n🎯 BEST TARGET IDENTIFIED:")
            print(f"   Type: {best_target['type']}")
            print(f"   Click coordinates: ({best_target['click_x']}, {best_target['click_y']})")
            print(f"   Element details: {best_target['element']}")
        else:
            print("\n❌ No suitable target found for clicking")
        
        return turnstile_info, best_target
        
    except Exception as e:
        print(f"❌ Error inspecting DOM: {e}")
        import traceback
        traceback.print_exc()
        return None, None

async def guess_checkbox_coordinates_from_container(turnstile_info):
    """Guess checkbox coordinates based on Turnstile container position."""
    if not turnstile_info or not turnstile_info.get('containers'):
        return []
    
    print("🎯 Guessing checkbox coordinates from Turnstile container...")
    
    container = turnstile_info['containers'][0]  # Use first container
    
    # Use actual widget coordinates if available, otherwise use container
    if container.get('actualWidget'):
        widget = container['actualWidget']
        widget_x = widget['x']
        widget_y = widget['y'] 
        widget_width = widget['width']
        widget_height = widget['height']
        print(f"🎯 Using actual widget: ({widget_x}, {widget_y}) Size: {widget_width}x{widget_height}")
        reference_element = widget
    else:
        widget_x = container['x']
        widget_y = container['y'] 
        widget_width = container['width']
        widget_height = container['height']
        print(f"📦 Using container: ({widget_x}, {widget_y}) Size: {widget_width}x{widget_height}")
        reference_element = container
    
    # For large containers without detected widgets, focus on likely areas
    if widget_width > 400 and not container.get('actualWidget'):
        print("⚠️  Large container detected - using focused search strategy")
        # Focus on the center area where Turnstile widgets are typically placed
        center_x = widget_x + (widget_width // 2)
        center_y = widget_y + (widget_height // 2)
        
        guessed_positions = []
        
        # Search around the center area
        for offset_x in [-50, -25, 0, 25, 50]:
            for offset_y in [-20, 0, 20]:
                guess_x = center_x + offset_x
                guess_y = center_y + offset_y
                
                # Make sure we're still within the container
                if (widget_x <= guess_x <= widget_x + widget_width and 
                    widget_y <= guess_y <= widget_y + widget_height):
                    
                    confidence = 'high' if abs(offset_x) <= 25 and abs(offset_y) <= 10 else 'medium'
                    guessed_positions.append({
                        'x': guess_x,
                        'y': guess_y,
                        'description': f'Center area ({offset_x:+d}, {offset_y:+d})',
                        'confidence': confidence
                    })
    else:
        # Normal strategy for smaller widgets or detected actual widgets
        guessed_positions = []
        
        # Position 1: Left side, vertically centered (most common)
        guess1_x = widget_x + 17
        guess1_y = widget_y + (widget_height // 2)
        guessed_positions.append({
            'x': guess1_x,
            'y': guess1_y,
            'description': 'Left side, vertically centered',
            'confidence': 'high'
        })
        
        # Position 2: Upper-left area (typical checkbox position)
        guess2_x = widget_x + 13
        guess2_y = widget_y + (widget_height // 3)
        guessed_positions.append({
            'x': guess2_x,
            'y': guess2_y,
            'description': 'Upper-left area',
            'confidence': 'medium'
        })
        
        # Position 3: Lower-left area
        guess3_x = widget_x + 25
        guess3_y = widget_y + (2 * widget_height // 3)
        guessed_positions.append({
            'x': guess3_x,
            'y': guess3_y,
            'description': 'Lower-left area',
            'confidence': 'medium'
        })
        
        # Position 4: Far left edge
        guess4_x = widget_x + 10
        guess4_y = widget_y + (widget_height // 2)
        guessed_positions.append({
            'x': guess4_x,
            'y': guess4_y,
            'description': 'Far left edge',
            'confidence': 'low'
        })
        
        # Position 5: Center-left (for wider widgets)
        if widget_width > 200:
            guess5_x = widget_x + 40
            guess5_y = widget_y + (widget_height // 2)
            guessed_positions.append({
                'x': guess5_x,
                'y': guess5_y,
                'description': 'Center-left area',
                'confidence': 'low'
            })
    
    print(f"🎯 Generated {len(guessed_positions)} coordinate guesses:")
    for i, pos in enumerate(guessed_positions):
        print(f"   {i+1}. ({pos['x']}, {pos['y']}) - {pos['description']} ({pos['confidence']} confidence)")
    
    return guessed_positions

async def try_coordinate_guessing_method(tab, turnstile_info, llm):
    """Try clicking on guessed coordinates based on container position - LIMITED TO 2 ATTEMPTS."""
    print("🎯 Attempting coordinate guessing method (max 2 attempts)...")
    
    guessed_positions = await guess_checkbox_coordinates_from_container(turnstile_info)
    
    if not guessed_positions:
        print("❌ No coordinates to guess from")
        return False
    
    # Limit to top 2 guesses (highest confidence)
    top_guesses = sorted(guessed_positions, key=lambda x: {'high': 3, 'medium': 2, 'low': 1}.get(x['confidence'], 0), reverse=True)[:2]
    
    try:
        # Connect to browser for clicking
        playwright = await async_playwright().start()
        debug_port = await get_active_debug_port()
        
        if not debug_port:
            print("❌ Could not find debug port for coordinate guessing, trying default port 9237")
            debug_port = 9237  # Use our known debug port as fallback
            
        browser = await playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{debug_port}")
        context = browser.contexts[0]
        page = context.pages[-1]
        
        # Try only the top 2 guesses
        for i, pos in enumerate(top_guesses):
            print(f"🎯 Attempt {i+1}/2: Clicking ({pos['x']}, {pos['y']}) - {pos['description']} ({pos['confidence']} confidence)")
            
            # Add visual marker for this guess
            await tab.evaluate(f"""
            (function() {{
                // Create a bright cyan outline marker for guessed position
                const marker = document.createElement('div');
                marker.id = 'guess-marker-{i}';
                marker.style.position = 'fixed';
                marker.style.left = '{pos['x'] - 12}px';
                marker.style.top = '{pos['y'] - 12}px';
                marker.style.width = '24px';
                marker.style.height = '24px';
                marker.style.backgroundColor = 'transparent';  // No fill - outline only
                marker.style.border = '3px solid cyan';
                marker.style.borderRadius = '50%';
                marker.style.zIndex = '999999';
                marker.style.pointerEvents = 'none';
                marker.style.opacity = '0.9';
                marker.style.boxShadow = '0 0 15px rgba(0,255,255,0.8), inset 0 0 0 1px rgba(255,255,255,0.8)';
                
                // Add number label
                const label = document.createElement('div');
                label.style.position = 'absolute';
                label.style.top = '-30px';
                label.style.left = '50%';
                label.style.transform = 'translateX(-50%)';
                label.style.backgroundColor = 'magenta';
                label.style.color = 'white';
                label.style.padding = '2px 6px';
                label.style.fontSize = '12px';
                label.style.fontWeight = 'bold';
                label.style.borderRadius = '3px';
                label.textContent = 'ATTEMPT {i+1}';
                marker.appendChild(label);
                
                document.body.appendChild(marker);
                
                // Remove after 4 seconds
                setTimeout(() => {{
                    if (marker.parentNode) {{
                        marker.parentNode.removeChild(marker);
                    }}
                }}, 4000);
            }})();
            """)
            
            await asyncio.sleep(0.5)  # Let marker appear
            
            # Click the guessed position
            await page.mouse.click(pos['x'], pos['y'])
            print(f"   🖱️  Clicked at ({pos['x']}, {pos['y']})")
            
            # Wait 2 seconds as requested
            print("   ⏳ Waiting 2 seconds...")
            await asyncio.sleep(2)
            
            # Use LLM to check if Turnstile is still visible
            llm_check = await check_turnstile_with_llm(tab, llm)
            
            if llm_check.get('verification_complete') or not llm_check.get('turnstile_still_visible'):
                print(f"✅ SUCCESS on attempt {i+1}! LLM detected verification completion")
                print(f"   Reason: {llm_check.get('reason')}")
                await browser.close()
                await playwright.stop()
                return True
            else:
                print(f"   ❌ Attempt {i+1} failed - Turnstile still visible")
                print(f"   Reason: {llm_check.get('reason')}")
                
                # Don't continue if this was the last attempt
                if i == len(top_guesses) - 1:
                    break
                    
                print(f"   🔄 Preparing for attempt {i+2}...")
        
        print("❌ All coordinate guessing attempts failed")
        await browser.close()
        await playwright.stop()
        return False
        
    except Exception as e:
        print(f"❌ Error in coordinate guessing: {e}")
        return False

class WorkableElementDiscovery:
    """Comprehensive element discovery system for Workable forms."""
    
    def __init__(self, tab):
        self.tab = tab
        self.discovered_elements: List[ElementInfo] = []
    
    def determine_field_purpose(self, label_text: str, data_ui: str) -> str:
        """A lightweight method to identify standard fields vs. complex questions."""
        label_lower = label_text.lower()
        
        # Mapping of keywords to a purpose
        purpose_map = {
            'first_name': ['first name', 'given name'],
            'last_name': ['last name', 'family name', 'surname'],
            'email': ['email', 'e-mail'],
            'phone': ['phone'],
            'address': ['address', 'location'],
            'linkedin': ['linkedin'],
            'github': ['github'],
            'portfolio': ['portfolio', 'website', 'personal site'],
            'resume': ['resume', 'cv', 'résumé'],
            'cover_letter': ['cover letter'],
        }

        for purpose, keywords in purpose_map.items():
            if any(keyword in label_lower for keyword in keywords):
                return purpose

        # If it doesn't match a standard field, it's a complex question
        # We can use the data_ui as a unique identifier for this question
        return f"complex_question_{data_ui}"

    async def discover_question_text(self, element) -> str:
        """Discover the question/label text using multiple strategies from worable.md."""
        try:
            # Get element attributes once
            element_attrs = element.attrs or {}
            data_ui = element_attrs.get('data-ui', '')
            element_id = element_attrs.get('id', '')
            
            # Strategy 1: aria-labelledby (highest priority)
            aria_labelledby_attr = element_attrs.get('aria-labelledby', '')
            if aria_labelledby_attr:
                try:
                    aria_labelledby = await self.tab.evaluate(f"""
                        (() => {{
                            const byIds = '{aria_labelledby_attr}'.trim();
                            if (byIds) {{
                                return byIds.split(/\\s+/)
                                    .map(id => {{
                                        const labelEl = document.getElementById(id);
                                        return labelEl ? labelEl.innerText?.trim() : '';
                                    }})
                                    .filter(Boolean)
                                    .join(' ');
                            }}
                            return '';
                        }})()
                    """)
                    if aria_labelledby:
                        return aria_labelledby
                except:
                    pass
            
            # Strategy 2: Explicit label[for="..."]
            if element_id:
                try:
                    explicit_label = await self.tab.evaluate(f"""
                        (() => {{
                            const label = document.querySelector('label[for="{element_id}"]');
                            return label ? label.innerText.trim() : '';
                        }})()
                    """)
                    if explicit_label:
                        return explicit_label
                except:
                    pass
            
            # Strategy 3: Find label by data-ui selector
            if data_ui:
                try:
                    # Look for nearby labels or text content
                    nearby_label = await self.tab.evaluate(f"""
                        (() => {{
                            const element = document.querySelector('[data-ui="{data_ui}"]');
                            if (!element) return '';
                            
                            // Check if nested in label
                            const nestedLabel = element.closest('label');
                            if (nestedLabel) {{
                                return nestedLabel.innerText.trim();
                            }}
                            
                            // Check parent container for text
                            let parent = element.parentElement;
                            while (parent && parent !== document.body) {{
                                const text = parent.innerText || parent.textContent || '';
                                if (text.length > 0 && text.length < 200) {{
                                    // Filter out just the element's own text
                                    const elementText = element.innerText || element.textContent || '';
                                    const parentText = text.replace(elementText, '').trim();
                                    if (parentText.length > 2) {{
                                        return parentText;
                                    }}
                                }}
                                parent = parent.parentElement;
                            }}
                            
                            return '';
                        }})()
                    """)
                    if nearby_label and len(nearby_label) > 2:
                        return nearby_label
                except:
                    pass
            
            # Strategy 4: aria-label
            if element_attrs.get('aria-label'):
                return element_attrs['aria-label']
            
            # Strategy 5: Legend in fieldset (for radio groups)
            if data_ui:
                try:
                    legend_text = await self.tab.evaluate(f"""
                        (() => {{
                            const element = document.querySelector('[data-ui="{data_ui}"]');
                            if (!element) return '';
                            
                            const fieldset = element.closest('fieldset');
                            if (fieldset) {{
                                const legend = fieldset.querySelector('legend');
                                return legend ? legend.innerText.trim() : '';
                            }}
                            return '';
                        }})()
                    """)
                    if legend_text:
                        return legend_text
                except:
                    pass
            
            # Strategy 6: Placeholder
            if element_attrs.get('placeholder'):
                return f"[Placeholder: {element_attrs['placeholder']}]"
            
            # Strategy 7: Name/ID heuristics
            name = element_attrs.get('name', element_attrs.get('id', ''))
            if name:
                # Convert to readable format using Python regex
                readable = re.sub(r'[-_]', ' ', name)
                readable = re.sub(r'([a-z])([A-Z])', r'\1 \2', readable)
                return f"[From name/id: {readable}]"
            
            # Strategy 8: Use data-ui as fallback
            if data_ui:
                readable = re.sub(r'[-_]', ' ', data_ui)
                readable = re.sub(r'([a-z])([A-Z])', r'\1 \2', readable)
                return f"[From data-ui: {readable}]"
                
            return "[No label found]"
            
        except Exception as e:
            print(f"⚠️  Error discovering question text: {e}")
            return "[Error getting label]"
    
    async def detect_required_field(self, element) -> bool:
        """Detect if field is required using comprehensive detection from worable.md."""
        try:
            # First, check if the label explicitly says "(Optional)"
            label_text = await self.discover_question_text(element)
            if '(optional)' in label_text.lower():
                return False

            # Method 1: HTML attributes on the element itself
            attrs = element.attrs or {}
            if attrs.get('required') or attrs.get('aria-required') == 'true':
                return True

            # Method 2: Check for a required asterisk '*' within the element's parent wrapper.
            # This is more accurate than a global search.
            data_ui = attrs.get('data-ui', '')
            if not data_ui:
                # If no data-ui, we can't reliably scope the search. Fallback to label check.
                if '*' in label_text:
                    return True
                return False

            is_required_by_asterisk = await self.tab.evaluate(f"""
                (() => {{
                    const element = document.querySelector('[data-ui="{data_ui}"]');
                    if (!element) return false;

                    // Find the closest field wrapper. Workable often uses a div container for each field.
                    let fieldWrapper = element.closest('div[class*="styles--"]');
                    if (!fieldWrapper) {{
                        fieldWrapper = element.parentElement;
                    }}
                    if (!fieldWrapper) return false;

                    // Now, look for an asterisk within this specific wrapper
                    const asterisk = fieldWrapper.querySelector('strong'); // Often in a <strong> tag
                    if (asterisk && asterisk.innerText.includes('*')) {{
                        return true;
                    }}
                    
                    const label = fieldWrapper.querySelector('label');
                    if(label && label.innerText.includes('*')) {{
                        return true;
                    }}

                    // Check for other common patterns
                    const asteriskSpan = fieldWrapper.querySelector('span[class*="asterisk"], span[class*="required"]');
                    if (asteriskSpan && asteriskSpan.innerText.includes('*')){{
                        return true;
                    }}
                    
                    return false;
                }})()
            """)

            if is_required_by_asterisk:
                return True

            # Method 3: Fallback to checking the discovered label text directly for an asterisk
            if '*' in label_text:
                return True
                
            return False
            
        except Exception as e:
            print(f"⚠️  Error detecting required field for {element.attrs.get('data-ui', 'unknown')}: {e}")
            return False
    
    async def get_radio_options(self, fieldset_data_ui: str) -> List[str]:
        """Get available options for radio groups."""
        try:
            print(f"🔍 Extracting radio options for {fieldset_data_ui}...")
            
            # Use JavaScript to get the actual option values and labels
            options_data = await self.tab.evaluate(f"""
                (() => {{
                    const fieldset = document.querySelector('fieldset[data-ui="{fieldset_data_ui}"]');
                    if (!fieldset) return [];
                    
                    const options = [];
                    
                    // Try different option structures
                    const radioInputs = fieldset.querySelectorAll('input[type="radio"]');
                    
                    for (let i = 0; i < radioInputs.length; i++) {{
                        const radio = radioInputs[i];
                        const value = radio.value || '';
                        
                        // Try to find associated label text
                        let labelText = '';
                        
                        // Method 1: Look for label with for attribute
                        if (radio.id) {{
                            const label = document.querySelector(`label[for="${{radio.id}}"]`);
                            if (label) labelText = label.innerText || label.textContent || '';
                        }}
                        
                        // Method 2: Look for parent label
                        if (!labelText) {{
                            const parentLabel = radio.closest('label');
                            if (parentLabel) labelText = parentLabel.innerText || parentLabel.textContent || '';
                        }}
                        
                        // Method 3: Look for sibling text in option container
                        if (!labelText) {{
                            const optionContainer = radio.closest('[data-ui="option"]') || radio.parentElement;
                            if (optionContainer) {{
                                labelText = optionContainer.innerText || optionContainer.textContent || '';
                            }}
                        }}
                        
                        // Clean up the text
                        labelText = labelText.replace(/SVGs not supported by this browser/gi, '');
                        labelText = labelText.replace(/\\s+/g, ' ').trim();
                        
                        // For YES/NO questions, use the value if we have it
                        if (value === 'true' || value === 'false') {{
                            labelText = value === 'true' ? 'YES' : 'NO';
                        }}
                        
                        if (labelText && labelText.length > 0) {{
                            options.push({{
                                value: value,
                                text: labelText,
                                index: i
                            }});
                        }}
                    }}
                    
                    return options;
                }})()
            """)
            
            if options_data:
                option_texts = []
                for option in options_data:
                    option_text = f"{option['text']} (value: {option['value']})" if option['value'] else option['text']
                    option_texts.append(option_text)
                    print(f"   📝 Option {option['index']}: {option_text}")
                return option_texts
            
            return []
            
        except Exception as e:
            print(f"⚠️  Error getting radio options: {e}")
            return []
    
    async def get_select_options(self, select_data_ui: str) -> List[str]:
        """Get available options for custom select dropdowns using robust methods."""
        try:
            print(f"🔍 Extracting dropdown options for {select_data_ui} using robust method...")

            # 1. Open the dropdown
            wrapper = await self.tab.select(f'div[data-ui="{select_data_ui}"]')
            if not wrapper:
                print(f"   ❌ Could not find dropdown wrapper for {select_data_ui}")
                return []

            await wrapper.scroll_into_view()
            await asyncio.sleep(0.5)

            dropdown_opened = False
            
            # Strategy 1: Click the input element (most reliable)
            input_element = await self.tab.select(f'div[data-ui="{select_data_ui}"] input[role="combobox"]')
            if input_element:
                try:
                    print("   🖱️  Attempt 1: Clicking input element...")
                    await input_element.mouse_click()
                    await asyncio.sleep(1.5)
                    if await self._check_dropdown_opened(select_data_ui):
                        dropdown_opened = True
                        print("   ✅ Dropdown opened with input click.")
                except Exception as e:
                    print(f"   ⚠️  Input click failed: {e}")

            # Strategy 2: Click the wrapper as fallback
            if not dropdown_opened:
                try:
                    print("   🖱️  Attempt 2: Clicking wrapper element...")
                    await wrapper.mouse_click()
                    await asyncio.sleep(1.5)
                    if await self._check_dropdown_opened(select_data_ui):
                        dropdown_opened = True
                        print("   ✅ Dropdown opened with wrapper click.")
                except Exception as e:
                    print(f"   ⚠️  Wrapper click failed: {e}")
            
            if not dropdown_opened:
                print(f"   ❌ All attempts to open dropdown {select_data_ui} failed.")
                await self._close_dropdown_with_esc() # Attempt cleanup
                return []

            # 2. Extract options from the open dropdown
            print("   📋 Extracting options...")
            options_data = await self.tab.evaluate("""
                (() => {
                    const options = [];
                    const dialog = document.querySelector('dialog[open]');
                    if (dialog) {
                        const listbox = dialog.querySelector('ul[role="listbox"]');
                        if (listbox) {
                            const optionElements = listbox.querySelectorAll('li[role="option"]');
                            for (let i = 0; i < optionElements.length; i++) {
                                const element = optionElements[i];
                                const text = (element.innerText || element.textContent || '').trim();
                                const value = element.getAttribute('data-value') || element.getAttribute('value') || text;
                                if (text && text.length > 0) {
                                    options.push({ text: text, value: value, index: i });
                                }
                            }
                        }
                    }
                    return options;
                })()
            """)

            # 3. Close the dropdown to prevent interference
            await self._close_dropdown_with_esc()

            if options_data:
                option_texts = []
                for option in options_data:
                    option_text = f"{option['text']}" + (f" (value: {option['value']})" if option['value'] != option['text'] else "")
                    option_texts.append(option_text)
                    print(f"   📝 Option {option['index']}: {option_text}")
                return option_texts
            else:
                print(f"   ❌ No dropdown options found for {select_data_ui}")
                return []

        except Exception as e:
            print(f"⚠️  Error getting select options for {select_data_ui}: {e}")
            # Try to clean up even on error
            await self._close_dropdown_with_esc()
            return []

    async def _check_dropdown_opened(self, data_ui_for_logging: str) -> bool:
        """Helper to check if a dropdown is open."""
        try:
            await asyncio.sleep(0.5)
            status = await self.tab.evaluate(f"""
                (() => {{
                    const openDialogs = document.querySelectorAll('dialog[open]').length;
                    const dialog = document.querySelector('dialog[open]');
                    let hasOptions = false;
                    if (dialog) {{
                        const listbox = dialog.querySelector('ul[role="listbox"]');
                        if (listbox) {{
                            const options = listbox.querySelectorAll('li[role="option"]');
                            hasOptions = options.length > 0;
                        }}
                    }}
                    return openDialogs > 0 && hasOptions;
                }})()
            """)
            return status
        except Exception as e:
            print(f"   ⚠️  Check dropdown open status failed for {data_ui_for_logging}: {e}")
            return False

    async def _close_dropdown_with_esc(self):
        """Helper to close any open dropdown using ESC key."""
        try:
            print("   🔄 Closing dropdown with ESC to ensure clean state...")
            await self.tab.evaluate("""
                (() => {
                    const escEvent = new KeyboardEvent('keydown', {
                        key: 'Escape', keyCode: 27, code: 'Escape', which: 27,
                        bubbles: true, cancelable: true
                    });
                    document.dispatchEvent(escEvent);
                    if (document.activeElement) {
                        document.activeElement.dispatchEvent(escEvent);
                    }
                    document.querySelectorAll('dialog[open]').forEach(d => d.close());
                })()
            """)
            await asyncio.sleep(1) # Wait for close animation
        except Exception as e:
            print(f"   ⚠️  Failed to send ESC key: {e}")
    
    async def get_element_section(self, element) -> str:
        """Determine which section the element belongs to."""
        try:
            section_title = await self.tab.evaluate("""
                (() => {
                    const el = arguments[0];
                    const section = el.closest('section[data-ui="section"]');
                    if (section) {
                        const h2 = section.querySelector('h2');
                        return h2 ? h2.innerText.trim() : 'Unknown Section';
                    }
                    return 'No Section';
                })()
            """, element)
            
            return section_title
            
        except Exception as e:
            return "Unknown Section"
    
    async def analyze_text_input(self, element) -> ElementInfo:
        """Analyze text input elements."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        # Determine interaction method
        input_type = attrs.get('type', 'text')
        if input_type == 'tel':
            interaction_method = "International phone input - click country flag if needed, then type number"
        elif input_type == 'email':
            interaction_method = "Email input - type email address"
        elif input_type == 'url':
            interaction_method = "URL input - type full URL"
        else:
            interaction_method = "Text input - type text directly"
        
        # Get validation rules
        validation_rules = {
            'maxlength': attrs.get('maxlength'),
            'minlength': attrs.get('minlength'),
            'pattern': attrs.get('pattern'),
            'autocomplete': attrs.get('autocomplete'),
        }
        
        return ElementInfo(
            element_type=f"Input ({input_type})",
            data_ui=data_ui,
            selector=f'input[data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method=interaction_method,
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules=validation_rules
        )
    
    async def analyze_textarea(self, element) -> ElementInfo:
        """Analyze textarea elements."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        validation_rules = {
            'maxlength': attrs.get('maxlength'),
            'minlength': attrs.get('minlength'),
            'rows': attrs.get('rows'),
            'cols': attrs.get('cols'),
        }
        
        return ElementInfo(
            element_type="Textarea",
            data_ui=data_ui,
            selector=f'textarea[data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method="Multi-line text input - type text, supports line breaks",
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules=validation_rules
        )
    
    async def analyze_radio_group(self, element) -> ElementInfo:
        """Analyze radio group fieldsets."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        # Get available options
        options = await self.get_radio_options(data_ui)
        
        return ElementInfo(
            element_type="Radio Group",
            data_ui=data_ui,
            selector=f'fieldset[role="radiogroup"][data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method="Click one option - use DOM element clicking, not JavaScript manipulation",
            available_options=options,
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules={}
        )
    
    async def analyze_select(self, element) -> ElementInfo:
        """Analyze custom select elements."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        # Get available options
        options = await self.get_select_options(data_ui)
        
        return ElementInfo(
            element_type="Custom Select",
            data_ui=data_ui,
            selector=f'div[data-input-type="select"][data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method="Click wrapper → wait for listbox dialog → click option",
            available_options=options,
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules={}
        )
    
    async def analyze_phone_input(self, element) -> ElementInfo:
        """Analyze phone input elements (Workable phone wrapper)."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        # Try to find the actual tel input inside the wrapper
        tel_input_attrs = {}
        try:
            tel_input = await self.tab.select(f'div[data-ui="{data_ui}"] input[type="tel"]')
            if tel_input:
                tel_input_attrs = tel_input.attrs or {}
        except:
            pass
        
        # Check for international phone input (intl-tel-input)
        has_country_selector = False
        try:
            country_selector = await self.tab.select(f'div[data-ui="{data_ui}"] .iti__selected-flag')
            has_country_selector = country_selector is not None
        except:
            pass
        
        interaction_method = "Phone input - "
        if has_country_selector:
            interaction_method += "click country flag if needed to select country, then type phone number"
        else:
            interaction_method += "type phone number directly"
        
        validation_rules = {
            'maxlength': tel_input_attrs.get('maxlength'),
            'pattern': tel_input_attrs.get('pattern'),
            'placeholder': tel_input_attrs.get('placeholder'),
            'has_country_selector': has_country_selector,
        }
        
        return ElementInfo(
            element_type="Phone Input",
            data_ui=data_ui,
            selector=f'div[data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method=interaction_method,
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules=validation_rules
        )
    
    async def analyze_file_input(self, element) -> ElementInfo:
        """Analyze file input elements."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        # Get accepted file types
        accept = attrs.get('accept', '')
        accepted_types = accept.split(',') if accept else []
        
        validation_rules = {
            'accept': accept,
            'multiple': attrs.get('multiple'),
        }
        
        return ElementInfo(
            element_type="File Upload",
            data_ui=data_ui,
            selector=f'input[type="file"][data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method="Use element.send_file(path) method - do not use drag/drop",
            available_options=accepted_types,
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules=validation_rules
        )
     
    async def analyze_checkbox_group(self, element) -> ElementInfo:
        """Analyze checkbox group elements (multi-select)."""
        attrs = element.attrs or {}
        data_ui = attrs.get('data-ui', '')
        label_text = await self.discover_question_text(element)
        is_required = await self.detect_required_field(element)
        section = await self.get_element_section(element)
        purpose = self.determine_field_purpose(label_text, data_ui)
        
        # Extract max selections from label (e.g., "pick your top 3")
        max_selections = self.extract_max_selections(label_text)
        
        # Get available checkbox options
        options = await self.get_checkbox_options(data_ui)
        
        return ElementInfo(
            element_type="Checkbox Group",
            data_ui=data_ui,
            selector=f'div[role="group"][data-ui="{data_ui}"]',
            label_text=label_text,
            is_required=is_required,
            interaction_method="Select multiple checkboxes by clicking - use DOM element clicking",
            available_options=options,
            purpose=purpose,
            attributes=attrs,
            section=section,
            validation_rules={},
            max_selections=max_selections
        )
    
    def extract_max_selections(self, label_text: str) -> int:
        """Extract the maximum number of selections from the label text."""
        # Look for patterns like "pick your top 3", "select 3", "choose your 3"
        match = re.search(r'(?:top|select|choose).*?(\d+)', label_text.lower())
        if match:
            return int(match.group(1))
        
        # Default to allowing multiple selections
        return 3  # Default assumption for "top 3" type questions
    
    async def get_checkbox_options(self, data_ui: str) -> List[str]:
        """Get available options for checkbox groups."""
        try:
            print(f"🔍 Extracting checkbox options for {data_ui}...")
            
            options_data = await self.tab.evaluate(f"""
                (() => {{
                    const group = document.querySelector('div[role="group"][data-ui="{data_ui}"]');
                    if (!group) return [];
                    
                    const options = [];
                    const checkboxes = group.querySelectorAll('input[type="checkbox"]');
                    
                    for (let i = 0; i < checkboxes.length; i++) {{
                        const checkbox = checkboxes[i];
                        const name = checkbox.name || '';
                        
                        // Find the associated label text
                        let labelText = '';
                        
                        // Method 1: Look for label element containing this checkbox
                        const label = checkbox.closest('label');
                        if (label) {{
                            // Get text content excluding nested elements
                            const spans = label.querySelectorAll('span');
                            for (const span of spans) {{
                                if (span.id && span.id.includes('checkbox_label')) {{
                                    labelText = span.innerText?.trim() || '';
                                    break;
                                }}
                            }}
                        }}
                        
                        // Clean up the text
                        labelText = labelText.replace(/SVGs not supported by this browser/gi, '');
                        labelText = labelText.replace(/\\s+/g, ' ').trim();
                        
                        if (labelText && labelText.length > 0) {{
                            options.push(`${{labelText}} (name: ${{name}})`);
                        }}
                    }}
                    
                    return options;
                }})()
            """)
            
            if options_data:
                for i, option in enumerate(options_data):
                    print(f"   📝 Option {i}: {option}")
                return options_data
            
            return []
            
        except Exception as e:
            print(f"⚠️  Error getting checkbox options: {e}")
            return []
    
    async def discover_all_elements(self) -> List[ElementInfo]:
        """Discover all actionable elements on the Workable form."""
        print("\n🔍 Starting comprehensive element discovery...")
        
        # Wait for form to be fully loaded
        await asyncio.sleep(3)
        
        # Check if we're on a Workable form
        form_exists = await self.tab.select('form[data-ui="application-form"]')
        if not form_exists:
            print("❌ No Workable application form found!")
            return []
        
        print("✅ Workable application form detected")
        
        # Discover different element types
        element_types = [
            # Text inputs (various types)
            ('input[type="text"][data-ui], input[type="email"][data-ui], input[type="tel"][data-ui], input[type="url"][data-ui], input:not([type])[data-ui]', self.analyze_text_input),
            
            # Phone inputs (special Workable phone wrapper)
            ('div[data-ui="phone"], div[data-input-type="phone"][data-ui]', self.analyze_phone_input),
            
            # Textareas
            ('textarea[data-ui]', self.analyze_textarea),
            
            # Radio groups
            ('fieldset[role="radiogroup"][data-ui]', self.analyze_radio_group),
            
            # Checkbox groups (multi-select)
            ('div[role="group"][data-ui]', self.analyze_checkbox_group),
            
            # Custom selects (with delay between each to prevent interference)
            ('div[data-input-type="select"][data-ui]', self.analyze_select),
            
            # File inputs
            ('input[type="file"][data-ui]', self.analyze_file_input),
        ]
        
        discovered_elements = []
        
        for selector, analyzer in element_types:
            try:
                elements = await self.tab.select_all(selector)
                print(f"📋 Found {len(elements)} elements matching: {selector}")
                
                for element in elements:
                    try:
                        element_info = await analyzer(element)
                        discovered_elements.append(element_info)
                        print(f"   ✅ Analyzed: {element_info.data_ui} ({element_info.element_type})")
                        
                        # Add delay between select elements to prevent interference
                        if 'select' in selector.lower():
                            print(f"   ⏳ Waiting 1 seconds before next dropdown analysis...")
                            await asyncio.sleep(1)
                            
                    except Exception as e:
                        print(f"   ⚠️  Error analyzing element: {e}")
                        
            except Exception as e:
                print(f"⚠️  Error finding elements with selector {selector}: {e}")
        
        self.discovered_elements = discovered_elements
        return discovered_elements
    
    def log_element_summary(self):
        """Log a condensed summary of all discovered elements."""
        if not self.discovered_elements:
            print("❌ No elements discovered to summarize")
            return

        print(f"\n📊 ELEMENT DISCOVERY SUMMARY (Total: {len(self.discovered_elements)})")
        print(f"=" * 120)
        print(f"{'Status':<4} {'ID (data-ui)':<20} {'Purpose':<25} {'Type':<15} {'Label'}")
        print(f"-" * 120)

        # Sort elements for consistent order
        sorted_elements = sorted(self.discovered_elements, key=lambda x: x.data_ui)

        for element in sorted_elements:
            required_icon = '✅' if element.is_required else '❌'
            label = " ".join(element.label_text.split())  # Normalize whitespace
            
            # Main info line with padding for alignment
            label_display = f"\"{label[:50]}{'...' if len(label) > 50 else ''}\""
            info_line = (
                f"  {required_icon:<2} "
                f"{element.data_ui:<20} "
                f"[{element.purpose:<23}] "
                f"[{element.element_type:<13}] "
                f"{label_display}"
            )
            print(info_line)

            # Optional second line for options if they exist
            if element.available_options:
                options_str = ", ".join(element.available_options)
                # Indent and wrap options text for readability
                prefix = "     -> Options: "
                if hasattr(element, 'max_selections') and element.max_selections > 1:
                    prefix = f"     -> Options (select max {element.max_selections}): "
                wrapper = textwrap.TextWrapper(initial_indent=prefix, width=120, subsequent_indent=' ' * len(prefix))
                print(wrapper.fill(f"[{options_str}]"))

        # Summary by type
        print(f"\n📈 ELEMENT TYPE BREAKDOWN")
        type_counts = {}
        for element in self.discovered_elements:
            element_type = element.element_type
            type_counts[element_type] = type_counts.get(element_type, 0) + 1
        
        type_summary = ", ".join([f"{k}: {v}" for k, v in sorted(type_counts.items())])
        print(f"   {type_summary}")
        
        # Required fields count
        required_count = sum(1 for e in self.discovered_elements if e.is_required)
        print(f"   Total Required Fields: {required_count} / {len(self.discovered_elements)}")

class LLMAnswerGenerator:
    """Uses Gemini to generate answers for complex questions."""
    def __init__(self, model_name: str, api_key: str):
        if not api_key:
            raise ValueError("Gemini API key is missing. Please provide it.")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)

    async def get_llm_answer(self, question: str, user_context: str, options: Optional[List[str]] = None, resume_file_content: Optional[bytes] = None, resume_filename: Optional[str] = None) -> str:
        """Generates an answer using the LLM."""
        prompt_parts: list[str | dict] = []
        
        initial_prompt = f"""
You are an expert data-matching AI. Your task is to answer job application questions with extreme accuracy, based *only* on the provided user profile and resume. You must act as if you are the user, representing their skills and experience truthfully and confidently.

**User Profile:**
{user_context}
"""
        prompt_parts.append(initial_prompt)

        if resume_file_content and resume_filename:
            import mimetypes
            mime_type, _ = mimetypes.guess_type(resume_filename)
            if mime_type and mime_type in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain"]:
                prompt_parts.append("\n**User Resume:**\n")
                prompt_parts.append({
                    "mime_type": mime_type,
                    "data": base64.b64encode(resume_file_content).decode()
                })

        # Add the critical rules after the context
        rules_prompt = """
**CRITICAL Answering Rules:**
1.  **PRIORITIZE THE RESUME:** The resume is the primary source of truth for skills, experience, and qualifications.
2.  **SKILLS ARE PARAMOUNT:** For any question about experience or proficiency (e.g., "Do you know Python?", "Experience with Git?"), if the skill or technology is mentioned ANYWHERE in the resume (especially under "Skills" or "Projects"), you MUST answer "YES" or the most positive equivalent option provided.
3.  **BE CONFIDENT, NOT CAUTIOUS:** Assume the user is proficient in any skill they've listed. Do not downplay their abilities.
4.  **EXACT MATCHING:** You must respond with the exact text of one of the provided options. Do not add any extra text, explanation, or punctuation.
"""
        prompt_parts.append(rules_prompt)

        if options and len(options) > 0:
            # This is a multiple-choice or dropdown question
            clean_options = [re.sub(r'\s*\(value:.*?\)\s*$', '', opt).strip() for opt in options]
            
            final_prompt = f"""
**Question to Answer:**
"{question}"

**Available Options:**
{chr(10).join([f"{i+1}. {opt}" for i, opt in enumerate(clean_options)])}

Based on the rules and provided data, what is the correct option?
"""
            prompt_parts.append(final_prompt)
        else:
            # This is a text input question
            final_prompt = f"""
**Question to Answer:**
"{question}"

Based on the rules and provided data, please provide a concise, professional, one-sentence answer.
"""
            prompt_parts.append(final_prompt)

        try:
            print(f"🧠 Asking Gemini: \"{question[:60]}{'...' if len(question) > 60 else ''}\"")
            if options and len(options) > 0:
                print(f"   📋 Available options ({len(options)}): {', '.join([opt[:30] + ('...' if len(opt) > 30 else '') for opt in [re.sub(r'\\s*\\(value:.*?\\)\\s*$', '', opt).strip() for opt in options]])}")
            response = await self.model.generate_content_async(prompt_parts)
            answer = response.text.strip()
            print(f"💡 Gemini's Answer: \"{answer[:60]}{'...' if len(answer) > 60 else ''}\"")
            return answer
        except Exception as e:
            print(f"❌ Error calling Gemini API: {e}")
            return f"[LLM Error: {e}]"

    async def get_checkbox_selections(self, question: str, options: List[str], max_selections: int, user_context: str, resume_file_content: Optional[bytes] = None, resume_filename: Optional[str] = None) -> List[str]:
        """Generate checkbox selections using the LLM."""
        options_text = "\n".join([f"- {opt}" for opt in options])
        
        prompt_parts: list[str | dict] = []
        
        prompt = f"""
You are a helpful assistant applying for a job on behalf of a user.
Here is the user's profile for context:
{user_context}
"""
        prompt_parts.append(prompt)

        if resume_file_content and resume_filename:
            import mimetypes
            mime_type, _ = mimetypes.guess_type(resume_filename)
            if mime_type and mime_type in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain"]:
                prompt_parts.append("\nHere is the user's resume for additional context. Use it to inform your selections.\n")
                prompt_parts.append({
                    "mime_type": mime_type,
                    "data": base64.b64encode(resume_file_content).decode()
                })

        final_prompt = f"""
Here is a question from the job application:
"{question}"

You need to select exactly {max_selections} options from the following list that best match the user's background and expertise:

{options_text}

Please respond with ONLY the exact text of the {max_selections} options you select, one per line.
For example:
Storage (S3, Blob, databases)
DevOps/CI-CD
Compute (EC2, VMs, Functions)

Do not add any explanation or additional text.
"""
        prompt_parts.append(final_prompt)
        
        try:
            print(f"🧠 Asking Gemini to select {max_selections} options from {len(options)} choices...")
            response = await self.model.generate_content_async(prompt_parts)
            answer = response.text.strip()
            
            # Parse the response into individual selections
            selections = [line.strip() for line in answer.split('\n') if line.strip()]
            print(f"💡 Gemini selected: {selections}")
            return selections[:max_selections]  # Ensure we don't exceed the limit
            
        except Exception as e:
            print(f"❌ Error calling Gemini API: {e}")
            return []

class FormFillingAgent:
    """Orchestrates filling the form using UserData and an LLM."""
    def __init__(self, tab, llm_generator: LLMAnswerGenerator, user_data: UserData, resume_file_content: Optional[bytes] = None, resume_filename: Optional[str] = None):
        self.tab = tab
        self.llm = llm_generator
        self.user_data = user_data
        self.user_context = user_data.to_context_string()
        self.resume_file_content = resume_file_content
        self.resume_filename = resume_filename

    def get_answer_from_user_data(self, purpose: str) -> Optional[str]:
        """Gets a pre-defined answer from the UserData object."""
        mapping = {
            'first_name': self.user_data.first_name,
            'last_name': self.user_data.last_name,
            'email': self.user_data.email,
            'phone': self.user_data.phone,
            'address': self.user_data.address,
            'linkedin': self.user_data.linkedin,
            'github': self.user_data.github,
            'portfolio': self.user_data.portfolio,
            'summary': self.user_data.summary,
            'cover_letter': self.user_data.cover_letter,
        }
        return mapping.get(purpose)

    async def fill_form(self, elements: List[ElementInfo]):
        """Iterates through elements and fills them."""
        print("\n🤖 Starting automatic form filling...")
        for element in sorted(elements, key=lambda x: x.data_ui):
            if element.purpose == 'resume' or 'file' in element.element_type.lower():
                print(f"⏭️  Skipping file upload field: {element.label_text}")
                continue

            answer = self.get_answer_from_user_data(element.purpose)
            
            # If we found a standard answer, but the field is a multiple choice,
            # let's double-check if the answer is one of the options.
            # This prevents using e.g. "5" for a "Yes/No" experience question.
            if answer and element.available_options:
                # Normalize options and the answer for comparison
                clean_options = [re.sub(r'\(value:.*\)', '', opt).strip().lower() for opt in element.available_options]
                # A loose check to see if the answer could be a valid choice
                if not get_close_matches(answer.lower(), clean_options, n=1, cutoff=0.6):
                    print(f"   ⚠️ Discarding standard answer ('{answer}') as it's not a close match for the available options. Will ask LLM.")
                    answer = None # Invalidate the answer, force LLM call

            if not answer:
                # If no pre-defined answer, use the LLM
                answer = await self.llm.get_llm_answer(
                    question=element.label_text,
                    user_context=self.user_context,
                    options=element.available_options,
                    resume_file_content=self.resume_file_content,
                    resume_filename=self.resume_filename
                )

            if answer:
                print(f"📝 Filling '{element.label_text}' with '{answer[:50]}...'")
                await self.fill_field(element, answer)
                await asyncio.sleep(1) # Small delay between fields
        
        # Final verification of all radio buttons and checkbox groups
        print("\n🔍 FINAL VERIFICATION - Checking all radio button and checkbox selections:")
        radio_elements = [e for e in elements if e.element_type == "Radio Group"]
        checkbox_elements = [e for e in elements if e.element_type == "Checkbox Group"]
        
        for element in radio_elements:
            try:
                selected_option = await self.tab.evaluate(f"""
                    (() => {{
                        const checkedRadio = document.querySelector('{element.selector} input[type="radio"]:checked');
                        if (checkedRadio) {{
                            const container = checkedRadio.closest('div[data-ui="option"]') || checkedRadio.closest('label');
                            if (container) {{
                                return container.innerText?.trim() || checkedRadio.value;
                            }}
                            return checkedRadio.value;
                        }}
                        return 'NOT SELECTED';
                    }})()
                """)
                status = "✅" if selected_option != "NOT SELECTED" else "❌"
                print(f"   {status} {element.data_ui}: {selected_option}")
            except Exception as e:
                print(f"   ❌ {element.data_ui}: Error checking - {e}")
        
        for element in checkbox_elements:
            try:
                selected_options = await self.tab.evaluate(f"""
                    (() => {{
                        const group = document.querySelector('div[data-ui="{element.data_ui}"]');
                        if (!group) return [];
                        
                        const selected = [];
                        const checkboxes = group.querySelectorAll('input[type="checkbox"]:checked');
                        
                        for (const checkbox of checkboxes) {{
                            const label = checkbox.closest('label');
                            if (label) {{
                                const spans = label.querySelectorAll('span');
                                for (const span of spans) {{
                                    if (span.id && span.id.includes('checkbox_label')) {{
                                        const text = span.innerText?.trim() || '';
                                        selected.push({{
                                            name: checkbox.name,
                                            text: text
                                        }});
                                        break;
                                    }}
                                }}
                            }}
                        }}
                        
                        return selected;
                    }})()
                """)
                
                if selected_options and len(selected_options) > 0:
                    status = "✅"
                    selections_text = f"{len(selected_options)} selected: " + ", ".join([opt['text'] for opt in selected_options])
                else:
                    status = "❌"
                    selections_text = "NOT SELECTED"
                
                print(f"   {status} {element.data_ui}: {selections_text}")
                
            except Exception as e:
                print(f"   ❌ {element.data_ui}: Error checking - {e}")
        
        print("✅ Form filling process complete.")

    async def fill_field(self, element: ElementInfo, answer: str):
        """Fills a single field based on its type."""
        try:
            if "Phone Input" in element.element_type:
                phone_input_element = await self.tab.select(f'{element.selector} input[type="tel"]')
                if phone_input_element:
                    await phone_input_element.send_keys(answer)

            elif "Input" in element.element_type or "Textarea" in element.element_type:
                input_field = await self.tab.select(element.selector)
                if input_field:
                    await input_field.send_keys(answer)

            elif "Radio Group" in element.element_type:
                # Detect if this is a button-style radio group (QA_ fields) or simple style (CA_ fields)
                is_button_style = await self.tab.evaluate(f"""
                    (() => {{
                        const selector = '{element.selector} div[data-ui="option"]';
                        return !!document.querySelector(selector);
                    }})()
                """)
                
                # Enhanced logging for radio group structure
                structure_info = await self.tab.evaluate(f"""
                    (() => {{
                        const fieldset = document.querySelector('{element.selector}');
                        if (!fieldset) return {{ error: "No fieldset found" }};
                        
                        const info = {{
                            dataUi: fieldset.getAttribute('data-ui'),
                            hasButtonOptions: !!fieldset.querySelector('div[data-ui="option"]'),
                            hasLabelOptions: !!fieldset.querySelector('label'),
                            totalInputs: fieldset.querySelectorAll('input[type="radio"]').length,
                            structure: 'unknown'
                        }};
                        
                        if (info.hasButtonOptions) {{
                            info.structure = 'button-style';
                            const options = fieldset.querySelectorAll('div[data-ui="option"]');
                            info.optionContainers = Array.from(options).map((opt, i) => ({{
                                index: i,
                                text: opt.innerText?.trim() || '',
                                hasRadio: !!opt.querySelector('input[type="radio"]'),
                                hasLabel: !!opt.querySelector('label'),
                                radioValue: opt.querySelector('input[type="radio"]')?.value || 'none'
                            }}));
                        }} else if (info.hasLabelOptions) {{
                            info.structure = 'simple-style';
                            const labels = fieldset.querySelectorAll('label');
                            info.optionContainers = Array.from(labels).map((label, i) => ({{
                                index: i,
                                text: label.innerText?.trim() || '',
                                hasRadio: !!label.querySelector('input[type="radio"]'),
                                radioValue: label.querySelector('input[type="radio"]')?.value || 'none'
                            }}));
                        }}
                        
                        return info;
                    }})()
                """)
                
                print(f"\n   📋 RADIO GROUP ANALYSIS: {element.data_ui}")
                print(f"   🔍 Structure Type: {structure_info.get('structure', 'unknown').upper()}")
                print(f"   📊 Total Radio Inputs: {structure_info.get('totalInputs', 0)}")
                print(f"   🎛️  Available Options:")
                
                for opt in structure_info.get('optionContainers', []):
                    radio_indicator = "🔘" if opt.get('hasRadio') else "❌"
                    label_indicator = "🏷️" if opt.get('hasLabel') else "❌"
                    print(f"      [{opt['index']}] {radio_indicator} '{opt['text']}' (value: {opt['radioValue']}) {label_indicator}")
                
                if is_button_style:
                    print(f"   ⚡ Using MULTI-STRATEGY approach for BUTTON-STYLE radio '{answer}'...")
                else:
                    print(f"   ⚡ Using JAVASCRIPT approach for SIMPLE-STYLE radio '{answer}'...")
                
                # Find the best text match for the answer from the available options
                option_texts = [re.sub(r'\(value:.*\)', '', opt).strip() for opt in element.available_options]
                answer_lower = answer.lower()
                options_lower_map = {opt.lower(): opt for opt in option_texts}
                best_match_list = get_close_matches(answer_lower, options_lower_map.keys(), n=1, cutoff=0.6)

                if not best_match_list:
                    print(f"   ❓ No close match found for answer '{answer}' in options. Skipping.")
                    return

                best_match_text = options_lower_map[best_match_list[0]]
                print(f"   🎯 Best match is '{best_match_text}'")
                
                if is_button_style:
                    # BUTTON-STYLE RADIO GROUPS (QA_ fields) - Use native clicking
                    try:
                        option_containers = await self.tab.select_all(f'{element.selector} div[data-ui="option"]')
                        
                        clicked = False
                        for i, container in enumerate(option_containers):
                            try:
                                # Get the text content of this option
                                container_text = await self.tab.evaluate(f"""
                                    (() => {{
                                        const containers = document.querySelectorAll('{element.selector} div[data-ui="option"]');
                                        if (containers[{i}]) {{
                                            return containers[{i}].innerText?.trim() || '';
                                        }}
                                        return '';
                                    }})()
                                """)
                                
                                # Check if this option matches our target
                                if container_text and best_match_text.lower() in container_text.lower():
                                    print(f"   🎯 Found matching button option: '{container_text.strip()}'")
                                    
                                    # Try multiple clicking strategies for this specific option
                                    strategies = [
                                        ("native_container", "Native click on container"),
                                        ("native_radio", "Native click on radio input"),
                                        ("native_label", "Native click on label"),
                                        ("js_container", "JavaScript click on container"),
                                        ("js_radio", "JavaScript click on radio input")
                                    ]
                                    
                                    for strategy_name, strategy_desc in strategies:
                                        try:
                                            print(f"   🧪 Trying: {strategy_desc}")
                                            
                                            if strategy_name == "native_container":
                                                # Scroll into view first and add more aggressive clicking
                                                await container.scroll_into_view()
                                                await asyncio.sleep(0.5)
                                                await container.mouse_click()
                                            elif strategy_name == "native_radio":
                                                radio_input = await self.tab.select(f'{element.selector} div[data-ui="option"]:nth-child({i+1}) input[type="radio"]')
                                                if radio_input:
                                                    # Scroll into view and add more aggressive clicking
                                                    await radio_input.scroll_into_view()
                                                    await asyncio.sleep(0.5)
                                                    await radio_input.mouse_click()
                                                    # Try double-click for stubborn radios
                                                    await asyncio.sleep(0.2)
                                                    await radio_input.mouse_click()
                                                else:
                                                    continue
                                            elif strategy_name == "native_label":
                                                label = await self.tab.select(f'{element.selector} div[data-ui="option"]:nth-child({i+1}) label')
                                                if label:
                                                    # Scroll into view first
                                                    await label.scroll_into_view()
                                                    await asyncio.sleep(0.5)
                                                    await label.mouse_click()
                                                else:
                                                    continue
                                            elif strategy_name == "js_container":
                                                await self.tab.evaluate(f"""
                                                    (() => {{
                                                        const containers = document.querySelectorAll('{element.selector} div[data-ui="option"]');
                                                        if (containers[{i}]) {{
                                                            containers[{i}].click();
                                                        }}
                                                    }})()
                                                """)
                                            elif strategy_name == "js_radio":
                                                await self.tab.evaluate(f"""
                                                    (() => {{
                                                        const radioInput = document.querySelector('{element.selector} div[data-ui="option"]:nth-child({i+1}) input[type="radio"]');
                                                        if (radioInput) {{
                                                            // Set checked state
                                                            radioInput.checked = true;
                                                            
                                                            // Trigger comprehensive events for Workable forms
                                                            radioInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                                            radioInput.dispatchEvent(new Event('click', {{ bubbles: true }}));
                                                            radioInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                                            
                                                            // Also try clicking the parent container to trigger UI updates
                                                            const container = radioInput.closest('div[data-ui="option"]');
                                                            if (container) {{
                                                                container.dispatchEvent(new Event('click', {{ bubbles: true }}));
                                                            }}
                                                            
                                                            // Force form validation/update
                                                            const form = radioInput.closest('form');
                                                            if (form) {{
                                                                form.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                                            }}
                                                        }}
                                                    }})()
                                                """)
                                            
                                            # Wait for form processing - longer wait for all strategies
                                            await asyncio.sleep(3)  # Longer wait for all strategies to ensure form updates
                                            
                                            # Simple verification for all buttons - just check if any radio is selected
                                            verification = await self.tab.evaluate(f"""
                                                (() => {{
                                                    const checkedRadio = document.querySelector('{element.selector} input[type="radio"]:checked');
                                                    return !!checkedRadio;
                                                }})()
                                            """)
                                            
                                            if verification:
                                                print(f"   ✅ SUCCESS with {strategy_desc}")
                                                print(f"   🎯 WINNING STRATEGY for {element.data_ui}: {strategy_name}")
                                                clicked = True
                                                break
                                            else:
                                                print(f"   ❌ {strategy_desc} failed verification")
                                                
                                        except Exception as e:
                                            print(f"   ❌ {strategy_desc} error: {e}")
                                            continue
                                    
                                    if clicked:
                                        break
                                    
                            except Exception as e:
                                print(f"   ⚠️ Error clicking button option {i}: {e}")
                                continue
                        
                        if not clicked:
                            print(f"   ❌ Button-style native clicking failed, trying JavaScript...")
                            # JavaScript fallback for button-style
                            clicked = await self.tab.evaluate(
                                f"""
                                (async () => {{
                                    const containers = document.querySelectorAll('{element.selector} div[data-ui="option"]');
                                    const targetText = `{best_match_text}`.toLowerCase();
                                    
                                    for (const container of containers) {{
                                        const containerText = (container.innerText || '').trim().toLowerCase();
                                        if (containerText.includes(targetText)) {{
                                            try {{
                                                container.click();
                                                await new Promise(r => setTimeout(r, 1000)); 
                                                return true;
                                            }} catch (e) {{
                                                console.error(`JS click failed:`, e);
                                                return false;
                                            }}
                                        }}
                                    }}
                                    return false;
                                }})()
                                """
                            )
                            if clicked:
                                print(f"   ✅ JavaScript fallback succeeded for button-style")
                            else:
                                # Final attempt: try clicking by radio input value directly
                                print(f"   🔄 Final attempt: clicking radio input by value...")
                                final_attempt = await self.tab.evaluate(f"""
                                    (() => {{
                                        const targetValue = '{best_match_text.lower()}' === 'yes' ? 'true' : 'false';
                                        const radioInput = document.querySelector('{element.selector} input[type="radio"][value="' + targetValue + '"]');
                                        if (radioInput) {{
                                            radioInput.checked = true;
                                            radioInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                            return true;
                                        }}
                                        return false;
                                    }})()
                                """)
                                if final_attempt:
                                    print(f"   ✅ Final attempt succeeded")
                                    clicked = True
                                    

                            
                    except Exception as e:
                        print(f"   ❌ Error with button-style radio clicking: {e}")
                        clicked = False
                        
                else:
                    # SIMPLE RADIO GROUPS (CA_ fields) - Use JavaScript (the original working method)
                    container_selector = f'{element.selector} div[data-ui="option"], {element.selector} label'

                    # First, just try to click the option
                    click_result = await self.tab.evaluate(
                        f"""
                        (async () => {{
                            const containers = document.querySelectorAll(`{container_selector}`);
                            const targetText = `{best_match_text}`.toLowerCase();
                            
                            for (const container of containers) {{
                                const containerText = (container.innerText || '').trim().toLowerCase();
                                // Find container whose text contains the best match
                                if (containerText.includes(targetText)) {{
                                    try {{
                                        container.click();
                                        console.log(`Clicked simple radio option: ${{containerText}}`);
                                        return true;
                                    }} catch (e) {{
                                        console.error(`JS click failed for '{best_match_text}':`, e);
                                        return false;
                                    }}
                                }}
                            }}
                            console.error(`No container found for text: '{best_match_text}'`);
                            return false; // No matching container found
                        }})()
                        """
                    )

                    if click_result:
                        # Give the form time to update, then verify separately
                        await asyncio.sleep(1)
                        
                        # Separate verification step with more time
                        verification = await self.tab.evaluate(f"""
                            (() => {{
                                const checkedRadio = document.querySelector('{element.selector} input[type="radio"]:checked');
                                if (checkedRadio) {{
                                    console.log('Simple radio verification: SUCCESS - found checked radio');
                                    return true;
                                }} else {{
                                    console.log('Simple radio verification: No checked radio found');
                                    return false;
                                }}
                            }})()
                        """)
                        
                        clicked = verification
                        if verification:
                            print(f"   🎯 SIMPLE RADIO SUCCESS: JavaScript click + verification worked for {element.data_ui}")
                        else:
                            print(f"   ⚠️ SIMPLE RADIO UNCERTAIN: Click succeeded but verification failed for {element.data_ui}")
                    else:
                        clicked = False
                        print(f"   ❌ SIMPLE RADIO FAILED: Could not click option for {element.data_ui}")

                if clicked:
                    print(f"   ✅ Successfully selected radio option for '{best_match_text}'")
                else:
                    print(f"   ⚠️ Radio option click uncertain for '{best_match_text}' (may still be selected)")

            elif "Custom Select" in element.element_type:
                # Perform a case-insensitive search for the best match
                option_texts = [re.sub(r'\(value:.*\)', '', opt).strip() for opt in element.available_options]
                answer_lower = answer.lower()
                options_lower_map = {opt.lower(): opt for opt in option_texts}
                best_match_lower_list = get_close_matches(answer_lower, options_lower_map.keys(), n=1, cutoff=0.3)

                if best_match_lower_list:
                    # Get the original-cased text for logging
                    match_text = options_lower_map[best_match_lower_list[0]]
                    print(f"   🎯 Targeting option: '{match_text}' for answer: '{answer}'")

                    # 1. Open the dropdown - use proven method from comprehensive test
                    select_wrapper = await self.tab.select(element.selector)
                    if select_wrapper:
                        await select_wrapper.scroll_into_view()
                        await asyncio.sleep(0.5)
                        
                        # Try clicking the input first (proven most reliable)
                        input_element = await self.tab.select(f'{element.selector} input[role="combobox"]')
                        if input_element:
                            print(f"   🖱️  Clicking dropdown input...")
                            await input_element.mouse_click()
                            await asyncio.sleep(1.5)
                        
                        # Check if dropdown opened
                        dropdown_opened = await self.tab.evaluate("""
                            (() => {
                                const openDialogs = document.querySelectorAll('dialog[open]').length;
                                const dialog = document.querySelector('dialog[open]');
                                let hasOptions = false;
                                if (dialog) {
                                    const listbox = dialog.querySelector('ul[role="listbox"]');
                                    if (listbox) {
                                        const options = listbox.querySelectorAll('li[role="option"]');
                                        hasOptions = options.length > 0;
                                    }
                                }
                                return openDialogs > 0 && hasOptions;
                            })()
                        """)
                        
                        if not dropdown_opened:
                            print(f"   🔄 Dropdown didn't open with input click, trying wrapper...")
                            # Try clicking the wrapper as fallback
                            await select_wrapper.mouse_click()
                            await asyncio.sleep(1.5)
                        
                        # 2. Find and click the option in the dialog/listbox with multiple strategies
                        clicked = False
                        
                        # Strategy 1: Look in open dialog
                        all_options = await self.tab.select_all('dialog[open] li[role="option"]')
                        for opt in all_options:
                            try:
                                opt_text = opt.text or ""
                                # Use multiple matching strategies
                                if (opt_text and 
                                    (match_text.lower() in opt_text.lower() or 
                                     opt_text.lower() in match_text.lower() or
                                     opt_text.strip().lower() == match_text.lower())):
                                    print(f"      🎯 Found matching select option: '{opt_text.strip()}'")
                                    await opt.mouse_click()
                                    clicked = True
                                    print(f"      ✅ Clicked select option successfully.")
                                    break
                            except Exception as e:
                                print(f"      ⚠️ Error clicking option: {e}")
                                continue
                        
                        # Strategy 2: Look in any visible listbox if dialog method failed
                        if not clicked:
                            print(f"   🔄 Trying alternative listbox selection...")
                            all_options = await self.tab.select_all('ul[role="listbox"] li, [role="listbox"] [role="option"]')
                            for opt in all_options:
                                try:
                                    opt_text = opt.text or ""
                                    if (opt_text and 
                                        (match_text.lower() in opt_text.lower() or 
                                         opt_text.lower() in match_text.lower() or
                                         opt_text.strip().lower() == match_text.lower())):
                                        print(f"      🎯 Found matching listbox option: '{opt_text.strip()}'")
                                        await opt.mouse_click()
                                        clicked = True
                                        print(f"      ✅ Clicked listbox option successfully.")
                                        break
                                except Exception as e:
                                    continue
                        
                        if not clicked:
                            print(f"   ❌ Could not find or click a select option for '{match_text}'")
                        else:
                            # Wait for selection to process
                            await asyncio.sleep(1)
                            
                            # Close dropdown with ESC to ensure clean state
                            print(f"   🔄 Closing dropdown with ESC...")
                            await self.tab.evaluate("""
                                (() => {
                                    const escEvent = new KeyboardEvent('keydown', {
                                        key: 'Escape',
                                        keyCode: 27,
                                        code: 'Escape',
                                        which: 27,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    document.dispatchEvent(escEvent);
                                    if (document.activeElement) {
                                        document.activeElement.dispatchEvent(escEvent);
                                    }
                                })()
                            """)
                            await asyncio.sleep(0.5)
                    else:
                        print(f"   ❌ Could not find select wrapper for {element.data_ui}")
                else:
                    print(f"   ❌ No matching option found for answer: '{answer}'") 

            elif "Checkbox Group" in element.element_type:
                # Handle multi-select checkbox groups
                print(f"   🔲 Processing checkbox group with max {element.max_selections} selections")
                
                # If this is a complex question, ask the LLM for multiple selections
                if element.purpose.startswith("complex_question_"):
                    # Ask LLM for multiple selections
                    multiple_answers = await self.llm.get_checkbox_selections(
                        question=element.label_text,
                        options=[opt for opt in element.available_options],
                        max_selections=element.max_selections,
                        user_context=self.user_context,
                        resume_file_content=self.resume_file_content,
                        resume_filename=self.resume_filename
                    )
                    
                    if multiple_answers:
                        selected_count = 0
                        for selection in multiple_answers:
                            success = await self.select_checkbox_option(element, selection)
                            if success:
                                selected_count += 1
                        
                        print(f"   ✅ Successfully selected {selected_count}/{len(multiple_answers)} checkbox options")
                    else:
                        print(f"   ❌ No checkbox selections generated")
                else:
                    print(f"   ⏭️  Skipping non-complex checkbox group: {element.data_ui}")

        except Exception as e:
            print(f"❌ Error filling field '{element.data_ui}': {e}")

    async def select_checkbox_option(self, element: ElementInfo, selection: str) -> bool:
        """Select a specific checkbox option."""
        try:
            # Find matching option from available options
            matching_option = None
            option_name = None
            
            for option_text in element.available_options:
                # Parse the option text to extract name (format: "Text (name: value)")
                if selection.lower() in option_text.lower():
                    matching_option = option_text
                    # Extract the name from the option text
                    match = re.search(r'\(name: ([^)]+)\)', option_text)
                    if match:
                        option_name = match.group(1)
                    break
            
            if not matching_option or not option_name:
                print(f"   ❌ No matching checkbox option found for: {selection}")
                return False
            
            print(f"   🎯 Attempting to select checkbox: {matching_option}")
            
            # Strategy 1: Click by checkbox name
            checkbox = await self.tab.select(f'div[data-ui="{element.data_ui}"] input[type="checkbox"][name="{option_name}"]')
            if checkbox:
                await checkbox.scroll_into_view()
                await asyncio.sleep(0.5)
                await checkbox.mouse_click()
                await asyncio.sleep(1)
                
                # Verify click worked
                is_checked = await self.tab.evaluate(f"""
                    (() => {{
                        const checkbox = document.querySelector('div[data-ui="{element.data_ui}"] input[type="checkbox"][name="{option_name}"]');
                        return checkbox ? checkbox.checked : false;
                    }})()
                """)
                
                if is_checked:
                    print(f"   ✅ Successfully selected checkbox: {selection}")
                    return True
            
            # Strategy 2: JavaScript direct checkbox manipulation
            result = await self.tab.evaluate(f"""
                (() => {{
                    const checkbox = document.querySelector('div[data-ui="{element.data_ui}"] input[type="checkbox"][name="{option_name}"]');
                    if (checkbox) {{
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        checkbox.dispatchEvent(new Event('click', {{ bubbles: true }}));
                        return true;
                    }}
                    return false;
                }})()
            """)
            
            if result:
                print(f"   ✅ Successfully selected checkbox via JavaScript: {selection}")
                return True
            
            print(f"   ❌ Failed to select checkbox: {selection}")
            return False
            
        except Exception as e:
            print(f"   ❌ Error selecting checkbox '{selection}': {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting FastAPI")
    uvicorn.run(app, host="0.0.0.0", port=8000)