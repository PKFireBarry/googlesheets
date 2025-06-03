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

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from browser_use import Agent
from browser_use.browser import BrowserProfile, BrowserSession

app = FastAPI()

@app.post('/auto-apply')
async def run_agent(
	prompt: str = Form(...),
	url: str = Form(...),
	api_key: str = Form(...),
	file: UploadFile = File(None),
	file_url: str = Form(None)
):
	temp_file_path = None
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
			# Download file from URL
			r = requests.get(file_url)
			r.raise_for_status()
			suffix = os.path.splitext(file_url)[-1]
			with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
				tmp.write(r.content)
				temp_file_path = tmp.name
				available_file_paths.append(temp_file_path)

		# Compose the task
		task = f"{prompt}\nURL: {url}"

		llm = ChatGoogleGenerativeAI(model='gemini-2.5-flash-preview-05-20', api_key=api_key)
		browser_session = BrowserSession(
			browser_profile=BrowserProfile(
				viewport_expansion=0,
				user_data_dir='~/.config/browseruse/profiles/default',
				headless=False,
				keep_alive=True,
			)
		)
		agent = Agent(
			task=task,
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
		result = await agent.run(max_steps=25)
		return JSONResponse(content={"result": result})
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
	finally:
		# Clean up temp file if created
		if temp_file_path and os.path.exists(temp_file_path):
			os.remove(temp_file_path)

# For local testing: python simple.py
if __name__ == '__main__':
	uvicorn.run("simple:app", host="0.0.0.0", port=8000, reload=True)