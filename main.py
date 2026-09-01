import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Query
from playwright.async_api import async_playwright

app = FastAPI(title="Canlan Oakville Ice Tracker")

CANLAN_OAKVILLE_URL = (
    "https://www.catchcorner.com/facility-page/canlansportsoakville/home"
)
STANDARD_RATE_THRESHOLD = 200.0  # Adjust baseline price threshold to detect discounts

async def fetch_catchcorner_slots() -> List[dict]:
    """Scrapes raw slot details directly from CatchCorner's DOM rendering."""
    slots = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Catch internal network requests if CatchCorner exposes JSON directly
        raw_responses = []
        page.on("response", lambda res: raw_responses.append(res) if "rental" in res.url or "availability" in res.url else None)

        await page.goto(CANLAN_OAKVILLE_URL, wait_until="networkidle")
        
        # Scrape rendered slot DOM elements
        elements = await page.query_selector_all(".slot-item-selector, [class*='rental-card']") 
        for el in elements:
            text = await el.inner_text()
            # Basic parsing strategy for scraped elements
            slots.append({"raw_details": text})

        await browser.close()
    return slots

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice(
    max_price: Optional[float] = Query(150.0, description="Maximum price target for discounted ice"),
    hours_ahead: Optional[int] = Query(48, description="Filter for ice occurring within N hours")
):
    """API Endpoint: Returns discounted or urgent open ice at Canlan Oakville."""
    raw_slots = await fetch_catchcorner_slots()
    
    # Process & filter logic
    discounted_slots = []
    now = datetime.now()
    cutoff_time = now + timedelta(hours=hours_ahead)

    for slot in raw_slots:
        # Example structure transformation
        # Parse price and datetime from scraped response
        price = 107.0  # Placeholder derived from parsed slot data
        slot_time = now + timedelta(hours=12)

        if price <= max_price and slot_time <= cutoff_time:
            discounted_slots.append({
                "facility": "Canlan Sports Oakville (Entripy Centre)",
                "price": price,
                "start_time": slot_time.isoformat(),
                "is_last_minute_discount": price < STANDARD_RATE_THRESHOLD,
                "booking_url": CANLAN_OAKVILLE_URL
            })

    return {
        "timestamp": datetime.now().isoformat(),
        "total_deals_found": len(discounted_slots),
        "deals": discounted_slots
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
