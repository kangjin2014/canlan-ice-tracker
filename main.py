import httpx
from datetime import datetime, timedelta
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice(days_ahead: int = 3):
    start = datetime.now().strftime("%Y-%m-%d")
    end = (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    
    patterns = [
        {"method": "POST", "url": "https://www.catchcorner.com/api/client/listing/search", "json": {"sportId": 1, "facilitySeoName": "canlansportsoakville", "startDate": start, "endDate": end}, "params": None},
        {"method": "POST", "url": "https://www.catchcorner.com/api/client/listing/search", "json": {"sportId": 1, "facilitySeoName": "canlan-sports-oakville", "startDate": start, "endDate": end}, "params": None},
        {"method": "GET", "url": "https://www.catchcorner.com/api/client/facility/rental/canlansportsoakville", "json": None, "params": {"sportId": 1, "startDate": start, "endDate": end}},
        {"method": "GET", "url": "https://www.catchcorner.com/api/client/facility/rental/canlan-sports-oakville", "json": None, "params": {"sportId": 1, "startDate": start, "endDate": end}},
        {"method": "GET", "url": "https://www.catchcorner.com/api/client/facility/rental/canlan-sports-oakville-entripy-centre", "json": None, "params": {"sportId": 1}}
    ]

    errors = []
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        for p in patterns:
            try:
                if p["method"] == "POST":
                    resp = await client.post(p["url"], json=p["json"], headers=headers)
                else:
                    resp = await client.get(p["url"], params=p["params"], headers=headers)
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        return {"success": True, "pattern": p, "raw_data": data}
            except Exception as e:
                errors.append(str(e))
                
    return {"success": False, "errors": errors, "status": "all_patterns_failed"}

