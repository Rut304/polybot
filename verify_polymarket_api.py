
import requests
import json

def verify_polymarket_leaderboard():
    url = "https://data-api.polymarket.com/v1/leaderboard"
    params = {
        "limit": 5,
        "timePeriod": "ALL",
        "orderBy": "PNL"
    }
    
    print(f"Fetching {url}...")
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        print(f"Status: {resp.status_code}")
        
        if isinstance(data, list):
            print(f"✅ Response is a list (Length: {len(data)})")
            if len(data) > 0:
                sample = data[0]
                print(f"Sample Data Keys: {list(sample.keys())}")
                
                # Check expected keys from route.ts
                expected_keys = ["rank", "proxyWallet", "userName", "vol", "pnl"]
                missing = [k for k in expected_keys if k not in sample]
                
                if not missing:
                    print("✅ Schema matches expected keys.")
                    print(f"Top Trader: {sample.get('userName', 'Anon')} - PnL: ${sample.get('pnl', 0)}")
                else:
                    print(f"❌ Schema Mismatch! Missing keys: {missing}")
        else:
            print("❌ Response is NOT a list (Unexpected format)")
            print(json.dumps(data, indent=2))
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    verify_polymarket_leaderboard()
