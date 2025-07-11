#!/usr/bin/env python3
"""
Simple test script to test browser-use functionality
"""
import os

# MUST set telemetry environment variable BEFORE any imports
os.environ['BROWSER_USE_TELEMETRY'] = 'false'
os.environ['POSTHOG_DISABLED'] = 'true'

import asyncio
import sys
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Suppress ALL the annoying warnings
logging.getLogger('urllib3.connectionpool').setLevel(logging.CRITICAL)
logging.getLogger('urllib3').setLevel(logging.CRITICAL)
logging.getLogger('backoff').setLevel(logging.CRITICAL)
logging.getLogger('posthog').setLevel(logging.CRITICAL)
logging.getLogger('browser_use.telemetry').setLevel(logging.CRITICAL)

# Add the browser_use path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from browser_use import Agent
from browser_use.browser import BrowserSession, BrowserProfile

async def test_browser_simple():
    """Simple test that just opens Google"""
    logger.info("Starting simple browser test...")
    
    try:
        # Create browser session
        logger.info("Creating browser session...")
        session = BrowserSession(
            browser_profile=BrowserProfile(
                headless=False,
                user_data_dir='~/.config/browseruse/profiles/test',
                viewport_expansion=0,
            )
        )
        
        # Start the session
        logger.info("Starting browser session...")
        await session.start()
        
        # Get the page and navigate to Google
        logger.info("Getting current page...")
        page = await session.get_current_page()
        
        logger.info("Navigating to Google...")
        await page.goto("https://www.google.com")
        
        logger.info("✅ Successfully opened Google!")
        
        # Wait a bit so you can see it
        await asyncio.sleep(3)
        
        # Close the session
        logger.info("Closing browser session...")
        await session.close()
        
        logger.info("✅ Test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise

async def test_agent_simple():
    """Test with Agent doing a simple task"""
    logger.info("Starting agent test...")
    
    try:
        # Get API key
        api_key = 'AIzaSyAHm37gWcnfQgQFbbi2_AVFNEd7EE5qhnQ'

        
        # Create browser session
        logger.info("Creating browser session...")
        session = BrowserSession(
            browser_profile=BrowserProfile(
                headless=False,
                user_data_dir='~/.config/browseruse/profiles/test',
                viewport_expansion=0,
            )
        )
        
        # Create LLM
        logger.info("Creating LLM...")
        llm = ChatGoogleGenerativeAI(
            model='gemini-2.5-flash',
            api_key=SecretStr(api_key),
            temperature=0.1
        )
        
        # Create agent with simple task
        logger.info("Creating agent...")
        agent = Agent(
            task="Go to Google.com and search for 'Tampa, FL' and click the first result",
            llm=llm,
            browser_session=session,
            use_vision=True,
            max_actions_per_step=5,
            tool_calling_method="auto"
        )
        
        # Run the agent
        logger.info("Running agent...")
        result = await agent.run()
        
        logger.info(f"✅ Agent completed! Result: {result.extracted_content()}")
        
    except Exception as e:
        logger.error(f"❌ Agent test failed: {e}")
        raise

async def main():
    """Main test function"""
    print("🧪 Browser-Use Test Script")
    print("=" * 50)
    
    # Test 1: Simple browser session
    print("\n1. Testing simple browser session...")
    try:
        await test_browser_simple()
        print("✅ Browser session test PASSED")
    except Exception as e:
        print(f"❌ Browser session test FAILED: {e}")
        return
    
    # Test 2: Agent with simple task
    print("\n2. Testing agent with simple task...")
    try:
        await test_agent_simple()
        print("✅ Agent test PASSED")
    except Exception as e:
        print(f"❌ Agent test FAILED: {e}")
        return
    
    print("\n🎉 All tests completed!")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", choices=["browser", "agent", "both"], default="both", 
                       help="Which test to run")
    args = parser.parse_args()
    
    if args.test == "browser":
        asyncio.run(test_browser_simple())
    elif args.test == "agent":
        asyncio.run(test_agent_simple())
    else:
        asyncio.run(main()) 