import asyncio
import os
import tempfile
import uuid
import re
import base64

import nodriver as uc
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
import uvicorn
import aiofiles
import httpx

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
        label_selector = f"//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{keywords[0]}')]/following-sibling::input"
        
        element = await tab.select(selector_str, timeout=2)
        if not element:
            element = await tab.select(label_selector, timeout=2)

        if element:
            print(f"Found field for '{keywords[0]}' and filling it.")
            await element.mouse_click()
            await asyncio.sleep(0.3)
            await element.send_keys(value, delay=0.05)
            return True
    except Exception as e:
        print(f"Could not find or fill field for '{keywords[0]}': {e}")
    return False

async def handle_cookie_banner(tab):
    """
    Finds and clicks common cookie consent buttons.
    """
    print("Checking for cookie consent banners...")
    # Prioritize accepting, as rejecting can sometimes break site functionality
    accept_keywords = ["accept all", "allow all", "i agree", "accept"]
    
    for keyword in accept_keywords:
        try:
            cookie_button = await tab.find(keyword, best_match=True, timeout=2)
            if cookie_button:
                print(f"Found and clicking cookie button: '{keyword}'")
                await cookie_button.mouse_click()
                await tab.sleep(1.5) # Wait for banner to disappear
                return True # Clicked a button
        except Exception:
            continue # Not found, try next keyword
            
    print("No cookie banner found or handled.")
    return False # No button was clicked

async def navigate_to_application_form(tab):
    """
    Tries to find and click an 'Apply' button to navigate to the actual form.
    This handles cases where the initial URL is just a job description.
    """
    print("Searching for the application form...")
    apply_keywords = [
        "apply for this job",
        "apply to this job",
        "apply now",
        "apply",
        "submit your application",
        "start application",
    ]
    for i in range(3):  # Try up to 3 times to find and navigate
        await handle_cookie_banner(tab) # Handle cookies before every attempt
        current_url = tab.url
        found_and_navigated = False
        for keyword in apply_keywords:
            try:
                # Use a more specific XPath to find clickable buttons or links containing the keyword text
                xpath_selector = f"//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{keyword}')] | //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{keyword}')]"
                apply_button = await tab.find(by='xpath', value=xpath_selector, timeout=3)
                
                if apply_button:
                    element_text = await apply_button.text
                    print(f"Found button/link with text: '{element_text}'. Clicking it...")
                    await apply_button.mouse_click()
                    await tab.sleep(3)  # Wait for potential page navigation

                    if tab.url != current_url:
                        print(f"Successfully navigated to new URL: {tab.url}")
                        found_and_navigated = True
                        break # Break from the inner keyword loop to restart search on the new page
                    else:
                        print("URL did not change. Assuming form is now visible (e.g., in a modal).")
                        return # Exit, we're done.
            except Exception:
                continue # Not found, try next keyword
        
        if not found_and_navigated:
            # If we looped through all keywords and didn't navigate, we're probably on the right page.
            print("Completed a full keyword search, but did not navigate to a new page. Assuming form is now visible.")
            break # Exit the outer loop

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
        # --- Setup Browser and LLM ---
        tasks[task_id].update({"status": "processing", "message": "Initializing browser and LLM..."})
        llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
        browser = await uc.start(headless=False, browser_args=['--no-sandbox'])
        tab = await browser.get(job_url)
        print(f"Navigated to: {job_url}")
        await tab.sleep(2) # Wait for page to settle

        # --- Handle Cookie Banner on Initial Load ---
        await handle_cookie_banner(tab)

        # --- Navigate to the actual application form ---
        tasks[task_id].update({"status": "processing", "message": "Searching for application form..."})
        await navigate_to_application_form(tab)

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
                await file_input.upload(temp_file_path)
                await tab.sleep(1)
            else:
                print("Could not find a file input for the resume.")

        # --- SCRIPT-BASED ACTIONS: Fill simple fields ---
        tasks[task_id].update({"status": "processing", "message": "Filling standard text fields..."})
        user_data_dict = user_data.model_dump()
        for keywords, data_key in FIELD_MAPPING.items():
            value = ""
            if isinstance(data_key, tuple):
                value = " ".join([user_data_dict.get(k, "") for k in data_key])
            else:
                value = user_data_dict.get(data_key)
            await fill_text_field(tab, keywords, value)
            await tab.sleep(0.7)

        # --- LLM-BASED ACTIONS: Fill complex fields ---
        tasks[task_id].update({"status": "processing", "message": "Answering complex questions with LLM..."})
        text_areas = await tab.select_all('textarea')
        for text_area in text_areas:
            try:
                # Attempt to find the question associated with the textarea
                label = await text_area.find_element(by='xpath', value='..').text or await text_area.get('aria-label')
                if label:
                    answer = await get_llm_response(llm, label, user_data)
                    await text_area.mouse_click()
                    await asyncio.sleep(0.3)
                    await text_area.send_keys(answer, delay=0.05)
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
    llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
    
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