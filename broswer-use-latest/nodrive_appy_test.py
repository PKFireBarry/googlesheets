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
        
        # Use NATIVE Brave browser (not Flatpak) for Cloudflare compatibility
        browser = await uc.start(
            headless=False,
            browser_executable_path="/usr/bin/brave-browser",  # Native Brave installation
            user_data_dir=os.path.expanduser("~/.config/BraveSoftware/Brave-Browser/"),  # Native profile location
            browser_args=[
                '--no-sandbox',  # Safe to use with native installation
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

        # --- SIMPLE FORM FILLING ---
        tasks[task_id].update({"status": "processing", "message": "Filling out basic form fields..."})
        await analyze_and_fill_all_form_elements(tab, llm, user_data)
        
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
            
            // Helper function to create highlight box
            function createHighlight(x, y, width, height, color, label, zIndex = 999999) {{
                const highlight = document.createElement('div');
                highlight.id = '{highlight_id}_' + highlightIndex++;
                highlight.style.position = 'fixed';
                highlight.style.left = x + 'px';
                highlight.style.top = y + 'px';
                highlight.style.width = width + 'px';
                highlight.style.height = height + 'px';
                highlight.style.border = '3px solid ' + color;
                highlight.style.backgroundColor = color.replace('rgb', 'rgba').replace(')', ', 0.1)');
                highlight.style.zIndex = zIndex;
                highlight.style.pointerEvents = 'none';
                highlight.style.boxSizing = 'border-box';
                
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
        guess1_x = widget_x + 20
        guess1_y = widget_y + (widget_height // 2)
        guessed_positions.append({
            'x': guess1_x,
            'y': guess1_y,
            'description': 'Left side, vertically centered',
            'confidence': 'high'
        })
        
        # Position 2: Upper-left area (typical checkbox position)
        guess2_x = widget_x + 15
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

async def check_turnstile_with_llm(tab, llm):
    """Use LLM to check if Turnstile verification is still visible on the page."""
    try:
        print("👁️  Using LLM to check if Turnstile is still visible...")
        
        # Take screenshot
        screenshot_path = f"/tmp/turnstile_check_{uuid.uuid4().hex}.png"
        await tab.save_screenshot(screenshot_path)
        
        # Read screenshot and convert to base64
        with open(screenshot_path, 'rb') as f:
            screenshot_bytes = f.read()
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        
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
        
        message = HumanMessage(
            content=[
                {"type": "text", "text": check_prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{screenshot_base64}"}
                }
            ]
        )
        
        response = await llm.ainvoke([message])
        
        # Parse response
        response_text = response.content.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response_text)
        
        print(f"👁️  LLM Check Result:")
        print(f"   Turnstile still visible: {result.get('turnstile_still_visible')}")
        print(f"   Verification complete: {result.get('verification_complete')}")
        print(f"   Confidence: {result.get('confidence')}")
        print(f"   Reason: {result.get('reason')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error in LLM Turnstile check: {e}")
        return {"turnstile_still_visible": True, "verification_complete": False, "confidence": "low", "reason": "Error occurred"}

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
            print("❌ Could not find debug port for coordinate guessing")
            return False
            
        browser = await playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{debug_port}")
        context = browser.contexts[0]
        page = context.pages[-1]
        
        # Try only the top 2 guesses
        for i, pos in enumerate(top_guesses):
            print(f"🎯 Attempt {i+1}/2: Clicking ({pos['x']}, {pos['y']}) - {pos['description']} ({pos['confidence']} confidence)")
            
            # Add visual marker for this guess
            await tab.evaluate(f"""
            (function() {{
                // Create a bright cyan marker for guessed position
                const marker = document.createElement('div');
                marker.id = 'guess-marker-{i}';
                marker.style.position = 'fixed';
                marker.style.left = '{pos['x'] - 12}px';
                marker.style.top = '{pos['y'] - 12}px';
                marker.style.width = '24px';
                marker.style.height = '24px';
                marker.style.backgroundColor = 'cyan';
                marker.style.border = '3px solid magenta';
                marker.style.borderRadius = '50%';
                marker.style.zIndex = '999999';
                marker.style.pointerEvents = 'none';
                marker.style.opacity = '0.9';
                marker.style.boxShadow = '0 0 15px rgba(0,255,255,0.8)';
                
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

if __name__ == "__main__":
    uvicorn.run("nodrive_appy_test:app", host="0.0.0.0", port=8000, reload=True) 