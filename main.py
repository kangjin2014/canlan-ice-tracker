import httpx
import json
import re
from datetime import datetime
from fastapi import FastAPI, Query
from typing import Optional

app = FastAPI(title="Canlan Oakville Ice Tracker")

# Recursive function to hunt down ice slots no matter where they are hidden in the JSON
def find_slots(data):
    slots = []
    if isinstance(data, dict):
        # CatchCorner slot objects always contain these keys
        if "startTime" in data and ("price" in data or "totalPrice" in data):
            slots.append(data)
        else:
            for value in data.values():
                slots.extend(find_slots(value))
    elif isinstance(data, list):
        for item in data:
            slots.extend(find_slots(item))
    return slots

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Canlan Oakville Ice Tracker"}

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice(
    max_price: Optional[float] = Query(200.0, description="Max target price")
):
    # The actual facility ID and SEO name used by CatchCorner
    target_url = "https://www.catchcorner.com/facility-page/embedded/rental/canlan-sports-oakville"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(target_url, headers=headers)
            response.raise_for_status()
            
            # CatchCorner is a Next.js app; the raw schedule data is baked into the HTML page state
            match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', response.text)
            
            if not match:
                return {"error": "Could not extract internal data state from Canlan Oakville page."}
                
            raw_json_state = json.loads(match.group(1))
            
            # Extract all valid time slots from the unstructured JSON
            all_slots = find_slots(raw_json_state)
            
            deals = []
            for item in all_slots:
                price = float(item.get("price", item.get("totalPrice", 9999)))
                if price <= max_price:
                    deals.append({
                        "facility": "Entripy Centre - Canlan Oakville",
                        "rink": item.get("spaceName", item.get("subFacilityName", "Ice Rink")),
                        "start_time": item.get("startTime"),
                        "end_time": item.get("endTime"),
                        "price": price,
                        "booking_url": target_url
                    })
            
            # Deduplicate (Next.js state often contains duplicate identical objects)
            unique_deals = [dict(t) for t in {tuple(d.items()) for d in deals}]
            # Sort chronologically
            sorted_deals = sorted(unique_deals, key=lambda x: x.get("start_time", ""))

            return {
                "timestamp": datetime.now().isoformat(),
                "total_deals_found": len(sorted_deals),
                "deals": sorted_deals
            }

    except Exception as e:
        return {"error": str(e), "status": "failed_to_fetch_data"}
