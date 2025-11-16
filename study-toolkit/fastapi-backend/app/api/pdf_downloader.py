from fastapi import APIRouter, HTTPException, Query
import requests
import os

router = APIRouter()

@router.post("/download-pdf/")
def download_pdf(url: str = Query(...), file_name: str = Query(...)):
    """Download a PDF file from a URL"""
    try:
        print(f"Downloading PDF from: {url}")
        
        # Download the PDF file
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Save to file
        with open(file_name, 'wb') as f:
            f.write(response.content)
        
        # Verify file was created
        if os.path.exists(file_name):
            file_size = os.path.getsize(file_name)
            print(f"✓ PDF saved: {file_name} ({file_size} bytes)")
            return {
                "message": "PDF downloaded successfully", 
                "file_name": file_name,
                "size_bytes": file_size
            }
        else:
            raise Exception("File was not created")
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")