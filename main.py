import httpx
import json
from datetime import datetime
from fastapi import FastAPI, Query

app = FastAPI(title="Canlan Oakville Ice Tracker")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Canlan Oakville Ice Tracker"}

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice(
    url: str = Query("https://www.catchcorner.com/api/client/sport/rental"),
    search_term: str = Query("oakville")
):
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
        # Brute-force schema-less search
        matches = []
        if isinstance(data, list):
            for item in data:
                if search_term.lower() in json.dumps(item).lower():
                    matches.append(item)
        elif isinstance(data, dict):
            if search_term.lower() in json.dumps(data).lower():
                matches.append(data)

        # Fallback to returning the entire raw payload if no local matches are found, 
        # so you can inspect the actual keys and IDs directly in your browser.
        return {
            "timestamp": datetime.now().isoformat(),
            "target_url": url,
            "total_matches": len(matches),
            "data": matches if matches else data 
        }

    except Exception as e:
        return {"error": str(e), "status": "failed_to_fetch_data"}
