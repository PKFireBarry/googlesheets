import asyncio
import os
import sys
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

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Remove dotenv loading since we do not want to use env API keys for LLM
# from dotenv import load_dotenv
# load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from browser_use import Agent
from browser_use.browser import BrowserProfile, BrowserSession

app = FastAPI()

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
		
		# Create a single browser session to be shared across all steps
		browser_profile = BrowserProfile(
			viewport_expansion=0,
			user_data_dir=unique_user_data_dir,
			headless=False,
			keep_alive=True,
			executable_path='/usr/bin/google-chrome',
		)
		
		browser_session = BrowserSession(browser_profile=browser_profile)
		
		# Initialize the browser session
		await browser_session.start()
		
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
		find_form_result = await form_finder_agent.run(max_steps=25)
		
		# Add a delay to ensure the page is fully loaded and stable
		await asyncio.sleep(3)
		
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
					await asyncio.sleep(2)
			
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
					break
			
			if resume_input:
				print(f"Found resume input: {resume_input}\n")
				
				# Upload the resume file if available
				if temp_file_path:
					try:
						# Get the current page from the browser session
						page = await browser_session.get_current_page()
						
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
							# Use XPath as fallback
							for i, el in enumerate(soup.find_all('input', {'type': 'file'})):
								if el == resume_input:
									selector = f"//input[@type='file'][{i+1}]"
									break
						
						if selector:
							print(f"Using selector {selector} to upload file {temp_file_path}")
							if selector.startswith('//'):
								# XPath selector
								file_input = await page.wait_for_selector(f"xpath={selector}", timeout=5000)
							else:
								# CSS selector
								file_input = await page.wait_for_selector(selector, timeout=5000)
							
							if file_input:
								await file_input.set_input_files(temp_file_path)
								print("File uploaded successfully")
								await asyncio.sleep(2)  # Wait for upload to complete
					except Exception as upload_error:
						print(f"Error uploading resume file: {upload_error}")
						print("Continuing without file upload")
			else:
				print("No resume input found matching criteria. Continuing without file upload.")
		except Exception as e:
			print(f"Error during resume input detection: {e}")
			print("Continuing without file upload")
		
		## Step 3: Fill out and submit the application and return the result
		## Compose the task to fillout the application
		apply_task = f"""your goal is to use the following personal/resume data information for a job application\n Fill out the text inputs, textareas, and answer any questions using the information provided.\nIgnore any optional data and the resume or photo upload inputs and any other inputs that are not text inputs, textareas, questions, checkboxes, or radio buttons.\nOnce all the required fields are completed consider the task complete and return the results.\n{prompt}"""
		
		# Create a new agent for step 3, reusing the same browser session
		apply_agent = Agent(
			task=apply_task,
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
		
		# Run the application filling agent
		result = await apply_agent.run(max_steps=25)
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