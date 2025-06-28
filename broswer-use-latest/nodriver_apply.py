import asyncio
import os
import tempfile
import uuid
import re
import base64
import json

import nodriver as uc
from playwright.async_api import async_playwright
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
import uvicorn
import aiofiles
import httpx
from langchain_core.messages import HumanMessage
from browser_use import Agent
from browser_use.browser import BrowserSession

app = FastAPI()

# In-memory task storage for status tracking
tasks = {}

# Disable browser_use telemetry calls to avoid network failures
os.environ["BROWSER_USE_DISABLE_TELEMETRY"] = "1"

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

# Mapping of common field identifiers to our user data keys
FIELD_MAPPING = {
    ("name", "full name", "fullname"): ("first_name", "last_name"),
    ("first name", "firstname"): "first_name",
    ("last name", "lastname", "surname"): "last_name",
    ("email", "e-mail"): "email",
    ("phone", "phone number", "mobile"): "phone",
    ("linkedin", "linkedin profile"): "linkedin",
    ("github", "github profile"): "github",
    ("website", "portfolio", "personal website"): "portfolio",
    ("address", "location"): "address",
}


async def fill_text_field(tab, keywords, value):
    """Finds and fills a text input field using a list of keywords."""
    if not value: return False
    try:
        selectors = [f"input[name*='{kw}'], input[aria-label*='{kw}'], input[placeholder*='{kw}']" for kw in keywords]
        selector_str = ", ".join(selectors)
        
        element = await tab.select(selector_str, timeout=2)
        if not element:
            # Try XPath to find input associated with label
            xpath_selector = f"//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{keywords[0]}')]/following-sibling::input"
            xpath_results = await tab.xpath(xpath_selector, timeout=2)
            if xpath_results:
                element = xpath_results[0]

        if element:
            print(f"Found field for '{keywords[0]}' and filling it.")
            # Move mouse to element before clicking
            await element.mouse_move()
            await asyncio.sleep(0.2)
            await element.click()
            await asyncio.sleep(0.3)
            await element.send_keys(value)
            return True
    except Exception as e:
        print(f"Could not find or fill field for '{keywords[0]}': {e}")
    return False

async def get_field_context(element, tab):
    """Extract context about a form field to help the LLM understand what it's for."""
    try:
        await element.update()
        context = {}
        
        # Get element attributes
        context['type'] = element.attrs.get('type', 'text')
        context['name'] = element.attrs.get('name', '')
        context['id'] = element.attrs.get('id', '')
        context['placeholder'] = element.attrs.get('placeholder', '')
        context['aria_label'] = element.attrs.get('aria-label', '')
        context['required'] = element.attrs.get('required', False)
        context['tag'] = element.tag_name
        
        # Try to find associated label
        label_text = ""
        if context['id']:
            try:
                label = await tab.select(f"label[for='{context['id']}']", timeout=1)
                if label:
                    await label.update()
                    label_text = label.text.strip()
            except:
                pass
        
        # Look for nearby text (labels, headings, etc.)
        if not label_text:
            try:
                # Get surrounding context using JavaScript
                surrounding_text = await tab.evaluate(f"""
                const element = document.querySelector('[name="{context["name"]}"], [id="{context["id"]}"]');
                if (element) {{
                    let text = '';
                    // Check parent elements for text
                    let parent = element.parentElement;
                    while (parent && text.length < 100) {{
                        const textNodes = Array.from(parent.childNodes)
                            .filter(node => node.nodeType === 3)
                            .map(node => node.textContent.trim())
                            .filter(text => text.length > 0);
                        if (textNodes.length > 0) {{
                            text = textNodes.join(' ');
                            break;
                        }}
                        parent = parent.parentElement;
                    }}
                    return text;
                }}
                return '';
                """)
                label_text = surrounding_text.strip()
            except:
                pass
        
        context['label'] = label_text
        context['question'] = label_text or context['placeholder'] or context['aria_label'] or context['name']
        
        return context
    except Exception as e:
        print(f"Error getting field context: {e}")
        return {}

async def analyze_and_fill_all_form_elements(tab, llm, user_data):
    """Simple and reliable form filling approach."""
    print("=== SIMPLE FORM FILLING ===")
    
    try:
        # Wait for form to be ready
        await tab.sleep(2)
        
        # Define simple field mappings with multiple selector strategies
        field_mappings = [
            {
                'name': 'first_name',
                'selectors': ['input[name*="first"]', 'input[placeholder*="first"]', 'input[id*="first"]'],
                'value': user_data.first_name
            },
            {
                'name': 'last_name', 
                'selectors': ['input[name*="last"]', 'input[placeholder*="last"]', 'input[id*="last"]'],
                'value': user_data.last_name
            },
            {
                'name': 'email',
                'selectors': ['input[type="email"]', 'input[name*="email"]', 'input[placeholder*="email"]'],
                'value': user_data.email
            },
            {
                'name': 'phone',
                'selectors': ['input[type="tel"]', 'input[name*="phone"]', 'input[placeholder*="phone"]'],
                'value': user_data.phone
            },
            {
                'name': 'address',
                'selectors': ['input[name*="address"]', 'input[placeholder*="address"]', 'textarea[name*="address"]'],
                'value': user_data.address or "Tampa, FL"
            },
            {
                'name': 'cover_letter',
                'selectors': ['textarea[name*="cover"]', 'textarea[placeholder*="cover"]', 'textarea[name*="letter"]'],
                'value': "I am excited to apply for this position and believe my skills and experience make me a strong candidate. I look forward to discussing how I can contribute to your team."
            }
        ]
        
        filled_count = 0
        
        for field_info in field_mappings:
            if not field_info['value']:
                print(f"Skipping {field_info['name']} - no value provided")
                continue
                
            element_found = False
            
            for selector in field_info['selectors']:
                try:
                    print(f"Trying to find {field_info['name']} with selector: {selector}")
                    
                    # Try to find the element
                    element = await tab.select(selector, timeout=2)
                    if element:
                        # Check if element is actually visible and interactable
                        is_visible = await tab.evaluate(f"""
                        (function() {{
                            const el = document.querySelector('{selector}');
                            if (!el) return false;
                            
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            
                            return rect.width > 0 && rect.height > 0 && 
                                   style.display !== 'none' && 
                                   style.visibility !== 'hidden' &&
                                   !el.disabled && !el.readOnly;
                        }})();
                        """)
                        
                        if is_visible:
                            print(f"✅ Found visible {field_info['name']} field")
                            
                            # Fill the field
                            try:
                                await element.mouse_move()
                                await asyncio.sleep(0.3)
                                await element.click()
                                await asyncio.sleep(0.3)
                                
                                # Clear the field completely using only JavaScript (no keyboard shortcuts)
                                print(f"Clearing {field_info['name']} field...")
                                
                                # Method 1: Select all and delete using JavaScript
                                unique_var_id = f"elem_{abs(hash(selector)) % 1000000}"  # Ensure positive number
                                await tab.evaluate(f"""
                                (function() {{
                                    const {unique_var_id} = document.querySelector('{selector}');
                                    if ({unique_var_id}) {{
                                        {unique_var_id}.focus();
                                        {unique_var_id}.select();
                                        {unique_var_id}.value = '';
                                        // Trigger input events to notify the form
                                        {unique_var_id}.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                        {unique_var_id}.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                    }}
                                }})();
                                """)
                                await asyncio.sleep(0.3)
                                
                                # Verify field is empty and do additional clearing if needed
                                current_value = await tab.evaluate(f"""
                                (function() {{
                                    const checkEl = document.querySelector('{selector}');
                                    return checkEl ? checkEl.value : '';
                                }})();
                                """)
                                
                                if current_value:
                                    print(f"Field still contains: '{current_value}' - trying aggressive clear...")
                                    # Final aggressive clear with different variable name
                                    clear_var_id = f"clearElem_{abs(hash(selector + 'clear')) % 1000000}"
                                    await tab.evaluate(f"""
                                    (function() {{
                                        const {clear_var_id} = document.querySelector('{selector}');
                                        if ({clear_var_id}) {{
                                            {clear_var_id}.value = '';
                                            {clear_var_id}.textContent = '';
                                            {clear_var_id}.innerHTML = '';
                                            {clear_var_id}.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                            {clear_var_id}.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                        }}
                                    }})();
                                    """)
                                    await asyncio.sleep(0.2)
                                
                                # Type the value
                                print(f"Typing value: {str(field_info['value'])}")
                                await element.send_keys(str(field_info['value']))
                                await asyncio.sleep(0.5)
                                
                                print(f"✅ Successfully filled {field_info['name']}")
                                filled_count += 1
                                element_found = True
                                break
                                
                            except Exception as fill_error:
                                print(f"❌ Error filling {field_info['name']}: {fill_error}")
                                continue
                        else:
                            print(f"Element found but not visible for {field_info['name']}")
                            
                except Exception as e:
                    print(f"Selector '{selector}' failed for {field_info['name']}: {e}")
                    continue
            
            if not element_found:
                print(f"❌ Could not find {field_info['name']} field")
        
        print(f"✅ Successfully filled {filled_count} out of {len([f for f in field_mappings if f['value']])} fields")
        
        if filled_count == 0:
            print("⚠️  No fields were filled - trying fallback approach...")
            await simple_form_fill_fallback(tab, user_data)
            
    except Exception as e:
        print(f"Error in form filling: {e}")
        import traceback
        traceback.print_exc()
        
        # Try fallback
        try:
            await simple_form_fill_fallback(tab, user_data)
        except Exception as fallback_error:
            print(f"Fallback also failed: {fallback_error}")

async def fill_additional_form_elements_nodriver(tab, user_data):
    """Fill additional form elements like salary and yes/no questions using nodriver directly."""
    print("=== DIRECT NODRIVER ADDITIONAL FORM FILLING ===")
    
    try:
        # Wait for page to be ready
        await tab.sleep(2)
        
        # 1. Look for salary fields using simple text matching
        print("🔍 Looking for salary fields...")
        try:
            # Use nodriver's find method to look for salary-related text
            salary_element = await tab.find("salary", timeout=3)
            if salary_element:
                print("✅ Found 'salary' text on page, filling with 60,000")
                await salary_element.mouse_move()
                await asyncio.sleep(0.3)
                await salary_element.click()
                await asyncio.sleep(0.3)
                await salary_element.send_keys("60,000")
                await asyncio.sleep(0.5)
                print("✅ Successfully filled salary field")
        except Exception as e:
            print(f"No salary field found with text search: {e}")
        
        # 2. Look for Yes buttons using simple text matching
        print("🔍 Looking for Yes buttons...")
        try:
            # Use nodriver's find method to look for "Yes" text
            yes_element = await tab.find("Yes", timeout=3)
            if yes_element:
                print("✅ Found 'Yes' button, clicking it")
                await yes_element.mouse_move()
                await asyncio.sleep(0.3)
                await yes_element.click()
                await asyncio.sleep(0.5)
                print("✅ Successfully clicked Yes button")
        except Exception as e:
            print(f"No Yes button found with text search: {e}")
            
        # 3. Alternative: Look for YES in uppercase
        try:
            yes_element_upper = await tab.find("YES", timeout=2)
            if yes_element_upper:
                print("✅ Found 'YES' button, clicking it")
                await yes_element_upper.mouse_move()
                await asyncio.sleep(0.3)
                await yes_element_upper.click()
                await asyncio.sleep(0.5)
                print("✅ Successfully clicked YES button")
        except Exception as e:
            print(f"No YES button found: {e}")
        
        print("✅ Completed simple form element filling")
        
    except Exception as e:
        print(f"Error in additional form filling: {e}")
        import traceback
        traceback.print_exc()

async def simple_form_fill_fallback(tab, user_data):
    """Simple fallback form filling using basic field detection."""
    print("=== SIMPLE FALLBACK FORM FILLING ===")
    
    # Try to fill common fields using simple selectors
    field_mappings = [
        (['input[name*="first"]', 'input[placeholder*="first"]'], user_data.first_name),
        (['input[name*="last"]', 'input[placeholder*="last"]'], user_data.last_name),
        (['input[type="email"]', 'input[name*="email"]'], user_data.email),
        (['input[type="tel"]', 'input[name*="phone"]'], user_data.phone),
        (['input[name*="address"]', 'input[placeholder*="address"]', 'textarea[name*="address"]'], user_data.address or "Tampa, FL"),
        (['textarea[name*="cover"]', 'textarea[placeholder*="cover"]'], "I am excited to apply for this position and believe my skills and experience make me a strong candidate."),
    ]
    
    for selectors, value in field_mappings:
        if not value:
            continue
            
        for selector in selectors:
            try:
                element = await tab.select(selector, timeout=2)
                if element:
                    print(f"Filling field with selector '{selector}': {value[:30]}...")
                    await element.click()
                    await asyncio.sleep(0.2)
                    
                    # Clear field with unique variable name to avoid conflicts
                    fallback_var_id = f"fallbackElem_{abs(hash(selector)) % 1000000}"
                    await tab.evaluate(f"""
                    (function() {{
                        const {fallback_var_id} = document.querySelector('{selector}');
                        if ({fallback_var_id}) {{
                            {fallback_var_id}.focus();
                            {fallback_var_id}.select();
                            {fallback_var_id}.value = '';
                            // Trigger events to notify the form
                            {fallback_var_id}.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            {fallback_var_id}.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }})();
                    """)
                    await asyncio.sleep(0.2)
                    
                    # For address fields that might be pre-filled, do additional clearing
                    if 'address' in selector.lower():
                        print("Detected address field - doing thorough clear...")
                        # Use additional JavaScript clearing for stubborn pre-filled fields
                        await element.click()
                        await asyncio.sleep(0.1)
                        
                        # Additional aggressive clearing for address fields
                        addr_clear_var = f"addrClear_{abs(hash(selector + 'addr')) % 1000000}"
                        await tab.evaluate(f"""
                        (function() {{
                            const {addr_clear_var} = document.querySelector('{selector}');
                            if ({addr_clear_var}) {{
                                {addr_clear_var}.focus();
                                {addr_clear_var}.select();
                                {addr_clear_var}.value = '';
                                {addr_clear_var}.textContent = '';
                                {addr_clear_var}.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                {addr_clear_var}.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            }}
                        }})();
                        """)
                        await asyncio.sleep(0.2)
                    
                    await element.send_keys(str(value))
                    await asyncio.sleep(0.3)
                    print(f"✅ Successfully filled field with selector '{selector}'")
                    break
            except Exception as e:
                print(f"Failed to fill field with selector '{selector}': {e}")
                continue

async def intelligent_form_completion(tab, llm, user_data, task_id):
    """Use browser_use to handle complex form elements via CDP connection to existing nodriver session."""
    print("=== INTELLIGENT FORM COMPLETION WITH BROWSER_USE CDP ===")
    
    try:
        # Get the debug port from the existing nodriver session
        debug_port = await get_active_debug_port()
        
        if not debug_port:
            print("⚠️  Could not find debug port, skipping intelligent form completion")
            return
        
        print(f"🔗 Connecting browser_use to existing nodriver session on port {debug_port}")
        
        # Get current page URL to ensure we stay on the same page
        current_url = await tab.evaluate("window.location.href")
        print(f"📍 Current page URL: {current_url}")
        
        # Create user data summary for the agent
        user_summary = f"""
        User Information:
        - Name: {user_data.first_name} {user_data.last_name}
        - Email: {user_data.email}
        - Phone: {user_data.phone}
        - Address: {user_data.address or 'Tampa, FL'}
        - LinkedIn: {user_data.linkedin or 'Not provided'}
        - GitHub: {user_data.github or 'Not provided'}
        - Portfolio: {user_data.portfolio or 'Not provided'}
        
        Professional Profile:
        - Experienced software developer
        - Skills: TypeScript, React, Python, AI/ML, Full-stack development
        - Looking for: Remote or Tampa, FL area positions
        - Salary expectations: $60,000 USD annually
        - Availability: Immediately available
        - Work authorization: Authorized to work in the US
        - Relocation: No relocation required for remote positions
        - Experience level: Mid-level (3-5 years)
        """
        
        # Create the task for browser_use agent
        agent_task = f"""
        You are completing a job application form. The basic text fields (name, email, phone, address) have already been filled out by a previous system.
        
        Your task is to:
        1. Look at the current form and identify any remaining unfilled interactive elements such as:
           - Yes/No questions (radio buttons)
           - Dropdown menus/select boxes
           - Checkboxes that need to be selected
           - Salary expectation fields
           - Experience level selections
           - Work authorization questions
           - Availability questions
           - Any other interactive form elements that appear unfilled or require selection
        
        2. Answer these questions appropriately using this user information:
        {user_summary}
        
        3. Guidelines for answering:
           - For salary questions: Use "$60,000" or select "Competitive" if available
           - For work authorization: Select "Yes" - authorized to work in US
           - For experience level: Select "Mid-level" or "3-5 years" if available
           - For availability: Select "Immediately" or "2 weeks notice"
           - For remote work: Select "Yes" if asked about remote work preference
           - For relocation: Select "No" for relocation questions
           - For yes/no questions about skills: Be honest but positive
           - For dropdown selections: Choose the most appropriate option based on user profile
        
        4. IMPORTANT RESTRICTIONS:
           - DO NOT submit the form (leave that for the final verification step)
           - DO NOT modify text fields that are already filled (name, email, phone, address)
           - DO NOT interact with file upload fields (resume upload is handled separately)
           - DO NOT click submit buttons
        
        5. When all interactive elements are properly answered, consider the task complete.
        
        Act like a human user - take time to read questions, scroll through the form if needed, and make thoughtful selections.
        """
        
        # Import browser_use components
        from browser_use import Agent
        from browser_use.browser import BrowserSession
        
        # Create browser session that connects to existing nodriver browser via CDP
        print("🔧 Creating browser_use session with CDP connection...")
        
        # Create browser profile to maintain consistent viewport
        from browser_use.browser import BrowserProfile
        browser_profile = BrowserProfile(
            viewport_expansion=0,  # Don't expand viewport
            headless=False,
            keep_alive=True,
            disable_security=False,
            deterministic_rendering=False,
            device_scale_factor=1.0,
            is_mobile=False,
            # Set explicit viewport size to match nodriver
            extra_chromium_args=[
                "--window-size=1280,720",
                "--start-maximized"
            ]
        )
        
        browser_session = BrowserSession(
            cdp_url=f"http://127.0.0.1:{debug_port}",
            keep_alive=True,  # Don't close the browser when done
            browser_profile=browser_profile
        )
        
        # Start the browser session (this will connect to the existing browser)
        print(f"🔌 Attempting to connect to CDP at: http://127.0.0.1:{debug_port}")
        await browser_session.start()
        print("✅ Successfully connected to existing browser session via CDP")
        
        # Set viewport size to match nodriver configuration
        try:
            page = await browser_session.get_current_page()
            await page.set_viewport_size(width=1280, height=720)
            print("📐 Set browser_use viewport to 1920x1080 to match nodriver")
        except Exception as viewport_error:
            print(f"⚠️  Could not set viewport size: {viewport_error}")
        
        # Verify the connection
        if browser_session.is_connected():
            print("🔗 Browser session connection verified")
            print(f"📊 Browser session details: browser_pid={browser_session.browser_pid}, cdp_url={browser_session.cdp_url}")
        else:
            print("⚠️  Browser session connection could not be verified")
        
        # Create the browser_use agent with the same LLM that has the API key
        form_agent = Agent(
            task=agent_task,
            llm=llm,  # This already has the API key from the main function
            max_actions_per_step=2,  # Be conservative to avoid overwhelming the form
            browser_session=browser_session,
            use_vision=True,
            use_vision_for_planner=True,
            max_failures=3,
            retry_delay=5,
            enable_memory=True,
            extend_system_message='Focus on filling interactive form elements (radio buttons, dropdowns, checkboxes) that are not basic text fields. Do not submit the form or modify already-filled text fields.'
        )
        
        print("🤖 Starting intelligent form completion agent...")
        tasks[task_id].update({"status": "processing", "message": "AI agent analyzing and filling complex form elements..."})
        
        # Run the agent to complete complex form elements
        try:
            # Ensure we're on the right page
            print(f"🌐 Navigating browser_use agent to: {current_url}")
            await browser_session.navigate_to(current_url)
            await asyncio.sleep(2)
            
            print("🤖 Starting browser_use agent to handle complex form elements...")
            print(f"🎯 Agent task: {agent_task[:200]}...")
            
            # Run the agent
            result = await form_agent.run(max_steps=15)
            
            print("✅ Intelligent form completion agent finished successfully")
            print(f"📋 Agent result summary: {result}")
            
            tasks[task_id].update({"status": "processing", "message": "AI agent completed complex form elements successfully"})
            
        except Exception as agent_error:
            print(f"⚠️  Browser_use agent encountered an error: {agent_error}")
            import traceback
            traceback.print_exc()
            print("Continuing with form submission...")
            tasks[task_id].update({"status": "processing", "message": "AI agent completed with some issues, proceeding..."})
        
        finally:
            # Clean up browser_use session (but keep the browser running for nodriver)
            try:
                await browser_session.stop()
                print("🧹 Cleaned up browser_use session")
            except Exception as cleanup_error:
                print(f"⚠️  Error cleaning up browser_use session: {cleanup_error}")
        
        # Wait a moment for any form changes to settle
        await asyncio.sleep(2)
        print("🔄 Returning control to nodriver for final submission steps")
        
    except Exception as e:
        print(f"Error in intelligent form completion: {e}")
        print("Continuing with standard form submission...")
        tasks[task_id].update({"status": "processing", "message": "Proceeding with form submission..."})

async def fill_fields_with_llm_intelligence(form_fields, llm, user_data, tab):
    """Use LLM to intelligently fill each form field based on context."""
    print("=== INTELLIGENT FORM FILLING ===")
    
    # Prepare user data summary for LLM
    user_summary = f"""
    User Information:
    - Name: {user_data.first_name} {user_data.last_name}
    - Email: {user_data.email}
    - Phone: {user_data.phone}
    - LinkedIn: {user_data.linkedin or 'Not provided'}
    - GitHub: {user_data.github or 'Not provided'}
    - Portfolio: {user_data.portfolio or 'Not provided'}
    - Address: {user_data.address or 'Not provided'}
    """
    
    for field_info in form_fields:
        try:
            element = field_info['element']
            context = field_info['context']
            
            # Skip file inputs and already-filled fields
            if context['type'] in ['file', 'submit', 'button', 'hidden']:
                continue
                
            # Check if field is already filled
            try:
                current_value = await element.evaluate("this.value")
                if current_value and current_value.strip():
                    print(f"Skipping field '{context['question'][:30]}...' - already filled with: '{current_value[:20]}...'")
                    continue
            except:
                pass
            
            print(f"Analyzing field: {context['question'][:50]}...")
            
            # Create intelligent prompt for LLM
            if context['type'] in ['radio', 'checkbox']:
                # Handle radio buttons and checkboxes
                await handle_choice_field(element, context, llm, user_data, tab)
            elif context['tag'] == 'select':
                # Handle dropdown selections
                await handle_select_field(element, context, llm, user_data, tab)
            else:
                # Handle text inputs and textareas
                await handle_text_field(element, context, llm, user_data, tab)
                
            await tab.sleep(0.5)  # Brief pause between fields
            
        except Exception as e:
            print(f"Error filling field: {e}")
            continue

async def handle_text_field(element, context, llm, user_data, tab):
    """Handle text inputs and textareas with LLM intelligence."""
    try:
        # Create context-aware prompt
        field_prompt = f"""
        You are filling out a job application form. Based on the user information provided, determine the best response for this field.
        
        Field Context:
        - Field Type: {context['type']}
        - Question/Label: {context['question']}
        - Field Name: {context['name']}
        - Required: {context['required']}
        
        User Information:
        - Name: {user_data.first_name} {user_data.last_name}
        - Email: {user_data.email}
        - Phone: {user_data.phone}
        - LinkedIn: {user_data.linkedin or 'Not provided'}
        - GitHub: {user_data.github or 'Not provided'}
        - Portfolio: {user_data.portfolio or 'Not provided'}
        - Address: {user_data.address or 'Not provided'}
        
        Instructions:
        - If this is asking for basic info (name, email, phone, etc.), provide the exact user data
        - If this is a complex question (like "why do you want to work here", "tell us about yourself", etc.), provide a thoughtful, professional response
        - Keep responses concise but complete
        - Return ONLY the text to fill in the field, no explanations
        
        Response:
        """
        
        response = await llm.ainvoke(field_prompt)
        answer = response.content.strip()
        
        if answer and len(answer) > 0:
            print(f"Filling '{context['question'][:30]}...' with: '{answer[:50]}...'")
            
            # Fill the field
            await element.mouse_move()
            await asyncio.sleep(0.2)
            await element.click()
            await asyncio.sleep(0.3)
            
            # Clear any existing content more thoroughly
            await element.click()
            await asyncio.sleep(0.2)
            
            # Select all text and delete it using unique variable names
            unique_id = f"elem_{hash(str(context['name']) + str(context['id']))}"
            await tab.evaluate(f"""
            const {unique_id} = document.activeElement;
            if ({unique_id} && ({unique_id}.tagName === 'INPUT' || {unique_id}.tagName === 'TEXTAREA')) {{
                {unique_id}.select();
                {unique_id}.value = '';
            }}
            """)
            await asyncio.sleep(0.2)
            
            # Type the response
            await element.send_keys(answer)
            await asyncio.sleep(0.3)
        else:
            print(f"No response generated for field: {context['question'][:30]}...")
            
    except Exception as e:
        print(f"Error handling text field: {e}")

async def handle_choice_field(element, context, llm, user_data, tab):
    """Handle radio buttons and checkboxes with LLM intelligence."""
    try:
        # Get all related radio buttons or checkboxes
        if context['name']:
            related_elements = await tab.select_all(f"input[name='{context['name']}']")
        else:
            related_elements = [element]
        
        # Get options
        options = []
        for elem in related_elements:
            try:
                await elem.update()
                value = elem.attrs.get('value', '')
                label_text = await get_choice_label(elem, tab)
                options.append({
                    'element': elem,
                    'value': value,
                    'label': label_text
                })
            except:
                continue
        
        if not options:
            return
        
        # Create prompt for LLM to choose
        options_text = "\n".join([f"- {opt['value']}: {opt['label']}" for opt in options])
        
        choice_prompt = f"""
        You are filling out a job application form. Choose the most appropriate option for this question.
        
        Question: {context['question']}
        Field Type: {context['type']}
        
        Available Options:
        {options_text}
        
        User Information:
        - Name: {user_data.first_name} {user_data.last_name}
        - Email: {user_data.email}
        - Phone: {user_data.phone}
        - LinkedIn: {user_data.linkedin or 'Not provided'}
        
        Instructions:
        - Choose the most appropriate option based on the question and user context
        - For checkboxes, you can choose multiple options (comma-separated)
        - For radio buttons, choose exactly one option
        - Return only the value(s) of your choice, no explanations
        
        Choice:
        """
        
        response = await llm.ainvoke(choice_prompt)
        choices = [choice.strip() for choice in response.content.split(',')]
        
        # Click the chosen options
        for choice in choices:
            for option in options:
                if choice in option['value'] or choice in option['label']:
                    print(f"Selecting option: {option['value']} - {option['label']}")
                    await option['element'].mouse_move()
                    await asyncio.sleep(0.2)
                    await option['element'].click()
                    await asyncio.sleep(0.3)
                    break
                    
    except Exception as e:
        print(f"Error handling choice field: {e}")

async def handle_select_field(element, context, llm, user_data, tab):
    """Handle dropdown selections with LLM intelligence."""
    try:
        # Get all options from the select element
        options = await tab.select_all(f"select[name='{context['name']}'] option")
        if not options:
            return
        
        option_texts = []
        for option in options:
            try:
                await option.update()
                value = option.attrs.get('value', '')
                text = option.text.strip()
                if text and text.lower() not in ['select', 'choose', 'pick']:
                    option_texts.append(f"- {value}: {text}")
            except:
                continue
        
        if not option_texts:
            return
        
        options_text = "\n".join(option_texts)
        
        select_prompt = f"""
        You are filling out a job application form. Choose the most appropriate option from this dropdown.
        
        Question: {context['question']}
        
        Available Options:
        {options_text}
        
        User Information:
        - Name: {user_data.first_name} {user_data.last_name}
        - Email: {user_data.email}
        - Address: {user_data.address or 'Not provided'}
        
        Instructions:
        - Choose the most appropriate option based on the question and user context
        - Return only the value of your choice, no explanations
        
        Choice:
        """
        
        response = await llm.ainvoke(select_prompt)
        choice = response.content.strip()
        
        # Select the chosen option
        for option in options:
            try:
                await option.update()
                if choice in option.attrs.get('value', '') or choice in option.text:
                    print(f"Selecting dropdown option: {choice}")
                    await option.select_option()
                    break
            except:
                continue
                
    except Exception as e:
        print(f"Error handling select field: {e}")

async def get_choice_label(element, tab):
    """Get the label text for a radio button or checkbox."""
    try:
        await element.update()
        element_id = element.attrs.get('id', '')
        
        if element_id:
            try:
                label = await tab.select(f"label[for='{element_id}']", timeout=1)
                if label:
                    await label.update()
                    return label.text.strip()
            except:
                pass
        
        # Try to find nearby text
        nearby_text = await tab.evaluate(f"""
        const element = document.querySelector('[id="{element_id}"]') || 
                       document.querySelector('[value="{element.attrs.get("value", "")}"]');
        if (element) {{
            const parent = element.parentElement;
            return parent ? parent.textContent.trim() : '';
        }}
        return '';
        """)
        
        return nearby_text.strip()
    except:
        return ""

# Removed unused debug functions - focusing on core functionality

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

# Removed LLM navigation function - using native nodriver methods only

async def get_llm_response(llm, prompt_text: str, user_data: UserData):
    """Generates a response from the LLM for a given prompt."""
    print(f"Asking LLM for: {prompt_text}")
    full_prompt = (
        f"Based on the following user data, please answer the job application question concisely and professionally.\n"
        f"User Data:\n{user_data.model_dump_json(indent=2)}\n\n"
        f"Question: {prompt_text}\n\n"
        f"Answer:"
    )
    try:
        response = await llm.ainvoke(full_prompt)
        return response.content
    except Exception as e:
        print(f"LLM generation failed: {e}")
        return "Experienced and motivated professional seeking a challenging role." # Fallback answer

async def process_hybrid_apply(task_id: str, job_url: str, api_key: str, user_data: UserData, resume_file: UploadFile | None, file_url: str | None):
    """The main background task for the hybrid auto-apply process."""
    tasks[task_id] = {"status": "starting", "message": "Starting hybrid auto-apply process."}
    browser = None
    temp_file_path = None
    
    try:
        # --- Setup Browser ---
        tasks[task_id].update({"status": "processing", "message": "Initializing browser..."})
        llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash', api_key=api_key) # For text responses only
        browser = await uc.start(
            headless=False,
            browser_args=[
                '--no-sandbox', 
                '--window-size=1920,1080',
                '--start-maximized',
                '--remote-debugging-port=9223',
                '--disable-features=SameSiteByDefaultCookies',  # Allow third-party cookies for Turnstile
                '--disable-blink-features=AutomationControlled',  # Hide automation
                '--disable-web-security',  # Disable web security for iframe access
                '--disable-features=VizDisplayCompositor',  # Improve rendering
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        )
        tab = await browser.get(job_url)
        print(f"Navigated to: {job_url}")
        
        # Wait for page to fully load and stabilize
        print("⏳ Waiting for page to fully load...")
        await tab.sleep(3)
        
        # Wait for any dynamic content to load
        try:
            await tab.wait_for('Page.loadEventFired', timeout=10)
            print("✅ Page load event detected")
        except:
            print("⚠️  Page load event timeout, continuing...")
        
        await tab.sleep(2) # Additional wait for dynamic content

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
                    await tab.sleep(3)
                    
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
                        await tab.sleep(3)
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
        
        # Process the resume, whether it's a direct upload or a URL
        if resume_file:
            # Save uploaded file to a temporary path
            suffix = os.path.splitext(resume_file.filename)[-1]
            async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await resume_file.read()
                await tmp.write(content)
                temp_file_path = tmp.name
        elif file_url:
            # Handle file_url: support both HTTP(S) and data URLs
            if file_url.startswith('data:'):
                try:
                    match = re.match(r'data:(?P<mime>[^;]+);filename=(?P<filename>[^;]+);base64,(?P<data>.+)', file_url)
                    filename = match.group('filename')
                    suffix = os.path.splitext(filename)[-1]
                    file_data = base64.b64decode(match.group('data'))
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp.write(file_data)
                        temp_file_path = tmp.name
                except Exception as e:
                    print(f"Failed to parse data URL: {e}")
            else:
                # Download file from HTTP(S) URL
                async with httpx.AsyncClient() as client:
                    response = await client.get(file_url)
                    response.raise_for_status()
                    suffix = os.path.splitext(file_url)[-1]
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp.write(response.content)
                        temp_file_path = tmp.name

        if temp_file_path:
            # Find the file input on the page and upload
            file_input = await tab.select('input[type=file]', timeout=5)
            if file_input:
                print(f"Found file input. Uploading resume from {temp_file_path}...")
                # CORRECTED: Use send_file method for elements
                await file_input.send_file(temp_file_path)
                await tab.sleep(1)
            else:
                print("Could not find a file input for the resume.")

        # --- SIMPLE FORM FILLING ---
        tasks[task_id].update({"status": "processing", "message": "Filling out basic form fields..."})
        await analyze_and_fill_all_form_elements(tab, llm, user_data)
        
        # --- INTELLIGENT FORM COMPLETION WITH BROWSER_USE ---
        # COMMENTED OUT FOR TESTING - Check if browser_use is causing Cloudflare issues
        # tasks[task_id].update({"status": "processing", "message": "Analyzing complex form elements with AI agent..."})
        # await intelligent_form_completion(tab, llm, user_data, task_id)
        
        # --- DIRECT NODRIVER FORM COMPLETION FOR TESTING ---
        tasks[task_id].update({"status": "processing", "message": "Filling additional form elements with nodriver..."})
        await fill_additional_form_elements_nodriver(tab, user_data)

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
                cf_solved = await solve_verification_visually(tab, llm)
                if cf_solved:
                    print("✅ Verification challenge solved visually.")
                else:
                    print("⚠️  Verification challenge could not be solved visually.")
            except Exception as e:
                print(f"Error during visual verification: {e}")

        # --- VERIFY SUBMISSION SUCCESS ---
        await tab.sleep(3)  # Wait for any final redirects
        
        try:
            print("Checking for submission confirmation...")
            
            # Check for success indicators
            success_check = await tab.evaluate("""
            (function() {
                const bodyText = document.body.textContent.toLowerCase();
                console.log('Current page text sample:', bodyText.substring(0, 500));
                
                // Look for success indicators
                const successIndicators = [
                    'success', 'verified', 'complete', 'passed', 'submitted',
                    'thank you', 'application received', 'application submitted'
                ];
                
                const hasSuccess = successIndicators.some(indicator => 
                    bodyText.includes(indicator)
                );
                
                // Look for failure indicators
                const failureIndicators = [
                    'verify you are human', 'security check', 'not a robot', 
                    'please verify', 'complete the verification', 'prove you are human',
                    'verification required', 'challenge', 'captcha'
                ];
                
                const hasFailure = failureIndicators.some(indicator => 
                    bodyText.includes(indicator)
                );
                
                // Check if verification elements disappeared
                const cfIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
                const turnstileIframe = document.querySelector('iframe[src*="turnstile"]');
                const verifyText = bodyText.includes('verify you are human');
                const challengeText = bodyText.includes('security check');
                const robotText = bodyText.includes('not a robot');
                
                const verificationGone = !cfIframe && !turnstileIframe && !verifyText && !challengeText && !robotText;
                
                // Check for checkboxes that might be checked now
                const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
                let hasCheckedBox = false;
                let checkedBoxCount = 0;
                checkboxes.forEach(checkbox => {
                    if (checkbox.checked || checkbox.getAttribute('aria-checked') === 'true') {
                        hasCheckedBox = true;
                        checkedBoxCount++;
                        console.log('Found checked verification checkbox:', {
                            id: checkbox.id,
                            className: checkbox.className,
                            type: checkbox.type,
                            checked: checkbox.checked
                        });
                    }
                });
                
                // Look for loading or processing indicators
                const loadingIndicators = document.querySelectorAll('.loading, .spinner, [role="progressbar"], .cf-loading');
                const isLoading = loadingIndicators.length > 0;
                
                const result = {
                    hasSuccess: hasSuccess,
                    hasFailure: hasFailure,
                    verificationGone: verificationGone,
                    hasCheckedBox: hasCheckedBox,
                    checkedBoxCount: checkedBoxCount,
                    cfIframe: !!cfIframe,
                    turnstileIframe: !!turnstileIframe,
                    verifyText: verifyText,
                    challengeText: challengeText,
                    robotText: robotText,
                    isLoading: isLoading,
                    totalCheckboxes: checkboxes.length
                };
                
                console.log('Verification check result:', result);
                
                // Only consider it successful if we have clear success indicators
                // and no failure indicators
                const isSuccessful = (hasSuccess || (verificationGone && !hasFailure)) && !isLoading;
                
                return {
                    success: isSuccessful,
                    details: result
                };
            })();
            """)
            
            print(f"Verification success check result: {success_check}")
            
            if success_check['success']:
                print("✅ Application appears to have been submitted successfully!")
                tasks[task_id].update({"status": "completed", "message": "Application submitted successfully! Confirmation detected."})
            else:
                print("⚠️  Could not confirm successful submission - please check manually")
                tasks[task_id].update({"status": "completed", "message": "Application submitted but confirmation unclear - please verify manually."})
                
        except Exception as e:
            print(f"Error checking submission status: {e}")
            tasks[task_id].update({"status": "completed", "message": "Application submitted! Please check for any final confirmations."})

        print("--- Application Process Complete ---")
        print("Application has been submitted. Keeping browser open for 30 seconds to see results...")
        await asyncio.sleep(30)

    except Exception as e:
        error_message = f"An error occurred: {e}"
        print(error_message)
        tasks[task_id].update({"status": "failed", "message": error_message})
    finally:
        if browser:
            browser.stop()
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

async def parse_prompt_to_user_data(llm: ChatGoogleGenerativeAI, prompt: str) -> UserData:
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
        response = await llm.ainvoke(parsing_prompt)
        # Clean the response to ensure it's valid JSON
        json_string = response.content.strip().replace("```json", "").replace("```", "")
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
    llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash', api_key=api_key)
    
    # Use the LLM to parse the unstructured prompt into structured data
    user_data_model = await parse_prompt_to_user_data(llm, prompt)

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
async def solve_verification_visually(tab, llm):
    """Use LLM to analyze screenshots and Playwright to click verification popups."""

    # 1) try nodriver template matching first (fastest)
    try:
        if await tab.verify_cf():
            print("✅ nodriver verify_cf succeeded")
            return True
    except Exception as e:
        print(f"nodriver verify_cf failed: {e}")

    # 2) LLM + Playwright approach
    try:
        print("🎭 Using LLM + Playwright for verification popup detection...")
        playwright_success = await llm_playwright_verification(tab, llm)
        if playwright_success:
            return True
    except Exception as e:
        print(f"LLM + Playwright verification failed: {e}")

    return False

async def get_active_debug_port():
    """Find the active Chrome debug port by checking running processes."""
    try:
        import psutil
        import re
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] and 'chrome' in proc.info['name'].lower():
                    cmdline = ' '.join(proc.info['cmdline'] or [])
                    if '--remote-debugging-port=' in cmdline:
                        port_match = re.search(r'--remote-debugging-port=(\d+)', cmdline)
                        if port_match:
                            port = int(port_match.group(1))
                            # Test if port is actually listening
                            import socket
                            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            result = sock.connect_ex(('127.0.0.1', port))
                            sock.close()
                            if result == 0:  # Port is open
                                print(f"Found active Chrome debug port: {port}")
                                return port
            except:
                continue
    except ImportError:
        print("psutil not available for port detection")
    except Exception as e:
        print(f"Error detecting debug port: {e}")
    
    return None

async def limited_container_clicking(page, tab):
    """Limited container-based clicking to avoid spam detection."""
    try:
        # Find Turnstile containers
        iframe_info = await tab.evaluate("""
        (function() {
            const turnstileContainers = document.querySelectorAll('[id*="turnstile"], [class*="turnstile"], [data-turnstile], [data-cf-turnstile]');
            const containers = [];
            
            turnstileContainers.forEach((container, index) => {
                const rect = container.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    containers.push({
                        type: 'turnstile-container',
                        index: index,
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        id: container.id,
                        className: container.className,
                        tagName: container.tagName
                    });
                }
            });
            
            return { containers: containers };
        })();
        """)
        
        if iframe_info['containers'] and len(iframe_info['containers']) > 0:
            container = iframe_info['containers'][0]  # Use first container
            print(f"🎯 Found Turnstile container: {container['tagName']} id='{container['id']}'")
            
            # Try only 5 strategic positions to avoid spam detection
            container_center_y = container['y'] + container['height'] // 2
            
            strategic_positions = [
                (container['x'] + 20, container_center_y, "Left-20"),
                (container['x'] + 30, container_center_y, "Left-30"), 
                (container['x'] + 40, container_center_y, "Left-40"),
                (container['x'] + 25, container_center_y - 5, "Left-25-Up"),
                (container['x'] + 25, container_center_y + 5, "Left-25-Down")
            ]
            
            for i, (x, y, position_name) in enumerate(strategic_positions):
                print(f"🎯 Strategic click {i+1}: {position_name} at ({x:.0f}, {y:.0f})")
                
                # Add visual marker
                await tab.evaluate(f"""
                (function() {{
                    const marker = document.createElement('div');
                    marker.style.position = 'fixed';
                    marker.style.left = '{x - 8}px';
                    marker.style.top = '{y - 8}px';
                    marker.style.width = '16px';
                    marker.style.height = '16px';
                    marker.style.backgroundColor = 'orange';
                    marker.style.border = '2px solid red';
                    marker.style.borderRadius = '50%';
                    marker.style.zIndex = '999999';
                    marker.style.pointerEvents = 'none';
                    marker.style.boxShadow = '0 0 10px rgba(255,165,0,0.8)';
                    document.body.appendChild(marker);
                    
                    setTimeout(() => {{
                        if (marker.parentNode) {{
                            marker.parentNode.removeChild(marker);
                        }}
                    }}, 2000);
                }})();
                """)
                
                await asyncio.sleep(0.5)
                await page.mouse.click(x, y)
                await asyncio.sleep(1.5)  # Longer delay between attempts
                
                # Check for token after each click
                try:
                    token_input = await page.wait_for_selector(
                        'input[name="cf-turnstile-response"][value]:not([value=""])',
                        timeout=3000
                    )
                    if token_input:
                        token = await token_input.get_attribute("value")
                        if token and len(token) > 10:
                            print(f"✅ Strategic click {i+1} succeeded! Token received ({len(token)} chars)")
                            return True
                except:
                    pass  # Continue to next position
            
            print("⚠️ All strategic positions tried, no token received")
            return False
        else:
            print("⚠️ No Turnstile containers found for strategic clicking")
            return False
            
    except Exception as e:
        print(f"❌ Error in limited container clicking: {e}")
        return False

async def llm_playwright_verification(tab, llm):
    """Use LLM to analyze screenshot and get coordinates, then Playwright to click."""
    playwright = None
    browser = None
    page = None
    
    try:
        # Find the active debug port
        debug_port = await get_active_debug_port()
        
        if not debug_port:
            print("❌ Could not find Chrome debug port")
            return False
        
        print(f"📸 Taking screenshot with nodriver...")
        
        # Take screenshot using nodriver's save_screenshot method
        screenshot_path = f"/tmp/verification_screenshot_{uuid.uuid4().hex}.png"
        await tab.save_screenshot(screenshot_path)
        
        # Get image dimensions using PIL
        from PIL import Image
        with Image.open(screenshot_path) as img:
            image_width, image_height = img.size
        print(f"📐 Screenshot dimensions: {image_width}x{image_height}")
        
        # Read the screenshot file and convert to base64
        with open(screenshot_path, 'rb') as f:
            screenshot_bytes = f.read()
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        
        # Clean up the temporary file
        os.remove(screenshot_path)
        
        print("🤖 Asking LLM to analyze verification popup...")
        
        # Create LLM prompt for verification detection
        verification_prompt = f"""
        You are an expert at analyzing web page screenshots to find verification challenges like Cloudflare, Turnstile, reCAPTCHA, or hCaptcha.

        IMAGE INFORMATION:
        - Screenshot dimensions: {image_width} x {image_height} pixels
        - You are analyzing the FULL PAGE screenshot

        TASK:
        1. Find any verification popup, checkbox, or challenge that needs to be clicked
        2. CRITICAL: Look for the actual CHECKBOX or clickable element, not just text
        3. Provide exact pixel coordinates (x, y) of the CENTER of the clickable element
        4. Focus on small interactive elements that need to be clicked

        SPECIFIC CLOUDFLARE TURNSTILE DETECTION:
        - Look for a small square checkbox (typically 16x16 to 24x24 pixels)
        - Usually positioned to the LEFT of "Verify you are human" text
        - Has a subtle border or background that makes it stand out
        - Often has the Cloudflare logo nearby
        - The checkbox itself is the clickable area, NOT the text

        COORDINATE PRECISION:
        - Provide coordinates for the CENTER of the checkbox
        - If you see a checkbox at the left edge of verification text, the checkbox center is typically 10-15 pixels to the left of the text
        - Be very precise - a few pixels off means missing the target

        VISUAL CLUES:
        - Checkboxes have borders, backgrounds, or subtle visual differences
        - Look for small square or rectangular elements that appear interactive
        - The clickable area is much smaller than the entire verification widget

        Respond in this exact JSON format:
        {{
            "found_verification": true/false,
            "verification_type": "description of what you found",
            "click_coordinates": {{"x": 123, "y": 456}},
            "confidence": "high/medium/low",
            "element_description": "describe the visual appearance and exact location of the clickable element",
            "checkbox_size_estimate": "estimated width x height in pixels"
        }}

        If no verification is found, set found_verification to false.
        """
        
        # Send image to LLM
        message = HumanMessage(
            content=[
                {"type": "text", "text": verification_prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{screenshot_base64}"}
                }
            ]
        )
        
        response = await llm.ainvoke([message])
        print(f"🤖 LLM Response: {response.content}")
        
        # Parse LLM response
        try:
            # Clean the response to extract JSON
            response_text = response.content.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            analysis = json.loads(response_text)
            
            if analysis.get("found_verification", False):
                coords = analysis.get("click_coordinates", {})
                verification_type = analysis.get("verification_type", "unknown")
                confidence = analysis.get("confidence", "unknown")
                
                print(f"🎯 LLM found {verification_type} (confidence: {confidence})")
                print(f"🎯 Click coordinates: x={coords.get('x')}, y={coords.get('y')}")
                
                if coords.get('x') and coords.get('y'):
                    # Connect Playwright to nodriver session
                    print(f"🎭 Connecting Playwright to debug port {debug_port}...")
                    playwright = await async_playwright().start()
                    browser = await playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{debug_port}")
                    
                    # Get the active page
                    contexts = browser.contexts
                    if contexts:
                        context = contexts[0]
                        pages = context.pages
                        if pages:
                            page = pages[-1]  # Get the most recent page
                            print("✅ Successfully connected Playwright to nodriver session")
                            
                            print("🎭 Using Playwright to click verification element...")
                            
                            # VISUAL DEBUGGING: Create debug directory and take screenshot before clicking
                            import datetime
                            debug_timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                            debug_dir = f"/tmp/verification_debug_{debug_timestamp}"
                            os.makedirs(debug_dir, exist_ok=True)
                            
                            pre_click_screenshot = f"{debug_dir}/01_pre_click.png"
                            await tab.save_screenshot(pre_click_screenshot)
                            print(f"📸 Pre-click screenshot saved: {pre_click_screenshot}")
                            
                            # VISUAL DEBUGGING: Add a visual marker at click coordinates using JavaScript
                            print(f"🎯 Adding visual marker at coordinates ({coords['x']}, {coords['y']})")
                            element_info = await tab.evaluate(f"""
                            (function() {{
                                // Create a red dot marker
                                const marker = document.createElement('div');
                                marker.id = 'debug-click-marker';
                                marker.style.position = 'fixed';
                                marker.style.left = '{coords['x'] - 10}px';
                                marker.style.top = '{coords['y'] - 10}px';
                                marker.style.width = '20px';
                                marker.style.height = '20px';
                                marker.style.backgroundColor = 'red';
                                marker.style.borderRadius = '50%';
                                marker.style.zIndex = '999999';
                                marker.style.border = '3px solid yellow';
                                marker.style.pointerEvents = 'none';
                                document.body.appendChild(marker);
                                
                                // Log what element is at these coordinates
                                const elementAtCoords = document.elementFromPoint({coords['x']}, {coords['y']});
                                console.log('Element at click coordinates:', elementAtCoords);
                                console.log('Element HTML:', elementAtCoords ? elementAtCoords.outerHTML : 'null');
                                
                                return {{
                                    elementTag: elementAtCoords ? elementAtCoords.tagName : 'null',
                                    elementClass: elementAtCoords ? elementAtCoords.className : 'null',
                                    elementId: elementAtCoords ? elementAtCoords.id : 'null',
                                    elementHTML: elementAtCoords ? elementAtCoords.outerHTML.substring(0, 200) : 'null'
                                }};
                            }})();
                            """)
                            
                            # Print element information
                            print(f"🔍 Element at click coordinates:")
                            print(f"   Tag: {element_info.get('elementTag', 'unknown')}")
                            print(f"   Class: {element_info.get('elementClass', 'none')}")
                            print(f"   ID: {element_info.get('elementId', 'none')}")
                            print(f"   HTML: {element_info.get('elementHTML', 'none')[:100]}...")
                            
                            # Take screenshot with marker
                            marked_screenshot = f"{debug_dir}/02_marked_click.png"
                            await tab.save_screenshot(marked_screenshot)
                            print(f"📍 Screenshot with marker saved: {marked_screenshot}")
                            
                            print(f"🖱️  Moving mouse to coordinates ({coords['x']}, {coords['y']})...")
                            # Human-like mouse movement with slight randomness
                            import random
                            
                            # Add small random offset to appear more human
                            human_x = coords['x'] + random.randint(-2, 2)
                            human_y = coords['y'] + random.randint(-2, 2)
                            
                            # Move mouse in stages for more human-like behavior
                            current_x, current_y = coords['x'] - 50, coords['y'] - 50
                            await page.mouse.move(current_x, current_y)
                            await asyncio.sleep(0.1)
                            
                            # Move closer
                            await page.mouse.move(human_x - 10, human_y - 10) 
                            await asyncio.sleep(0.1)
                            
                            # Final precise movement
                            await page.mouse.move(human_x, human_y)
                            await asyncio.sleep(0.3)
                            
                            # Take screenshot showing mouse position
                            mouse_pos_screenshot = f"{debug_dir}/03_mouse_position.png"
                            await tab.save_screenshot(mouse_pos_screenshot)
                            print(f"🖱️  Mouse position screenshot saved: {mouse_pos_screenshot}")
                            
                            print(f"🎭 Using iframe-aware Turnstile verification...")
                            
                            # Try iframe-aware clicking for better success rate
                            try:
                                # Method 1: Find and click Turnstile checkbox in iframe
                                print("🔍 Method 1: Looking for Turnstile iframe and checkbox...")
                                
                                # Find Turnstile iframe
                                turnstile_frame = None
                                for frame in page.frames:
                                    frame_url = frame.url or ""
                                    if "turnstile" in frame_url.lower() or "challenges.cloudflare.com" in frame_url:
                                        turnstile_frame = frame
                                        print(f"✅ Found Turnstile iframe: {frame_url}")
                                        break
                                
                                if turnstile_frame:
                                    try:
                                        # Look for checkbox in the iframe
                                        checkbox = await turnstile_frame.wait_for_selector(
                                            'input[type="checkbox"], [role="checkbox"]', 
                                            timeout=5000
                                        )
                                        if checkbox:
                                            print("✅ Found checkbox in Turnstile iframe - clicking it")
                                            await checkbox.click()
                                            await asyncio.sleep(2)
                                            
                                            # Wait for token to appear
                                            print("⏳ Waiting for Turnstile token...")
                                            try:
                                                token_input = await page.wait_for_selector(
                                                    'input[name="cf-turnstile-response"][value]:not([value=""])',
                                                    timeout=8000
                                                )
                                                if token_input:
                                                    token = await token_input.get_attribute("value")
                                                    if token and len(token) > 10:
                                                        print(f"✅ Method 1: Turnstile token received! ({len(token)} chars)")
                                                        return True
                                            except Exception as token_error:
                                                print(f"⚠️  Token wait failed: {token_error}")
                                        
                                    except Exception as iframe_error:
                                        print(f"⚠️  Iframe interaction failed: {iframe_error}")
                                else:
                                    print("⚠️  No Turnstile iframe found")
                                
                                # Method 2: Fallback to limited container-based clicking
                                print("🔍 Method 2: Fallback to limited container-based clicking...")
                                return await limited_container_clicking(page, tab)
                                
                                # Final check: Wait for Turnstile token
                                print("⏳ Final check: Waiting for Turnstile token...")
                                try:
                                    token_input = await page.wait_for_selector(
                                        'input[name="cf-turnstile-response"][value]:not([value=""])',
                                        timeout=5000
                                    )
                                    if token_input:
                                        token = await token_input.get_attribute("value")
                                        if token and len(token) > 10:
                                            print(f"✅ Turnstile token found! ({len(token)} chars)")
                                            return True
                                except:
                                    print("⚠️ No token received - verification may have failed")
                            except Exception as click_error:
                                print(f"❌ Click methods failed: {click_error}")
                                
                            print(f"🔄 All clicking methods attempted")
                            
                            # Wait for verification to process
                            await asyncio.sleep(3)
                            
                            # Final verification check - look for Turnstile token
                            print("🔍 Final verification check - looking for Turnstile token...")
                            try:
                                token_input = await page.wait_for_selector(
                                    'input[name="cf-turnstile-response"][value]:not([value=""])',
                                    timeout=5000
                                )
                                if token_input:
                                    token = await token_input.get_attribute("value")
                                    if token and len(token) > 10:
                                        print(f"✅ Verification successful! Turnstile token received ({len(token)} chars)")
                                        return True
                            except:
                                pass
                            
                            # Fallback: Check for other success indicators
                            verification_gone = await tab.evaluate("""
                            (function() {
                                const bodyText = document.body.textContent.toLowerCase();
                                
                                const hasVerifyText = bodyText.includes('verify you are human') || 
                                                    bodyText.includes('security check') || 
                                                    bodyText.includes('not a robot');
                                
                                const hasSuccess = bodyText.includes('success') || 
                                                 bodyText.includes('verified') || 
                                                 bodyText.includes('complete');
                                
                                return {
                                    verificationGone: !hasVerifyText,
                                    hasSuccess: hasSuccess
                                };
                            })();
                            """)
                            
                            if verification_gone['verificationGone'] or verification_gone['hasSuccess']:
                                print("✅ Verification appears successful!")
                                return True
                            else:
                                print("⚠️  Verification status unclear")
                                return False
                else:
                    print("❌ LLM didn't provide valid coordinates")
            else:
                print("ℹ️  LLM didn't find any verification elements")
                
        except json.JSONDecodeError as e:
            print(f"❌ Could not parse LLM response as JSON: {e}")
            print(f"Raw response: {response.content}")
        except Exception as e:
            print(f"❌ Error processing LLM response: {e}")
        
        return False
        
    except Exception as e:
        print(f"❌ Error in LLM + Playwright verification: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Clean up Playwright resources
        if browser:
            try:
                await browser.close()
            except:
                pass
        if playwright:
            try:
                await playwright.stop()
            except:
                pass

if __name__ == "__main__":
    uvicorn.run("nodriver_apply:app", host="0.0.0.0", port=8000, reload=True) 