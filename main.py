from fastapi import FastAPI
from datetime import datetime

app = FastAPI(title="Canlan Oakville Ice Tracker")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Canlan Oakville Ice Tracker"}

@app.get("/api/v1/ice/last-minute")
async def get_last_minute_ice():
    return {
        "timestamp": datetime.now().isoformat(),
        "status": "active",
        "message": "Service operational. Ready for direct target configuration.",
        "deals": []
    }
