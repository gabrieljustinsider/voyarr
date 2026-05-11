import sys
import json
import requests

# Configure your Voyarr API settings here
VOYARR_API_URL = "http://localhost:8000"
VOYARR_MASTER_KEY = "your_32_byte_hex_key" # Replace with your MASTER_KEY
TPDB_API_KEY = "your_tpdb_api_key"

def scrape_scene():
    input_data = sys.stdin.read()
    if not input_data:
        return []
        
    fragment = json.loads(input_data)
    query = fragment.get("title") or fragment.get("name")
    file_hash = fragment.get("hash")
    
    if not query and not file_hash:
        return []
    
    headers = {
        "X-Voyarr-Api-Key": VOYARR_MASTER_KEY,
        "x-api-key": TPDB_API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        payload = {}
        if query:
            payload["query"] = query
        if file_hash:
            payload["hash"] = file_hash
            
        res = requests.post(f"{VOYARR_API_URL}/external-api/theporndb/query", json=payload, headers=headers, timeout=15)
        res.raise_for_status()
        
        data = res.json()
        formatted_results = []
        for item in data.get("results", []):
            result = {
                "title": item.get("title"),
                "details": item.get("details", ""),
                "date": item.get("date", ""),
                "url": item.get("url", ""),
                "tags": [{"name": t} for t in item.get("tags", [])],
                "performers": [{"name": p} for p in item.get("performers", [])]
            }
            if item.get("studio"):
                result["studio"] = {"name": item.get("studio")}
            formatted_results.append(result)
        return formatted_results
    except Exception as e:
        sys.stderr.write(f"Error querying TPDB via Voyarr: {str(e)}\n")
        return []

def main():
    print(json.dumps(scrape_scene()))

if __name__ == "__main__":
    main()