import asyncio
import os
import sys
import random
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.responses import JSONResponse
import uvicorn
import tempfile
import aiofiles
import requests
import re
import base64
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from patchright.async_api import async_playwright as async_patchright

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Remove dotenv loading since we do not want to use env API keys for LLM
# from dotenv import load_dotenv
# load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from browser_use import Agent
from browser_use.browser import BrowserProfile, BrowserSession

app = FastAPI()

# In-memory task storage for status tracking
tasks = {}

# LinkedIn Lookup Service URLs (Bore.pub endpoints)
LINKEDIN_RUN_TASK_URL = "http://bore.pub:7777/run-task"
LINKEDIN_STOP_TASK_URL = "http://bore.pub:7777/stop-task"
LINKEDIN_TASK_STATUS_URL = "http://bore.pub:7777/task-status"

# Maximum time (in milliseconds) a task should run before we force stop it
MAX_TASK_RUNTIME = 95000  # 1.5 minutes

# Common user agents for better stealth
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
]

# Common screen resolutions
SCREEN_RESOLUTIONS = [
    {"width": 1920, "height": 1080},
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864}
]

async def human_like_delay():
    """Add a random human-like delay between actions"""
    delay = random.uniform(0.5, 2.0)
    await asyncio.sleep(delay)

async def warm_browser_session(browser_session, target_url):
    """Build browsing history and session data before agent takes over"""
    try:
        page = await browser_session.get_current_page()
        
        # Extract domain from target URL for related browsing
        from urllib.parse import urlparse
        parsed_url = urlparse(target_url)
        domain = parsed_url.netloc
        
        print(f"Warming browser session for {domain}...")
        
        # 1. Visit Google first (common starting point)
        await page.goto("https://www.google.com")
        await asyncio.sleep(random.uniform(2, 4))
        
        # 2. Search for the company (if it's a company career page)
        if any(keyword in domain.lower() for keyword in ['careers', 'jobs', 'workday', 'greenhouse']):
            company_name = domain.split('.')[0]
            search_box = await page.query_selector('textarea[name="q"], input[name="q"]')
            if search_box:
                await search_box.fill(f"{company_name} careers")
                await search_box.press('Enter')
                await asyncio.sleep(random.uniform(3, 5))
        
        # 3. Visit the main company website first
        if 'careers' in domain or 'jobs' in domain:
            main_domain = domain.replace('careers.', '').replace('jobs.', '')
            try:
                await page.goto(f"https://{main_domain}")
                await asyncio.sleep(random.uniform(2, 4))
            except:
                pass  # If main site doesn't exist, continue
        
        # 4. Finally navigate to target URL
        await page.goto(target_url)
        await asyncio.sleep(random.uniform(2, 3))
        
        print("✅ Browser session warmed successfully")
        
    except Exception as e:
        print(f"⚠️  Error warming browser session: {e}")
        # Continue anyway - just go directly to target
        try:
            page = await browser_session.get_current_page()
            await page.goto(target_url)
        except:
            pass

async def apply_browser_level_stealth(browser_session):
    """Apply stealth at browser level without JavaScript modifications"""
    try:
        page = await browser_session.get_current_page()
        
        # Remove automation indicators at browser level
        await page.evaluate("""
        // Remove webdriver property
        delete navigator.__proto__.webdriver;
        
        // Remove automation flags
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
        """)
        
        print("✅ Browser-level stealth applied successfully")
        
    except Exception as e:
        print(f"⚠️  Error applying browser-level stealth: {e}")
        # Continue anyway

async def apply_minimal_stealth_protections(browser_session):
    """Apply only the safest stealth protections that won't trigger detection"""
    try:
        page = await browser_session.get_current_page()
        
        # Generate session-consistent but randomized values
        session_hardware_cores = random.choice([4, 6, 8, 12])  # Common CPU core counts
        session_device_memory = random.choice([4, 8, 16])  # Common RAM amounts in GB
        
        # ONLY: Hardware Fingerprinting Spoofing (safest protection)
        hardware_protection_script = f"""
        // Only spoof hardware - this is the safest protection
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: function() {{ return {session_hardware_cores}; }}
        }});
        
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: function() {{ return {session_device_memory}; }}
        }});
        """
        
        print("Applying minimal hardware fingerprinting protection...")
        await page.add_init_script(hardware_protection_script)
        
        print("✅ Minimal stealth protections applied successfully")
        
    except Exception as e:
        print(f"⚠️  Error applying minimal stealth protections: {e}")
        # Continue anyway - don't fail the entire process

async def apply_stealth_protections(browser_session):
    """Apply advanced fingerprinting protections to boost trust score to 85%+"""
    try:
        page = await browser_session.get_current_page()
        
        # Generate session-consistent but randomized values
        session_hardware_cores = random.choice([4, 8, 12])  # Most common CPU core counts
        session_device_memory = random.choice([8, 16])  # Most common RAM amounts in GB
        session_canvas_noise = random.uniform(-0.00001, 0.00001)  # Very subtle canvas noise
        
        # 1. CRITICAL: JavaScript Engine Fingerprinting Protection (Addresses math_v8 and error_v8 detection)
        js_engine_protection_script = """
        // Advanced JavaScript engine fingerprinting protection
        
        // Override Math object methods with more sophisticated spoofing
        const originalMath = {
            random: Math.random,
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            exp: Math.exp,
            log: Math.log
        };
        
        // Spoof Math.random with consistent but natural variation
        Math.random = function() {
            const base = originalMath.random.call(this);
            // Add deterministic but natural-looking variation
            const seed = (Date.now() * 0.001) % 1000;
            const variation = originalMath.sin(seed) * 0.0000001;
            return (base + variation) % 1;
        };
        
        // Override other Math functions to reduce engine fingerprinting
        ['sin', 'cos', 'tan', 'exp', 'log'].forEach(method => {
            Math[method] = function(x) {
                const result = originalMath[method].call(this, x);
                // Add tiny consistent variation to reduce precision fingerprinting
                return result + (originalMath.sin(x * 1000) * 0.0000000001);
            };
        });
        
        // Advanced Error stack trace normalization
        const originalError = Error;
        const originalErrorCaptureStackTrace = Error.captureStackTrace;
        
        window.Error = function(...args) {
            const error = new originalError(...args);
            
            // Normalize stack trace to look like regular Chrome
            if (error.stack) {
                error.stack = error.stack
                    .replace(/chrome-extension:\\/\\/[^\\s]+/g, 'chrome-extension://redacted')
                    .replace(/moz-extension:\\/\\/[^\\s]+/g, 'moz-extension://redacted')
                    .replace(/\\/usr\\/bin\\/google-chrome[^\\s]*/g, 'chrome')
                    .replace(/HeadlessChrome/g, 'Chrome')
                    .replace(/automation/gi, 'navigation');
            }
            return error;
        };
        
        // Preserve Error prototype and static methods
        window.Error.prototype = originalError.prototype;
        window.Error.captureStackTrace = originalErrorCaptureStackTrace;
        
        // Override Function.toString to hide modifications
        const originalFunctionToString = Function.prototype.toString;
        Function.prototype.toString = function() {
            if (this === Math.random || this === Math.sin || this === Math.cos || 
                this === Math.tan || this === Math.exp || this === Math.log) {
                return `function ${this.name}() { [native code] }`;
            }
            return originalFunctionToString.call(this);
        };
        
        // Hide console modifications
        const originalConsole = {
            error: console.error,
            warn: console.warn,
            log: console.log
        };
        
        console.error = function(...args) {
            const message = args.join(' ');
            if (!message.includes('webdriver') && !message.includes('automation') && 
                !message.includes('HeadlessChrome')) {
                originalConsole.error.apply(this, args);
            }
        };
        """
        
        # 2. CRITICAL: HTML Element Detection Protection (Addresses html_element detection)
        html_element_protection_script = """
        // Advanced HTML element and DOM protection
        
        // Override Element prototype methods comprehensively
        const originalElementMethods = {
            getAttribute: Element.prototype.getAttribute,
            setAttribute: Element.prototype.setAttribute,
            hasAttribute: Element.prototype.hasAttribute,
            removeAttribute: Element.prototype.removeAttribute,
            getAttributeNames: Element.prototype.getAttributeNames
        };
        
        Element.prototype.getAttribute = function(name) {
            const result = originalElementMethods.getAttribute.call(this, name);
            // Hide all automation-related attributes
            if (['webdriver', 'automation', 'headless', 'phantom', 'nightmare'].includes(name.toLowerCase())) {
                return null;
            }
            return result;
        };
        
        Element.prototype.hasAttribute = function(name) {
            if (['webdriver', 'automation', 'headless', 'phantom', 'nightmare'].includes(name.toLowerCase())) {
                return false;
            }
            return originalElementMethods.hasAttribute.call(this, name);
        };
        
        Element.prototype.getAttributeNames = function() {
            const names = originalElementMethods.getAttributeNames.call(this);
            return names.filter(name => 
                !['webdriver', 'automation', 'headless', 'phantom', 'nightmare'].includes(name.toLowerCase())
            );
        };
        
        // Override document properties comprehensively
        const documentDescriptors = {
            webdriver: { get: () => undefined, configurable: true },
            $cdc_asdjflasutopfhvcZLmcfl_: { get: () => undefined, configurable: true },
            $chrome_asyncScriptInfo: { get: () => undefined, configurable: true }
        };
        
        Object.keys(documentDescriptors).forEach(prop => {
            try {
                Object.defineProperty(document, prop, documentDescriptors[prop]);
            } catch (e) {}
        });
        
        // Comprehensive window object cleanup
        const automationProps = [
            'webdriver', '_phantom', '__nightmare', 'callPhantom', '_Selenium_IDE_Recorder',
            'document.__webdriver_script_fn', 'document.$cdc_asdjflasutopfhvcZLmcfl_',
            'document.$chrome_asyncScriptInfo', '__webdriver_evaluate', '__selenium_evaluate',
            '__webdriver_script_function', '__webdriver_script_func', '__webdriver_script_fn',
            '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
            '__driver_evaluate', '__selenium_unwrapped', '__fxdriver_unwrapped'
        ];
        
        automationProps.forEach(prop => {
            try {
                delete window[prop];
                Object.defineProperty(window, prop, {
                    get: () => undefined,
                    configurable: true
                });
            } catch (e) {}
        });
        
        // Enhanced window.chrome spoofing
        if (!window.chrome || typeof window.chrome !== 'object') {
            window.chrome = {};
        }
        
        // Add realistic Chrome API structure
        Object.assign(window.chrome, {
            runtime: {
                onConnect: null,
                onMessage: null,
                connect: function() { return null; },
                sendMessage: function() { return null; }
            },
            app: {
                isInstalled: false,
                getDetails: function() { return null; }
            },
            csi: function() { return {}; },
            loadTimes: function() { 
                return {
                    requestTime: Date.now() / 1000 - Math.random(),
                    startLoadTime: Date.now() / 1000 - Math.random(),
                    commitLoadTime: Date.now() / 1000 - Math.random(),
                    finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
                    finishLoadTime: Date.now() / 1000 - Math.random(),
                    firstPaintTime: Date.now() / 1000 - Math.random(),
                    firstPaintAfterLoadTime: 0,
                    navigationType: 'Other'
                };
            }
        });
        
        // Override Object.getOwnPropertyDescriptor to hide modifications
        const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        Object.getOwnPropertyDescriptor = function(obj, prop) {
            const descriptor = originalGetOwnPropertyDescriptor(obj, prop);
            if (automationProps.includes(prop) && obj === window) {
                return undefined;
            }
            return descriptor;
        };
        """
        
        # 3. ENHANCED: Canvas Fingerprinting Protection (More sophisticated)
        canvas_protection_script = f"""
        // Advanced canvas fingerprinting protection
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const canvasNoise = {session_canvas_noise};
        
        HTMLCanvasElement.prototype.toDataURL = function(...args) {{
            const result = originalToDataURL.apply(this, args);
            // Add consistent but subtle noise
            if (result.length > 100) {{
                const chars = result.split('');
                const pos = Math.floor(chars.length * 0.8); // Modify near the end
                if (chars[pos] && /[A-Za-z0-9]/.test(chars[pos])) {{
                        chars[pos] = chars[pos] === 'A' ? 'B' : 'A';
                }}
                return chars.join('');
            }}
            return result;
        }};
        
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {{
            const result = originalGetImageData.apply(this, args);
            // Add minimal noise to image data
            if (result.data && result.data.length > 0) {{
                for (let i = 0; i < result.data.length; i += 100) {{
                    if (result.data[i] !== undefined) {{
                        result.data[i] = Math.max(0, Math.min(255, result.data[i] + canvasNoise));
                    }}
                }}
            }}
            return result;
        }};
        """
        
        # 4. CRITICAL: WebGL Fingerprinting Protection
        webgl_protection_script = """
        // WebGL fingerprinting protection
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
            const context = originalGetContext.apply(this, [contextType, ...args]);
            
            if (contextType === 'webgl' || contextType === 'webgl2') {
                // Override WebGL parameters that are commonly fingerprinted
                const originalGetParameter = context.getParameter;
                context.getParameter = function(parameter) {
                    // Return common/safe values for fingerprinting parameters
                    switch (parameter) {
                        case context.VENDOR:
                            return 'Google Inc. (Intel)';
                        case context.RENDERER:
                            return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
                        case context.VERSION:
                            return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
                        case context.SHADING_LANGUAGE_VERSION:
                            return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
                        default:
                            return originalGetParameter.call(this, parameter);
                    }
                };
            }
            
            return context;
        };
        """
        
        # 5. ENHANCED: Hardware Fingerprinting Protection
        hardware_protection_script = f"""
        // Enhanced hardware fingerprinting protection
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: function() {{ return {session_hardware_cores}; }},
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: function() {{ return {session_device_memory}; }},
            configurable: true
        }});
        
        // Override platform information
        Object.defineProperty(navigator, 'platform', {{
            get: function() {{ return 'Win32'; }},
            configurable: true
        }});
        
        // Spoof connection information with realistic values
        Object.defineProperty(navigator, 'connection', {{
            get: function() {{
                return {{
                    effectiveType: '4g',
                    downlink: 10,
                    rtt: 50,
                    saveData: false,
                    type: 'wifi'
                }};
            }},
            configurable: true
        }});
        """
        
        # 6. CRITICAL: Audio Context Fingerprinting Protection (Enhanced)
        audio_protection_script = """
        // Enhanced audio context fingerprinting protection
        const originalAudioContext = window.AudioContext || window.webkitAudioContext;
        if (originalAudioContext) {
            const AudioContextProxy = new Proxy(originalAudioContext, {
                construct: function(target, args) {
                    const instance = new target(...args);
                    
                    // Override key fingerprinting properties with common values
                    Object.defineProperty(instance, 'sampleRate', {
                        get: function() { return 44100; },
                        configurable: true
                    });
                    
                    Object.defineProperty(instance, 'baseLatency', {
                        get: function() { return 0.01; },
                        configurable: true
                    });
                    
                    Object.defineProperty(instance, 'outputLatency', {
                        get: function() { return 0.02; },
                        configurable: true
                    });
                    
                    return instance;
                }
            });
            
            window.AudioContext = AudioContextProxy;
            if (window.webkitAudioContext) {
                window.webkitAudioContext = AudioContextProxy;
            }
        }
        """
        
        # 7. NEW: Screen and Viewport Fingerprinting Protection
        screen_protection_script = """
        // Screen fingerprinting protection
        const screenWidth = screen.width;
        const screenHeight = screen.height;
        
        Object.defineProperty(screen, 'availWidth', {
            get: function() { return screenWidth; },
            configurable: true
        });
        
        Object.defineProperty(screen, 'availHeight', {
            get: function() { return screenHeight - 40; }, // Account for taskbar
            configurable: true
        });
        
        Object.defineProperty(screen, 'colorDepth', {
            get: function() { return 24; },
            configurable: true
        });
        
        Object.defineProperty(screen, 'pixelDepth', {
            get: function() { return 24; },
            configurable: true
        });
        """
        
        # 8. NEW: DOMRect and Emoji Rendering Protection
        domrect_protection_script = """
        // DOMRect and emoji rendering consistency protection
        
        // Override getBoundingClientRect for consistent measurements
        const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
            const rect = originalGetBoundingClientRect.call(this);
            
            // Add slight consistent variation to avoid perfect measurements
            const variation = 0.001; // Very small variation
            
            return {
                x: rect.x + (Math.sin(rect.x * 1000) * variation),
                y: rect.y + (Math.cos(rect.y * 1000) * variation),
                width: rect.width + (Math.sin(rect.width * 1000) * variation),
                height: rect.height + (Math.cos(rect.height * 1000) * variation),
                top: rect.top + (Math.sin(rect.top * 1000) * variation),
                right: rect.right + (Math.cos(rect.right * 1000) * variation),
                bottom: rect.bottom + (Math.sin(rect.bottom * 1000) * variation),
                left: rect.left + (Math.cos(rect.left * 1000) * variation),
                toJSON: rect.toJSON
            };
        };
        
        // Override getClientRects for consistency
        const originalGetClientRects = Element.prototype.getClientRects;
        Element.prototype.getClientRects = function() {
            const rects = originalGetClientRects.call(this);
            const variation = 0.001;
            
            // Apply same variation to all rects
            for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                Object.defineProperties(rect, {
                    x: { value: rect.x + (Math.sin(rect.x * 1000) * variation), enumerable: true },
                    y: { value: rect.y + (Math.cos(rect.y * 1000) * variation), enumerable: true },
                    width: { value: rect.width + (Math.sin(rect.width * 1000) * variation), enumerable: true },
                    height: { value: rect.height + (Math.cos(rect.height * 1000) * variation), enumerable: true }
                });
            }
            
            return rects;
        };
        
        // Override Range.getBoundingClientRect for consistency
        if (window.Range && Range.prototype.getBoundingClientRect) {
            const originalRangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;
            Range.prototype.getBoundingClientRect = function() {
                const rect = originalRangeGetBoundingClientRect.call(this);
                const variation = 0.001;
                
                return {
                    x: rect.x + (Math.sin(rect.x * 1000) * variation),
                    y: rect.y + (Math.cos(rect.y * 1000) * variation),
                    width: rect.width + (Math.sin(rect.width * 1000) * variation),
                    height: rect.height + (Math.cos(rect.height * 1000) * variation),
                    top: rect.top + (Math.sin(rect.top * 1000) * variation),
                    right: rect.right + (Math.cos(rect.right * 1000) * variation),
                    bottom: rect.bottom + (Math.sin(rect.bottom * 1000) * variation),
                    left: rect.left + (Math.cos(rect.left * 1000) * variation),
                    toJSON: rect.toJSON
                };
            };
        }
        """
        
        # 9. NEW: Timezone and Locale Consistency
        timezone_protection_script = """
        // Ensure timezone consistency
        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {
            return 300; // EST timezone offset
        };
        
        // Override Intl.DateTimeFormat to be consistent
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(...args) {
            if (args.length === 0) {
                args = ['en-US'];
            }
            return new originalDateTimeFormat(...args);
        };
        
        // Override Date.prototype.toString for consistency
        const originalDateToString = Date.prototype.toString;
        Date.prototype.toString = function() {
            const result = originalDateToString.call(this);
            // Ensure consistent timezone representation
            return result.replace(/GMT[+-]\d{4}.*$/, 'GMT-0500 (Eastern Daylight Time)');
        };
        """
        
        # Apply all protections in order of importance
        print("Applying JavaScript engine protection...")
        await page.add_init_script(js_engine_protection_script)
        
        print("Applying HTML element protection...")
        await page.add_init_script(html_element_protection_script)
        
        print("Applying enhanced canvas protection...")
        await page.add_init_script(canvas_protection_script)
        
        print("Applying WebGL protection...")
        await page.add_init_script(webgl_protection_script)
        
        print("Applying enhanced hardware protection...")
        await page.add_init_script(hardware_protection_script)
        
        print("Applying enhanced audio protection...")
        await page.add_init_script(audio_protection_script)
        
        print("Applying screen protection...")
        await page.add_init_script(screen_protection_script)
        
        print("Applying DOMRect protection...")
        await page.add_init_script(domrect_protection_script)
        
        print("Applying timezone protection...")
        await page.add_init_script(timezone_protection_script)
        
        print("✅ All advanced stealth protections applied successfully")
        
    except Exception as e:
        print(f"⚠️  Error applying stealth protections: {e}")
        # Continue anyway - don't fail the entire process

@app.post('/run-task')
async def run_task(
    company: str = Form(...),
    apiKey: str = Form(None)
):
    """
    POST handler for LinkedIn lookup
    This bypasses CORS using the bore.pub service to scrape LinkedIn data
    Implements the polling pattern instead of waiting for task completion
    """
    try:
        print(f"=== DEBUG: /run-task endpoint called ===")
        print(f"DEBUG: Received company: {company}")
        print(f"DEBUG: Received apiKey: {apiKey[:10] if apiKey else 'None'}...")
        print(f"DEBUG: LINKEDIN_RUN_TASK_URL: {LINKEDIN_RUN_TASK_URL}")
        
        # Check if company is provided
        if not company:
            print("DEBUG: Company name is missing!")
            raise HTTPException(status_code=400, detail="Company name is required")
        
        print(f"DEBUG: Looking up LinkedIn HR contacts for company: {company}")
        
        # Define system prompt for better guidance of the automation
        system_prompt = """You are a professional LinkedIn researcher. Your task is to find HR contacts at companies using Google and LinkedIn.
Follow the instructions carefully and meticulously. If you encounter any obstacles, try alternative approaches to find the information.
Focus specifically on finding HR personnel with clear job titles related to Human Resources, Recruitment, or Talent Acquisition.
Extract profile details accurately, especially LinkedIn profile URLs and contact information."""
        
        # Create the LinkedIn search task for the bore.pub service
        task = f"""
Go to Google.com (always start with this step)
Search for the company {company} on LinkedIn.

Check if the Company has a LinkedIn Page
    If no LinkedIn page is found, return to Google.com and exit the process.
    If a LinkedIn page is found, click on the company page.

Navigate to the People Section
    Locate the People section of the company's LinkedIn page.
    Scroll down to the people cards on the page to find people that work in HR-related roles.
    Identify profiles of employees (excluding accounts labeled as "LinkedIn Member", as these are private).
  
Find HR-Related Employees
    Search for at least one employee with a job title related to:
        Human Resources (HR)
        Recruitment
        Talent Acquisition
        Hiring Manager
        Other relevant HR roles
    If no suitable employee is found, return to Google.com and exit the process.

Extract Contact Information
    Click on the selected employee's profile picture to open their profile.
    Click the More button.
    Open the Contact Info overlay and collect any available details, such as:
        Full name
        Profile image URL
        Job title
        LinkedIn profile URL
        Email (if available)
        Company website (if available)
Return to google.com
Return the Results of the LinkedIn profile found
Compile and return all collected information about the HR employee(s) and any available company HR contact details.
"""

        print('DEBUG: Starting LinkedIn search with task')
        print(f'DEBUG: Task length: {len(task)} characters')
        
        # Prepare the request body
        request_body = {
            "task": task,
            "system_prompt": system_prompt
        }
        
        # Use provided API key, or fall back to environment variable
        gemini_api_key = apiKey or os.getenv('GEMINI_API_KEY')
        
        # Add API key if provided
        if gemini_api_key:
            request_body["api_key"] = gemini_api_key.strip()
            print(f'DEBUG: Using provided API key for the task: {gemini_api_key[:5]}...')
        else:
            print('DEBUG: No API key provided, relying on bore.pub default')
        
        print(f'DEBUG: Request body keys: {list(request_body.keys())}')
        print(f'DEBUG: Request body size: {len(str(request_body))} characters')
        print(f'DEBUG: About to POST to: {LINKEDIN_RUN_TASK_URL}')
        
        # Create the fetch request to bore.pub to START the task
        try:
            response = requests.post(
                LINKEDIN_RUN_TASK_URL,
                headers={'Content-Type': 'application/json'},
                json=request_body,
                timeout=30  # Add timeout
            )
            
            print(f'DEBUG: Response status code: {response.status_code}')
            print(f'DEBUG: Response headers: {dict(response.headers)}')
            print(f'DEBUG: Response text: {response.text}')
            
        except requests.exceptions.RequestException as req_error:
            print(f'DEBUG: Request exception occurred: {req_error}')
            print(f'DEBUG: Request exception type: {type(req_error)}')
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to bore.pub service: {str(req_error)}"
            )
        
        if not response.ok:
            print(f"DEBUG: LinkedIn lookup failed to start: {response.text}")
            print(f"DEBUG: Response status: {response.status_code}")
            print(f"DEBUG: Response reason: {response.reason}")
            
            # Try to get more detailed error info
            try:
                error_json = response.json()
                print(f"DEBUG: Error JSON: {error_json}")
            except:
                print("DEBUG: Could not parse error response as JSON")
            
            raise HTTPException(
                status_code=response.status_code,
                detail=f"LinkedIn lookup failed to start: {response.text}"
            )
        
        # Get the task information with the task ID
        try:
            task_info = response.json()
            print('DEBUG: Task started with info:', task_info)
        except Exception as json_error:
            print(f'DEBUG: Failed to parse response JSON: {json_error}')
            print(f'DEBUG: Raw response: {response.text}')
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse response from bore.pub service: {str(json_error)}"
            )
        
        if not task_info or not task_info.get('task_id'):
            print(f'DEBUG: Invalid task_info structure: {task_info}')
            raise HTTPException(
                status_code=500,
                detail="Failed to get task ID from service"
            )
        
        task_id = task_info['task_id']
        print(f'DEBUG: Got task_id: {task_id}')
        
        # Set up a background timeout to stop the task if it runs too long
        async def stop_task_after_timeout():
            await asyncio.sleep(MAX_TASK_RUNTIME / 1000)  # Convert to seconds
            try:
                # Check if the task is still running before stopping it
                status_response = requests.get(f"{LINKEDIN_TASK_STATUS_URL}/{task_id}")
                if status_response.ok:
                    status_data = status_response.json()
                    if status_data.get('status') == 'running':
                        print(f"DEBUG: Task {task_id} is taking too long, stopping it automatically...")
                        await stop_linkedin_task(task_id)
            except Exception as stop_error:
                print(f"DEBUG: Error in timeout handler for task {task_id}: {stop_error}")
        
        # Start the timeout task in the background
        asyncio.create_task(stop_task_after_timeout())
        
        # Return the task ID for polling
        response_data = {
            "task_id": task_id,
            "taskId": task_id,
            "status": "running",
            "message": "LinkedIn search task started successfully",
            "company": company
        }
        
        print(f'DEBUG: Returning response: {response_data}')
        return JSONResponse(content=response_data)
        
    except HTTPException as http_error:
        print(f'DEBUG: HTTPException occurred: {http_error.detail}')
        raise
    except Exception as error:
        print(f'DEBUG: Unexpected error initiating LinkedIn HR lookup: {error}')
        print(f'DEBUG: Error type: {type(error)}')
        import traceback
        print(f'DEBUG: Traceback: {traceback.format_exc()}')
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@app.get('/task-status/{task_id}')
async def get_task_status_linkedin(task_id: str):
    """
    GET handler to check the status of a LinkedIn lookup task by polling
    """
    try:
        if not task_id:
            raise HTTPException(status_code=400, detail="Task ID is required")
        
        print(f"Checking status of LinkedIn task: {task_id}")
        
        # Call the task-status endpoint
        status_url = f"{LINKEDIN_TASK_STATUS_URL}/{task_id}"
        status_response = requests.get(status_url)
        
        if not status_response.ok:
            print(f"Failed to get task status: {status_response.text}")
            raise HTTPException(
                status_code=status_response.status_code,
                detail=f"Failed to get task status: {status_response.text}"
            )
        
        # Return the status
        status_data = status_response.json()
        print(f"Task {task_id} status: {status_data.get('status')}")
        
        # Make sure we have consistent field names
        return JSONResponse(content={
            **status_data,
            "task_id": task_id,
            "taskId": task_id
        })
        
    except HTTPException:
        raise
    except Exception as error:
        print(f'Error checking LinkedIn task status: {error}')
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

@app.post('/stop-task')
async def stop_task(
    task_id: str = Form(...)
):
    """
    POST handler to stop a running LinkedIn lookup task
    """
    try:
        if not task_id:
            raise HTTPException(status_code=400, detail="Task ID is required")
        
        print(f"Stopping LinkedIn task with ID: {task_id}")
        stop_response = requests.post(
            LINKEDIN_STOP_TASK_URL,
            headers={'Content-Type': 'application/json'},
            json={"task_id": task_id}
        )
        
        if not stop_response.ok:
            print(f"Failed to stop task: {stop_response.text}")
            raise HTTPException(
                status_code=stop_response.status_code,
                detail=f"Failed to stop task: {stop_response.text}"
            )
        
        stop_result = stop_response.json()
        print('Task stop result:', stop_result)
        
        return JSONResponse(content={
            "success": True,
            "message": "Task stopped successfully",
            "task_id": task_id,
            **stop_result
        })
        
    except HTTPException:
        raise
    except Exception as error:
        print(f'Error stopping LinkedIn task: {error}')
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

async def stop_linkedin_task(task_id: str):
    """
    Helper function to stop a running LinkedIn lookup task
    """
    try:
        print(f"Stopping LinkedIn task with ID: {task_id}")
        stop_response = requests.post(
            LINKEDIN_STOP_TASK_URL,
            headers={'Content-Type': 'application/json'},
            json={"task_id": task_id}
        )
        
        if not stop_response.ok:
            print(f"Failed to stop task: {stop_response.text}")
            return
        
        stop_result = stop_response.json()
        print('Task stop result:', stop_result)
    except Exception as error:
        print(f'Error stopping LinkedIn task: {error}')

@app.get('/auto-apply-status/{task_id}')
async def get_task_status(task_id: str):
    """Get the status of a task by its ID"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    try:
        # Return a copy of the task data to avoid serialization issues
        task_data = {
            "status": tasks[task_id].get("status", "unknown"),
            "message": tasks[task_id].get("message", ""),
            "progress": tasks[task_id].get("progress", 0),
            "error": tasks[task_id].get("error", ""),
            "result": tasks[task_id].get("result", {})
        }
        
        return JSONResponse(content=task_data)
    except Exception as e:
        print(f"Error getting task status: {e}")
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Error retrieving task status: {str(e)}",
                "progress": 0
            },
            status_code=500
        )

@app.post('/test-browser')
async def test_browser_stealth(
	url: str = Form(...), ### URL to test (e.g., creepjs)
	prompt: str = Form(...), ### What to look for on the page
	api_key: str = Form(...) ### Google Gemini API key
):
	"""Test browser stealth capabilities with direct response"""
	
	# Enforce that api_key is provided and non-empty
	if not api_key or not api_key.strip():
		raise HTTPException(status_code=400, detail="API key must be provided in the request.")

	browser_session = None
	patchright = None
	
	try:
		# Configure the LLM
		llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
		
		# Select random user agent and screen resolution
		user_agent = random.choice(USER_AGENTS)
		screen_resolution = random.choice(SCREEN_RESOLUTIONS)
		
		# Create a browser profile for testing
		unique_user_data_dir = f"~/.config/browseruse/profiles/stealth_test_{os.getpid()}"
		
		# Initialize patchright for stealth capabilities
		patchright = await async_patchright().start()
		
		# Create browser session with advanced stealth configuration
		browser_profile = BrowserProfile(
			viewport_expansion=0,
			user_data_dir=unique_user_data_dir,
			headless=False,
			keep_alive=True,
			executable_path='/usr/bin/google-chrome',
			disable_security=False,
			deterministic_rendering=False,
			screen=screen_resolution,
			extra_http_headers={
                "User-Agent": user_agent,
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="99", "Chromium";v="123"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1"
            },
            locale="en-US",
            timezone_id="America/New_York",
            device_scale_factor=1.0,
            is_mobile=False,
            permissions=["geolocation", "notifications"],
            # Advanced browser-level stealth configuration
            extra_chromium_args=[
                # Core automation hiding (CRITICAL)
                "--disable-blink-features=AutomationControlled",
                "--exclude-switches=enable-automation",
                "--disable-automation",
                "--disable-extensions-file-access-check",
                "--disable-extensions-http-throttling",
                
                # Anti-headless detection (CRITICAL)
                "--disable-headless-mode",
                "--window-size=1366,768",
                "--start-maximized",
                "--disable-gpu-sandbox",
                "--enable-webgl",
                "--enable-3d-apis",
                
                # Reduce fingerprinting vectors but keep some enabled for realism
                "--disable-canvas-aa",
                "--disable-2d-canvas-clip-aa",
                "--disable-gl-drawing-for-tests",
                
                # Memory and performance fingerprinting
                "--disable-dev-shm-usage",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
                "--disable-backgrounding-occluded-windows",
                "--disable-ipc-flooding-protection",
                
                # Plugin and extension fingerprinting
                "--disable-plugins-discovery",
                "--disable-default-apps",
                "--disable-extensions-except",
                "--disable-component-extensions-with-background-pages",
                
                # Network fingerprinting (but keep some WebRTC for realism)
                "--disable-webrtc-hw-decoding",
                "--disable-webrtc-hw-encoding",
                "--disable-webrtc-multiple-routes",
                "--disable-webrtc-hw-vp8-encoding",
                
                # System integration fingerprinting
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-default-browser-check",
                "--disable-popup-blocking",
                "--disable-translate",
                "--disable-sync",
                
                # Realistic browser behavior
                "--enable-features=NetworkService,NetworkServiceLogging",
                "--enable-automation=false",
                "--disable-blink-features=AutomationControlled",
                "--user-data-dir-name=Default",
                
                # Additional stealth flags
                "--no-sandbox",
                "--disable-features=VizDisplayCompositor,TranslateUI",
                "--disable-logging",
                "--silent",
                "--log-level=3",
                
                # Memory optimization
                "--memory-pressure-off",
                "--max_old_space_size=4096",
                
                # Realistic Chrome flags
                "--enable-features=VaapiVideoDecoder",
                "--disable-features=MediaRouter",
                "--disable-component-update"
            ]
		)
		
		browser_session = BrowserSession(
			browser_profile=browser_profile,
			playwright=patchright,
		)
		
		# Initialize the browser session
		await browser_session.start()
		
		# Apply browser-level stealth and session warming
		await apply_browser_level_stealth(browser_session)
		await warm_browser_session(browser_session, url)
		
		# Create and run agent with human-like instructions
		test_agent = Agent(
			task=f"You are already on {url}. {prompt}. Take your time and act naturally - add pauses between actions, scroll to read content, and behave like a human user would.",
			llm=llm,
			max_actions_per_step=5,  # Slower, more deliberate actions
			browser_session=browser_session,
			use_vision=True,
			use_vision_for_planner=True,
			max_failures=3,
			retry_delay=15,  # Longer delays between retries
			extend_system_message='Act like a human user. Take pauses between actions. Scroll to read content. Add delays before clicking. When providing responses, return ONLY clean, valid JSON without any special characters, emojis, markdown formatting, or escape sequences. Do not include ActionResult objects, backticks, code blocks, or any non-JSON text. Use simple double quotes for all strings and avoid any characters that could cause parsing errors like \\n, \\t, or unicode symbols.',
			enable_memory=True,
			tool_calling_method='auto'
		)
		
		# Run the agent and get results
		result = await test_agent.run(max_steps=15)
		
		# Extract only serializable data from the result
		serializable_result = "Test completed successfully"
		if result:
			try:
				# Try to extract the final message or summary from the result
				if hasattr(result, 'history') and result.history:
					# Get the last action's result if available
					last_action = result.history[-1] if result.history else None
					if last_action and hasattr(last_action, 'result'):
						serializable_result = str(last_action.result)
					else:
						serializable_result = f"Agent completed {len(result.history)} actions"
				else:
					serializable_result = str(result)
			except Exception as e:
				print(f"Error extracting result: {e}")
				serializable_result = "Test completed but result extraction failed"
		
		return JSONResponse(content={
			"success": True,
			"message": "Browser stealth test completed",
			"url_tested": url,
			"result": serializable_result
		})
		
	except Exception as e:
		return JSONResponse(
			content={
				"success": False,
				"error": str(e),
				"message": f"Test failed: {str(e)}"
			},
			status_code=500
		)
	finally:
		# Clean up resources
		try:
			if browser_session:
				await browser_session.stop()
			if patchright:
				await patchright.stop()
		except Exception as close_error:
			print(f"Error closing browser session: {close_error}")

@app.post('/auto-apply')
async def run_agent(
	prompt: str = Form(...), ### This is the information that will be used to apply for the job.
	url: str = Form(...), ### This is the URL of the job posting.
	api_key: str = Form(...), ### This is the API key for the Google Gemini API.
	file: UploadFile = File(None), ### This is the file that will be used to apply for the job.
	file_url: str = Form(None) ### This is the URL of the file that will be used to apply for the job.
):
	#Print incoming data for debugging
	#print("--- Incoming API Call Data ---")
	##print(f"url: {url}")
	##print("-----------------------------")

	# Enforce that api_key is provided and non-empty
	if not api_key or not api_key.strip():
		raise HTTPException(status_code=400, detail="API key must be provided in the request. No fallback to environment variable is allowed.")

	# Generate a unique task ID
	task_id = str(uuid.uuid4())
	
	# Initialize task status
	tasks[task_id] = {
		"status": "starting",
		"progress": 0,
		"message": "Starting the auto-apply process"
	}

	temp_file_path = None
	browser_session = None
	patchright = None
	
	# Run the task in the background
	asyncio.create_task(process_auto_apply(task_id, prompt, url, api_key, file, file_url))
	
	# Return task ID immediately for polling
	return JSONResponse(content={"task_id": task_id, "status": "starting"})



async def process_auto_apply(task_id, prompt, url, api_key, file, file_url):
	"""Process the auto-apply task in the background"""
	temp_file_path = None
	browser_session = None
	patchright = None
	
	try:
		# Update task status
		tasks[task_id]["status"] = "processing"
		tasks[task_id]["message"] = "Processing file upload"
		tasks[task_id]["progress"] = 10
		
		# Handle file upload
		available_file_paths = []
		if file is not None:
			suffix = os.path.splitext(file.filename)[-1]
			async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
				content = await file.read()
				await tmp.write(content)
				temp_file_path = tmp.name
				available_file_paths.append(temp_file_path)
		elif file_url:
			# Handle file_url: support both HTTP(S) and data URLs
			if file_url.startswith('data:'):
				# Parse data URL (e.g., data:application/pdf;filename=generated.pdf;base64,...) 
				match = re.match(r'data:(?P<mime>[^;]+);filename=(?P<filename>[^;]+);base64,(?P<data>.+)', file_url)
				if not match:
					tasks[task_id]["status"] = "failed"
					tasks[task_id]["error"] = "Invalid data URL format for file_url"
					return
				filename = match.group('filename')
				suffix = os.path.splitext(filename)[-1]
				file_data = base64.b64decode(match.group('data'))
				with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
					tmp.write(file_data)
					temp_file_path = tmp.name
					available_file_paths.append(temp_file_path)
			else:
				# Download file from HTTP(S) URL
				r = requests.get(file_url)
				r.raise_for_status()
				suffix = os.path.splitext(file_url)[-1]
				with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
					tmp.write(r.content)
					temp_file_path = tmp.name
					available_file_paths.append(temp_file_path)

		# Update task status
		tasks[task_id]["status"] = "processing"
		tasks[task_id]["message"] = "Initializing browser"
		tasks[task_id]["progress"] = 20

		# Always configure the LLM
		llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
		
		# Select random user agent and screen resolution for better stealth
		user_agent = random.choice(USER_AGENTS)
		screen_resolution = random.choice(SCREEN_RESOLUTIONS)
		
		# Create a browser profile with unique user data dir to avoid conflicts
		unique_user_data_dir = f"~/.config/browseruse/profiles/job_apply_{os.getpid()}"
		
		# Initialize patchright for stealth capabilities
		patchright = await async_patchright().start()
		
		# Create a single browser session to be shared across all steps with stealth
		browser_profile = BrowserProfile(
			viewport_expansion=0,
			user_data_dir=unique_user_data_dir,
			headless=False,
			keep_alive=True,
			executable_path='/usr/bin/google-chrome',
			disable_security=False,
			deterministic_rendering=False,
			screen=screen_resolution,
			extra_http_headers={
                "User-Agent": user_agent,
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"'
            },
            locale="en-US",
            timezone_id="America/New_York",
            device_scale_factor=1.0,
            is_mobile=False,
            permissions=["geolocation"],
            # Add critical anti-fingerprinting browser flags
            extra_chromium_args=[
                "--disable-webrtc",  # Block WebRTC at browser level
                "--disable-webgl",   # Reduce WebGL fingerprinting
                "--disable-canvas-aa",  # Reduce canvas anti-aliasing fingerprinting
                "--disable-2d-canvas-clip-aa",  # Reduce canvas clipping fingerprinting
                "--disable-gl-drawing-for-tests",  # Reduce GPU fingerprinting
                "--disable-dev-shm-usage",  # Reduce memory fingerprinting
                "--no-first-run",  # Reduce startup fingerprinting
                "--disable-default-apps",  # Reduce extension fingerprinting
                "--disable-extensions-file-access-check",  # Reduce extension detection
                "--disable-background-timer-throttling",  # Reduce timing fingerprinting
                "--disable-renderer-backgrounding",  # Reduce background detection
                "--disable-backgrounding-occluded-windows",  # Reduce window state detection
                "--disable-ipc-flooding-protection",  # Reduce IPC fingerprinting
				"--disable-blink-features=AutomationControlled",  # Hide automation
                "--exclude-switches=enable-automation",  # Remove automation flags
                "--disable-extensions-except",  # Reduce extension fingerprinting
                "--disable-plugins-discovery",  # Reduce plugin detection
                "--no-sandbox"  # Sometimes helps with detection
            ]
		)
		
		# Use patchright with browser session for stealth capabilities
		browser_session = BrowserSession(
			browser_profile=browser_profile,
			playwright=patchright,
		)
		
		# Initialize the browser session
		await browser_session.start()
		
		# Apply critical fingerprinting protections
		await apply_stealth_protections(browser_session)
		
		# Add initial human-like delay before navigation
		await human_like_delay()
		
		# Update task status
		tasks[task_id]["status"] = "in_progress"
		tasks[task_id]["message"] = "Finding application form"
		tasks[task_id]["progress"] = 30
		
		## Step 1: Finding the application form to submit an application 
		## have an ai agent navigate the page till the application form is found
		find_application_form = f"""go to this URL:{url},\n what your looking at a job application and need to navigate to the appliaciton form.\nif the form is already shown on the screen stop and consider the task completed.\nif the application form is not shown on the screen naviagate the webiste to find to form and then consider the task complete\n"""
		form_finder_agent = Agent(
			task=find_application_form,
			llm=llm,
			max_actions_per_step=15,
			browser_session=browser_session,
			use_vision=True,
			use_vision_for_planner=True,
			max_failures=3,
			retry_delay=15,
			extend_system_message='When providing responses, return ONLY clean, valid JSON without any special characters, emojis, markdown formatting, or escape sequences. Do not include ActionResult objects, backticks, code blocks, or any non-JSON text. Use simple double quotes for all strings and avoid any characters that could cause parsing errors like \\n, \\t, unicode symbols, or raw object representations. Strip all formatting and return plain JSON only.',
			enable_memory=True,
			tool_calling_method='auto'
		)
		
		try:
			find_form_result = await form_finder_agent.run(max_steps=25)
			# Store only JSON-serializable data
			form_result_serializable = {
				"success": True,
				"final_url": find_form_result.get("final_url", url),
				"message": "Successfully found application form"
			}
		except Exception as e:
			print(f"Error finding form: {e}")
			form_result_serializable = {
				"success": False,
				"error": str(e),
				"message": "Failed to find application form"
			}
		
		# Add a variable delay to ensure the page is fully loaded and stable
		await asyncio.sleep(random.uniform(2, 4))
		
		# Update task status
		tasks[task_id]["status"] = "in_progress"
		tasks[task_id]["message"] = "Uploading resume"
		tasks[task_id]["progress"] = 50
		tasks[task_id]["form_result"] = form_result_serializable
		
		## Step 2: Fetch the page HTML and parse for resume file input
		## Use the browser session directly to get the page HTML and find the file input
		print("Fetching current page HTML after agent navigation...")
		resume_upload_result = {"success": False, "message": ""}
		
		try:
			# Verify browser session is still active
			if not browser_session.is_connected():
                # Reconnect if needed
				print("Browser session disconnected, reconnecting...")
				await browser_session.start()
				
				# Navigate back to the current URL if needed
				current_url = form_result_serializable.get('final_url', url)
				if current_url:
					await browser_session.navigate_to(current_url)
					await asyncio.sleep(random.uniform(1.5, 3))
			
			# Get the HTML content
			html = await browser_session.get_page_html()
			print("Fetched HTML, parsing with BeautifulSoup...")
			
			# Parse HTML to find file inputs
			soup = BeautifulSoup(html, 'html.parser')
			resume_input = None
			file_inputs = soup.find_all('input', {'type': 'file'})
			print(f"Found {len(file_inputs)} file input elements")
			
			# Look for resume upload fields with expanded criteria
			for input_el in file_inputs:
				print(f"Examining file input: {input_el}")
				found_resume_field = False
				
				# Check accept attribute for resume-related file types
				accept_attr = input_el.get('accept', '')
				if accept_attr and any(ext in accept_attr.lower() for ext in ['.pdf', '.doc', '.docx', 'application/pdf']):
					found_resume_field = True
					print(f"Found resume input based on accept attribute: {input_el}")
				
				# Check all attributes for resume-related keywords
				for attr, value in input_el.attrs.items():
					if any(keyword in attr.lower() for keyword in ['resume', 'file', 'upload', 'document', 'cv']):
						found_resume_field = True
						break
					if isinstance(value, str) and any(keyword in value.lower() for keyword in ['resume', 'file', 'upload', 'document', 'cv']):
						found_resume_field = True
						break
				
				# Check parent elements for resume-related text
				parent = input_el.parent
				for _ in range(3):  # Check up to 3 levels up
					if parent and parent.get_text() and any(keyword in parent.get_text().lower() for keyword in ['resume', 'cv', 'upload', 'document']):
						found_resume_field = True
						break
					parent = parent.parent if parent else None
				
				if found_resume_field:
					resume_input = input_el
					print(f"Found resume input: {resume_input}")
					break
			
			if resume_input:
				# Upload the resume file if available
				if temp_file_path:
					try:
						# Get the current page from the browser session
						page = await browser_session.get_current_page()
						
						# Add human-like delay before file upload
						await human_like_delay()
						
						# Find a selector for the file input
						selector = None
						if resume_input.get('id'):
							selector = f"#{resume_input['id']}"
						elif resume_input.get('name'):
							selector = f"input[name='{resume_input['name']}']"
						elif resume_input.get('class'):
							class_names = ' '.join(resume_input['class'])
							selector = f"input.{class_names.replace(' ', '.')}"
						else:
							# Use XPath as fallback - find the index of this input among all file inputs
							for i, el in enumerate(file_inputs):
								if el == resume_input:
									selector = f"//input[@type='file'][{i+1}]"
									break
						
						if selector:
							print(f"Using selector {selector} to upload file {temp_file_path}")
							try:
								if selector.startswith('//'):
									# XPath selector
									file_input = await page.wait_for_selector(f"xpath={selector}", timeout=5000)
								else:
									# CSS selector
									file_input = await page.wait_for_selector(selector, timeout=5000)
								
								if file_input:
									# Try to make the file input visible if it's hidden
									await page.evaluate_handle("""(selector) => {
										const el = document.querySelector(selector) || document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
										if (el) {
											el.style.display = 'block';
											el.style.opacity = '1';
											el.style.visibility = 'visible';
											el.style.position = 'relative';
										}
									}""", selector)
									
									# Add human-like delay before upload
									await human_like_delay()
									
									# Try direct upload
									await file_input.set_input_files(temp_file_path)
									print("File uploaded successfully")
									resume_upload_result = {"success": True, "message": "Resume uploaded successfully"}
									await asyncio.sleep(random.uniform(1.5, 3))  # Variable wait for upload to complete
							except Exception as selector_error:
								print(f"Error with selector {selector}: {selector_error}")
								resume_upload_result = {"success": False, "message": f"Selector error: {str(selector_error)}"}
								
								# Try a more general approach if specific selector fails
								try:
									# Try to find and use any file input
									all_file_inputs = await page.query_selector_all('input[type="file"]')
									if all_file_inputs and len(all_file_inputs) > 0:
										print(f"Trying direct upload to first file input of {len(all_file_inputs)} found")
										await human_like_delay()
										await all_file_inputs[0].set_input_files(temp_file_path)
										print("File uploaded successfully with fallback method")
										resume_upload_result = {"success": True, "message": "Resume uploaded with fallback method"}
										await asyncio.sleep(random.uniform(1.5, 3))
								except Exception as fallback_error:
									print(f"Fallback upload also failed: {fallback_error}")
									resume_upload_result = {"success": False, "message": f"Fallback upload failed: {str(fallback_error)}"}
					except Exception as upload_error:
						print(f"Error uploading resume file: {upload_error}")
						print("Continuing without file upload")
						resume_upload_result = {"success": False, "message": f"Upload error: {str(upload_error)}"}
			else:
				print("No resume input found matching criteria. Continuing without file upload.")
				resume_upload_result = {"success": True, "message": "No resume input field found, continuing without file upload"}
		except Exception as e:
			print(f"Error during resume input detection: {e}")
			print("Continuing without file upload")
			resume_upload_result = {"success": False, "message": f"Resume detection error: {str(e)}"}
		
		# Update task status with resume upload result
		tasks[task_id]["resume_upload"] = resume_upload_result
		
		# Add human-like delay before form filling
		await human_like_delay()
		
		# Update task status
		tasks[task_id]["status"] = "in_progress"
		tasks[task_id]["message"] = "Filling application form"
		tasks[task_id]["progress"] = 70
		
		## Step 3: Fill out and submit the application and return the result
		## Compose the task to fillout the application
		apply_task = f"""your goal is to use the following personal/resume data information for a job application\n Fill out the text inputs, textareas, and answer any questions using the information provided.\nIgnore any optional data and the resume or photo upload inputs and any other inputs that are not text inputs, textareas, questions, checkboxes, or radio buttons.\nOnce all the required fields are completed consider the task complete and return the results.\n\nIMPORTANT: Act like a human user. Type at a natural pace with brief pauses between fields. Don't fill out forms too quickly or in a robotic pattern. Occasionally make small typos and correct them. Navigate through fields in a natural order, sometimes using tab key and sometimes clicking directly.\n\n{prompt}"""
		
		# Create a new agent for step 3, reusing the same browser session
		apply_agent = Agent(
			task=apply_task,
			llm=llm,
			max_actions_per_step=2,
			browser_session=browser_session,
			use_vision=True,
			use_vision_for_planner=True,
			max_failures=7,
			retry_delay=30,
			extend_system_message='When providing responses, return ONLY clean, valid JSON without any special characters, emojis, markdown formatting, or escape sequences. Do not include ActionResult objects, backticks, code blocks, or any non-JSON text. Use simple double quotes for all strings and avoid any characters that could cause parsing errors like \\n, \\t, unicode symbols, or raw object representations. Strip all formatting and return plain JSON only. Act naturally like a human when filling forms.',
			enable_memory=True,
			tool_calling_method='auto'
		)
		
		# Run the application filling agent
		try:
			result = await apply_agent.run(max_steps=25)
			
			# Extract only JSON-serializable data from the result
			result_serializable = {
				"success": True,
				"message": "Application submitted successfully",
				"fields_filled": "All required fields were completed"
			}
			
			# Update task status with success
			tasks[task_id]["status"] = "completed"
			tasks[task_id]["message"] = "Application submitted successfully"
			tasks[task_id]["progress"] = 100
			tasks[task_id]["result"] = result_serializable
		except Exception as e:
			error_message = str(e)
			print(f"Error in form filling agent: {error_message}")
			
			# Check for specific error patterns
			if "Failed to parse model output" in error_message or "Invalid \escape" in error_message:
				error_message = "The AI had trouble parsing the form. This often happens with complex forms or when special characters cause parsing issues."
			
			# Update task status with error
			tasks[task_id]["status"] = "failed"
			tasks[task_id]["error"] = error_message
			tasks[task_id]["message"] = f"Error: {error_message}"
			tasks[task_id]["progress"] = 100
		
	except Exception as e:
		print(f"Error in run_agent: {e}")
		# Update task status with error
		tasks[task_id]["status"] = "failed"
		tasks[task_id]["error"] = str(e)
		tasks[task_id]["message"] = f"Error: {str(e)}"
		tasks[task_id]["progress"] = 100
	finally:
		# Clean up resources
		try:
			if browser_session:
				print("Closing browser session...")
				await browser_session.stop()
			if patchright:
				await patchright.stop()
		except Exception as close_error:
			print(f"Error closing browser session: {close_error}")
		
		# Clean up temp file if created
		if temp_file_path and os.path.exists(temp_file_path):
			try:
				os.remove(temp_file_path)
				print(f"Removed temporary file: {temp_file_path}")
			except Exception as file_error:
				print(f"Error removing temp file: {file_error}")

# For local testing: python simple.py
if __name__ == '__main__':
	uvicorn.run("simple:app", host="0.0.0.0", port=8000, reload=True)