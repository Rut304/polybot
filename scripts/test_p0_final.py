#!/usr/bin/env python3
"""Final API verification test for P0 completion"""

import os
import requests
import json

SUPABASE_URL = "https://ytaltvltxkkfczlvjgad.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YWx0dmx0eGtrZmN6bHZqZ2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDUwODgsImV4cCI6MjA4MDAyMTA4OH0.wTIGy2JFxcMNiMcBvOOemIh-8-gjDjmFnAIuD0lmTg4"
BASE = "http://localhost:3001"

def main():
    print("=" * 60)
    print("  FINAL P0 API VERIFICATION")
    print("=" * 60)
    
    # Login - NEVER hardcode passwords!
    test_email = os.environ.get("TEST_EMAIL", "test@example.com")
    test_password = os.environ.get("TEST_PASSWORD")
    if not test_password:
        print("❌ Error: Set TEST_PASSWORD env var")
        return
    
    print(f"\n📍 Logging in as {test_email}...")
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": test_email, "password": test_password}
    )
    
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code}")
        print(resp.text)
        return
    
    token = resp.json().get("access_token")
    if not token:
        print(f"❌ No token in response: {resp.json()}")
        return
    
    print("✅ Login successful")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test endpoints
    tests = [
        ("GET", "/api/users/me", None, "User Profile"),
        ("GET", "/api/config", None, "User Config"),
        ("GET", "/api/team", None, "Team Info"),
        ("GET", "/api/bets", None, "Bets"),
        ("GET", "/api/balances", None, "Balances"),
        ("GET", "/api/logs", None, "Logs"),
        ("PATCH", "/api/users/me", {"display_name": "Rut (Admin)"}, "Update Profile"),
        ("PATCH", "/api/config", {"notifications_enabled": True}, "Update Config"),
    ]
    
    print(f"\n📡 Testing {len(tests)} API Endpoints")
    print("-" * 60)
    
    passed = 0
    failed = 0
    
    for method, path, data, desc in tests:
        try:
            if method == "GET":
                r = requests.get(f"{BASE}{path}", headers=headers, timeout=10)
            elif method == "PATCH":
                r = requests.patch(f"{BASE}{path}", headers=headers, json=data, timeout=10)
            
            if r.status_code < 400:
                print(f"   ✅ {method:5} {path:20} - {desc}")
                passed += 1
            else:
                print(f"   ❌ {method:5} {path:20} - {desc} ({r.status_code})")
                failed += 1
        except Exception as e:
            print(f"   ❌ {method:5} {path:20} - {desc} (ERROR: {e})")
            failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"  RESULTS: {passed}/{passed + failed} passed")
    print("=" * 60)
    
    if failed == 0:
        print("\n  🎉 ALL API ENDPOINTS WORKING!")
    else:
        print(f"\n  ⚠️  {failed} endpoint(s) need attention")

if __name__ == "__main__":
    main()
