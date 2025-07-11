#!/usr/bin/env python3
"""
Test script for the browser-use auto-apply API

This script demonstrates how to use the new browser-use auto-apply endpoint
that uses browser-use for intelligent form filling while keeping the proven
resume detection and cloudflare handling from the original script.
"""

import asyncio
import httpx
import time
import json
import base64
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_BASE_URL = "http://localhost:8001"
# API key is now loaded from GOOGLE_API_KEY environment variable

# Sample user data prompt - the API will parse this into structured data
USER_PROMPT = """
My name is John Doe, and my email is john.doe@example.com. 
My phone number is (555) 123-4567. 
I live at 123 Main Street, Anytown, USA 12345.
My LinkedIn profile is https://linkedin.com/in/johndoe
My GitHub is https://github.com/johndoe
My portfolio website is https://johndoe.dev

I am an experienced software engineer with 5+ years of experience in Python, JavaScript, React, and Node.js. 
I have worked on full-stack applications, API development, and cloud infrastructure.
I am passionate about building scalable solutions and leading development teams.
"""

# Test job URLs - replace with actual job URLs you want to apply to
TEST_JOB_URLS = [
    "https://example-company.com/careers/software-engineer",
    # Add more job URLs here
]

# Path to resume file (optional)
RESUME_FILE_PATH = "/path/to/your/resume.pdf"  # Replace with actual path

async def test_hybrid_auto_apply():
    """Test the hybrid nodriver + browser-use auto-apply functionality."""
    
    print("🧪 Testing Hybrid Nodriver + Browser-Use Auto-Apply")
    print("=" * 60)
    
    # Test data
    test_url = "https://careers.example.com/jobs/software-engineer"  # Replace with actual job URL
    test_prompt = """
    John Doe
    Software Engineer with 5 years experience
    Email: john.doe@example.com
    Phone: (555) 123-4567
    LinkedIn: https://linkedin.com/in/johndoe
    GitHub: https://github.com/johndoe
    Portfolio: https://johndoe.dev
    Address: 123 Main St, San Francisco, CA 94102
    
    Experience in Python, React, Node.js, AWS, Docker, Kubernetes
    Strong background in full-stack development and cloud technologies
    """
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            print(f"📤 Starting hybrid auto-apply process...")
            print(f"   URL: {test_url}")
            print(f"   Profile: John Doe (Software Engineer)")
            
            # Send the auto-apply request
            response = await client.post(
                f"{API_BASE_URL}/auto-apply",
                data={
                    "url": test_url,
                    "prompt": test_prompt,
                    # Note: No api_key needed - loaded from environment
                },
                # files={"resume": ("John-Doe-Resume.pdf", resume_content, "application/pdf")}  # Optional
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to start process: {response.status_code}")
                print(f"   Response: {response.text}")
                return
            
            result = response.json()
            task_id = result["task_id"]
            
            print(f"✅ Process started successfully!")
            print(f"   Task ID: {task_id}")
            print(f"   Status: {result['status']}")
            
            # Monitor progress
            print(f"\n🔄 Monitoring progress...")
            print("   Phase 1: Nodriver starts browser and clicks Apply")
            print("   Phase 1.5: Nodriver uploads resume immediately")
            print("   Phase 2: Browser-use fills out the form")
            print("   Phase 3: Nodriver submits and handles Cloudflare")
            print("   Phase 4: Final verification")
            
            max_wait_time = 300  # 5 minutes
            start_time = time.time()
            last_message = ""
            
            while True:
                elapsed = time.time() - start_time
                if elapsed > max_wait_time:
                    print(f"\n⏰ Timeout reached ({max_wait_time}s)")
                    break
                
                # Check status
                status_response = await client.get(f"{API_BASE_URL}/auto-apply-status/{task_id}")
                
                if status_response.status_code != 200:
                    print(f"❌ Failed to get status: {status_response.status_code}")
                    break
                
                status_data = status_response.json()
                current_status = status_data["status"]
                current_message = status_data.get("message", "")
                
                # Print status updates
                if current_message != last_message:
                    print(f"   [{elapsed:6.1f}s] {current_status.upper()}: {current_message}")
                    last_message = current_message
                
                if current_status in ["completed", "failed"]:
                    break
                
                await asyncio.sleep(3)  # Check every 3 seconds
            
            # Final status
            print(f"\n📊 Final Status:")
            print(f"   Status: {current_status.upper()}")
            print(f"   Message: {current_message}")
            print(f"   Elapsed Time: {elapsed:.1f}s")
            
            if current_status == "completed":
                print(f"\n✅ Hybrid auto-apply process completed successfully!")
                print(f"   🔍 The browser should still be open - check the results")
                print(f"   📄 Resume was uploaded using proven nodriver methodology")
                print(f"   🛡️  Cloudflare verification was handled with visual LLM")
            elif current_status == "failed":
                print(f"\n❌ Process failed: {current_message}")
            else:
                print(f"\n⚠️  Process incomplete or timed out")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

async def test_status_endpoint():
    """Test the status endpoint with a fake task ID."""
    print(f"\n🧪 Testing Status Endpoint")
    print("=" * 30)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_BASE_URL}/auto-apply-status/fake-task-id")
            
            if response.status_code == 404:
                print(f"✅ Status endpoint working correctly (404 for fake task)")
            else:
                print(f"⚠️  Unexpected response: {response.status_code}")
                print(f"   Response: {response.text}")
                
    except Exception as e:
        print(f"❌ Status test failed: {e}")

async def test_with_resume_file():
    """Test with an actual resume file."""
    print(f"\n🧪 Testing With Resume File")
    print("=" * 32)
    
    # This would require an actual resume file
    print(f"📝 To test with resume file:")
    print(f"   1. Place a resume file (PDF/DOCX) in the same directory")
    print(f"   2. Update the file path in this function")
    print(f"   3. Uncomment the files parameter in the request")
    print(f"   4. The hybrid system will use nodriver's proven resume upload detection")

async def main():
    """Run all tests."""
    print("🚀 Starting Hybrid Nodriver + Browser-Use Auto-Apply Tests")
    print("=" * 65)
    print()
    print("📋 Test Overview:")
    print("   • Nodriver: Browser startup, navigation, apply click")
    print("   • Browser-use: Intelligent form filling via CDP")
    print("   • Nodriver: Resume upload with proven detection")
    print("   • Nodriver: Cloudflare verification with LLM")
    print("   • Nodriver: Form submission and final verification")
    print()
    
    # Check if server is running
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_BASE_URL}/auto-apply-status/test")
            print("✅ Server is running and accessible")
    except Exception as e:
        print(f"❌ Server is not accessible: {e}")
        print(f"   Make sure to start the server with: python browseruse_apply.py")
        return
    
    print()
    
    # Run tests
    await test_status_endpoint()
    await test_with_resume_file()
    
    # Main test (commented out by default since it requires a real job URL)
    print(f"\n⚠️  To run the full hybrid auto-apply test:")
    print(f"   1. Replace 'test_url' with a real job application URL")
    print(f"   2. Update the test_prompt with real user information")
    print(f"   3. Uncomment the line below:")
    print(f"   # await test_hybrid_auto_apply()")
    
    # Uncomment this line to run the actual test:
    # await test_hybrid_auto_apply()

if __name__ == "__main__":
    asyncio.run(main()) 