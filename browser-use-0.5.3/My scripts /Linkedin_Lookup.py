import asyncio
import os
import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import JSONResponse
import uvicorn
import uuid
import logging
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv

load_dotenv()

# Import browser-use components correctly
from browser_use import Agent
from browser_use.browser import BrowserSession, BrowserProfile
from browser_use.llm import ChatGoogle
from browser_use.llm.ollama.chat import ChatOllama as BrowserUseChatOllama

app = FastAPI()

# Global variables
browser_session = None
current_agent = None
task_storage: Dict[str, Dict[str, Any]] = {}

class TaskRequest(BaseModel):
    task: str
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: str = "google"

async def ensure_browser_session():
    """Ensure browser session is started"""
    global browser_session
    if browser_session is None:
        # Create a new browser session if none exists
        browser_session = create_browser_session()
    
    if not browser_session.initialized:
        await browser_session.start()
        logger.info("Browser session started")
    return browser_session

@app.post("/run-task")
async def run_agent_task(request: TaskRequest):
    global current_agent
    
    logger.info(f"Received task request: {request.task}")
    
    # Generate a unique task ID
    task_id = str(uuid.uuid4())
    
    # Store task as running
    task_storage[task_id] = {
        "status": "running",
        "result": None,
        "error": None
    }
    
    try:
        # Ensure browser session is ready
        session = await ensure_browser_session()
        
        # Use the API key from the request if provided, otherwise fall back to env variable
        api_key = request.api_key or os.getenv('GOOGLE_API_KEY')
        if not api_key and request.provider == "google":
            error_msg = "No API key provided in request or environment for Google provider"
            logger.error(error_msg)
            task_storage[task_id]["status"] = "error"
            task_storage[task_id]["error"] = error_msg
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Create LLM using browser-use components
        if request.provider == "google":
            llm = ChatGoogle(
                model='gemini-2.5-flash',
                api_key=api_key,
                temperature=0.1
            )
            logger.info("Initialized Google Gemini LLM")
        elif request.provider == "ollama":
            llm = BrowserUseChatOllama(
                model="granite3.2-vision:latest"
            )
            logger.info("Initialized Ollama LLM")
        else:
            error_msg = f"Unsupported provider: {request.provider}"
            logger.error(error_msg)
            task_storage[task_id]["status"] = "error"
            task_storage[task_id]["error"] = error_msg
            raise HTTPException(status_code=400, detail=error_msg)

        # Create agent
        current_agent = Agent(
            task=request.task,
            llm=llm,
            browser_session=session,
            use_vision=True,
            max_actions_per_step=10,
        )
        logger.info("Created browser agent")

        # Run the task asynchronously
        async def run_task():
            global current_agent
            try:
                logger.info(f"Starting task execution for task_id: {task_id}")
                result = await current_agent.run() # type: ignore
                task_storage[task_id]["status"] = "completed"
                task_storage[task_id]["result"] = result.extracted_content()
                logger.info(f"Task completed successfully for task_id: {task_id}")
            except Exception as e:
                error_msg = f"Task execution failed: {e}"
                logger.error(error_msg)
                task_storage[task_id]["status"] = "error"
                task_storage[task_id]["error"] = error_msg
            finally:
                current_agent = None

        # Start the task in the background
        asyncio.create_task(run_task())

        return JSONResponse(content={
            "task_id": task_id,
            "status": "running",
            "message": "Task started successfully"
        })

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        logger.error(error_msg)
        task_storage[task_id]["status"] = "error"
        task_storage[task_id]["error"] = error_msg
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a running task"""
    if task_id not in task_storage:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_info = task_storage[task_id]
    
    if task_info["status"] == "completed":
        return JSONResponse(content={
            "status": "completed",
            "result": task_info["result"],
            "results": task_info["result"]  # Include both for compatibility
        })
    elif task_info["status"] == "error":
        return JSONResponse(content={
            "status": "error",
            "message": task_info["error"]
        })
    else:
        return JSONResponse(content={
            "status": "running",
            "message": "Task is still running"
        })

@app.post("/stop-task")
async def stop_agent():
    global current_agent
    try:
        if current_agent:
            # Note: browser-use Agent doesn't have a stop() method, so we'll just clear the reference
            current_agent = None
            logger.info("Agent stopped")
            return {"status": "Agent stopped"}
        return {"status": "No active agent to stop"}
    except Exception as e:
        logger.error(f"Error stopping agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/open-browser")
async def open_browser():
    try:
        session = await ensure_browser_session()
        page = await session.get_current_page()
        await page.goto("https://www.google.com")
        logger.info("Browser opened and navigated to Google")
        return {"status": "browser opened", "url": "https://www.google.com"}
    except Exception as e:
        logger.error(f"Error opening browser: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "browser_session_initialized": browser_session is not None,
        "browser_session_connected": browser_session.initialized if browser_session else False,
        "active_tasks": len([t for t in task_storage.values() if t["status"] == "running"])
    }

def create_browser_session(headless: bool = False):
    """Create browser session following the examples pattern"""
    browser_profile = BrowserProfile(
        headless=headless,
        user_data_dir='~/.config/browseruse/profiles/default',
        viewport_expansion=0,
    )
    
    session = BrowserSession(browser_profile=browser_profile)
    
    logger.info(f"Browser session created (headless={headless})")
    return session

# Cleanup function
async def cleanup():
    """Cleanup resources on shutdown"""
    global browser_session
    if browser_session and browser_session.initialized:
        try:
            await browser_session.close()
            logger.info("Browser session closed")
        except Exception as e:
            logger.error(f"Error closing browser session: {e}")

# Add shutdown event handler
@app.on_event("shutdown")
async def shutdown_event():
    await cleanup()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    args = parser.parse_args()

    # Create browser session following examples pattern
    create_browser_session(args.headless)
    
    logger.info("Starting FastAPI server...")
    uvicorn.run(app, host="127.0.0.1", port=args.port)