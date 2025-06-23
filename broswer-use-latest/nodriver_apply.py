import asyncio
import os
import tempfile
import uuid
import re

import nodriver as uc
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
import uvicorn
import aiofiles

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
        
        element = await tab.select(selector_str, best_match=True, timeout=2)
        if not element:
            element = await tab.select(label_selector, best_match=True, timeout=2)

        if element:
            print(f"Found field for '{keywords[0]}' and filling it.")
            await element.mouse_click()
            await asyncio.sleep(0.3)
            await element.send_keys(value, delay=0.05)
            return True
    except Exception as e:
        print(f"Could not find or fill field for '{keywords[0]}': {e}")
    return False

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

async def process_hybrid_apply(task_id: str, job_url: str, api_key: str, user_data: UserData, resume_file: UploadFile | None):
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

        # --- Handle Resume Upload ---
        tasks[task_id].update({"status": "processing", "message": "Looking for resume upload field..."})
        if resume_file:
            # Save uploaded file to a temporary path
            suffix = os.path.splitext(resume_file.filename)[-1]
            async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await resume_file.read()
                await tmp.write(content)
                temp_file_path = tmp.name
            
            # Find the file input on the page
            file_input = await tab.select('input[type=file]', best_match=True, timeout=5)
            if file_input:
                print("Found file input. Uploading resume...")
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
            await browser.stop()
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/auto-apply")
async def hybrid_auto_apply(
    job_url: str = Form(...),
    api_key: str = Form(...),
    user_data: str = Form(...), # JSON string for UserData
    resume: UploadFile = File(None)
):
    """
    Endpoint to trigger the hybrid auto-application process.
    Receives user data and job info, then starts a background task.
    """
    try:
        user_data_model = UserData.model_validate_json(user_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid user_data JSON: {e}")

    task_id = str(uuid.uuid4())
    asyncio.create_task(process_hybrid_apply(task_id, job_url, api_key, user_data_model, resume))
    
    return {"task_id": task_id, "status": "starting"}

@app.get("/auto-apply-status/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a task by its ID."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

if __name__ == "__main__":
    uvicorn.run("nodriver_apply:app", host="0.0.0.0", port=8000, reload=True) 