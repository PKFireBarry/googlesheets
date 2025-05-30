from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from pydantic import BaseModel, SecretStr
import uvicorn
from browser_use import Agent, Browser, BrowserConfig
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
import os
import asyncio
import argparse
import uuid
from datetime import datetime
from typing import Dict, Optional
import re
from bs4 import BeautifulSoup
import bs4
import tempfile
import requests
import shutil
import base64

app = FastAPI()
load_dotenv()

# Initialize the browser globally
browser = Browser(config=BrowserConfig(
    headless=True,  # Keep the browser visible
    disable_security=True,
    #_force_keep_browser_alive=True,  # Keep browser instance alive
    chrome_instance_path='/usr/bin/google-chrome'
))

# Initialize browser context
context = None

# Add near the top with other global variables
current_agent = None

# Task tracking system
task_statuses = {}  # Dictionary to store task statuses

# Add upload task tracking system
upload_task_statuses = {}  # Dictionary to store upload task statuses

class TaskStatus:
    def __init__(self, task_id: str, task: str):
        self.task_id = task_id
        self.task = task
        self.status = "running"  # "running", "completed", "failed"
        self.start_time = datetime.now()
        self.end_time = None
        self.result = None
        self.error = None

class TaskRequest(BaseModel):
    task: str
    api_key: str = None  # Optional API key parameter
    system_prompt: str = None  # Add system prompt field
    provider: str = "google"  # Add provider field with default

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    task: str
    start_time: str
    end_time: Optional[str] = None
    result: Optional[Dict] = None
    error: Optional[str] = None
    elapsed_seconds: int

class UploadTaskStatus:
    def __init__(self, task_id: str, file_name: str, target_url: str):
        self.task_id = task_id
        self.file_name = file_name
        self.target_url = target_url
        self.status = "running"  # "running", "completed", "failed"
        self.start_time = datetime.now()
        self.end_time = None
        self.result = None
        self.error = None

class UploadTaskStatusResponse(BaseModel):
    task_id: str
    status: str
    file_name: str
    target_url: str
    start_time: str
    end_time: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    elapsed_seconds: int

async def get_or_create_context():
    global context
    if context is None:
        context = await browser.new_context()
    return context

# Function to decode data URI and save as file
def save_data_uri_to_file(data_uri, filename="resume.pdf"):
    try:
        # Create a unique filename
        unique_filename = f"{uuid.uuid4()}_{filename}"
        
        # Create directory for storing files if it doesn't exist
        base_dir = os.path.dirname(os.path.abspath(__file__))
        resume_dir = os.path.join(base_dir, "resume")
        os.makedirs(resume_dir, exist_ok=True)
        
        file_path = os.path.join(resume_dir, unique_filename)
        
        # Parse the data URI
        if not data_uri:
            raise ValueError("Empty data URI provided")
            
        # Handle different data URI formats
        if data_uri.startswith('data:'):
            # Extract the base64 data part
            header, data = data_uri.split(',', 1)
            
            # Handle potential URL encoding or padding issues
            data = data.replace(' ', '+')  # Fix potential space issues
            
            # Add padding if needed
            missing_padding = len(data) % 4
            if missing_padding:
                data += '=' * (4 - missing_padding)
                
            # Decode the base64 data
            binary_data = base64.b64decode(data)
            
            # Write to file
            with open(file_path, 'wb') as f:
                f.write(binary_data)
                
            print(f"Data URI successfully saved to {file_path}")
            return file_path
        else:
            raise ValueError("Invalid data URI format")
    except Exception as e:
        print(f"Error saving data URI to file: {str(e)}")
        raise

@app.post("/run-task")
async def run_agent_task(request: TaskRequest):
    global context, current_agent, task_statuses
    
    # Generate a unique task ID
    task_id = str(uuid.uuid4())
    
    # Create and store task status
    task_status = TaskStatus(task_id=task_id, task=request.task)
    task_statuses[task_id] = task_status
    
    # Start task in background to return task_id immediately
    asyncio.create_task(execute_task(request, task_id))
    
    return {"task_id": task_id, "status": "running"}

async def execute_task(request: TaskRequest, task_id: str):
    global context, current_agent, task_statuses
    
    try:
        context = await get_or_create_context()
        
        # Use the API key from the request if provided, otherwise fall back to env variable
        api_key = request.api_key or os.getenv('GEMINI_API_KEY')
        if not api_key:
            task_statuses[task_id].status = "failed"
            task_statuses[task_id].error = "No API key provided in request or environment"
            task_statuses[task_id].end_time = datetime.now()
            return
        
        if request.provider == "google":
            llm = ChatGoogleGenerativeAI(
                model='gemini-2.0-flash',
                temperature=0.5,
                google_api_key=api_key,
                system_instruction=request.system_prompt
            )
        elif request.provider == "ollama":
            llm = ChatOllama(model="qwen2.5:32b", temperature=0.5)

        # Create and run agent using the browser context
        current_agent = Agent(
            task=request.task,
            llm=llm,
            browser_context=context,
            use_vision=True,
            generate_gif=False,
            browser=browser,
            page_extraction_llm=llm,
            validate_output=True
        )

        result = await current_agent.run()
        
        # Update task status to completed
        task_statuses[task_id].status = "completed"
        task_statuses[task_id].result = {"result": result.extracted_content()}
        task_statuses[task_id].end_time = datetime.now()
        
        current_agent = None

    except Exception as e:
        # Update task status to failed
        task_statuses[task_id].status = "failed"
        task_statuses[task_id].error = str(e)
        task_statuses[task_id].end_time = datetime.now()

@app.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    if task_id not in task_statuses:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    
    task_status = task_statuses[task_id]
    elapsed = (task_status.end_time or datetime.now()) - task_status.start_time
    
    return {
        "task_id": task_status.task_id,
        "status": task_status.status,
        "task": task_status.task,
        "start_time": task_status.start_time.isoformat(),
        "end_time": task_status.end_time.isoformat() if task_status.end_time else None,
        "result": task_status.result,
        "error": task_status.error,
        "elapsed_seconds": int(elapsed.total_seconds())
    }

@app.post("/close-browser")
async def close_browser_endpoint():
    global context
    try:
        if context:
            await context.close()
            context = None
        await browser.close()
        return {"status": "Browser closed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop-task")
async def stop_agent():
    global current_agent
    try:
        if current_agent:
            current_agent.stop()
            current_agent = None
            return {"status": "Agent stopped"}
        return {"status": "No active agent to stop"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/open-browser")
async def open_browser():
    global context
    try:
        context = await get_or_create_context()
        page = await context.new_page()
        await page.goto("https://www.google.com")
        return {"status": "browser opened", "url": "https://www.google.com"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-upload")
async def test_upload(
    file: UploadFile = File(None),
    file_url: str = Form(None),
    api_key: str = Form(...),
    prompt: str = Form(...),
    file_input_selector: str = Form('auto')
):
    # Generate a unique task ID
    task_id = str(uuid.uuid4())
    
    # Extract file name for status tracking
    file_name = file.filename if file is not None else "resume.pdf"
    
    # Extract target URL from the prompt
    url_match = re.search(r'(https?://\S+)', prompt)
    target_url = url_match.group(1) if url_match else None
    
    # Create and store upload task status
    upload_status = UploadTaskStatus(task_id=task_id, file_name=file_name, target_url=target_url)
    upload_task_statuses[task_id] = upload_status
    
    # Start upload in background
    asyncio.create_task(execute_upload_task(file, file_url, api_key, prompt, file_input_selector, task_id))
    
    return {"task_id": task_id, "status": "running"}

async def execute_upload_task(file, file_url, api_key, prompt, file_input_selector, task_id):
    temp_file_path = None
    file_path = None
    
    try:
        # Process file or file_url
        if file is not None:
            # Create a directory for storing files if it doesn't exist
            base_dir = os.path.dirname(os.path.abspath(__file__))
            resume_dir = os.path.join(base_dir, "resume")
            os.makedirs(resume_dir, exist_ok=True)
            
            # Create a unique filename
            safe_filename = f"{uuid.uuid4()}_{file.filename or 'uploaded_resume.pdf'}"
            file_path = os.path.join(resume_dir, safe_filename)
            
            # Save the file using shutil to ensure it's properly closed
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Reset the file position to the beginning
            await file.seek(0)
        elif file_url:
            # Check if it's a data URI
            if file_url.startswith('data:'):
                try:
                    # Save data URI as file
                    file_path = save_data_uri_to_file(file_url)
                    temp_file_path = file_path  # Mark for cleanup later
                except Exception as e:
                    upload_task_statuses[task_id].status = "failed"
                    upload_task_statuses[task_id].error = f"Failed to process data URI: {str(e)}"
                    upload_task_statuses[task_id].end_time = datetime.now()
                    return
            else:
                # It's a regular URL, download the file
                try:
                    # Create a directory for storing files if it doesn't exist
                    base_dir = os.path.dirname(os.path.abspath(__file__))
                    resume_dir = os.path.join(base_dir, "resume")
                    os.makedirs(resume_dir, exist_ok=True)
                    
                    # Create a unique filename
                    safe_filename = f"{uuid.uuid4()}_downloaded.pdf"
                    file_path = os.path.join(resume_dir, safe_filename)
                    
                    # Download and save the file
                    response = requests.get(file_url)
                    response.raise_for_status()
                    
                    with open(file_path, "wb") as buffer:
                        buffer.write(response.content)
                        
                    temp_file_path = file_path  # Mark for cleanup later
                except Exception as e:
                    upload_task_statuses[task_id].status = "failed"
                    upload_task_statuses[task_id].error = f"Failed to download file from URL: {str(e)}"
                    upload_task_statuses[task_id].end_time = datetime.now()
                    return
        else:
            upload_task_statuses[task_id].status = "failed"
            upload_task_statuses[task_id].error = "No file or file_url provided"
            upload_task_statuses[task_id].end_time = datetime.now()
            return

        # Extract target URL from the prompt
        url_match = re.search(r'(https?://\S+)', prompt)
        if not url_match:
            upload_task_statuses[task_id].status = "failed"
            upload_task_statuses[task_id].error = "No URL found in prompt. Please include a URL in your prompt."
            upload_task_statuses[task_id].end_time = datetime.now()
            return
        target_url = url_match.group(1)

        # Moved block for JSON extraction from prompt
        main_prompt_text = prompt
        print("[DEBUG] Received main prompt for JSON extraction:")
        print(main_prompt_text)
        
        personal_info_json_str = None
        resume_json_str = None
        
        # Regex to find Personal Information JSON block
        pi_match = re.search(r"--- Personal Information JSON ---(.*?)--- End Personal Information JSON ---", main_prompt_text, re.DOTALL)
        if pi_match:
            personal_info_json_str = pi_match.group(1).strip()
            print("[DEBUG] Extracted Personal Info JSON from prompt (early extraction):")
            print(personal_info_json_str)
        else:
            print("[DEBUG] No Personal Info JSON found in prompt (early extraction).")
        
        # Regex to find Full Resume JSON block
        resume_match = re.search(r"--- Full Resume JSON ---(.*?)--- End Full Resume JSON ---", main_prompt_text, re.DOTALL)
        if resume_match:
            resume_json_str = resume_match.group(1).strip()
            print("[DEBUG] Extracted Full Resume JSON from prompt (early extraction):")
            print(resume_json_str)
        else:
            print("[DEBUG] No Resume JSON found in prompt (early extraction).")

        # Verify file exists and is readable
        if not os.path.exists(file_path):
            upload_task_statuses[task_id].status = "failed"
            upload_task_statuses[task_id].error = f"File does not exist at path: {file_path}"
            upload_task_statuses[task_id].end_time = datetime.now()
            return
            
        if not os.access(file_path, os.R_OK):
            upload_task_statuses[task_id].status = "failed"
            upload_task_statuses[task_id].error = f"File is not readable: {file_path}"
            upload_task_statuses[task_id].end_time = datetime.now()
            return
            
        # Print file info for debugging
        file_size = os.path.getsize(file_path)
        print(f"File path: {file_path}")
        print(f"File size: {file_size} bytes")
        print(f"File exists: {os.path.exists(file_path)}")
        print(f"File is readable: {os.access(file_path, os.R_OK)}")

        # Directly set the file input for guaranteed upload
        context = await get_or_create_context()
        page = await context.get_current_page()
        if not page:
            page = await context.new_page()
        await page.goto(target_url)

        # Set up LLM for agent tasks
        api_key_val = api_key or os.getenv('GEMINI_API_KEY') or ''
        llm = ChatGoogleGenerativeAI(
            model='gemini-2.0-flash',
            temperature=0.5,
            api_key=SecretStr(api_key_val)
        )

        # First, check if we need to navigate to find the application form
        html = await page.content()
        navigation_needed = True
        file_input_present = False

        # Check if file input is already present on current page
        soup = BeautifulSoup(html, "html.parser")
        file_inputs_on_page = soup.find_all("input", {"type": "file"})
        if file_inputs_on_page:
            file_input_present = True
            navigation_needed = False
            print("File input found on initial page")

        # If no file input is found, try to navigate to application page
        if navigation_needed:
            print("No file input found on initial page. Attempting to navigate to application form.")
            
            # Use an agent to identify application links/buttons
            navigation_prompt = (
                "You are looking at a job posting page. Your task is to find and click on buttons or links "
                "that would lead to the job application form where you can upload a resume. "
                "Look for elements containing text like 'Apply', 'Apply Now', 'Application', 'Submit Resume', etc. "
                "Return ONLY the CSS selector for the best element to click (no explanation needed)."
            )
            
            navigation_agent = Agent(
                task=navigation_prompt,
                llm=llm,
                browser_context=context,
                use_vision=True,  # Enable vision for better UI understanding
                generate_gif=False,
                browser=browser,
                validate_output=False
            )
            
            navigation_result = await navigation_agent.run()
            nav_selector = str(navigation_result).strip()
            
            # Clean up the selector if needed
            if nav_selector:
                # Remove quotes and handle common formatting issues
                nav_selector = nav_selector.replace('"', '').replace("'", "").strip()
                print(f"Navigation selector found: {nav_selector}")
                
                # Try to click the navigation element
                try:
                    nav_element = await page.query_selector(nav_selector)
                    if nav_element:
                        print(f"Clicking on navigation element: {nav_selector}")
                        await nav_element.click()
                        # Wait for navigation and page load
                        await asyncio.sleep(3)
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        
                        # Check if we're on a new page with file inputs
                        updated_html = await page.content()
                        soup = BeautifulSoup(updated_html, "html.parser")
                        file_inputs_on_page_after_nav = soup.find_all("input", {"type": "file"})
                        if file_inputs_on_page_after_nav:
                            file_input_present = True
                            print("File input found after navigation")
                        else:
                            print("No file input found after initial navigation")
                            
                            # Try one more level of navigation if needed
                            second_navigation_prompt = (
                                "You are on a job application page. Your task is to find and click on buttons or links "
                                "that would lead to the form where you can upload a resume. "
                                "Look for elements containing text like 'Upload Resume', 'Attach Files', 'Upload CV', etc. "
                                "Return ONLY the CSS selector for the best element to click (no explanation needed)."
                            )
                            
                            second_nav_agent = Agent(
                                task=second_navigation_prompt,
                                llm=llm,
                                browser_context=context,
                                use_vision=True,
                                generate_gif=False,
                                browser=browser,
                                validate_output=False
                            )
                            
                            second_nav_result = await second_nav_agent.run()
                            second_nav_selector = str(second_nav_result).strip()
                            
                            if second_nav_selector:
                                second_nav_selector = second_nav_selector.replace('"', '').replace("'", "").strip()
                                print(f"Second navigation selector found: {second_nav_selector}")
                                
                                try:
                                    second_nav_element = await page.query_selector(second_nav_selector)
                                    if second_nav_element:
                                        print(f"Clicking on second navigation element: {second_nav_selector}")
                                        await second_nav_element.click()
                                        await asyncio.sleep(3)
                                        await page.wait_for_load_state("networkidle", timeout=10000)
                                        
                                        # Check again for file inputs
                                        updated_html = await page.content()
                                        soup = BeautifulSoup(updated_html, "html.parser")
                                        file_inputs_on_page_after_second_nav = soup.find_all("input", {"type": "file"})
                                        if file_inputs_on_page_after_second_nav:
                                            file_input_present = True
                                            print("File input found after second navigation")
                                except Exception as nav_e:
                                    print(f"Error during second navigation: {str(nav_e)}")
                    else:
                        print(f"Navigation element not found for selector: {nav_selector}")
                except Exception as nav_e:
                    print(f"Error during navigation: {str(nav_e)}")

            # If still no file input, try common application buttons by text content
            if not file_input_present:
                print("Trying to find application buttons by common text patterns...")
                common_apply_buttons = [
                    "//button[contains(text(), 'Apply')]",
                    "//a[contains(text(), 'Apply')]",
                    "//button[contains(text(), 'Application')]",
                    "//a[contains(text(), 'Application')]",
                    "//a[contains(@href, 'apply')]",
                    "//a[contains(@href, 'application')]",
                    "//div[contains(text(), 'Apply') and @role='button']",
                    "//span[contains(text(), 'Apply') and @role='button']"
                ]
                
                for xpath_selector in common_apply_buttons:
                    try:
                        button = await page.query_selector(f"xpath={xpath_selector}")
                        if button:
                            print(f"Found common apply button: {xpath_selector}")
                            await button.click()
                            await asyncio.sleep(3)
                            await page.wait_for_load_state("networkidle", timeout=10000)
                            
                            # Check if we're on a new page with file inputs
                            updated_html = await page.content()
                            soup = BeautifulSoup(updated_html, "html.parser")
                            file_inputs_on_page_after_common_button = soup.find_all("input", {"type": "file"})
                            if file_inputs_on_page_after_common_button:
                                file_input_present = True
                                print("File input found after clicking common apply button")
                                break
                    except Exception as e:
                        print(f"Error clicking {xpath_selector}: {str(e)}")
                        continue

            # If still no success, try looking for iframe forms
            if not file_input_present:
                print("Checking for iframes that might contain application forms...")
                try:
                    iframes = await page.query_selector_all("iframe")
                    for i, iframe_element in enumerate(iframes):
                        try:
                            # Try to get the iframe's content
                            frame = page.frame({"index": i})
                            if frame:
                                # Check if the frame has a file input
                                frame_html = await frame.content()
                                soup = BeautifulSoup(frame_html, "html.parser")
                                file_inputs_in_iframe = soup.find_all("input", {"type": "file"})
                                if file_inputs_in_iframe:
                                    file_input_present = True
                                    print(f"File input found in iframe {i}")
                                    # Stay in this frame context for the upload
                                    page = frame
                                    break
                                
                                # If no file input but has apply buttons, try clicking them
                                apply_buttons_in_iframe = soup.find_all(lambda tag: tag.name in ["button", "a"] and 
                                                          tag.text and 
                                                          ("apply" in tag.text.lower() or 
                                                           "upload" in tag.text.lower() or 
                                                           "resume" in tag.text.lower()))
                                if apply_buttons_in_iframe:
                                    # Try to click the first apply button in the iframe
                                    button_text = apply_buttons_in_iframe[0].text.strip()
                                    print(f"Found apply button in iframe {i}: {button_text}")
                                    
                                    # Create a selector for this button
                                    button_selector_in_iframe = None
                                    if apply_buttons_in_iframe[0].get('id'):
                                        button_selector_in_iframe = f"#{apply_buttons_in_iframe[0].get('id')}"
                                    elif apply_buttons_in_iframe[0].get('class'):
                                        # Ensure class names are properly formatted for CSS selector
                                        class_list = apply_buttons_in_iframe[0].get('class', [])
                                        if class_list:
                                             button_selector_in_iframe = f".{'.'.join(class_list)}"
                                    else:
                                        # Try to create an XPath for this button
                                        button_selector_in_iframe = f"xpath=//{apply_buttons_in_iframe[0].name}[contains(text(), '{button_text}')]"
                                        
                                    if button_selector_in_iframe:
                                        frame_button = await frame.query_selector(button_selector_in_iframe)
                                        if frame_button:
                                            await frame_button.click()
                                            await asyncio.sleep(3)
                                            
                                            # Check again for file inputs
                                            frame_html_after_click = await frame.content()
                                            soup = BeautifulSoup(frame_html_after_click, "html.parser")
                                            file_inputs_in_iframe_after_click = soup.find_all("input", {"type": "file"})
                                            if file_inputs_in_iframe_after_click:
                                                file_input_present = True
                                                print(f"File input found in iframe {i} after clicking button")
                                                # Stay in this frame context for the upload
                                                page = frame
                                                break
                        except Exception as iframe_e:
                            print(f"Error processing iframe {i}: {str(iframe_e)}")
                except Exception as iframe_error:
                    print(f"Error checking iframes: {str(iframe_error)}")

            # Try to fill out any required form fields before looking for file input
            if not file_input_present:
                try:
                    print("Attempting to fill out form fields that might be required before file upload...")
                    
                    # Use an agent to identify and fill out form fields
                    form_fill_prompt = (
                        "You are an AI assistant helping a user apply for a job. Your task is to analyze the current web page (an application form) "
                        "and identify all input fields, text areas, select dropdowns, radio buttons, and checkboxes that need to be filled. "
                        "Carefully check if a field is already pre-filled with the correct information from the user's data. If a field is already correctly filled, you do not need to include it in your response JSON. "
                        "Only include fields that are empty, incorrect, or incomplete. "
                        "You also need to identify any application-specific questions asked on the form (e.g., 'Why are you interested in this role?', "
                        "'Describe your experience with X technology', 'What are your salary expectations?', 'Are you authorized to work in X?').\n\n"
                        "You have been provided with the user's Personal Information and their Full Resume data in JSON format below. "
                        "Use the Personal Information JSON to pre-fill standard fields (name, email, phone, address, LinkedIn URL, website, etc.) if they are not already correctly filled. "
                        "For application-specific questions or fields requiring summaries or detailed explanations (like a cover letter section), you MUST synthesize a truthful, nuanced, and relevant answer using the Full Resume JSON and Personal Information. "
                        "DO NOT simply copy-paste verbatim from the resume. Craft well-written, professional responses tailored to the likely context of a job application. "
                        "Do NOT invent information or misrepresent the user's skills or experience. Base your answers *solely* on the provided resume data. "
                        "If the resume does not contain information to answer a specific question, you can state that the information is not available in the resume or provide a generic, non-committal answer IF appropriate, otherwise leave it blank. "
                        "For questions about salary expectations, if not in the resume, you might suggest a placeholder like 'Negotiable' or state it's not specified. "
                        "For yes/no questions (like work authorization), try to infer from the resume (e.g., location, past work) or default to a safe answer if unsure, or leave it for the user. \n\n"
                        "Return a SINGLE JSON object. The keys of this JSON object should be the CSS selectors for each form field or question that needs to be filled or corrected. "
                        "The values should be the data to be entered or the generated answer. "
                        "Example: { \"#firstName\": \"John\", \"#email\": \"john.doe@example.com\", \"textarea[name='question1']\": \"Synthesized answer based on resume...\" }\n\n"
                        "--- User's Personal Information (JSON) ---\n"
                        f"{personal_info_json_str if personal_info_json_str else 'Not Provided'}\n"
                        "--- End User's Personal Information (JSON) ---\n\n"
                        "--- User's Full Resume (JSON) ---\n"
                        f"{resume_json_str if resume_json_str else 'Not Provided'}\n"
                        "--- End User's Full Resume (JSON) ---\n\n"
                        "Analyze the current page HTML and provide the JSON output for filling/correcting the form."
                    )
                    
                    form_agent = Agent(
                        task=form_fill_prompt,
                        llm=llm,
                        browser_context=context,
                        page_override=page,
                        use_vision=True,
                        generate_gif=False,
                        browser=browser,
                        validate_output=False
                    )
                    
                    form_result = await form_agent.run()
                    form_data_str = str(form_result).strip()
                    
                    # Extract JSON data using regex
                    import json
                    json_match = re.search(r'\{.*\}', form_data_str, re.DOTALL)
                    
                    if json_match:
                        try:
                            form_data = json.loads(json_match.group(0))
                            print(f"Found form fields to fill: {form_data}")
                            
                            # Fill out each field
                            for field_selector, value in form_data.items():
                                try:
                                    field = await page.query_selector(field_selector)
                                    if field:
                                        # Determine field type
                                        field_type = await page.evaluate("(el) => el.type || el.tagName.toLowerCase()", field)
                                        
                                        if field_type in ['text', 'email', 'tel', 'textarea', 'url', 'search', 'number', 'password']:
                                            await field.fill(str(value))
                                        elif field_type == 'select':
                                            await field.select_option(value=str(value))
                                        elif field_type == 'checkbox':
                                            if isinstance(value, bool) and value:
                                                await field.check()
                                            elif isinstance(value, str) and value.lower() == 'true':
                                                await field.check()
                                        elif field_type == 'radio':
                                            # For radio buttons, the value in JSON should match the radio button's value attribute
                                            radio_button_to_select = await page.query_selector(f"{field_selector}[value='{value}']")
                                            if radio_button_to_select:
                                                await radio_button_to_select.check()
                                            else:
                                                print(f"Radio button with value '{value}' not found for selector {field_selector}")
                                        print(f"Filled field {field_selector} with {value}")
                                except Exception as field_error:
                                    print(f"Error filling field {field_selector}: {str(field_error)}")
                            
                            # Look for a "Next" or "Continue" button after filling the form
                            next_button_selectors = [
                                "button:has-text('Next')", 
                                "button:has-text('Continue')",
                                "input[type='submit']",
                                "button[type='submit']",
                                "a:has-text('Next')",
                                "a:has-text('Continue')"
                            ]
                            
                            for next_button_sel in next_button_selectors:
                                try:
                                    next_button = await page.query_selector(next_button_sel)
                                    if next_button:
                                        print(f"Clicking {next_button_sel} to proceed to next step")
                                        await next_button.click()
                                        await asyncio.sleep(3)
                                        await page.wait_for_load_state("networkidle", timeout=10000)
                                        
                                        # Check if file inputs are now available
                                        updated_html_after_form_fill = await page.content()
                                        soup = BeautifulSoup(updated_html_after_form_fill, "html.parser")
                                        file_inputs_after_form_fill = soup.find_all("input", {"type": "file"})
                                        if file_inputs_after_form_fill:
                                            file_input_present = True
                                            print("File input found after form submission")
                                            break 
                                except Exception as next_button_error:
                                    print(f"Error clicking next button {next_button_sel}: {str(next_button_error)}")
                        except json.JSONDecodeError:
                            print(f"Could not parse form data JSON: {form_data_str}")
                except Exception as form_error:
                    print(f"Error filling form: {str(form_error)}")

        # Now try to find a file input on the current page
        selector = None
        try:
            html_content_for_selector = await page.content()
            
            # Only try to find selector if we know or believe a file input exists or if selector is 'auto'
            if file_input_present or file_input_selector == 'auto':
                agent_prompt_selector = (
                    f"Given the following HTML, return the best CSS selector for the file input to upload a resume or CV. "
                    f"Only return the selector string, nothing else.\nHTML:\n{html_content_for_selector}"
                )
                agent_selector = Agent(
                    task=agent_prompt_selector,
                    llm=llm,
                    browser_context=context,
                    use_vision=False,
                    generate_gif=False,
                    browser=browser,
                    validate_output=False
                )
                result_selector = await agent_selector.run()
                result_str_selector = str(result_selector)
                selector_match = re.search(r"(input\[.*?\]|input\s*\[.*?\]|input\s*\(.*?\)|input\s*\{.*?\}|#[\w-]+|\.[\w-]+)", result_str_selector)
                if selector_match:
                    selector = selector_match.group(1).strip().replace('"', '').replace("'", "")
                else:
                    for line in result_str_selector.splitlines():
                        line = line.strip().replace('"', '').replace("'", "")
                        if line.startswith('input') or line.startswith('#') or line.startswith('.'):
                            selector = line
                            break
                if selector and ' ' in selector:
                    selector = selector.split(' ')[0]
                    # Validate if the found selector is indeed for an input, preferably file input
                    if selector:
                        try:
                            element_on_page = await page.query_selector(selector)
                            if element_on_page:
                                element_tag = await page.evaluate("(el) => el.tagName.toLowerCase()", element_on_page)
                                element_type = await page.evaluate("(el) => el.type", element_on_page) if element_tag == 'input' else None
                                if not (element_tag == 'input' and (element_type == 'file' or not element_type)):
                                    print(f"Selector {selector} is not for a file input. Discarding.")
                                    selector = None 
                            else:
                                selector = None # Selector didn't find anything
                        except Exception:
                            selector = None # Error querying selector
        except Exception as e:
            print(f"Error finding selector with LLM: {str(e)}")
            selector = None

        # Improved: Prefer resume/CV file inputs, avoid photo/avatar/image inputs
        if not selector:
            html_for_bs = await page.content()
            soup_for_bs = BeautifulSoup(html_for_bs, "html.parser")
            file_inputs_bs = [elem for elem in soup_for_bs.find_all("input", {"type": "file"}) if isinstance(elem, bs4.element.Tag)]

            def is_resume_input(elem):
                # Check for attributes that indicate resume/CV
                for attr in ['name', 'id', 'aria-label', 'placeholder']:
                    val = elem.get(attr, '').lower()
                    if any(x in val for x in ['resume', 'cv', 'document', 'application', 'upload']):
                        return True
                # Check associated label
                if elem.has_attr('id'):
                    label_elem = soup_for_bs.find('label', {'for': elem['id']})
                    if label_elem and any(x in label_elem.get_text().lower() for x in ['resume', 'cv', 'document', 'application', 'upload']):
                        return True
                return False

            def is_photo_input(elem):
                # Check accept attribute for images
                accept = elem.get('accept', '').lower()
                if any(x in accept for x in ['image/', '.jpg', '.jpeg', '.png', '.gif', 'photo', 'avatar', 'profile']):
                    return True
                # Check for attributes that indicate photo/avatar
                for attr in ['name', 'id', 'aria-label', 'placeholder']:
                    val = elem.get(attr, '').lower()
                    if any(x in val for x in ['photo', 'avatar', 'image', 'profile', 'picture']):
                        return True
                # Check associated label
                if elem.has_attr('id'):
                    label_elem = soup_for_bs.find('label', {'for': elem['id']})
                    if label_elem and any(x in label_elem.get_text().lower() for x in ['photo', 'avatar', 'image', 'profile', 'picture']):
                        return True
                return False

            # Prefer resume/CV file inputs
            resume_inputs = [elem for elem in file_inputs_bs if is_resume_input(elem) and not is_photo_input(elem)]
            if resume_inputs:
                input_elem_bs = resume_inputs[0]
            else:
                # Fallback: any file input that is not a photo/avatar
                non_photo_inputs = [elem for elem in file_inputs_bs if not is_photo_input(elem)]
                input_elem_bs = non_photo_inputs[0] if non_photo_inputs else (file_inputs_bs[0] if file_inputs_bs else None)

            if input_elem_bs and input_elem_bs.has_attr("id"):
                selector = f"#{input_elem_bs['id']}"
            elif input_elem_bs and input_elem_bs.has_attr("name"):
                selector = f"input[name='{input_elem_bs['name']}']"
            # Fallback even if no specific attributes, if it's the only one
            elif input_elem_bs and len(file_inputs_bs) == 1:
                selector = "input[type='file']"

        # Try a visual approach if we still don't have a selector or it's not found
        current_selector_element = await page.query_selector(selector) if selector else None
        if not selector or not current_selector_element:
            print("Using visual approach to find file input...")
            try:
                visual_prompt = (
                    "You are looking at a web page that should have a file upload input for a resume/CV. "
                    "Look carefully at the page and identify the exact CSS selector for the file input element. "
                    "Pay special attention to elements that look like file upload buttons, even if they don't have the standard input[type='file'] appearance. "
                    "Return ONLY the CSS selector, nothing else."
                )
                
                visual_agent = Agent(
                    task=visual_prompt,
                    llm=llm,
                    browser_context=context,
                    page_override=page,
                    use_vision=True,
                    generate_gif=False,
                    browser=browser,
                    validate_output=False
                )
                
                visual_result = await visual_agent.run()
                visual_selector = str(visual_result).strip()
                
                if visual_selector:
                    visual_selector = visual_selector.replace('"', '').replace("'", "").strip()
                    
                    # Check if this selector exists
                    visual_element = await page.query_selector(visual_selector)
                    if visual_element:
                        print(f"Found file input using visual detection: {visual_selector}")
                        selector = visual_selector
            except Exception as visual_error:
                print(f"Error in visual detection: {str(visual_error)}")

        # If we still don't have a valid selector, try common file input selectors
        current_selector_element = await page.query_selector(selector) if selector else None
        if not selector or not current_selector_element:
            print("Trying common file input selectors...")
            common_selectors_list = [
                "input[type='file']",
                "input[accept='.pdf']",
                "input[accept='application/pdf']",
                "input[name='resume']",
                "input[name='cv']",
                "input[name*='resume']",
                "input[name*='cv']",
                "input[name*='file']",
                "input[id*='resume']",
                "input[id*='cv']",
                "input[id*='file']",
                "input[id*='upload']",
                ".resume-upload input",
                "#resume-upload input",
                "[data-test*='resume'] input",
                "[data-test*='file'] input",
                "[data-testid*='resume'] input",
                "[data-testid*='file'] input"
            ]
            
            for common_sel in common_selectors_list:
                try:
                    element = await page.query_selector(common_sel)
                    if element:
                        # Verify it's actually a file input
                        element_tag_common = await page.evaluate("(el) => el.tagName.toLowerCase()", element)
                        element_type_common = await page.evaluate("(el) => el.type", element) if element_tag_common == 'input' else None
                        if element_tag_common == "input" and (element_type_common == "file" or not element_type_common):
                            print(f"Found file input using common selector: {common_sel}")
                            selector = common_sel
                            break
                except Exception as common_selector_error:
                    continue
        
        if not selector:
            print("No specific file input selector found after all attempts. Defaulting to generic 'input[type=\"file\"]'.")
            selector = "input[type='file']"

        print(f"Using selector: {selector}")
        max_attempts = 3
        check_result_str = "Not checked"
        for attempt in range(1, max_attempts + 1):
            print(f"Attempt {attempt} to upload file to selector: {selector}")
            file_input_element = await page.query_selector(selector)
            
            if not file_input_element:
                if attempt == max_attempts:
                    # Last resort: try to find any file input element directly with JavaScript
                    try:
                        print("Trying JavaScript approach to find any file input as selector failed...")
                        js_result_id = await page.evaluate("""
                            () => {
                                const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
                                if (fileInputs.length > 0) {
                                    const input = fileInputs[0];
                                    if (!input.id) {
                                       input.id = 'temp-file-input-id-' + Date.now();
                                    }
                                    return input.id;
                                }
                                // Try to find elements that behave like file inputs
                                const customUploaders = Array.from(document.querySelectorAll('[role="button"], [onclick*="file"], [class*="upload"]'));
                                for (const uploader of customUploaders) {
                                    // A very basic check, might need refinement
                                    if (uploader.textContent.toLowerCase().includes('upload') || uploader.textContent.toLowerCase().includes('attach')) {
                                        if (!uploader.id) {
                                            uploader.id = 'temp-custom-uploader-id-' + Date.now();
                                        }
                                        return uploader.id; // This might not be a file input directly
                                    }
                                }
                                return null;
                            }
                        """)
                        
                        if js_result_id:
                            print(f"Found element using JavaScript with ID: {js_result_id}")
                            selector = f"#{js_result_id}"
                            file_input_element = await page.query_selector(selector)
                            
                    except Exception as js_error:
                        print(f"JavaScript approach failed: {str(js_error)}")
                    
                    # If we still haven't found a file input, look for hidden inputs or custom upload buttons
                    if not file_input_element:
                        try:
                            print("Looking for hidden file inputs or custom upload buttons as a final fallback...")
                            hidden_input_eval_result = await page.evaluate("""
                                () => {
                                    // First, try to find any hidden file inputs
                                    const hiddenInputs = Array.from(document.querySelectorAll('input[type="file"][style*="display: none"], input[type="file"][style*="visibility: hidden"], input[type="file"][hidden]'));
                                    
                                    if (hiddenInputs.length > 0) {
                                        // Make the hidden input visible
                                        const input = hiddenInputs[0];
                                        input.style.display = 'block';
                                        input.style.visibility = 'visible';
                                        input.style.position = 'relative';
                                        input.style.zIndex = '99999';
                                        input.hidden = false;
                                        if (!input.id) input.id = 'temp-hidden-file-input-' + Date.now();
                                        return { type: 'hidden', id: input.id };
                                    }
                                    
                                    // Look for custom upload buttons (divs/spans that might have click handlers)
                                    const uploadButtons = Array.from(document.querySelectorAll('button, div, span, a')).filter(el => {
                                        const text = (el.textContent || "").toLowerCase();
                                        return text.includes('upload') || text.includes('attach') || text.includes('resume') || 
                                               text.includes('browse') || text.includes('choose file') || text.includes('select file');
                                    });
                                    
                                    if (uploadButtons.length > 0) {
                                        const button = uploadButtons[0];
                                        if(!button.id) button.id = 'temp-upload-button-' + Date.now();
                                        return { type: 'button', id: button.id };
                                    }
                                    
                                    return null;
                                }
                            """)
                            
                            if hidden_input_eval_result:
                                if hidden_input_eval_result.get('type') == 'hidden':
                                    print(f"Found and made visible a hidden file input: #{hidden_input_eval_result.get('id')}")
                                    selector = f"#{hidden_input_eval_result.get('id')}"
                                    file_input_element = await page.query_selector(selector)
                                elif hidden_input_eval_result.get('type') == 'button':
                                    print(f"Found a custom upload button: #{hidden_input_eval_result.get('id')}")
                                    custom_button_element = await page.query_selector(f"#{hidden_input_eval_result.get('id')}")
                                    if custom_button_element:
                                        # Click the button to trigger the file dialog
                                        await custom_button_element.click()
                                        await asyncio.sleep(2)
                                        
                                        # After clicking, look for newly created/revealed file inputs
                                        newly_revealed_input_id = await page.evaluate("""
                                            () => {
                                                const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
                                                // Prefer visible inputs
                                                const visibleInputs = inputs.filter(el => el.offsetParent !== null);
                                                if (visibleInputs.length > 0) {
                                                    if(!visibleInputs[0].id) visibleInputs[0].id = 'temp-triggered-file-input-' + Date.now();
                                                    return visibleInputs[0].id;
                                                } else if (inputs.length > 0) { // Fallback to any file input
                                                    if(!inputs[0].id) inputs[0].id = 'temp-triggered-file-input-' + Date.now();
                                                    return inputs[0].id;
                                                }
                                                return null;
                                            }
                                        """)
                                        
                                        if newly_revealed_input_id:
                                            print(f"Found file input after clicking custom button: #{newly_revealed_input_id}")
                                            selector = f"#{newly_revealed_input_id}"
                                            file_input_element = await page.query_selector(selector)
                        except Exception as hidden_error:
                            print(f"Error looking for hidden inputs/custom buttons: {str(hidden_error)}")
                    
                    if not file_input_element:
                        upload_task_statuses[task_id].status = "failed"
                        upload_task_statuses[task_id].error = f"Could not find file input for selector: {selector} after all fallbacks."
                        upload_task_statuses[task_id].end_time = datetime.now()
                        return
                else:
                    print(f"Selector {selector} failed on attempt {attempt}. Trying generic 'input[type=\"file\"]' for next attempt.")
                    selector = "input[type='file']"
                    continue
                
            try:
                print(f"Attempting to set input files to: {file_path} for selector {selector}")
                is_visible = await file_input_element.is_visible()
                if not is_visible:
                    print(f"File input {selector} is not visible. Attempting to make it visible.")
                    await page.evaluate("(element) => { element.style.display = 'block'; element.style.visibility = 'visible'; element.hidden = false; }", file_input_element)
                    await asyncio.sleep(0.5)

                await file_input_element.set_input_files(file_path)
                
                # Trigger change event to ensure the file upload is recognized
                await page.evaluate("""
                    (input) => {
                        const event = new Event('change', { bubbles: true });
                        input.dispatchEvent(event);
                    }
                """, file_input_element)
                
                await asyncio.sleep(2)
                updated_html_after_upload = await page.content()
                
                check_prompt_upload = (
                    f"Given the following HTML after attempting to upload a file, "
                    f"does it look like the file '{os.path.basename(file_path)}' was uploaded successfully? "
                    f"Look for the file name, a remove/delete button, or any success message or just a change to the html. "
                    f"Return 'yes' or 'no' and explain why.\nHTML:\n{updated_html_after_upload}"
                )
                
                check_agent_upload = Agent(
                    task=check_prompt_upload,
                    llm=llm,
                    browser_context=context,
                    use_vision=False,
                    generate_gif=False,
                    browser=browser,
                    validate_output=False
                )
                
                check_result = await check_agent_upload.run()
                check_result_str = str(check_result).strip()
                print(f"Upload check result (attempt {attempt}): {check_result_str}")
                
                if 'yes' in check_result_str.lower():
                    # File upload succeeded, now let the agent fill out the rest of the form using vision and reasoning
                    try:
                        print("File upload confirmed. Running agent to fill out the rest of the form using vision and reasoning.")
                        vision_prompt = (
                            "You are applying to a job on this page. The resume has already been uploaded. "
                            "Your task is to fill out all *remaining* required fields and answer any questions. "
                            "Use vision and reasoning to interact with the page directly (click, type, select, etc.). "
                            "IMPORTANT: Carefully observe the existing values in form fields. If a field is already correctly pre-filled with information derived from the JSONs below, DO NOT refill it. Only fill empty fields or fields that contain incorrect or incomplete information. "
                            "For text areas requiring answers to specific questions (e.g., 'Why are you interested in this role?', 'Summarize your experience', 'Cover letter section'), you MUST synthesize a well-crafted, professional response based on the provided Personal Information and Resume JSON. Do NOT just copy-paste from the resume. Strive for clarity, conciseness, truthfulness, and relevance. "
                            "Do not upload a photo unless explicitly part of the resume upload process. When all necessary fields are completed and answers provided, submit the application if possible.\n\n"
                            "--- Personal Information JSON ---\n"
                            f"{personal_info_json_str if personal_info_json_str else 'Not Provided'}\n"
                            "--- End Personal Information JSON ---\n\n"
                            "--- Resume JSON ---\n"
                            f"{resume_json_str if resume_json_str else 'Not Provided'}\n"
                            "--- End Resume JSON ---"
                        )
                        print("[DEBUG] Vision agent prompt:")
                        print(vision_prompt)
                        vision_agent = Agent(
                            task=vision_prompt,
                            llm=llm,
                            browser_context=context,
                            use_vision=True,
                            generate_gif=False,
                            browser=browser,
                            validate_output=True
                        )
                        await vision_agent.run()
                        print("Agent finished vision-based form filling and submission.")
                    except Exception as form_fill_error:
                        print(f"Error running vision-based form fill agent: {str(form_fill_error)}")
                    upload_task_statuses[task_id].status = "completed"
                    upload_task_statuses[task_id].result = {
                        "status": "file uploaded and form filled via agent/automation",
                        "file_path": file_path,
                        "target_url": target_url,
                        "file_input_selector": selector,
                        "upload_check": check_result_str,
                        "attempt": attempt
                    }
                    upload_task_statuses[task_id].end_time = datetime.now()
                    return
            except Exception as e:
                print(f"Attempt {attempt} to upload file failed: {str(e)}")
                if attempt == max_attempts:
                    upload_task_statuses[task_id].error = f"File upload failed after {max_attempts} attempts. Last error: {str(e)}. Last selector: {selector}"
                await asyncio.sleep(1)
                
        # If loop finishes without returning, it means all attempts failed
        upload_task_statuses[task_id].status = "failed"
        if not upload_task_statuses[task_id].error:
             upload_task_statuses[task_id].error = f"File upload failed after {max_attempts} attempts. Final selector tried: {selector}."
        upload_task_statuses[task_id].result = {"last_upload_check": check_result_str if 'check_result_str' in locals() else "Upload check not performed or failed"}
        upload_task_statuses[task_id].end_time = datetime.now()

    except Exception as e:
        print(f"Critical error in execute_upload_task: {str(e)}")
        upload_task_statuses[task_id].status = "failed"
        upload_task_statuses[task_id].error = str(e)
        upload_task_statuses[task_id].end_time = datetime.now()
    finally:
        # Clean up temporary files
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                print(f"Removed temporary file: {temp_file_path}")
            except Exception as e:
                print(f"Error removing temporary file {temp_file_path}: {str(e)}")
        # Do not remove the primary file_path if it wasn't a temp download (e.g., uploaded directly)
        # The resume files in the "resume" directory are generally meant to be kept unless explicitly temporary

@app.get("/test-upload-status/{task_id}")
async def get_test_upload_status(task_id: str):
    if task_id not in upload_task_statuses:
        raise HTTPException(status_code=404, detail=f"Upload task with ID {task_id} not found")
    upload_status = upload_task_statuses[task_id]
    elapsed = (upload_status.end_time or datetime.now()) - upload_status.start_time
    return {
        "task_id": upload_status.task_id,
        "status": upload_status.status,
        "file_name": upload_status.file_name,
        "target_url": upload_status.target_url,
        "start_time": upload_status.start_time.isoformat(),
        "end_time": upload_status.end_time.isoformat() if upload_status.end_time else None,
        "result": upload_status.result,
        "error": upload_status.error,
        "elapsed_seconds": int(elapsed.total_seconds())
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    args = parser.parse_args()

    # Update browser config with headless mode
    browser.config.headless = args.headless

    uvicorn.run(app, host="0.0.0.0", port=args.port)
