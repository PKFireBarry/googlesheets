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

        # --- SCRIPT-BASED ACTIONS: Fill simple fields ---
        tasks[task_id].update({"status": "processing", "message": "Filling standard text fields..."})
        user_data_dict = user_data.model_dump()
        print(f"Starting to fill form fields. FIELD_MAPPING has {len(FIELD_MAPPING)} entries.")
        
        try:
            for keywords, data_key in FIELD_MAPPING.items():
                value = ""
                if isinstance(data_key, tuple):
                    value = " ".join([user_data_dict.get(k, "") for k in data_key])
                else:
                    value = user_data_dict.get(data_key)
                print(f"Attempting to fill field with keywords: {keywords}, value: {value}")
                await fill_text_field(tab, keywords, value)
                await tab.sleep(0.7)
        except Exception as field_error:
            print(f"Error in field filling loop: {field_error}")
            print(f"Error type: {type(field_error).__name__}")
            import traceback
            traceback.print_exc()

        # --- LLM-BASED ACTIONS: Fill complex fields ---
        tasks[task_id].update({"status": "processing", "message": "Answering complex questions with LLM..."})
        text_areas = await tab.select_all('textarea')
        for text_area in text_areas:
            try:
                # Attempt to find the question associated with the textarea
                # Try to get aria-label or placeholder from the textarea attributes
                label = text_area.attributes.get('aria-label') or text_area.attributes.get('placeholder') or "Please provide relevant information"
                if label:
                    answer = await get_llm_response(llm, label, user_data)
                    # Move mouse to element before clicking
                    await text_area.mouse_move()
                    await asyncio.sleep(0.2)
                    await text_area.click()
                    await asyncio.sleep(0.3)
                    await text_area.send_keys(answer)
                    await tab.sleep(1)
            except Exception as e:
                print(f"Could not process a textarea: {e}")

        tasks[task_id].update({"status": "completed", "message": "Application process finished. Please review and submit."})
        print("--- Process Complete ---")
        print("Review the form on the browser. The script will close in 60 seconds.")
        await asyncio.sleep(60)

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