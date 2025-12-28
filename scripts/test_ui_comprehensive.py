#!/usr/bin/env python3
"""
Comprehensive UI Testing Script for Polybot Admin
Tests authentication, API endpoints, and page accessibility
"""

import os
import sys
import json
import requests
from typing import Optional

# Configuration
BASE_URL = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:3001"
SUPABASE_URL = "https://ytaltvltxkkfczlvjgad.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YWx0dmx0eGtrZmN6bHZqZ2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDUwODgsImV4cCI6MjA4MDAyMTA4OH0.wTIGy2JFxcMNiMcBvOOemIh-8-gjDjmFnAIuD0lmTg4"


def print_header(text: str):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def print_result(test_name: str, passed: bool, details: str = ""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  {status} | {test_name}")
    if details and not passed:
        print(f"         └─ {details}")


def login(email: str, password: str) -> Optional[dict]:
    """Authenticate with Supabase and return session"""
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            json={"email": email, "password": password}
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"  Login failed: {resp.status_code} - {resp.text[:100]}")
            return None
    except Exception as e:
        print(f"  Login error: {e}")
        return None


def test_api_endpoint(name: str, url: str, headers: dict, expected_status: int = 200) -> bool:
    """Test an API endpoint"""
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        passed = resp.status_code == expected_status
        details = "" if passed else f"Got {resp.status_code}, expected {expected_status}"
        print_result(name, passed, details)
        return passed
    except Exception as e:
        print_result(name, False, str(e))
        return False


def test_page(name: str, url: str, headers: dict = None) -> bool:
    """Test if a page loads"""
    try:
        resp = requests.get(url, headers=headers or {}, timeout=10, allow_redirects=False)
        # 200 = success, 307/302 = redirect (auth redirect is expected for protected pages)
        passed = resp.status_code in [200, 307, 302]
        details = "" if passed else f"Got {resp.status_code}"
        print_result(name, passed, details)
        return passed
    except Exception as e:
        print_result(name, False, str(e))
        return False


def main():
    results = {"passed": 0, "failed": 0, "tests": []}

    # Get credentials from args
    if len(sys.argv) < 3:
        print("Usage: python test_ui_comprehensive.py <email> <password> [base_url]")
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]

    print_header("POLYBOT ADMIN UI TEST SUITE")
    print(f"  Base URL: {BASE_URL}")
    print(f"  User: {email}")

    # 1. Test Database State via diagnostic API
    print_header("1. DATABASE STATE")
    try:
        resp = requests.get(f"{BASE_URL}/api/diagnostics/db-check", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            results_data = data.get("results", {})

            tests = [
                ("Auth Users", results_data.get("auth_users", {}).get("count", 0) >= 3),
                ("User Profiles", results_data.get("polybot_user_profiles", {}).get("count", 0) >= 3),
                ("Teams", results_data.get("polybot_teams", {}).get("count", 0) >= 3),
                ("Team Members", results_data.get("polybot_team_members", {}).get("count", 0) >= 3),
            ]

            for name, passed in tests:
                print_result(name, passed)
                if passed:
                    results["passed"] += 1
                else:
                    results["failed"] += 1
        else:
            print_result("DB Check API", False, f"Status {resp.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_result("DB Check API", False, str(e))
        results["failed"] += 1

    # 2. Test Authentication
    print_header("2. AUTHENTICATION")
    session = login(email, password)
    if session:
        print_result("Supabase Login", True)
        results["passed"] += 1
        access_token = session.get("access_token")
        user = session.get("user", {})
        print(f"         └─ User ID: {user.get('id', 'N/A')[:8]}...")
    else:
        print_result("Supabase Login", False, "Could not authenticate")
        results["failed"] += 1
        access_token = None

    # 3. Test API Endpoints (with auth)
    print_header("3. API ENDPOINTS")
    auth_headers = {
        "Authorization": f"Bearer {access_token}" if access_token else "",
        "Content-Type": "application/json"
    }

    api_tests = [
        ("GET /api/users/me", f"{BASE_URL}/api/users/me"),
        ("GET /api/config", f"{BASE_URL}/api/config"),
        ("GET /api/opportunities", f"{BASE_URL}/api/opportunities"),
        ("GET /api/teams", f"{BASE_URL}/api/teams"),
    ]

    for name, url in api_tests:
        if test_api_endpoint(name, url, auth_headers):
            results["passed"] += 1
        else:
            results["failed"] += 1

    # 4. Test Page Accessibility
    print_header("4. PAGE ACCESSIBILITY")
    pages = [
        ("Login Page", f"{BASE_URL}/login"),
        ("Dashboard", f"{BASE_URL}/dashboard"),
        ("Profile", f"{BASE_URL}/profile"),
        ("Settings", f"{BASE_URL}/settings"),
        ("Opportunities", f"{BASE_URL}/opportunities"),
        ("Teams", f"{BASE_URL}/teams"),
    ]

    for name, url in pages:
        if test_page(name, url):
            results["passed"] += 1
        else:
            results["failed"] += 1

    # 5. Summary
    print_header("TEST SUMMARY")
    total = results["passed"] + results["failed"]
    print(f"  Total Tests: {total}")
    print(f"  Passed: {results['passed']} ({100*results['passed']//total if total > 0 else 0}%)")
    print(f"  Failed: {results['failed']}")

    if results["failed"] == 0:
        print("\n  🎉 ALL TESTS PASSED!")
    else:
        print(f"\n  ⚠️ {results['failed']} tests need attention")

    sys.exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
