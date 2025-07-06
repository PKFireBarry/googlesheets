# Clean Browser Setup and Element Discovery System
# Comprehensive Workable form element analysis

import asyncio
import os
import subprocess
import time
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import json
import re
import nodriver as uc
import textwrap
import google.generativeai as genai
from difflib import get_close_matches

llm = 'gemini-2.5-flash'
llm_api_key = 'AIzaSyAHm37gWcnfQgQFbbi2_AVFNEd7EE5qhnQ'


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

@dataclass
class UserData:
    """User data for form filling."""
    first_name: str = "Darion"
    last_name: str = "George"
    email: str = "dariongeorge0719@gmail.com"
    phone: str = "813-555-0123"
    address: str = "Tampa, FL"
    linkedin: str = "https://linkedin.com/in/dariongeorge"
    github: str = "https://github.com/dariongeorge"
    portfolio: str = "https://dariongeorge.dev"
    
    # Text content
    summary: str = "Experienced professional with strong technical expertise and proven track record. Skilled in modern technologies with excellent problem-solving abilities and commitment to deliver high-quality results."
    
    cover_letter: str = """Dear Hiring Manager,

I am writing to express my strong interest in this position. With my background and skills, I believe I would be a valuable addition to your team.

I am excited about the opportunity to contribute to your organization and look forward to discussing how my experience can benefit your company.

Thank you for your consideration.

Best regards,
Darion George"""

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
            'summary': ['summary', 'profile'],
            'education_level': ['education', 'degree'],
            'experience_years': ['experience', 'years of'],
            'salary': ['salary', 'compensation', 'pay expectation'],
            'visa_status': ['visa', 'authorized to work', 'sponsorship'],
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

    async def get_llm_answer(self, question: str, user_context: str, options: Optional[List[str]] = None) -> str:
        """Generates an answer using the LLM."""
        if options and len(options) > 0:
            # This is a multiple-choice or dropdown question
            # Clean up options for display (remove value parts)
            clean_options = []
            for opt in options:
                clean_opt = re.sub(r'\s*\(value:.*?\)\s*$', '', opt).strip()
                clean_options.append(clean_opt)
            
            prompt = f"""
You are a helpful assistant applying for a job on behalf of a user.
Here is the user's profile for context:
{user_context}

Here is a question from the job application:
"{question}"

You MUST choose exactly ONE option from the list below. Your answer must be EXACTLY one of these options, word-for-word:

{chr(10).join([f"{i+1}. {opt}" for i, opt in enumerate(clean_options)])}

CRITICAL: Respond with ONLY the exact text of the best option. Do not add any explanation, numbering, or extra text.
Do not write a paragraph or sentence. Just the exact option text.

Example: If option 2 is best, respond with exactly: "{clean_options[0] if clean_options else 'N/A'}"
"""
        else:
            # This is a text input question
            prompt = f"""
You are a helpful assistant applying for a job on behalf of a user.
Here is the user's profile for context:
{user_context}

Here is a question from the job application:
"{question}"

Please provide a concise, professional, one-sentence answer to this question based on the user's profile.
Your answer should be suitable for a job application form.
"""
        try:
            print(f"🧠 Asking Gemini: \"{question[:60]}{'...' if len(question) > 60 else ''}\"")
            if options and len(options) > 0:
                print(f"   📋 Available options ({len(options)}): {', '.join([opt[:30] + ('...' if len(opt) > 30 else '') for opt in clean_options])}")
            response = await self.model.generate_content_async(prompt)
            answer = response.text.strip()
            print(f"💡 Gemini's Answer: \"{answer[:60]}{'...' if len(answer) > 60 else ''}\"")
            return answer
        except Exception as e:
            print(f"❌ Error calling Gemini API: {e}")
            return f"[LLM Error: {e}]"

    async def get_checkbox_selections(self, question: str, options: List[str], max_selections: int, user_context: str) -> List[str]:
        """Generate checkbox selections using the LLM."""
        options_text = "\n".join([f"- {opt}" for opt in options])
        
        prompt = f"""
You are a helpful assistant applying for a job on behalf of a user.
Here is the user's profile for context:
{user_context}

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
        try:
            print(f"🧠 Asking Gemini to select {max_selections} options from {len(options)} choices...")
            response = await self.model.generate_content_async(prompt)
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
    def __init__(self, tab, llm_generator: LLMAnswerGenerator, user_data: UserData):
        self.tab = tab
        self.llm = llm_generator
        self.user_data = user_data
        self.user_context = user_data.to_context_string()

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
                    options=element.available_options
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
                
                # For checkbox groups, the LLM should return multiple selections
                # But we might only have one answer string, so we need to handle this differently
                
                # If this is a complex question, ask the LLM for multiple selections
                if element.purpose.startswith("complex_question_"):
                    # Ask LLM for multiple selections
                    multiple_answers = await self.llm.get_checkbox_selections(
                        question=element.label_text,
                        options=[opt for opt in element.available_options],
                        max_selections=element.max_selections,
                        user_context=self.user_context
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


async def start_brave_browser():
    """Start Brave browser with comprehensive element discovery."""
    browser = None
    
    try:
        print(f"🔧 Starting browser with temporary profile...")
        
        # Find Brave browser executable
        brave_paths = [
            "/usr/bin/brave-browser",
            "/usr/bin/brave-browser-stable", 
        ]
        
        brave_executable = None
        for path in brave_paths:
            if os.path.exists(path):
                brave_executable = path
                break
        
        if not brave_executable:
            print("❌ Could not find Brave browser executable!")
            print("Available paths checked:")
            for path in brave_paths:
                print(f"   - {path}")
            raise Exception("Brave browser executable not found")
        
        print(f"🦁 Using Brave executable: {brave_executable}")
        
        # Start browser with simplified configuration
        browser = await uc.start(
            headless=False,
            browser_executable_path=brave_executable,
            no_sandbox=True,
            browser_args=[
                '--window-size=1920,1080',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled'
            ]
        )
        
        # Navigate to test form
        test_url = "https://apply.workable.com/cubic3/j/CDB2AADD50/apply/"
        print(f"📍 Navigating to: {test_url}")
        
        tab = await browser.get(test_url)
        await asyncio.sleep(5)  # Wait for page load
        
        # Verify navigation
        current_url = await tab.evaluate("window.location.href")
        print(f"📍 Current URL: {current_url}")
        
        if ("workable.com" in current_url):
            print("✅ Successfully navigated to form!")
            
            # Initialize user data
            user_data = UserData()
            print(f"👤 User data ready: {user_data.first_name} {user_data.last_name}")
            
            # START ELEMENT DISCOVERY
            print("\n🚀 Starting comprehensive element discovery...")
            discovery = WorkableElementDiscovery(tab)
            elements = await discovery.discover_all_elements()
            
            # Log comprehensive summary
            discovery.log_element_summary()

            # Initialize LLM and Agent
            if llm_api_key:
                llm_generator = LLMAnswerGenerator(model_name=llm, api_key=llm_api_key)
                agent = FormFillingAgent(tab, llm_generator, user_data)

                # Fill the form
                await agent.fill_form(elements)
            else:
                print("\n⚠️  Gemini API key not found. Skipping LLM-based form filling.")
            
            print(f"\n🎯 DISCOVERY AND FILLING COMPLETE!")
            print(f"   📊 Total elements analyzed: {len(elements)}")
            print(f"   🔍 Check console output for detailed analysis")
            
            # Keep browser open for 60 seconds for inspection, then close automatically.
            print("\n🕐 Browser will close automatically in 60 seconds...")
            await asyncio.sleep(15)
            print("   15-second delay complete. Closing browser.")
                
        else:
            print("❌ Navigation failed - check URL and try again")
        
    except Exception as e:
        print(f"❌ Browser startup failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        if browser:
            try:
                browser.stop()
                print("✅ Browser closed")
            except:
                pass

async def main():
    """Main function to start browser and discovery."""
    try:
        kill_existing_brave_instances()
        print("🚀 Starting comprehensive Workable form analysis...")
        await start_brave_browser()
            
    except asyncio.CancelledError:
        print("\nScript interrupted by user.")
    except Exception as e:
        print(f"❌ An error occurred: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Exiting.")