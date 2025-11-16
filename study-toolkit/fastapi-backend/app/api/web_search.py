from fastapi import APIRouter, HTTPException
import requests
import os
from dotenv import load_dotenv

# Load .env.local
load_dotenv(".env.local")

router = APIRouter()

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
if SERPAPI_API_KEY is None:
    raise ValueError("SERPAPI_API_KEY not found in environment variables!")

def build_queries(course_name: str):
    #Return the list of search queries we want to run.
    return [
        f"{course_name} Past Exams",
        f"{course_name} Notes"
    ]

@router.get("/search")
async def web_search(course_name: str):
    queries = build_queries(course_name)
    results = {}

    for query in queries:
        params = {
            "q": query,
            "api_key": SERPAPI_API_KEY,
            "engine": "google"
        }
        response = requests.get("https://serpapi.com/search", params=params)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Error fetching results for '{query}'")

        data = response.json()
        # Extract first 10 links
        links = []
        for item in data.get("organic_results", [])[:10]:
            link = item.get("link")
            if link and link.lower().endswith(".pdf"):
                links.append({
                "title": item.get("title"),
                "link": item.get("link"),
                "snippet": item.get("snippet")})
        results[query] = links

    return results
