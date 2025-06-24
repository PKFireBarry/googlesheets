import asyncio
import os
import tempfile
import uuid
import re
import base64
import json

import nodriver as uc
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
import uvicorn
import aiofiles
import httpx
from langchain_core.messages import HumanMessage

app = FastAPI()

# In-memory task storage for status tracking
tasks = {}

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
                'selectors': ['input[name*="first"]', 'input[placeholder*="first" i]', 'input[id*="first"]'],
                'value': user_data.first_name
            },
            {
                'name': 'last_name', 
                'selectors': ['input[name*="last"]', 'input[placeholder*="last" i]', 'input[id*="last"]'],
                'value': user_data.last_name
            },
            {
                'name': 'email',
                'selectors': ['input[type="email"]', 'input[name*="email"]', 'input[placeholder*="email" i]'],
                'value': user_data.email
            },
            {
                'name': 'phone',
                'selectors': ['input[type="tel"]', 'input[name*="phone"]', 'input[placeholder*="phone" i]'],
                'value': user_data.phone
            },
            {
                'name': 'address',
                'selectors': ['input[name*="address"]', 'input[placeholder*="address" i]', 'textarea[name*="address"]'],
                'value': user_data.address or "Tampa, FL"
            },
            {
                'name': 'cover_letter',
                'selectors': ['textarea[name*="cover"]', 'textarea[placeholder*="cover" i]', 'textarea[name*="letter"]'],
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
                                
                                # Clear the field completely with multiple methods
                                print(f"Clearing {field_info['name']} field...")
                                
                                # Method 1: Select all and delete
                                await tab.evaluate(f"""
                                (function() {{
                                    const el = document.querySelector('{selector}');
                                    if (el) {{
                                        el.focus();
                                        el.select();
                                        el.value = '';
                                        // Trigger input events to notify the form
                                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                    }}
                                }})();
                                """)
                                await asyncio.sleep(0.3)
                                
                                # Method 2: Use Ctrl+A and Delete for stubborn fields
                                await element.click()
                                await asyncio.sleep(0.2)
                                
                                # Send Ctrl+A to select all
                                await tab.send_keys('\ue009a')  # Ctrl+A
                                await asyncio.sleep(0.2)
                                
                                # Send Delete key
                                await tab.send_keys('\ue017')  # Delete key
                                await asyncio.sleep(0.2)
                                
                                # Verify field is empty
                                current_value = await tab.evaluate(f"""
                                (function() {{
                                    const el = document.querySelector('{selector}');
                                    return el ? el.value : '';
                                }})();
                                """)
                                
                                if current_value:
                                    print(f"Field still contains: '{current_value}' - trying aggressive clear...")
                                    # Final aggressive clear
                                    await tab.evaluate(f"""
                                    (function() {{
                                        const el = document.querySelector('{selector}');
                                        if (el) {{
                                            el.value = '';
                                            el.textContent = '';
                                            el.innerHTML = '';
                                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
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

async def simple_form_fill_fallback(tab, user_data):
    """Simple fallback form filling using basic field detection."""
    print("=== SIMPLE FALLBACK FORM FILLING ===")
    
    # Try to fill common fields using simple selectors
    field_mappings = [
        (['input[name*="first"]', 'input[placeholder*="first"]'], user_data.first_name),
        (['input[name*="last"]', 'input[placeholder*="last"]'], user_data.last_name),
        (['input[type="email"]', 'input[name*="email"]'], user_data.email),
        (['input[type="tel"]', 'input[name*="phone"]'], user_data.phone),
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
                    
                    # Clear field
                    await tab.evaluate(f"""
                    const el = document.querySelector('{selector}');
                    if (el) {{
                        el.focus();
                        el.select();
                        el.value = '';
                    }}
                    """)
                    
                    await element.send_keys(str(value))
                    await asyncio.sleep(0.3)
                    break
            except Exception as e:
                print(f"Failed to fill field with selector '{selector}': {e}")
                continue

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
                        await tab.wait_for('Page.loadEventFired', timeout=10)
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
            browser_args=['--no-sandbox', '--window-size=1920,1080']
        )
        tab = await browser.get(job_url)
        print(f"Navigated to: {job_url}")
        await tab.sleep(2) # Wait for page to settle

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
        tasks[task_id].update({"status": "processing", "message": "Filling out form fields..."})
        await analyze_and_fill_all_form_elements(tab, llm, user_data)

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
            tasks[task_id].update({"status": "processing", "message": "Checking for verification challenges..."})
            await tab.sleep(5)  # Wait longer for any redirects/popups to appear
            
            # Look for Cloudflare verification
            try:
                print("Checking for Cloudflare verification...")
                
                # Wait for potential Cloudflare modal to appear
                cf_found = False
                max_attempts = 3
                
                for attempt in range(max_attempts):
                    print(f"Cloudflare detection attempt {attempt + 1}/{max_attempts}")
                    
                    # Look for Cloudflare verification elements with more comprehensive selectors
                    cf_selectors = [
                        # Turnstile checkbox
                        "input[type='checkbox'][id*='cf']",
                        "input[type='checkbox'][name*='cf']",
                        ".cf-turnstile input[type='checkbox']",
                        "[data-sitekey] input[type='checkbox']",
                        
                        # Generic verification checkboxes
                        "input[type='checkbox']",
                        
                        # Turnstile containers
                        ".cf-turnstile",
                        "[data-sitekey]",
                        
                        # Challenge forms
                        ".challenge-form",
                        "#challenge-form",
                        
                        # Iframes
                        "iframe[src*='challenges.cloudflare.com']",
                        "iframe[src*='turnstile']",
                        "iframe[title*='verification']",
                        "iframe[title*='challenge']"
                    ]
                    
                    for selector in cf_selectors:
                        try:
                            print(f"Trying CF selector: {selector}")
                            
                            if selector.startswith('iframe'):
                                # Handle iframes specially
                                iframes = await tab.select_all(selector, timeout=2)
                                for iframe in iframes:
                                    try:
                                        print(f"Found iframe, attempting to interact...")
                                        await iframe.mouse_move()
                                        await tab.sleep(1)
                                        await iframe.click()
                                        print("Clicked iframe!")
                                        cf_found = True
                                        break
                                    except Exception as iframe_error:
                                        print(f"Iframe interaction failed: {iframe_error}")
                                        continue
                            else:
                                # Handle regular elements
                                cf_elements = await tab.select_all(selector, timeout=2)
                                
                                for cf_element in cf_elements:
                                    try:
                                        # Check if element is visible and interactable
                                        is_visible = await tab.evaluate(f"""
                                        (function() {{
                                            const elements = document.querySelectorAll('{selector}');
                                            for (let el of elements) {{
                                                const rect = el.getBoundingClientRect();
                                                const style = window.getComputedStyle(el);
                                                
                                                if (rect.width > 0 && rect.height > 0 && 
                                                    style.display !== 'none' && 
                                                    style.visibility !== 'hidden' &&
                                                    style.opacity !== '0') {{
                                                    
                                                    // Check for verification-related attributes or text
                                                    const elementText = el.textContent.toLowerCase();
                                                    const hasVerifyText = elementText.includes('verify') || 
                                                                         elementText.includes('human') || 
                                                                         elementText.includes('robot') ||
                                                                         elementText.includes('challenge');
                                                    
                                                    const hasVerifyAttrs = el.className.includes('cf') ||
                                                                          el.className.includes('turnstile') ||
                                                                          el.id.includes('cf') ||
                                                                          el.hasAttribute('data-sitekey');
                                                    
                                                    if (hasVerifyText || hasVerifyAttrs || el.type === 'checkbox') {{
                                                        return true;
                                                    }}
                                                }}
                                            }}
                                            return false;
                                        }})();
                                        """)
                                        
                                        if is_visible:
                                            print(f"Found visible Cloudflare element with selector: {selector}")
                                            
                                            # Try to click the element
                                            await cf_element.mouse_move()
                                            await tab.sleep(1)
                                            await cf_element.click()
                                            print("Clicked Cloudflare verification element!")
                                            await tab.sleep(3)  # Wait for verification to process
                                            cf_found = True
                                            break
                                            
                                    except Exception as elem_error:
                                        print(f"Error interacting with CF element: {elem_error}")
                                        continue
                            
                            if cf_found:
                                break
                                
                        except Exception as selector_error:
                            print(f"CF selector '{selector}' failed: {selector_error}")
                            continue
                    
                    if cf_found:
                        print("✅ Cloudflare verification completed!")
                        await tab.sleep(5)  # Wait for verification to complete
                        break
                    else:
                        print(f"No CF elements found in attempt {attempt + 1}, waiting before retry...")
                        await tab.sleep(3)
                
                if not cf_found:
                    print("❌ No Cloudflare verification elements found after all attempts")
                    
                    # Try the built-in method as last resort
                    try:
                        print("Trying built-in verify_cf() method as fallback...")
                        result = await tab.verify_cf()
                        if result:
                            print("✅ Built-in Cloudflare verification succeeded!")
                            cf_found = True
                        else:
                            print("❌ Built-in verification also failed")
                    except Exception as builtin_error:
                        print(f"Built-in CF verification failed: {builtin_error}")
                    
            except Exception as e:
                print(f"Error in Cloudflare verification: {e}")

        # --- VERIFY SUBMISSION SUCCESS ---
        await tab.sleep(3)  # Wait for any final redirects
        
        try:
            print("Checking for submission confirmation...")
            
            # First check for error indicators or incomplete submission
            error_keywords = [
                "verify you are human",
                "complete the verification",
                "security check",
                "prove you're not a robot",
                "cloudflare",
                "verification required",
                "please verify",
                "captcha",
                "challenge"
            ]
            
            page_text = await tab.get_content()
            page_text_lower = page_text.lower()
            
            # Check for verification/error indicators
            verification_needed = any(keyword in page_text_lower for keyword in error_keywords)
            
            if verification_needed:
                print("⚠️  Verification challenge detected - application may not be complete")
                tasks[task_id].update({"status": "incomplete", "message": "Application submitted but verification challenge detected. Please complete manually."})
                
                # Try one more time to find and click verification
                print("Making final attempt to complete verification...")
                try:
                    # Look for any visible checkboxes or buttons
                    final_selectors = [
                        "input[type='checkbox']:not([style*='display: none'])",
                        "button:contains('Verify')",
                        ".verify-button",
                        "[role='checkbox']"
                    ]
                    
                    for selector in final_selectors:
                        try:
                            elements = await tab.select_all(selector, timeout=2)
                            for element in elements:
                                try:
                                    print(f"Final verification attempt with: {selector}")
                                    await element.mouse_move()
                                    await tab.sleep(1)
                                    await element.click()
                                    await tab.sleep(5)
                                    print("Clicked final verification element!")
                                    break
                                except:
                                    continue
                        except:
                            continue
                            
                except Exception as final_error:
                    print(f"Final verification attempt failed: {final_error}")
                
            else:
                # Look for success indicators
                success_keywords = [
                    "thank you",
                    "application submitted",
                    "application received", 
                    "successfully submitted",
                    "confirmation",
                    "we'll be in touch",
                    "application complete",
                    "your application has been sent",
                    "application sent successfully"
                ]
                
                success_found = any(keyword in page_text_lower for keyword in success_keywords)
                
                if success_found:
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

if __name__ == "__main__":
    uvicorn.run("nodriver_apply:app", host="0.0.0.0", port=8000, reload=True) 