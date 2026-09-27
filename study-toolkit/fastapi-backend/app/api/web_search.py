from fastapi import APIRouter, HTTPException
import httpx

from ..config import require_env

router = APIRouter()

def build_queries(course_name: str):
    #Return the list of search queries we want to run.
    return [
        f"{course_name} Past Exams",
        f"{course_name} Notes"
    ]

@router.get("/search")
async def web_search(course_name: str):
    try:
        api_key = require_env("SERPAPI_API_KEY")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    queries = build_queries(course_name)
    results = {}

    async with httpx.AsyncClient(timeout=30) as client:
        for query in queries:
            params = {
                "q": query,
                "api_key": api_key,
                "engine": "google"
            }
            try:
                response = await client.get("https://serpapi.com/search", params=params)
            except httpx.HTTPError as e:
                raise HTTPException(status_code=502, detail=f"Error fetching results for '{query}': {e}")

            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Error fetching results for '{query}'")

            data = response.json()
            # Keep only PDF links from the first 10 results
            links = []
            for item in data.get("organic_results", [])[:10]:
                link = item.get("link")
                if link and link.lower().endswith(".pdf"):
                    links.append({
                        "title": item.get("title"),
                        "link": link,
                        "snippet": item.get("snippet")})
            results[query] = links

    return results
