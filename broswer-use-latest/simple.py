import asyncio
import os
import sys
import random
import time
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

# Human-like behavior utilities
async def human_delay(min_seconds=0.5, max_seconds=2.0):
    """Add a random delay to simulate human thinking/reaction time"""
    delay = random.uniform(min_seconds, max_seconds)
    await asyncio.sleep(delay)
    return delay

async def human_typing(page, selector, text, min_delay=0.05, max_delay=0.15):
    """Type text like a human with variable speed and occasional pauses"""
    await page.click(selector)
    await human_delay(0.2, 0.5)  # Small pause before typing
    
    for char in text:
        await page.type(selector, char, delay=random.uniform(min_delay, max_delay) * 1000)
        
        # Occasionally pause while typing (simulating thinking)
        if random.random() < 0.05:  # 5% chance of pause
            await human_delay(0.3, 1.2)

async def human_mouse_movement(page, start_x=None, start_y=None, end_selector=None, steps=10):
    """Move mouse in a human-like way with slight randomness in path"""
    viewport_size = await page.viewport_size()
    width, height = viewport_size["width"], viewport_size["height"]
    
    # Default start position if not specified
    if start_x is None or start_y is None:
        start_x = random.randint(0, width)
        start_y = random.randint(0, height)
    
    # Get end position
    if end_selector:
        element = await page.query_selector(end_selector)
        if element:
            bounding_box = await element.bounding_box()
            if bounding_box:
                end_x = bounding_box["x"] + bounding_box["width"] / 2
                end_y = bounding_box["y"] + bounding_box["height"] / 2
            else:
                end_x = random.randint(0, width)
                end_y = random.randint(0, height)
        else:
            end_x = random.randint(0, width)
            end_y = random.randint(0, height)
    else:
        end_x = random.randint(0, width)
        end_y = random.randint(0, height)
    
    # Calculate control points for a slightly curved path (Bezier-like)
    control_x = (start_x + end_x) / 2 + random.uniform(-100, 100)
    control_y = (start_y + end_y) / 2 + random.uniform(-100, 100)
    
    # Move mouse along the path
    for i in range(steps + 1):
        t = i / steps
        # Quadratic Bezier curve calculation
        x = (1-t)**2 * start_x + 2*(1-t)*t * control_x + t**2 * end_x
        y = (1-t)**2 * start_y + 2*(1-t)*t * control_y + t**2 * end_y
        
        # Add slight randomness to the path
        x += random.uniform(-5, 5)
        y += random.uniform(-5, 5)
        
        # Keep within viewport bounds
        x = max(0, min(width, x))
        y = max(0, min(height, y))
        
        await page.mouse.move(x, y)
        
        # Variable speed (slower at beginning and end, faster in middle)
        delay = 0.01
        if i < steps * 0.2 or i > steps * 0.8:
            delay = random.uniform(0.01, 0.03)  # Slower at start/end
        else:
            delay = random.uniform(0.005, 0.01)  # Faster in middle
        
        await asyncio.sleep(delay)
    
    return end_x, end_y

async def human_scroll(page, direction="down", distance=None, speed="medium"):
    """Scroll like a human with variable speed and occasional pauses"""
    viewport_size = await page.viewport_size()
    height = viewport_size["height"]
    
    if distance is None:
        if direction == "down":
            distance = random.randint(int(height * 0.3), int(height * 0.7))
        else:
            distance = -random.randint(int(height * 0.3), int(height * 0.7))
    
    # Determine scroll speed
    if speed == "slow":
        steps = random.randint(15, 25)
    elif speed == "medium":
        steps = random.randint(8, 14)
    else:  # fast
        steps = random.randint(4, 7)
    
    # Scroll in steps to simulate human behavior
    step_size = distance / steps
    for i in range(steps):
        await page.mouse.wheel(0, step_size)
        
        # Variable delay between scroll steps
        if i < 2 or i > steps - 3:
            # Slower at beginning and end
            await asyncio.sleep(random.uniform(0.04, 0.08))
        else:
            # Faster in the middle
            await asyncio.sleep(random.uniform(0.02, 0.05))
    
    # Occasionally add a small pause after scrolling
    if random.random() < 0.3:  # 30% chance
        await human_delay(0.5, 1.5)

class HumanizedAgent(Agent):
    """Extension of the Agent class with humanized behaviors"""
    
    async def humanized_action(self, action_type, **kwargs):
        """Perform a humanized browser action"""
        page = await self.browser_session.get_current_page()
        
        if action_type == "click":
            selector = kwargs.get("selector")
            if selector:
                # Move mouse to element and click
                await human_mouse_movement(page, end_selector=selector)
                await human_delay(0.1, 0.3)
                await page.click(selector, delay=random.uniform(50, 150))
                return True
        
        elif action_type == "type":
            selector = kwargs.get("selector")
            text = kwargs.get("text")
            if selector and text:
                await human_typing(page, selector, text)
                return True
        
        elif action_type == "scroll":
            direction = kwargs.get("direction", "down")
            await human_scroll(page, direction=direction)
            return True
        
        return False

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

	temp_file_path = None
	browser_session = None
	patchright = None
	
	try:
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
					raise HTTPException(status_code=400, detail='Invalid data URL format for file_url')
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

		# Always configure the LLM
		llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
		
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
		)
		
		# Use patchright with browser session for stealth capabilities
		browser_session = BrowserSession(
			browser_profile=browser_profile,
			playwright=patchright,
		)
		
		# Initialize the browser session
		await browser_session.start()
		
		# Add a random initial delay to simulate human startup behavior
		await human_delay(1.5, 3.0)
		
		# Get the page and perform some initial human-like actions
		page = await browser_session.get_current_page()
		
		# Set a more realistic user agent
		realistic_user_agents = [
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
		]
		await page.evaluate(f"() => {{ Object.defineProperty(navigator, 'userAgent', {{ get: () => '{random.choice(realistic_user_agents)}' }}); }}")
		
		# Navigate to the URL with human-like behavior
		print(f"Navigating to {url} with human-like behavior...")
		await page.goto("about:blank")  # Start with blank page
		await human_delay(0.5, 1.5)
		
		# Type URL in address bar with human-like typing
		await page.goto(url)
		
		# Simulate initial page exploration
		await human_delay(1.0, 2.5)  # Initial pause to "read" the page
		await human_scroll(page, direction="down", speed="medium")
		await human_delay(1.0, 2.0)
		await human_scroll(page, direction="down", speed="slow")
		await human_delay(0.8, 1.5)
		await human_scroll(page, direction="up", speed="medium")
		await human_delay(1.2, 2.5)
		
		## Step 1: Finding the application form to submit an application 
		## have an ai agent navigate the page till the application form is found
		find_application_form = f"""go to this URL:{url},\n what your looking at a job application and need to navigate to the appliaciton form.\nif the form is already shown on the screen stop and consider the task completed.\nif the application form is not shown on the screen naviagate the webiste to find to form and then consider the task complete\n"""
		form_finder_agent = HumanizedAgent(
			task=find_application_form,
			llm=llm,
			max_actions_per_step=10,  # Reduced from 15 to slow down
			browser_session=browser_session,
			use_vision=True,
			use_vision_for_planner=True,
			max_failures=3,
			retry_delay=15,
			extend_system_message='Respond ONLY with valid JSON. Do not include any text before or after the JSON. Use double quotes for all strings. Do not escape single quotes. Do not include comments. Do not include markdown.',
			enable_memory=True,
			tool_calling_method='auto'
		)
		find_form_result = await form_finder_agent.run(max_steps=25)
		
		# Add a delay to ensure the page is fully loaded and stable
		await human_delay(2.0, 4.0)
		
		## Step 2: Fetch the page HTML and parse for resume file input
		## Use the browser session directly to get the page HTML and find the file input
		print("Fetching current page HTML after agent navigation...")
		try:
			# Verify browser session is still active
			if not browser_session.is_connected():
                # Reconnect if needed
				print("Browser session disconnected, reconnecting...")
				await browser_session.start()
				
				# Navigate back to the current URL if needed
				current_url = find_form_result.get('final_url', url)
				if current_url:
					await browser_session.navigate_to(current_url)
					await human_delay(1.5, 3.0)
			
			# Get the HTML content
			html = await browser_session.get_page_html()
			print("Fetched HTML, parsing with BeautifulSoup...")
			
			# Parse HTML to find file inputs
			soup = BeautifulSoup(html, 'html.parser')
			file_inputs = soup.find_all('input', {'type': 'file'})
			print(f"Found {len(file_inputs)} file input elements")
			
			# Look for resume upload fields with expanded criteria
			resume_inputs = []
			
			for input_el in file_inputs:
				print(f"Examining file input: {input_el}")
				resume_score = 0
				
				# Check all attributes for resume-related keywords
				for attr, value in input_el.attrs.items():
					if isinstance(value, str):
						if any(keyword in attr.lower() for keyword in ['resume', 'cv']):
							resume_score += 3
						elif any(keyword in attr.lower() for keyword in ['file', 'upload', 'document']):
							resume_score += 1
							
						if any(keyword in value.lower() for keyword in ['resume', 'cv']):
							resume_score += 3
						elif any(keyword in value.lower() for keyword in ['file', 'upload', 'document']):
							resume_score += 1
							
						# Check for document type acceptance
						if attr == 'accept' and any(ext in value.lower() for ext in ['.pdf', '.doc', '.docx']):
							resume_score += 2
				
				# Check parent elements for resume-related text
				parent = input_el.parent
				for _ in range(3):  # Check up to 3 levels up
					if parent and parent.get_text():
						parent_text = parent.get_text().lower()
						if any(keyword in parent_text for keyword in ['resume', 'cv']):
							resume_score += 3
						elif any(keyword in parent_text for keyword in ['upload', 'document', 'file']):
							resume_score += 1
					parent = parent.parent if parent else None
				
				if resume_score > 0:
					resume_inputs.append((input_el, resume_score))
			
			# Sort by score in descending order
			resume_inputs.sort(key=lambda x: x[1], reverse=True)
			
			if resume_inputs:
				# Get the current page from the browser session
				page = await browser_session.get_current_page()
				
				# Try to upload to each potential resume input until successful
				upload_success = False
				
				for resume_input, score in resume_inputs:
					print(f"Attempting upload to input with score {score}: {resume_input}")
					
					if temp_file_path:
						try:
							# Find a selector for the file input
							selector = None
							if resume_input.get('id'):
								selector = f"#" + resume_input['id']
							elif resume_input.get('name'):
								selector = f"input[name='{resume_input['name']}']"
							elif resume_input.get('class'):
								class_names = ' '.join(resume_input['class'])
								selector = f"input.{class_names.replace(' ', '.')}"
							else:
								# Use XPath as fallback
								for i, el in enumerate(file_inputs):
									if el == resume_input:
										selector = f"//input[@type='file'][{i+1}]"
										break
							
							if selector:
								print(f"Using selector {selector} to upload file {temp_file_path}")
								
								try:
									# First try to evaluate the selector to make sure it exists
									if selector.startswith('//'):
										elements = await page.query_selector_all(f"xpath={selector}")
									else:
										elements = await page.query_selector_all(selector)
									
									if not elements:
										print(f"No elements found with selector {selector}")
										continue
									
									# Look for any upload button near the file input
									upload_button = None
									if selector.startswith('//'):
										# Try to find a nearby button if using XPath
										upload_buttons = await page.query_selector_all("xpath=//button[contains(translate(., 'UPLOAD', 'upload'), 'upload') or contains(@class, 'upload') or contains(@id, 'upload')]")
									else:
										# Try CSS approach
										upload_buttons = await page.query_selector_all("button:has-text('Upload'), button[class*='upload' i], button[id*='upload' i]")
									
									# Simulate human exploration before upload
									await human_scroll(page, direction="down", speed="slow")
									await human_delay(0.8, 1.5)
									
									# Force the file input to be visible if needed
									if selector.startswith('//'):
										await page.evaluate(f"""
											(() => {{
												const elements = document.evaluate('{selector}', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
												for (let i = 0; i < elements.snapshotLength; i++) {{
													const el = elements.snapshotItem(i);
													if (el) {{
														el.style.opacity = '1';
														el.style.display = 'block';
														el.style.visibility = 'visible';
														el.style.position = 'relative';
													}}
												}}
											}})()
										""")
									else:
										await page.evaluate(f"""
											(() => {{
												const elements = document.querySelectorAll('{selector}');
												elements.forEach(el => {{
													el.style.opacity = '1';
													el.style.display = 'block';
													el.style.visibility = 'visible';
													el.style.position = 'relative';
												}});
											}})()
										""")
									
									# Wait a moment for the style changes to take effect
									await human_delay(0.8, 1.2)
									
									# Move mouse to the file input area before uploading
									if not selector.startswith('//'):
										await human_mouse_movement(page, end_selector=selector)
									else:
										# For XPath, move to a random position first
										viewport_size = await page.viewport_size()
										await human_mouse_movement(
											page, 
											random.randint(100, viewport_size["width"]-100),
											random.randint(100, viewport_size["height"]-100)
										)
									
									await human_delay(0.5, 1.0)
									
									# Try to set the file input directly
									if selector.startswith('//'):
										await page.set_input_files(f"xpath={selector}", temp_file_path)
									else:
										await page.set_input_files(selector, temp_file_path)
									
									print("File uploaded successfully")
									upload_success = True
									
									# If there's an upload button, click it with human-like behavior
									if upload_buttons and len(upload_buttons) > 0:
										await human_delay(0.8, 1.5)
										upload_button = upload_buttons[0]
										await human_mouse_movement(page, end_selector="button:has-text('Upload')")
										await human_delay(0.2, 0.5)
										await upload_button.click(delay=random.uniform(50, 150))
									
									await human_delay(2.0, 3.5)  # Wait for upload to complete
									break
								except Exception as upload_error:
									print(f"Error uploading with selector {selector}: {upload_error}")
									# Continue to try the next method if this one fails
						except Exception as upload_error:
							print(f"Error during upload attempt: {upload_error}")
				
				if not upload_success:
					print("All upload attempts failed. Continuing without file upload.")
			else:
				print("No resume input found matching criteria. Continuing without file upload.")
		except Exception as e:
			print(f"Error during resume input detection: {e}")
			print("Continuing without file upload")
		
		# Add some human-like page interaction before filling the form
		await human_delay(1.0, 2.0)
		await human_scroll(page, direction="up", speed="medium")
		await human_delay(0.8, 1.5)
		await human_scroll(page, direction="down", speed="slow")
		await human_delay(1.2, 2.0)
		
		## Step 3: Fill out and submit the application and return the result
		## Compose the task to fillout the application
		apply_task = f"""your goal is to use the following personal/resume data information for a job application\n Fill out the text inputs, textareas, and answer any questions using the information provided.\nIgnore any optional data and the resume or photo upload inputs and any other inputs that are not text inputs, textareas, questions, checkboxes, or radio buttons.\nOnce all the required fields are completed consider the task complete and return the results.\n\nIMPORTANT: Take your time filling out the form. Act like a human by pausing between actions. Don't fill out the entire form too quickly.\n\n{prompt}"""
		
		# Create a new agent for step 3, reusing the same browser session
		apply_agent = HumanizedAgent(
			task=apply_task,
			llm=llm,
			max_actions_per_step=8,  # Reduced from 15 to slow down
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
		result = await apply_agent.run(max_steps=25)
		
		# Add final human-like interaction before completing
		await human_delay(1.5, 3.0)
		await human_scroll(page, direction="up", speed="slow")
		await human_delay(1.0, 2.0)
		
		return JSONResponse(content={"result": result})
	except Exception as e:
		print(f"Error in run_agent: {e}")
		raise HTTPException(status_code=500, detail=str(e))
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