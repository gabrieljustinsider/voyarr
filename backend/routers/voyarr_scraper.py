import sys
import json
import requests

VOYARR_API_URL = "http://localhost:8000/metadata"

def scrape_voyarr_for_metadata():
    input_data = sys.stdin.read()
    try:
        stash_payload = json.loads(input_data)
        title_query = stash_payload.get("title", "")
        ohash_query = stash_payload.get("oshash", "")
        
        # Ask Voyarr if it recognizes the file or hash
        # e.g., you can map this to an advanced library search query via API
        response = requests.get(f"{VOYARR_API_URL}?title={title_query}&ohash={ohash_query}")
        if response.status_code == 200:
            voyarr_results = response.json()
            if voyarr_results:
                top_result = voyarr_results[0]
                result_payload = {
                    "title": top_result.get("title"),
                    "details": top_result.get("description"),
                    "tags": [{"name": tag} for tag in top_result.get("tags", [])],
                    "performers": [{"name": perf} for perf in top_result.get("performers", [])]
                }
                print(json.dumps(result_payload))
                sys.exit(0)
                
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        
    # Return empty if nothing found
    print(json.dumps({}))
    sys.exit(0)

if __name__ == '__main__':
    scrape_voyarr_for_metadata()