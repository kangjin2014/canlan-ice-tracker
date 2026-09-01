import httpx
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Query

app = FastAPI(title="Canlan Oakville Ice Tracker")

CANLAN_OAKVILLE_URL = "https://www.catchcorner.com/facility-page/canlansportsoakville/home"
# Replace this URL with the actual JSON endpoint captured from Chrome DevTools (Network > Fetch/XHR)
CATCHCORNER_API_URL = "https://www.catchcorner.com/api/v1/availability?facilityId=canlan-oakville" 

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Canlan Oakville Ice Tracker"}

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice(
    max_price: Optional[float] = Query(150.0, description="Maximum price target"),
    hours_ahead: Optional[int] = Query(48, description="Hours ahead filter")
):
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(CATCHCORNER_API_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            
        # Parse returned JSON data directly
        deals = []
        # Add filtering logic based on response payload structure
        
        return {
            "timestamp": datetime.now().isoformat(),
            "total_deals_found": len(deals),
            "deals": deals
        }
    except Exception as e:
        return {"error": str(e), "status": "failed_to_fetch_data"}
