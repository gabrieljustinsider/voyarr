import sys
import json
import requests

# Configure your Voyarr API settings here
VOYARR_API_URL = "http://localhost:8000"
VOYARR_MASTER_KEY = "your_32_byte_hex_key" # Replace with your MASTER_KEY

def scrape_scene():
    input_data = sys.stdin.read()
    if not input_data:
        return []
        
    fragment = json.loads(input_data)
    title = fragment.get("title") or fragment.get("name")
    file_hash = fragment.get("hash")
    
    headers = {"X-Voyarr-Api-Key": VOYARR_MASTER_KEY}
    
    try:
        params = {}
        if title:
            params["title"] = title
        if file_hash:
            params["hash"] = file_hash
            
        res = requests.get(f"{VOYARR_API_URL}/external-api/library/search", headers=headers, params=params, timeout=10)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        sys.stderr.write(f"Error querying Voyarr: {str(e)}\n")
        return []

def main():
    results = scrape_scene()
    # Print the array of search results to stdout for Stash to consume
    print(json.dumps(results))

if __name__ == "__main__":
    main()