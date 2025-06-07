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
		llm = ChatGoogleGenerativeAI(model='gemini-2.5-pro-preview-06-05', api_key=api_key)
		
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
            permissions=["geolocation"]
		)
		
		# Use patchright with browser session for stealth capabilities
		browser_session = BrowserSession(
			browser_profile=browser_profile,
			playwright=patchright,
		)
		
		# Initialize the browser session
		await browser_session.start()
		
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
			extend_system_message='Respond ONLY with valid JSON. Do not include any text before or after the JSON. Use double quotes for all strings. Do not escape single quotes. Do not include comments. Do not include markdown.',
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
			max_failures=3,
			retry_delay=15,
			extend_system_message='Respond ONLY with valid JSON. Do not include any text before or after the JSON. Use double quotes for all strings. Do not escape single quotes. Do not include comments. Do not include markdown.',
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

@app.post('/test-browser')
async def test_browser(
    url: str = Form(...),  ### This is the URL to navigate to for testing
    prompt: str = Form(...),  ### This is the task/prompt for the browser agent to execute
    api_key: str = Form(...)  ### This is the API key for the Google Gemini API
):
    """Test browser stealth capabilities with the same configuration as auto-apply"""
    
    # Enforce that api_key is provided and non-empty
    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="API key must be provided in the request. No fallback to environment variable is allowed.")

    # Run the task directly
    asyncio.create_task(process_browser_test(url, prompt, api_key))
    
    # Return simple confirmation
    return JSONResponse(content={"message": "Browser test started", "url": url})

async def process_browser_test(url, prompt, api_key):
    """Process the browser test task in the background"""
    browser_session = None
    patchright = None
    
    try:
        print("Starting browser test...")
        
        # Configure the LLM
        llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
        
        # Select random user agent and screen resolution for better stealth
        user_agent = random.choice(USER_AGENTS)
        screen_resolution = random.choice(SCREEN_RESOLUTIONS)
        
        # Create a browser profile with unique user data dir to avoid conflicts
        unique_user_data_dir = f"~/.config/browseruse/profiles/browser_test_{os.getpid()}"
        
        # Initialize patchright for stealth capabilities
        patchright = await async_patchright().start()
        
        # Create a single browser session with stealth configuration
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
            permissions=["geolocation"]
        )
        
        # Use patchright with browser session for stealth capabilities
        browser_session = BrowserSession(
            browser_profile=browser_profile,
            playwright=patchright,
        )
        
        # Initialize the browser session
        await browser_session.start()
        
        # Add initial human-like delay before navigation
        await human_like_delay()
        
        print("Browser initialized, starting agent...")
        
        # Create the browser test task
        test_task = f"Go to this URL: {url}\n\n{prompt}"
        
        # Create the agent with the same configuration as auto-apply
        test_agent = Agent(
            task=test_task,
            llm=llm,
            max_actions_per_step=15,
            browser_session=browser_session,
            use_vision=True,
            use_vision_for_planner=True,
            max_failures=3,
            retry_delay=15,
            extend_system_message='Respond ONLY with valid JSON. Do not include any text before or after the JSON. Use double quotes for all strings. Do not escape single quotes. Do not include comments. Do not include markdown.',
            enable_memory=True,
            tool_calling_method='auto'
        )
        
        # Run the test agent
        try:
            result = await test_agent.run(max_steps=25)
            print("Browser test completed successfully!")
            
        except Exception as e:
            error_message = str(e)
            print(f"Error in browser test agent: {error_message}")
            
    except Exception as e:
        print(f"Error in browser test: {e}")
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

# For local testing: python simple.py
if __name__ == '__main__':
	uvicorn.run("simple:app", host="0.0.0.0", port=8000, reload=True)