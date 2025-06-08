#!/usr/bin/env python3
"""
Test script to demonstrate improved JSON parsing for browser-use agent responses.
This script tests various malformed JSON responses that the agent might receive.
"""

import json
import sys
import os

# Add the browser_use package to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

from browser_use.agent.message_manager.utils import extract_json_from_model_output

def test_parsing_scenarios():
    """Test various problematic JSON scenarios that the improved parser should handle."""
    
    test_cases = [
        # Case 1: JSON wrapped in markdown code blocks
        {
            "name": "Markdown code blocks",
            "input": '''```json
{
  "current_state": {
    "page_summary": "Browser stealth test page",
    "evaluation_previous_goal": "Successfully navigated to test page",
    "memory": "Testing browser fingerprinting detection",
    "next_goal": "Extract trust score from page"
  },
  "action": [
    {
      "extract_content": {
        "goal": "Extract the trust score percentage from the page"
      }
    }
  ]
}
```''',
            "should_work": True
        },
        
        # Case 2: JSON with extra text before and after
        {
            "name": "JSON with surrounding text",
            "input": '''Here's my response:

{
  "current_state": {
    "page_summary": "Test page loaded",
    "evaluation_previous_goal": "Page navigation successful", 
    "memory": "Extracted content from page",
    "next_goal": "Complete the task"
  },
  "action": [
    {
      "done": {
        "success": true,
        "text": "Task completed successfully"
      }
    }
  ]
}

That should work!''',
            "should_work": True
        },
        
        # Case 3: Malformed JSON with trailing commas
        {
            "name": "JSON with trailing commas",
            "input": '''{
  "current_state": {
    "page_summary": "Page analysis complete",
    "evaluation_previous_goal": "Successfully analyzed page",
    "memory": "Found trust score data",
    "next_goal": "Extract specific values",
  },
  "action": [
    {
      "extract_content": {
        "goal": "Get trust score",
      }
    },
  ]
}''',
            "should_work": True
        },
        
        # Case 4: JSON with single quotes instead of double quotes
        {
            "name": "JSON with single quotes",
            "input": """{
  'current_state': {
    'page_summary': 'Browser test page',
    'evaluation_previous_goal': 'Navigation completed',
    'memory': 'Testing stealth capabilities',
    'next_goal': 'Extract results'
  },
  'action': [
    {
      'click_element': {
        'index': 5
      }
    }
  ]
}""",
            "should_work": True
        },
        
        # Case 5: Partial JSON that needs reconstruction
        {
            "name": "Partial JSON reconstruction",
            "input": '''The response contains:
"current_state": {
  "page_summary": "Stealth test results",
  "evaluation_previous_goal": "Test completed",
  "memory": "Found trust score of 64.5%",
  "next_goal": "Report findings"
}

And the action should be:
"action": [
  {
    "done": {
      "success": true,
      "text": "Trust score is 64.5%"
    }
  }
]''',
            "should_work": True
        },
        
        # Case 6: Completely malformed - should fail gracefully
        {
            "name": "Completely malformed JSON",
            "input": '''This is not JSON at all! Just some random text
with no structure whatsoever. The agent sometimes
returns responses like this when confused.''',
            "should_work": False
        }
    ]
    
    print("🧪 Testing improved JSON parsing for browser-use agent responses\n")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}: {test_case['name']}")
        print("-" * 50)
        
        try:
            result = extract_json_from_model_output(test_case['input'])
            
            # Validate the result has required fields
            if isinstance(result, dict) and 'current_state' in result and 'action' in result:
                if test_case['should_work']:
                    print("✅ PASS - Successfully parsed and validated")
                    print(f"   📄 Page summary: {result['current_state'].get('page_summary', 'N/A')}")
                    print(f"   🎯 Next goal: {result['current_state'].get('next_goal', 'N/A')}")
                    print(f"   ⚡ Actions: {len(result.get('action', []))}")
                    passed += 1
                else:
                    print("❌ FAIL - Should not have parsed successfully")
                    failed += 1
            else:
                if test_case['should_work']:
                    print("❌ FAIL - Parsed but missing required fields")
                    failed += 1
                else:
                    print("✅ PASS - Correctly failed to parse malformed input")
                    passed += 1
                    
        except Exception as e:
            if test_case['should_work']:
                print(f"❌ FAIL - Should have parsed successfully: {str(e)}")
                failed += 1
            else:
                print(f"✅ PASS - Correctly failed with error: {str(e)}")
                passed += 1
    
    print("\n" + "=" * 80)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! The improved parsing is working correctly.")
    else:
        print(f"⚠️  {failed} tests failed. The parsing may need further improvements.")
    
    return failed == 0

def demonstrate_problematic_response():
    """Demonstrate parsing the specific problematic response from the user's example."""
    
    print("\n" + "=" * 80)
    print("🔍 Demonstrating fix for the specific problematic response")
    print("=" * 80)
    
    # This is similar to the problematic response format mentioned by the user
    problematic_response = '''```json
{
  "current_state": {
    "page_summary": "Browser stealth test completed on creepjs page",
    "evaluation_previous_goal": "Successfully navigated and analyzed the page",
    "memory": "Found trust score data: 64.5% D-",
    "next_goal": "Extract and report the final trust score"
  },
  "action": [
    {
      "extract_content": {
        "goal": "Extract trust score from page",
        "include_links": false
      }
    }
  ]
}
```'''
    
    try:
        result = extract_json_from_model_output(problematic_response)
        print("✅ Successfully parsed the problematic response!")
        print("\n📋 Parsed content:")
        print(f"   🌐 Page: {result['current_state']['page_summary']}")
        print(f"   📝 Memory: {result['current_state']['memory']}")
        print(f"   🎯 Goal: {result['current_state']['next_goal']}")
        print(f"   ⚡ Action: {list(result['action'][0].keys())[0]}")
        
        # Show the clean JSON structure
        print("\n🔧 Clean JSON structure:")
        print(json.dumps(result, indent=2))
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to parse: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Browser-Use Agent Response Parsing Test Suite")
    print("Testing improved JSON extraction and parsing capabilities\n")
    
    # Run the main test suite
    success = test_parsing_scenarios()
    
    # Demonstrate the specific fix
    demo_success = demonstrate_problematic_response()
    
    if success and demo_success:
        print("\n🎉 All tests completed successfully!")
        print("The improved parsing should handle malformed agent responses much better.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the implementation.")
        sys.exit(1) 