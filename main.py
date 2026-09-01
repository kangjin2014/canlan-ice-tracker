import json
from fastapi import FastAPI
from playwright.async_api import async_playwright

app = FastAPI(title="CatchCorner API Interceptor")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Canlan Oakville Ice Tracker"}

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice():
    target_url = "https://www.catchcorner.com/facility-page/embedded/rental/canlan-sports-oakville"
    captured_data = None
    captured_api_url = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        async def handle_response(response):
            nonlocal captured_data, captured_api_url
            if "catchcorner" in response.url and response.request.method in ["GET", "POST"]:
                try:
                    data = await response.json()
                    json_str = json.dumps(data)
                    # Identify the correct API payload by checking for ice slot keys
                    if "price" in json_str and "startTime" in json_str:
                        captured_api_url = response.url
                        captured_data = data
                except:
                    pass

        page.on("response", handle_response)
        
        try:
            await page.goto(target_url, wait_until="networkidle", timeout=15000)
        except Exception:
            pass 
            
        await browser.close()
        
        if captured_api_url:
            return {
                "success": True, 
                "discovered_api_url": captured_api_url, 
                "raw_data": captured_data
            }
        else:
            return {"success": False, "error": "Could not intercept CatchCorner API request."}
