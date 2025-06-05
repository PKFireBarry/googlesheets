import asyncio
import os
import sys
import random
import uuid
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
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

# Configuration constants
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
]

SCREEN_RESOLUTIONS = [{"width": 1920, "height": 1080}, {"width": 1366, "height": 768}]

RESUME_KEYWORDS = ['resume', 'file', 'upload', 'document', 'cv']
RESUME_FILE_TYPES = ['.pdf', '.doc', '.docx', 'application/pdf']

# System message for AI agents
JSON_SYSTEM_MESSAGE = """
Respond ONLY with valid JSON. Do not include any text before or after the JSON.

IMPORTANT JSON FORMATTING RULES:
1. Use double quotes for all JSON keys and string values
2. NEVER use escaped single quotes (\\') in your JSON
3. NEVER use escaped double quotes (\\\") inside JSON strings
4. If you need to include quotes in a string value, use single quotes without escaping them
5. Ensure all JSON is properly nested and formatted

Example of CORRECT format:
{"current_state": {"evaluation": "I clicked on 'Apply Now' button", "memory": "I am on the job application page"}, "action": [{"click": {"selector": "#apply-button"}}]}
"""

async def human_like_delay(min_delay=0.5, max_delay=2.0):
    """Add a random human-like delay between actions"""
    await asyncio.sleep(random.uniform(min_delay, max_delay))

def update_task_status(task_id, status, message, progress, **kwargs):
    """Update task status with additional fields"""
    tasks[task_id].update({
        "status": status,
        "message": message,
        "progress": progress,
        **kwargs
    })

@app.get('/auto-apply-status/{task_id}')
async def get_task_status(task_id: str):
    """Get the status of a task by its ID"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    try:
        return JSONResponse(content={
            "status": tasks[task_id].get("status", "unknown"),
            "message": tasks[task_id].get("message", ""),
            "progress": tasks[task_id].get("progress", 0),
            "error": tasks[task_id].get("error", ""),
            "result": tasks[task_id].get("result", {})
        })
    except Exception as e:
        print(f"Error getting task status: {e}")
        return JSONResponse(
            content={"status": "error", "message": f"Error retrieving task status: {str(e)}", "progress": 0},
            status_code=500
        )

@app.post('/auto-apply')
async def run_agent(
    prompt: str = Form(...),
    url: str = Form(...),
    api_key: str = Form(...),
    file: UploadFile = File(None),
    file_url: str = Form(None)
):
    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="API key must be provided in the request.")

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "starting",
        "progress": 0,
        "message": "Starting the auto-apply process"
    }
    
    # Run the task in the background
    asyncio.create_task(process_auto_apply(task_id, prompt, url, api_key, file, file_url))
    
    return JSONResponse(content={"task_id": task_id, "status": "starting"})

async def handle_file_upload(file, file_url):
    """Process file upload from either direct upload or URL"""
    if file is not None:
        suffix = os.path.splitext(file.filename)[-1]
        async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            await tmp.write(content)
            return tmp.name
    elif file_url:
        if file_url.startswith('data:'):
            # Parse data URL
            match = re.match(r'data:(?P<mime>[^;]+);filename=(?P<filename>[^;]+);base64,(?P<data>.+)', file_url)
            if not match:
                return None
            suffix = os.path.splitext(match.group('filename'))[-1]
            file_data = base64.b64decode(match.group('data'))
        else:
            # Download file from HTTP(S) URL
            r = requests.get(file_url)
            r.raise_for_status()
            suffix = os.path.splitext(file_url)[-1]
            file_data = r.content
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_data)
            return tmp.name
    return None

async def setup_browser_session():
    """Initialize and configure browser session with stealth capabilities"""
    user_agent = random.choice(USER_AGENTS)
    screen_resolution = random.choice(SCREEN_RESOLUTIONS)
    
    # Initialize patchright for stealth capabilities
    patchright = await async_patchright().start()
    
    # Create browser profile with stealth settings
    browser_profile = BrowserProfile(
        viewport_expansion=0,
        user_data_dir=f"~/.config/browseruse/profiles/job_apply_{os.getpid()}",
        headless=False,
        keep_alive=True,
        executable_path='/usr/bin/google-chrome',
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
        device_scale_factor=1.0
    )
    
    # Create and initialize browser session
    browser_session = BrowserSession(browser_profile=browser_profile, playwright=patchright)
    await browser_session.start()
    
    return browser_session, patchright

async def find_and_upload_resume(browser_session, temp_file_path):
    """Find resume upload field and upload the file if available"""
    if not temp_file_path:
        return {"success": True, "message": "No file to upload"}
        
    try:
        # Get the HTML content
        html = await browser_session.get_page_html()
        soup = BeautifulSoup(html, 'html.parser')
        file_inputs = soup.find_all('input', {'type': 'file'})
        
        # Find resume input field
        resume_input = None
        for input_el in file_inputs:
            # Check for resume-related attributes
            accept_attr = input_el.get('accept', '')
            if accept_attr and any(ext in accept_attr.lower() for ext in RESUME_FILE_TYPES):
                resume_input = input_el
                break
                
            # Check attributes and parent text for resume keywords
            for attr, value in input_el.attrs.items():
                if any(keyword in attr.lower() for keyword in RESUME_KEYWORDS) or \
                   (isinstance(value, str) and any(keyword in value.lower() for keyword in RESUME_KEYWORDS)):
                    resume_input = input_el
                    break
                    
            # Check parent elements
            parent = input_el.parent
            for _ in range(3):
                if parent and parent.get_text() and any(keyword in parent.get_text().lower() for keyword in RESUME_KEYWORDS):
                    resume_input = input_el
                    break
                parent = parent.parent if parent else None
                
            if resume_input:
                break
        
        if resume_input and temp_file_path:
            page = await browser_session.get_current_page()
            await human_like_delay()
            
            # Get selector for the file input
            selector = None
            if resume_input.get('id'):
                selector = f"#{resume_input['id']}"
            elif resume_input.get('name'):
                selector = f"input[name='{resume_input['name']}']"
            elif resume_input.get('class'):
                class_names = ' '.join(resume_input['class'])
                selector = f"input.{class_names.replace(' ', '.')}"
            else:
                for i, el in enumerate(file_inputs):
                    if el == resume_input:
                        selector = f"//input[@type='file'][{i+1}]"
                        break
            
            if selector:
                # Get file input element and make it visible
                file_input = await page.wait_for_selector(
                    f"xpath={selector}" if selector.startswith('//') else selector, 
                    timeout=5000
                )
                
                if file_input:
                    # Make file input visible if hidden
                    await page.evaluate_handle("""(selector) => {
                        const el = document.querySelector(selector) || 
                                  document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if (el) {
                            el.style.display = 'block';
                            el.style.opacity = '1';
                            el.style.visibility = 'visible';
                            el.style.position = 'relative';
                        }
                    }""", selector)
                    
                    await human_like_delay()
                    await file_input.set_input_files(temp_file_path)
                    await asyncio.sleep(random.uniform(1.5, 3))
                    return {"success": True, "message": "Resume uploaded successfully"}
            
            # Fallback to any file input if specific selector fails
            all_file_inputs = await page.query_selector_all('input[type="file"]')
            if all_file_inputs and len(all_file_inputs) > 0:
                await human_like_delay()
                await all_file_inputs[0].set_input_files(temp_file_path)
                await asyncio.sleep(random.uniform(1.5, 3))
                return {"success": True, "message": "Resume uploaded with fallback method"}
                
        return {"success": True, "message": "No resume input field found"}
    except Exception as e:
        print(f"Error during resume upload: {e}")
        return {"success": False, "message": f"Resume upload error: {str(e)}"}

async def process_auto_apply(task_id, prompt, url, api_key, file, file_url):
    """Process the auto-apply task in the background"""
    temp_file_path = None
    browser_session = None
    patchright = None
    
    try:
        # Process file upload
        update_task_status(task_id, "processing", "Processing file upload", 10)
        temp_file_path = await handle_file_upload(file, file_url)
        
        # Initialize browser and LLM
        update_task_status(task_id, "processing", "Initializing browser", 20)
        llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
        browser_session, patchright = await setup_browser_session()
        await human_like_delay()
        
        # Step 1: Find application form
        update_task_status(task_id, "in_progress", "Finding application form", 30)
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
            extend_system_message=JSON_SYSTEM_MESSAGE,
            enable_memory=True,
            tool_calling_method='auto'
        )
        
        try:
            find_form_result = await form_finder_agent.run(max_steps=25)
            form_result = {
                "success": True,
                "final_url": find_form_result.get("final_url", url),
                "message": "Successfully found application form"
            }
        except Exception as e:
            print(f"Error finding form: {e}")
            form_result = {
                "success": False,
                "error": str(e),
                "message": "Failed to find application form"
            }
        
        await asyncio.sleep(random.uniform(2, 4))
        update_task_status(task_id, "in_progress", "Uploading resume", 50, form_result=form_result)
        
        # Step 2: Upload resume if available
        resume_result = await find_and_upload_resume(browser_session, temp_file_path)
        update_task_status(task_id, "in_progress", "Filling application form", 70, resume_upload=resume_result)
        await human_like_delay()
        
        # Step 3: Fill out application form
        apply_task = f"""your goal is to use the following personal/resume data information for a job application\n Fill out the text inputs, textareas, and answer any questions using the information provided.\nIgnore any optional data and the resume or photo upload inputs and any other inputs that are not text inputs, textareas, questions, checkboxes, or radio buttons.\nOnce all the required fields are completed consider the task complete and return the results.\n\nIMPORTANT: Act like a human user. Type at a natural pace with brief pauses between fields. Don't fill out forms too quickly or in a robotic pattern. Occasionally make small typos and correct them. Navigate through fields in a natural order, sometimes using tab key and sometimes clicking directly.\n\n{prompt}"""
        
        apply_agent = Agent(
            task=apply_task,
            llm=llm,
            max_actions_per_step=2,
            browser_session=browser_session,
            use_vision=True,
            use_vision_for_planner=True,
            max_failures=3,
            retry_delay=15,
            extend_system_message=JSON_SYSTEM_MESSAGE,
            enable_memory=True,
            tool_calling_method='auto'
        )
        
        try:
            await apply_agent.run(max_steps=25)
            update_task_status(
                task_id, 
                "completed", 
                "Application submitted successfully", 
                100, 
                result={"success": True, "message": "Application submitted successfully"}
            )
        except Exception as e:
            error_message = str(e)
            if "Failed to parse model output" in error_message or "Invalid \escape" in error_message:
                error_message = "The AI had trouble parsing the form. This often happens with complex forms or when special characters cause parsing issues."
            
            update_task_status(
                task_id, 
                "failed", 
                f"Error: {error_message}", 
                100, 
                error=error_message
            )
        
    except Exception as e:
        print(f"Error in run_agent: {e}")
        update_task_status(task_id, "failed", f"Error: {str(e)}", 100, error=str(e))
    finally:
        # Clean up resources
        if browser_session:
            try:
                await browser_session.stop()
            except Exception as e:
                print(f"Error closing browser session: {e}")
                
        if patchright:
            try:
                await patchright.stop()
            except Exception as e:
                print(f"Error stopping patchright: {e}")
                
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"Error removing temp file: {e}")

if __name__ == '__main__':
    uvicorn.run("simple.py:app", host="0.0.0.0", port=8000, reload=True)