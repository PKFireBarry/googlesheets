import asyncio
import os
import subprocess
import tempfile
import time
import uuid
import re
import base64
import json
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import textwrap
from difflib import get_close_matches
import shutil
import sys
import psutil
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from browser_use import Agent, Controller, ActionResult
from browser_use.browser import BrowserProfile, BrowserSession
from browser_use.llm.google.chat import ChatGoogle
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
import uvicorn
import aiofiles
import httpx
import google.generativeai as genai
from PIL import Image
import io
import nodriver as uc
from playwright.async_api import async_playwright

# Load environment variables
load_dotenv()

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
        """Converts user data to a string for context."""
        return f"""
User Profile:
- Name: {self.first_name} {self.last_name}
- Email: {self.email}
- Phone: {self.phone}
- Location: {self.address}
- LinkedIn: {self.linkedin}
- GitHub: {self.github}
- Portfolio: {self.portfolio}
- Summary: {self.summary}
- Cover Letter: {self.cover_letter}
"""

# --- Controller Setup for Browser Use ---
controller = Controller()

@controller.action('Upload resume file to a file input element')
async def upload_resume_file(index: int, browser_session: BrowserSession, file_path: str):
    """Upload resume file to the specified file input element by index."""
    try:
        print(f"📤 Attempting to upload resume to file input index {index}")
        
        file_upload_dom_el = await browser_session.find_file_upload_element_by_index(index)
        
        if file_upload_dom_el is None:
            print(f"❌ No file upload element found at index {index}")
            return ActionResult(error=f'No file upload element found at index {index}')

        file_upload_el = await browser_session.get_locate_element(file_upload_dom_el)

        if file_upload_el is None:
            print(f"❌ No file upload element found at index {index}")
            return ActionResult(error=f'No file upload element found at index {index}')

        await file_upload_el.set_input_files(file_path)
        msg = f'Successfully uploaded resume file "{file_path}" to index {index}'
        print(f"✅ {msg}")
        return ActionResult(extracted_content=msg)
        
    except Exception as e:
        error_msg = f'Failed to upload resume file to index {index}: {str(e)}'
        print(f"❌ {error_msg}")
        return ActionResult(error=error_msg)

@controller.action('Get user profile information for filling forms')
def get_user_profile():
    """Get user profile information for form filling."""
    # This will be dynamically populated during agent execution
    user_profile = """
USER PROFILE INFORMATION:
Access user data from agent context including:
- Personal information (name, email, phone)
- Professional links (LinkedIn, GitHub, Portfolio)
- Professional summary and experience
- Cover letter content
Use this information to fill form fields accurately.
"""
    return ActionResult(extracted_content=user_profile, include_in_memory=True)

@controller.action('Get job description and context for better form answers')  
def get_job_context():
    """Get job description context for tailored form responses."""
    # This will be dynamically populated during agent execution
    job_context = """
JOB CONTEXT INFORMATION:
Access job description from agent context to:
- Answer experience questions relevantly
- Highlight matching skills and qualifications  
- Tailor responses to job requirements
- Show enthusiasm for the specific role
- Use relevant keywords from job posting
"""
    return ActionResult(extracted_content=job_context, include_in_memory=True)

# --- Resume Upload Detection (kept from nodriver_apply.py) ---
async def detect_and_upload_resume(tab, temp_file_path: str):
    """Detect resume upload fields and upload the file using the proven methodology from nodriver script."""
    print("📄 Looking for resume upload field using comprehensive detection...")
    
    try:
        # Find ALL file inputs on the page
        all_file_inputs = await tab.select_all('input[type=file]', timeout=5)
        
        if not all_file_inputs:
            print("❌ No file inputs found on the page")
            return False
        
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
                await asyncio.sleep(2)
                print("✅ Resume uploaded successfully!")
                return True
            except Exception as upload_error:
                print(f"❌ Error uploading resume: {upload_error}")
                return False
        else:
            print("❌ Could not identify a suitable resume upload field")
            # Try fallback with first file input
            if all_file_inputs:
                print("🔄 Falling back to first file input...")
                try:
                    await all_file_inputs[0].send_file(temp_file_path)
                    await asyncio.sleep(2)
                    print("✅ Resume uploaded to first file input as fallback")
                    return True
                except Exception as fallback_error:
                    print(f"❌ Fallback upload also failed: {fallback_error}")
                    return False
            return False
            
    except Exception as e:
        print(f"❌ Error in resume upload detection: {e}")
        return False

# --- Cloudflare Verification (from nodriver_apply.py) ---
async def check_turnstile_with_llm(tab, llm_model):
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
        
        # Use the model to analyze the image
        response = await llm_model.generate_content_async(
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
        return {"turnstile_still_visible": True, "verification_complete": False, "confidence": "low", "reason": f"Error occurred: {e}"}

async def inject_stealth_scripts(tab):
    """Inject JavaScript to hide automation and enhance stealth for Cloudflare bypass."""
    try:
        stealth_script = """
        (() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Override plugins and languages
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5] // Fake plugin array
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // Override screen properties to look more realistic
            Object.defineProperty(screen, 'availHeight', {
                get: () => 1040
            });
            
            Object.defineProperty(screen, 'availWidth', {
                get: () => 1920
            });
            
            // Remove automation indicators
            delete window.chrome;
            window.chrome = {
                runtime: {}
            };
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            console.log('🕵️ Anti-detection scripts injected');
        })();
        """
        
        await tab.evaluate(stealth_script)
        print("✅ Anti-detection JavaScript injected successfully")
        
    except Exception as e:
        print(f"⚠️  Failed to inject anti-detection scripts: {e}")

async def solve_verification_visually(tab, llm_model):
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
            guessing_success = await try_coordinate_guessing_method(tab, turnstile_info, llm_model)
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
            
            // 3. Find ONLY Turnstile-related checkboxes (not regular form checkboxes)
            const turnstileCheckboxSelectors = [
                'input[type="checkbox"]', '[role="checkbox"]', 
                '[aria-checked]', '.checkbox', '.check-box'
            ];
            
            turnstileCheckboxSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((element, index) => {
                        const rect = element.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            // Only include checkboxes that are likely Turnstile-related
                            const isTurnstileCheckbox = (
                                // Check if it's inside a Turnstile container
                                element.closest('[id*="turnstile"], [class*="turnstile"], [data-turnstile], [data-cf-turnstile]') ||
                                // Check if it has Turnstile-related attributes
                                element.id.includes('turnstile') || 
                                element.className.includes('turnstile') ||
                                element.className.includes('cloudflare') ||
                                // Check if nearby text mentions verification
                                (element.parentElement && 
                                 element.parentElement.textContent.toLowerCase().includes('verify')) ||
                                (element.parentElement && 
                                 element.parentElement.textContent.toLowerCase().includes('human'))
                            );
                            
                            if (isTurnstileCheckbox) {
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
                                    outerHTML: element.outerHTML.substring(0, 300),
                                    isTurnstileRelated: true
                                });
                            }
                        }
                    });
                } catch (e) {
                    console.log('Error with Turnstile checkbox selector:', selector, e);
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
        print(f"   - Found {len(turnstile_info['checkboxes'])} Turnstile-related checkboxes")
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
            
            // Highlight ONLY Turnstile checkboxes (bright green)
            results.checkboxes.forEach((checkbox, index) => {{
                const label = `TURNSTILE CHECKBOX ${{index + 1}}${{checkbox.checked ? ' ✓' : ''}}`;
                createHighlight(checkbox.x, checkbox.y, checkbox.width, checkbox.height, 
                              'lime', label);
                console.log('Highlighted Turnstile checkbox:', label, checkbox);
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
            print("\n☑️  TURNSTILE CHECKBOXES FOUND:")
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
        
        # Priority 2: Unchecked Turnstile checkboxes
        elif turnstile_info['checkboxes']:
            unchecked_turnstile_boxes = [cb for cb in turnstile_info['checkboxes'] if not cb['checked'] and cb.get('isTurnstileRelated')]
            if unchecked_turnstile_boxes:
                best_target = {
                    'type': 'turnstile_checkbox',
                    'element': unchecked_turnstile_boxes[0],
                    'click_x': unchecked_turnstile_boxes[0]['x'] + unchecked_turnstile_boxes[0]['width'] // 2,
                    'click_y': unchecked_turnstile_boxes[0]['y'] + unchecked_turnstile_boxes[0]['height'] // 2
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

# --- Main Hybrid Processing Function ---
async def process_hybrid_browseruse_apply(task_id: str, job_url: str, user_data: UserData, resume_file: UploadFile | None, file_url: str | None, job_description: str = ""):
    """The main hybrid background task: nodriver start -> browser-use form fill -> nodriver resume/cloudflare/submit."""
    tasks[task_id] = {"status": "starting", "message": "Starting hybrid nodriver + browser-use auto-apply process."}
    
    # Storage for session objects
    nodriver_browser = None
    nodriver_tab = None
    browseruse_session = None
    playwright_instance = None
    temp_file_path = None
    temp_dir = None
    debug_port = 9237  # Define debug port at function scope for cleanup access
    
    try:
        # --- Get API Key from Environment ---
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables. Please add it to your .env file.")
        
        print("✅ Loaded API key from environment")
        
        # --- PHASE 1: START NODRIVER SESSION ---
        tasks[task_id].update({"status": "processing", "message": "Starting nodriver browser session..."})
        
        # Kill any existing browser instances first
        kill_existing_brave_instances()
        
        # Setup profile paths (from nodriver_apply.py)
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
        
        # Using debug port defined at function scope
        
        print("🚀 PHASE 1: Starting nodriver with Brave browser...")
        print(f"   Using native executable: {brave_executable_path}")
        print(f"   Using main profile: {main_profile_dir}")
        print(f"   Using debugging port: {debug_port}")
        
        # ENHANCED browser arguments for MAXIMUM Cloudflare bypass compatibility
        browser_args = [
            f'--remote-debugging-port={debug_port}',
            '--window-size=1920,1080',
            '--start-maximized',          # ENSURE WINDOW IS VISIBLE
            '--no-first-run',
            '--no-default-browser-check',
            
            # === CORE ANTI-DETECTION ARGUMENTS ===
            '--disable-blink-features=AutomationControlled',  # Hide automation (CRITICAL)
            '--disable-features=SameSiteByDefaultCookies',    # Allow third-party cookies for Turnstile
            '--disable-web-security',  # Disable web security for iframe access
            '--no-sandbox',  # Sometimes helps with detection
        ]


        # Use NATIVE Brave browser with main profile for Cloudflare compatibility
        print("🖥️  Starting browser in VISIBLE mode (headless=False)...")
        nodriver_browser = await uc.start(
            headless=False,               # EXPLICITLY NON-HEADLESS
            browser_executable_path=brave_executable_path,
            user_data_dir=main_profile_dir,
            browser_args=browser_args,
        )
        
        # Verify browser is running visibly
        print(f"✅ Browser started successfully!")
        print(f"🖥️  Browser should be VISIBLE on your screen")
        print(f"🔍 Browser PID: {nodriver_browser.process.pid if hasattr(nodriver_browser, 'process') and nodriver_browser.process else 'Unknown'}")
        
        # Extract the actual debug port that nodriver assigned
        actual_debug_port = None
        
        try:
            # Check if nodriver has a connection with port info
            if hasattr(nodriver_browser, 'connection') and hasattr(nodriver_browser.connection, 'target'):
                target = nodriver_browser.connection.target
                if hasattr(target, 'port'):
                    actual_debug_port = target.port
                    print(f"✅ Got debug port from target: {actual_debug_port}")
                elif hasattr(target, 'websocket_debugger_url'):
                    ws_url = target.websocket_debugger_url
                    print(f"🔍 Target WebSocket URL: {ws_url}")
                    port_match = re.search(r':(\d+)/', ws_url)
                    if port_match:
                        actual_debug_port = int(port_match.group(1))
                        print(f"✅ Extracted debug port from target WebSocket URL: {actual_debug_port}")
            
            # If we still don't have the port, try to get it from tabs
            if not actual_debug_port and hasattr(nodriver_browser, 'tabs') and len(nodriver_browser.tabs) > 0:
                first_tab = nodriver_browser.tabs[0]
                if hasattr(first_tab, 'connection') and hasattr(first_tab.connection, 'websocket_url'):
                    ws_url = first_tab.connection.websocket_url
                    print(f"🔍 Tab WebSocket URL: {ws_url}")
                    port_match = re.search(r':(\d+)/', ws_url)
                    if port_match:
                        actual_debug_port = int(port_match.group(1))
                        print(f"✅ Extracted debug port from tab WebSocket URL: {actual_debug_port}")
                        
        except Exception as e:
            print(f"⚠️  Error getting debug port: {e}")
        
        # Final fallback - try to read from process arguments
        if not actual_debug_port:
            try:
                # Get the browser process
                if hasattr(nodriver_browser, 'process') and nodriver_browser.process:
                    proc = psutil.Process(nodriver_browser.process.pid)
                    cmdline = proc.cmdline()
                    print(f"🔍 Process command line: {' '.join(cmdline)}")
                    
                    # Look for ALL occurrences of --remote-debugging-port and use the LAST one
                    # because nodriver adds its own after ours
                    debug_ports = []
                    for arg in cmdline:
                        if arg.startswith('--remote-debugging-port='):
                            port = int(arg.split('=')[1])
                            debug_ports.append(port)
                            print(f"🔍 Found debug port in args: {port}")
                    
                    if debug_ports:
                        actual_debug_port = debug_ports[-1]  # Use the LAST one (nodriver's)
                        print(f"✅ Using LAST debug port from process args: {actual_debug_port}")
            except Exception as e:
                print(f"⚠️  Could not read process args: {e}")
                
        # Additional fallback - check if browser connection has websocket info
        if not actual_debug_port:
            try:
                if hasattr(nodriver_browser, 'connection') and hasattr(nodriver_browser.connection, 'websocket_url'):
                    ws_url = nodriver_browser.connection.websocket_url
                    print(f"🔍 Browser WebSocket URL: {ws_url}")
                    port_match = re.search(r':(\d+)/', ws_url)
                    if port_match:
                        actual_debug_port = int(port_match.group(1))
                        print(f"✅ Extracted debug port from browser WebSocket URL: {actual_debug_port}")
            except Exception as e:
                print(f"⚠️  Could not read browser websocket URL: {e}")
        
        # Use the actual port if found, otherwise fall back to our specified port
        if actual_debug_port:
            debug_port = actual_debug_port
            print(f"✅ Using actual nodriver debug port: {debug_port}")
        else:
            print(f"⚠️  Could not detect actual debug port, using specified: {debug_port}")
        
        print(f"✅ Final debug port for browser-use connection: {debug_port}")
        
        # Debug info
        print(f"🔍 Browser type: {type(nodriver_browser)}")
        print(f"🔍 Available browser attributes: {[attr for attr in dir(nodriver_browser) if not attr.startswith('_')][:10]}...")  # Show first 10 attributes
        
        # Navigate to target URL
        print("📍 Navigating to target URL...")
        nodriver_tab = await nodriver_browser.get(job_url)
        print(f"✅ Navigated to: {job_url}")
        
        # Wait for page to fully load  
        print("⏳ Waiting for page to fully load...")
        print("📺 CHECK: You should now see the Brave browser window open on your screen!")
        await nodriver_tab.sleep(5)
        
        # Wait for any dynamic content to load
        try:
            await nodriver_tab.wait_for('Page.loadEventFired', timeout=3)
            print("✅ Page load event detected")
        except:
            print("⚠️  Page load event timeout, continuing...")
        
        await nodriver_tab.sleep(2)
        
        # Inject additional anti-detection JavaScript for maximum stealth
        print("🕵️  Injecting anti-detection JavaScript...")
        await inject_stealth_scripts(nodriver_tab)
        
        # Handle cookie banner if present
        await handle_cookie_banner(nodriver_tab)
        
        # Find and click apply button using nodriver
        print("🔍 Looking for apply button...")
        apply_keywords = [
            "apply now", "apply for this job", "apply to this job", "apply",
            "submit application", "apply for position"
        ]
        
        button_found = False
        for keyword in apply_keywords:
            try:
                print(f"Searching for button with text: '{keyword}'")
                apply_button = await nodriver_tab.find(keyword, best_match=True, timeout=3)
                if apply_button:
                    print(f"Found apply button with text: '{keyword}'")
                    await apply_button.mouse_move()
                    await nodriver_tab.sleep(0.5)
                    await apply_button.click()
                    await nodriver_tab.sleep(2)
                    print("Apply button clicked successfully!")
                    button_found = True
                    break
            except Exception as e:
                print(f"Could not find button with text '{keyword}': {e}")
                continue
        
        if not button_found:
            raise Exception("Could not find any apply button on the page.")
        
        # --- PHASE 1.5: IMMEDIATE RESUME UPLOAD ---
        tasks[task_id].update({"status": "processing", "message": "Uploading resume immediately after apply button..."})
        
        print("📄 PHASE 1.5: Uploading resume immediately after apply button...")
        
        # Handle Resume Upload immediately after apply button (before form filling)
        if resume_file or file_url:
            original_filename = ""
            content = b""

            if resume_file:
                original_filename = resume_file.filename
                content = await resume_file.read()
            elif file_url:
                if file_url.startswith('data:'):
                    try:
                        import re as regex_module  # Use a different name to avoid conflicts
                        match = regex_module.match(r'data:(?P<mime>[^;]+);filename=(?P<filename>[^;]+);base64,(?P<data>.+)', file_url)
                        if match:
                            original_filename = match.group('filename')
                            content = base64.b64decode(match.group('data'))
                        else:
                            print("❌ Data URL format not recognized, skipping file upload")
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
                # Get file extension
                suffix = os.path.splitext(original_filename)[-1]

                # Sanitize names for the filename
                first_name = re.sub(r'[^a-zA-Z0-9]', '', user_data.first_name)
                last_name = re.sub(r'[^a-zA-Z0-9]', '', user_data.last_name)
                
                # Create the new filename
                new_resume_filename = f"{first_name}-{last_name}-Resume{suffix}"

                # Create a temporary directory to hold the renamed file
                temp_dir = tempfile.mkdtemp()
                temp_file_path = os.path.join(temp_dir, new_resume_filename)

                # Write the resume content to the new file path
                async with aiofiles.open(temp_file_path, 'wb') as tmp:
                    await tmp.write(content)

                print(f"📄 Resume prepared: '{new_resume_filename}' at {temp_file_path}")
                
                # Upload resume using nodriver proven method
                upload_success = await detect_and_upload_resume(nodriver_tab, temp_file_path)
                if upload_success:
                    print("✅ Resume upload completed successfully")
                    # Wait a moment for the page to process the upload
                    await nodriver_tab.sleep(3)
                else:
                    print("⚠️  Resume upload may have failed - continuing with form filling")
        
        # --- PHASE 2: BROWSER-USE FORM FILLING ---
        tasks[task_id].update({"status": "processing", "message": "Connecting browser-use for form filling..."})
        
        print("🤖 PHASE 2: Setting up browser-use connection...")
        
        # Configure Gemini for browser-use
        genai.configure(api_key=api_key)
        
        # Create ChatGoogle instance for browser-use
        llm = ChatGoogle(
            model='gemini-2.5-flash-preview-05-20',
            api_key=api_key,
            temperature=0.1,
        )
        
        # Connect browser-use to the existing nodriver session via CDP
        print("🔗 Connecting browser-use to existing nodriver session...")
        
        # Create a browser session that connects to existing CDP with STEALTH MODE
        print("🔗 Browser-use connecting to existing VISIBLE browser session...")
        browseruse_session = BrowserSession(
            cdp_url=f"http://127.0.0.1:{debug_port}",  # Connect to existing session via CDP
            browser_profile=BrowserProfile(
                headless=False,           # EXPLICITLY NON-HEADLESS
                keep_alive=True,          # Don't close the browser when done
                stealth=True,             # ENABLE STEALTH MODE for maximum Cloudflare bypass
            )
        )
        print("✅ Browser-use session connected to visible browser")
        
        # Create comprehensive task description for browser-use
        task_description = f"""
You are a professional job application assistant. Fill out this job application form strategically and accurately.

CURRENT SITUATION:
- You are on a job application form page
- The "Apply" button has been clicked and resume uploaded
- DO NOT submit the form when done - only fill fields

PRIORITY FORM FILLING STRATEGY:
1. FIRST: Use get_user_profile action to get user information
2. SECOND: Use get_job_context action to get job description for tailored responses
3. ANALYZE each form field before filling:
   - REQUIRED fields (marked with "*" in label/question) = HIGHEST PRIORITY
   - Cover letter fields = ALWAYS fill even if optional
   - Pre-filled fields = SKIP completely (don't modify existing values)
   - Optional fields without "*" = Fill if time permits

FIELD IDENTIFICATION RULES:
- Look for "*" symbol in field labels, questions, or nearby text
- Required fields often have "required" in aria-label or validation text
- Pre-filled fields already contain text/values - leave these unchanged
- Cover letter fields (textarea with "cover letter", "motivation", "why") = always fill

FORM FILLING PRIORITIES:
1. REQUIRED fields with "*" symbol (must complete all)
2. Cover letter/motivation fields (always fill even if optional)
3. Contact information fields (name, email, phone)
4. Optional fields only if time allows

USER PROFILE SUMMARY:
- Name: {user_data.first_name} {user_data.last_name}
- Email: {user_data.email}
- Phone: {user_data.phone}
- LinkedIn: {user_data.linkedin or 'Not provided'}
- GitHub: {user_data.github or 'Not provided'}
- Portfolio: {user_data.portfolio or 'Not provided'}
- Summary: {user_data.summary}
- Cover Letter: {user_data.cover_letter}

JOB DESCRIPTION CONTEXT:
{job_description if job_description.strip() else 'No specific job description provided - use general professional responses.'}

CRITICAL RULES:
- NEVER modify pre-filled fields (fields that already have values)
- ALWAYS fill cover letter fields even if not required
- Focus on required fields marked with "*" first
- Skip file upload fields (already handled)
- Answer experience questions positively and specifically
- Use job context to tailor responses when available
- DO NOT click submit buttons
"""
        
        # Create the agent with optimized settings
        agent = Agent(
            task=task_description,
            llm=llm,
            controller=controller,
            browser_session=browseruse_session,
            use_vision=True,
            max_failures=5,
            max_actions_per_step=15,  # Reduced for faster execution
        )
        
        print(f"🤖 Agent created with enhanced task description")
        print(f"📋 User data: {user_data.first_name} {user_data.last_name}, {user_data.email}")
        print(f"📄 Job description: {len(job_description)} characters")
        print(f"💼 Cover letter available: {'Yes' if user_data.cover_letter.strip() else 'No'}")
        print(f"📝 Summary available: {'Yes' if user_data.summary.strip() else 'No'}")
        
        print("\n🎯 FORM FILLING STRATEGY:")
        print("   1. Focus on REQUIRED fields (marked with '*') first")
        print("   2. Always fill cover letter fields even if optional")
        print("   3. Skip pre-filled fields completely")
        print("   4. Use job context for tailored responses")
        
        # Inject user data and job description into the agent's context
        agent.context = {
            'user_data': user_data,
            'job_description': job_description
        }
        
        print("🤖 Starting browser-use form filling...")
        tasks[task_id].update({"status": "processing", "message": "Browser-use agent is filling the form..."})
        
        # Run the agent for form filling with timeout handling
        try:
            print("🔄 Running browser-use agent for form filling...")
            history = await asyncio.wait_for(agent.run(max_steps=15), timeout=180)  # 3 minute timeout, 15 steps
            print("✅ Browser-use form filling completed!")
            print(f"📊 Agent completed {len(history)} steps")
            
            # Show some details about what was done
            for i, step in enumerate(history[-3:], 1):  # Show last 3 steps
                print(f"   Step {len(history)-3+i}: {step.get('action', {}).get('description', 'Unknown action')[:80]}...")
                
        except asyncio.TimeoutError:
            print("⚠️  Browser-use agent timed out after 3 minutes")
            print("🔄 Continuing with manual form submission...")
        except Exception as e:
            print(f"⚠️  Browser-use agent encountered an error: {e}")
            print("🔄 Continuing with manual form submission...")
            import traceback
            traceback.print_exc()
        
        # Add a small delay to let any final actions complete
        await asyncio.sleep(2)
        
        # --- PHASE 3: NODRIVER SUBMIT & CLOUDFLARE ---
        tasks[task_id].update({"status": "processing", "message": "Submitting form and handling verification..."})
        
        print("🚀 PHASE 3: Submitting form with nodriver...")
        
        # Try to find and click submit button
        submit_keywords = [
            "submit application", "submit", "send application", 
            "apply", "continue", "next"
        ]
        
        submitted = False
        for keyword in submit_keywords:
            try:
                print(f"Looking for submit button with text: '{keyword}'")
                submit_button = await nodriver_tab.find(keyword, best_match=True, timeout=2)
                if submit_button:
                    print(f"Found submit button: '{keyword}'")
                    await submit_button.mouse_move()
                    await nodriver_tab.sleep(0.5)
                    await submit_button.click()
                    await nodriver_tab.sleep(3)
                    print("Submit button clicked!")
                    submitted = True
                    break
            except Exception as e:
                print(f"Could not find submit button with text '{keyword}': {e}")
        
        if not submitted:
            # Try CSS selectors for submit buttons
            submit_selectors = [
                "button[type='submit']", "input[type='submit']", 
                ".submit-btn", ".btn-submit", "button[class*='submit']"
            ]
            
            for selector in submit_selectors:
                try:
                    print(f"Trying submit selector: {selector}")
                    submit_element = await nodriver_tab.select(selector, timeout=2)
                    if submit_element:
                        print(f"Found submit element with selector: {selector}")
                        await submit_element.mouse_move()
                        await nodriver_tab.sleep(0.5)
                        await submit_element.click()
                        await nodriver_tab.sleep(3)
                        print("Submit element clicked!")
                        submitted = True
                        break
                except Exception as e:
                    print(f"Submit selector '{selector}' failed: {e}")
        
        # Handle Cloudflare verification using nodriver + LLM
        if submitted:
            tasks[task_id].update({"status": "processing", "message": "Handling Cloudflare verification..."})
            await nodriver_tab.sleep(3)
            
            print("🔍 Attempting Cloudflare verification with nodriver...")
            # Create LLM instance for verification
            llm_model = genai.GenerativeModel('gemini-2.0-flash-exp')
            
            cf_solved = await solve_verification_visually(nodriver_tab, llm_model)
            if cf_solved:
                print("✅ Cloudflare verification solved!")
            else:
                print("⚠️  Cloudflare verification could not be solved")
        
        # --- PHASE 4: FINAL VERIFICATION ---
        print("🔍 PHASE 4: Final verification...")
        
        await nodriver_tab.sleep(3)
        
        # Check for success indicators
        success_check = await nodriver_tab.evaluate("""
        (function() {
            const bodyText = document.body.textContent.toLowerCase();
            const currentUrl = window.location.href.toLowerCase();
            
            // Look for success indicators
            const successIndicators = [
                'success', 'submitted', 'thank you', 'application received',
                'congratulations', 'we have received', 'application complete'
            ];
            
            const hasSuccessText = successIndicators.some(indicator => 
                bodyText.includes(indicator)
            );
            
            const urlSuccessIndicators = [
                'success', 'complete', 'submitted', 'thank', 'confirmation'
            ];
            
            const hasSuccessUrl = urlSuccessIndicators.some(indicator => 
                currentUrl.includes(indicator)
            );
            
            return {
                success: hasSuccessText || hasSuccessUrl,
                currentUrl: currentUrl,
                pageTitle: document.title
            };
        })();
        """)
        
        if success_check['success']:
            print("✅ Application appears to have been submitted successfully!")
            tasks[task_id].update({"status": "completed", "message": "Application submitted successfully!"})
        else:
            print("⚠️  Application status unclear - please verify manually")
            tasks[task_id].update({"status": "completed", "message": "Application process completed - please verify submission manually"})
        
        # Keep browser open for viewing results
        print("🔄 Keeping browser open for 30 seconds to view results...")
        await asyncio.sleep(30)
        
    except Exception as e:
        error_message = f"An error occurred: {e}"
        print(error_message)
        import traceback
        traceback.print_exc()
        tasks[task_id].update({"status": "failed", "message": error_message})
        
    finally:
        # Cleanup
        if browseruse_session:
            try:
                await browseruse_session.close()
                print("✅ Browser-use session closed")
            except Exception as e:
                print(f"⚠️  Error closing browser-use session: {e}")
        
        if nodriver_browser:
            print("🛑 Closing browser...")
            try:
                # Try multiple methods to ensure browser closes
                await nodriver_browser.stop()
                print("✅ Browser.stop() called")
                
                # Give it a moment to close
                await asyncio.sleep(2)
                
                # Force kill any remaining processes as backup
                try:
                    subprocess.run(['pkill', '-f', 'brave-browser'], capture_output=True)
                    subprocess.run(['pkill', '-f', f'remote-debugging-port={debug_port}'], capture_output=True)
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
            shutil.rmtree(temp_dir)
            print(f"🧹 Cleaned up temporary directory: {temp_dir}")
        elif temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            print(f"🧹 Cleaned up temporary file: {temp_file_path}")

async def handle_cookie_banner(tab):
    """Handle cookie consent banners."""
    print("Checking for cookie consent banners...")
    accept_keywords = ["accept all", "allow all", "i agree", "accept"]
    
    for keyword in accept_keywords:
        try:
            cookie_button = await tab.find(keyword, best_match=True, timeout=2)
            if cookie_button:
                print(f"Found cookie button with text: '{keyword}'")
                await cookie_button.mouse_move()
                await asyncio.sleep(0.2)
                await cookie_button.click()
                await tab.sleep(2)
                print("Cookie consent handled")
                return True
        except Exception as e:
            continue
    
    print("No cookie banner found")
    return False

async def parse_prompt_to_user_data(prompt: str) -> tuple[UserData, str]:
    """Uses the LLM to parse the unstructured prompt into a structured UserData object and extract job description."""
    print("Parsing prompt to extract structured user data and job description...")
    
    # First, extract job description from the prompt using pattern matching
    job_description = extract_job_description_from_prompt(prompt)
    
    parsing_prompt = (
        "You are a data extraction expert. Parse the following text from a job application prompt "
        "and extract the user's personal information. Return ONLY a valid JSON object with the following keys: "
        "'first_name', 'last_name', 'email', 'phone', 'linkedin', 'github', 'portfolio', 'address', "
        "'summary', 'cover_letter'. "
        "If a value is not found, omit the key or set it to null. "
        "For summary and cover_letter, extract or infer from the context provided.\n\n"
        f"Text to parse:\n---\n{prompt}\n---\n\n"
        "JSON object:"
    )
    
    try:
        # Get API key from environment
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("Warning: GOOGLE_API_KEY not found, using default user data")
            return UserData(first_name="N/A", last_name="N/A", email="N/A", phone="N/A"), job_description
        
        # Configure and use Google Generative AI directly
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        response = model.generate_content(parsing_prompt)
        # Clean the response to ensure it's valid JSON
        json_string = response.text.strip().replace("```json", "").replace("```", "")
        user_data_model = UserData.model_validate_json(json_string)
        print("Successfully parsed user data from prompt.")
        print(f"📄 Extracted job description: {len(job_description)} characters")
        return user_data_model, job_description
    except Exception as e:
        print(f"Failed to parse user data from prompt: {e}. Proceeding with basic fallback data.")
        # Return a reasonable fallback model if parsing fails
        return UserData(
            first_name="John", 
            last_name="Doe", 
            email="john.doe@example.com", 
            phone="123-456-7890",
            linkedin="https://linkedin.com/in/johndoe",
            github="https://github.com/johndoe",
            portfolio="https://johndoe.dev"
        ), job_description

def extract_job_description_from_prompt(prompt: str) -> str:
    """Extract job description from the prompt using pattern matching."""
    try:
        # Look for common job description patterns in the prompt
        patterns = [
            r"Job Descripton:\s*(.*?)(?=\n[A-Z][a-z]+\s*[A-Z][a-z]+:|\n[A-Z][a-z]+:|\n\n|\nResume|\nPersonal|$)",  # Handle typo "Descripton"
            r"Job Description:\s*(.*?)(?=\n[A-Z][a-z]+\s*[A-Z][a-z]+:|\n[A-Z][a-z]+:|\n\n|\nResume|\nPersonal|$)",
            r"Description:\s*(.*?)(?=\n[A-Z][a-z]+\s*[A-Z][a-z]+:|\n[A-Z][a-z]+:|\n\n|\nResume|\nPersonal|$)",
            r"Requirements:\s*(.*?)(?=\n[A-Z][a-z]+\s*[A-Z][a-z]+:|\n[A-Z][a-z]+:|\n\n|\nResume|\nPersonal|$)",
            r"Job Title:.*?\nCompany:.*?\nJob Descripton:\s*(.*?)(?=\n[A-Z][a-z]+\s*[A-Z][a-z]+:|\n[A-Z][a-z]+:|\n\n|\nResume|\nPersonal|$)",  # Handle your specific format
        ]
        
        for pattern in patterns:
            match = re.search(pattern, prompt, re.DOTALL | re.IGNORECASE)
            if match:
                job_desc = match.group(1).strip()
                if len(job_desc) > 50:  # Only return if substantial content
                    print(f"✅ Found job description using pattern: {pattern[:50]}...")
                    print(f"📄 Job description length: {len(job_desc)} characters")
                    print(f"📄 Job description preview: {job_desc[:200]}...")
                    return job_desc
        
        # Fallback: Look for text after "Job Descripton:" or similar patterns
        lines = prompt.split('\n')
        job_desc_started = False
        potential_job_desc = []
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            line_lower = line_stripped.lower()
            
            # Check if this line starts the job description
            if any(keyword in line_lower for keyword in ['job descripton:', 'job description:', 'description:']):
                job_desc_started = True
                # If the description is on the same line after the colon
                colon_pos = line.find(':')
                if colon_pos != -1 and len(line) > colon_pos + 1:
                    desc_part = line[colon_pos + 1:].strip()
                    if desc_part:
                        potential_job_desc.append(desc_part)
                continue
            
            # If we've started collecting and hit a new section, stop
            if job_desc_started and line_stripped and any(line_lower.startswith(keyword) for keyword in 
                ['resume', 'personal', 'name:', 'email:', 'phone:', 'linkedin:', 'github:', 'portfolio:', 'address:', 'cover letter']):
                break
            
            # Collect lines if we're in the job description section
            if job_desc_started and line_stripped:
                potential_job_desc.append(line_stripped)
        
        if potential_job_desc:
            job_desc = ' '.join(potential_job_desc).strip()
            if len(job_desc) > 50:  # Lowered threshold
                print(f"✅ Found job description using fallback method")
                print(f"📄 Job description length: {len(job_desc)} characters") 
                print(f"📄 Job description preview: {job_desc[:200]}...")
                return job_desc
        
        print("⚠️  No job description found in prompt")
        return ""
        
    except Exception as e:
        print(f"⚠️  Error extracting job description: {e}")
        return ""

# --- FastAPI Endpoints ---
@app.post("/auto-apply")
async def hybrid_auto_apply(
    url: str = Form(...),
    prompt: str = Form(...),
    job_description: str = Form(default=""),
    resume: UploadFile = File(None),
    file_url: str = Form(None)
):
    """
    Endpoint to trigger the hybrid nodriver + browser-use auto-application process.
    API key is loaded from GOOGLE_API_KEY environment variable.
    Now includes job_description for better context-aware form filling.
    """
    # Parse user data and extract job description from prompt
    user_data_model, extracted_job_description = await parse_prompt_to_user_data(prompt)
    
    # Use extracted job description if no explicit job_description was provided
    final_job_description = job_description if job_description.strip() else extracted_job_description
    
    print(f"📄 Final job description being used: {len(final_job_description)} characters")
    if final_job_description:
        print(f"📄 Job description preview: {final_job_description[:200]}...")
    else:
        print("⚠️  No job description available for context")

    task_id = str(uuid.uuid4())
    
    # Start the hybrid background task with job description
    asyncio.create_task(process_hybrid_browseruse_apply(task_id, url, user_data_model, resume, file_url, final_job_description))
    
    return {"task_id": task_id, "status": "starting"}

@app.get("/auto-apply-status/{task_id}")
async def get_hybrid_task_status(task_id: str):
    """Get the status of a hybrid task by its ID."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

if __name__ == "__main__":
    print("🚀 Starting FastAPI server for hybrid nodriver + browser-use auto-apply")
    
    # Check if API key is available
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY not found in environment variables!")
        print("   Please add it to your .env file:")
        print("   echo 'GOOGLE_API_KEY=your-actual-api-key' >> .env")
        print("   Then restart the server.")
        exit(1)
    else:
        print("✅ GOOGLE_API_KEY loaded from environment")
    
    uvicorn.run(app, host="0.0.0.0", port=8000) 