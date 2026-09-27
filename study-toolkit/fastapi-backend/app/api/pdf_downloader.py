from pathlib import Path
from urllib.parse import urlparse
import httpx

# PDFs are sent inline to Gemini, whose requests are capped at 20 MB after base64 encoding
MAX_PDF_BYTES = 14 * 1024 * 1024

# There is intentionally no HTTP endpoint here: accepting an arbitrary URL and
# output path from a request would let any web page write files to disk.
async def download_pdf_file(client: httpx.AsyncClient, url: str, file_path: Path) -> dict:
    """
    Download a PDF from a URL to file_path.
    Raises ValueError if the URL or the response isn't an acceptable PDF.
    """
    if urlparse(url).scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {url}")

    print(f"Downloading PDF from: {url}")

    async with client.stream("GET", url, follow_redirects=True) as response:
        response.raise_for_status()
        chunks = []
        size = 0
        async for chunk in response.aiter_bytes():
            size += len(chunk)
            if size > MAX_PDF_BYTES:
                raise ValueError(f"PDF larger than {MAX_PDF_BYTES // (1024 * 1024)} MB")
            chunks.append(chunk)

    content = b"".join(chunks)
    # Search results ending in .pdf are sometimes HTML landing pages
    if not content.startswith(b"%PDF"):
        raise ValueError("Response is not a PDF")

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(content)
    print(f"✓ PDF saved: {file_path} ({size} bytes)")
    return {
        "message": "PDF downloaded successfully",
        "file_name": str(file_path),
        "size_bytes": size
    }
