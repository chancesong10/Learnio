from fastapi import APIRouter, HTTPException
import requests

router = APIRouter()

SERPAPI_API_KEY = "your_serpapi_key"  # Replace with your actual SerpAPI key

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