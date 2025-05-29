import requests
import json
import websockets
import asyncio
import os
import sys
import time
from datetime import datetime

# Get the backend URL from the frontend .env file
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.strip().split('=')[1]
            break

# Ensure we have a backend URL
if not 'BACKEND_URL' in locals():
    print("Error: Could not find REACT_APP_BACKEND_URL in frontend/.env")
    sys.exit(1)

# Add /api prefix for all API calls
API_URL = f"{BACKEND_URL}/api"

print(f"Testing backend API at: {API_URL}")

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "total": 0
}

def run_test(test_name, test_func, *args, **kwargs):
    """Run a test and track results"""
    test_results["total"] += 1
    print(f"\n{'='*80}\nTEST: {test_name}\n{'='*80}")
    
    try:
        result = test_func(*args, **kwargs)
        if result:
            test_results["passed"] += 1
            print(f"✅ PASSED: {test_name}")
        else:
            test_results["failed"] += 1
            print(f"❌ FAILED: {test_name}")
        return result
    except Exception as e:
        test_results["failed"] += 1
        print(f"❌ ERROR: {test_name} - {str(e)}")
        return False

def test_status_endpoint():
    """Test the /api/status endpoint"""
    try:
        response = requests.get(f"{API_URL}/status")
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        return (
            response.status_code == 200 and
            response.json().get("status") == "ok" and
            response.json().get("service") == "SoulSeer API"
        )
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def test_health_endpoint():
    """Test the /api/health endpoint"""
    try:
        response = requests.get(f"{API_URL}/health")
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        return (
            response.status_code == 200 and
            response.json().get("status") == "healthy" and
            response.json().get("database") == "connected"
        )
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def test_auth_required_endpoint():
    """Test an endpoint that requires authentication without a token"""
    try:
        response = requests.get(f"{API_URL}/user/profile")
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # Should fail with 401 or 403 status code
        return response.status_code in [401, 403]
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def test_auth_with_invalid_token():
    """Test an endpoint with an invalid token"""
    try:
        headers = {"Authorization": "Bearer invalid_token"}
        response = requests.get(f"{API_URL}/user/profile", headers=headers)
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # Should fail with 401 status code
        return response.status_code == 401
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def test_readers_available_endpoint():
    """Test the /api/readers/available endpoint"""
    try:
        response = requests.get(f"{API_URL}/readers/available")
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Should return a list (even if empty)
        return (
            response.status_code == 200 and
            isinstance(response.json(), list)
        )
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

async def test_websocket_connection():
    """Test the WebSocket connection"""
    try:
        # Use a test user ID
        user_id = "test_user_123"
        ws_url = f"{BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/api/ws/{user_id}"
        
        print(f"Connecting to WebSocket at: {ws_url}")
        
        # Set a timeout for the connection attempt
        try:
            # Create connection without timeout parameter
            async with websockets.connect(ws_url) as websocket:
                print("WebSocket connection established")
                
                # Send a ping message
                await websocket.send(json.dumps({"type": "ping"}))
                print("Ping message sent")
                
                # Wait for response with timeout
                response = await asyncio.wait_for(websocket.recv(), timeout=5)
                print(f"Received response: {response}")
                
                # Parse response
                response_data = json.loads(response)
                return response_data.get("type") == "pong"
        except asyncio.TimeoutError:
            print("WebSocket connection timed out")
            return False
        except websockets.exceptions.ConnectionClosed as e:
            print(f"WebSocket connection closed: {e}")
            return False
    except Exception as e:
        print(f"Error in WebSocket test: {str(e)}")
        return False

def run_websocket_test():
    """Run the WebSocket test using asyncio"""
    try:
        result = asyncio.run(test_websocket_connection())
        return result
    except Exception as e:
        print(f"Error running WebSocket test: {str(e)}")
        return False

def print_summary():
    """Print a summary of test results"""
    print("\n" + "="*80)
    print(f"TEST SUMMARY: {test_results['passed']}/{test_results['total']} tests passed")
    print(f"  ✅ Passed: {test_results['passed']}")
    print(f"  ❌ Failed: {test_results['failed']}")
    print("="*80)

def main():
    """Run all tests"""
    print(f"Starting SoulSeer Backend Tests at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test health check endpoints
    run_test("Status Endpoint", test_status_endpoint)
    run_test("Health Endpoint", test_health_endpoint)
    
    # Test authentication
    run_test("Auth Required Endpoint", test_auth_required_endpoint)
    run_test("Auth with Invalid Token", test_auth_with_invalid_token)
    
    # Test reader availability
    run_test("Readers Available Endpoint", test_readers_available_endpoint)
    
    # Test WebSocket connection
    run_test("WebSocket Connection", run_websocket_test)
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
