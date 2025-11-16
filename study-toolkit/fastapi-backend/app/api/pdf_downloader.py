from fastapi import APIRouter, HTTPException
from playwright.sync_api import sync_playwright

router = APIRouter()

@router.post("/download-pdf/")
def download_pdf(url: str, file_name: str):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(url)
            page.pdf(path=file_name)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            browser.close()
    return {"message": "PDF downloaded successfully", "file_name": file_name}