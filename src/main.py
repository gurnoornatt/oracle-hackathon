"""
main.py — FastAPI entry point for Visual Oracle.

Endpoints:
  GET  /health              → service status
  POST /scan                → live eBay URL investigation
  POST /scan/local          → demo mode using local PNG files
  GET  /images/suspect/{f}  → serve test_images/ for the UI
  GET  /images/registry/{f} → serve registry_cache/ for the UI
"""

from pathlib import Path

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from src.detective import ForensicVerdict, investigate, investigate_bytes, investigate_local

_ROOT = Path(__file__).parent.parent

app = FastAPI(
    title="Visual Oracle",
    description="Ghost listing & image integrity detector for TCG collectibles.",
    version="1.0.0",
)

# CORS — allow the Vite dev server (port 5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # open for local dev — lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    url: str


class LocalScanRequest(BaseModel):
    suspect: str    # filename in test_images/, e.g. "sus_charizard.png"
    registry: str   # filename in registry_cache/, e.g. "charizard_73606485_official.png"


class ImageUrlRequest(BaseModel):
    url: str        # direct image URL (not an eBay listing page)


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def generic_error_handler(request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": type(exc).__name__, "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "model": "gemini-2.5-flash", "version": "1.0.0"}


@app.get("/images/suspect/{filename}")
async def serve_suspect(filename: str) -> FileResponse:
    path = _ROOT / "test_images" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Image not found: {filename}")
    return FileResponse(path)


@app.get("/images/registry/{filename}")
async def serve_registry(filename: str) -> FileResponse:
    path = _ROOT / "registry_cache" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Image not found: {filename}")
    return FileResponse(path)


@app.post("/scan", response_model=ForensicVerdict)
async def scan(request: ScanRequest) -> ForensicVerdict:
    """
    Live investigation pipeline:
    1. Scrape eBay listing via Stagehand + Browserbase
    2. Fingerprint images with Gemini
    3. Compare against local registry
    4. Search Japanese marketplaces
    5. Reverse image search via Google Lens
    6. Return forensic verdict
    """
    if not request.url.startswith("http"):
        raise HTTPException(status_code=400, detail="url must be a valid HTTP URL")

    return await investigate(request.url)


@app.post("/scan/image", response_model=ForensicVerdict)
async def scan_image(file: UploadFile = File(...)) -> ForensicVerdict:
    """
    Accept a direct image file upload and analyze it.
    Automatically finds the best matching registry entry.
    """
    suspect_bytes = await file.read()
    return await investigate_bytes(suspect_bytes)


@app.post("/scan/url-image", response_model=ForensicVerdict)
async def scan_url_image(request: ImageUrlRequest) -> ForensicVerdict:
    """
    Download an image from a direct URL and analyze it.
    Suitable for direct image links (not eBay listing pages — use /scan for those).
    """
    if not request.url.startswith("http"):
        raise HTTPException(status_code=400, detail="url must be a valid HTTP URL")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.get(
            request.url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; VisualOracle/1.0)"},
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=422, detail=f"Could not fetch image: HTTP {resp.status_code}")
        suspect_bytes = resp.content
    return await investigate_bytes(suspect_bytes)


@app.post("/scan/local", response_model=ForensicVerdict)
async def scan_local(request: LocalScanRequest) -> ForensicVerdict:
    """
    Demo mode — no Browserbase needed.
    Compares a suspect image from test_images/ against a registry image from registry_cache/.

    Example:
      {"suspect": "sus_charizard.png", "registry": "charizard_73606485_official.png"}
      {"suspect": "sus_lugia.png",     "registry": "lugia_108435597_official.png"}
    """
    return await investigate_local(
        suspect_filename=request.suspect,
        registry_filename=request.registry,
    )
