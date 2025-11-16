from fastapi import APIRouter, HTTPException
import requests
import os
from dotenv import load_dotenv

# Load .env.local
load_dotenv(".env.local")

router = APIRouter()

# Get API key from environment
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
if SERPAPI_API_KEY is None:
    raise ValueError("SERPAPI_API_KEY not found in environment variables!")

@router.get("/search")
async def web_search(query: str):
    params = {
        "q": query,
        "api_key": SERPAPI_API_KEY,
        "engine": "google"
    }
    response = requests.get("https://serpapi.com/search", params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Error fetching search results")

    return response.json()
