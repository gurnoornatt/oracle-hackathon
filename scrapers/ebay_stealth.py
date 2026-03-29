"""
ebay_stealth.py — Stagehand + Browserbase: eBay listing scraper.

Extracts high-res images, cert numbers, seller info, price, and listing date.
All image URLs are aggressively normalized to s-l1600 — Gemini cannot detect
micro-scratches or dust specks at lower resolutions.
"""

import re
from typing import Optional

import httpx
from pydantic import BaseModel
from stagehand import AsyncStagehand

from src.config import settings


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class EbayListing(BaseModel):
    url: str
    cert_number: Optional[str] = None
    image_urls: list[str]
    seller: Optional[str] = None
    listing_date: Optional[str] = None
    price: Optional[float] = None
    title: Optional[str] = None


class ReverseSearchResult(BaseModel):
    title: str
    url: str
    source: str
    snippet: Optional[str] = None


# ---------------------------------------------------------------------------
# s-l1600 normalization (Tweak 2)
# Catches every eBay thumbnail variant: s-l64, s-l96, s-l140, s-l225, s-l300,
# s-l400, s-l500, s-l640, s-l960, s-l1200, s-l1600 (already correct)
# ---------------------------------------------------------------------------

_EBAY_RES_PATTERN = re.compile(r's-l\d+')


def force_max_resolution(url: str) -> str:
    """Force any eBay image URL to its maximum 1600px version."""
    return _EBAY_RES_PATTERN.sub('s-l1600', url)


def normalize_image_urls(urls: list[str]) -> list[str]:
    """Normalize and deduplicate a list of eBay image URLs."""
    seen: set[str] = set()
    result: list[str] = []
    for url in urls:
        normalized = force_max_resolution(url)
        if normalized not in seen and 'ebayimg.com' in normalized:
            seen.add(normalized)
            result.append(normalized)
    return result


# ---------------------------------------------------------------------------
# Stagehand helpers
# ---------------------------------------------------------------------------

def _stagehand_client() -> AsyncStagehand:
    return AsyncStagehand(
        browserbase_api_key=settings.browserbase_api_key,
        browserbase_project_id=settings.browserbase_project_id,
        model_api_key=settings.anthropic_api_key,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def scrape_listing(url: str) -> EbayListing:
    """
    Scrape an eBay listing for images, cert number, price, seller, and date.
    Images are normalized to s-l1600 before returning.
    """
    async with _stagehand_client() as client:
        session = await client.sessions.start(
            model_name="anthropic/claude-sonnet-4-6",
            browser={"type": "browserbase"},
        )

        await session.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        # Small wait for lazy-loaded gallery images to appear
        await session.page.wait_for_timeout(2000)

        # Extract structured listing data via Stagehand AI extraction
        from pydantic import Field

        class _RawListing(BaseModel):
            title: str = Field(default="", description="The listing title")
            price_text: str = Field(default="", description="The listed price as text, e.g. '$249.99'")
            seller_name: str = Field(default="", description="The seller's username")
            listing_date: str = Field(default="", description="When the item was listed, if visible")
            cert_number: str = Field(default="", description="PSA or CGC certificate/serial number if visible in the listing")
            image_urls: list[str] = Field(default_factory=list, description="All high-resolution image URLs from the main image gallery (data-zoom-src or full-size src attributes)")

        raw = await session.extract(
            instruction=(
                "Extract from this eBay listing: the title, price, seller username, "
                "listing date, PSA/CGC certificate number (if shown), and all "
                "high-resolution image URLs from the main product gallery. "
                "For images, prioritize data-zoom-src attributes over src."
            ),
            schema=_RawListing,
        )

        # Parse price to float
        price = None
        if raw.price_text:
            price_match = re.search(r'[\d,]+\.?\d*', raw.price_text.replace(',', ''))
            if price_match:
                price = float(price_match.group())

        # Normalize all image URLs to max resolution
        normalized_urls = normalize_image_urls(raw.image_urls)

        return EbayListing(
            url=url,
            cert_number=raw.cert_number or None,
            image_urls=normalized_urls,
            seller=raw.seller_name or None,
            listing_date=raw.listing_date or None,
            price=price,
            title=raw.title or None,
        )


async def download_images(
    image_urls: list[str],
    max_images: int = 5,
) -> list[tuple[bytes, str]]:
    """
    Download images concurrently with httpx.
    Returns list of (bytes, mime_type) tuples.
    Only downloads up to max_images (first = primary gallery shot).
    """
    urls_to_fetch = image_urls[:max_images]

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(20.0),
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (compatible; VisualOracle/1.0)"},
    ) as http:
        results: list[tuple[bytes, str]] = []
        for url in urls_to_fetch:
            try:
                resp = await http.get(url)
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                results.append((resp.content, content_type))
            except Exception:
                continue
        return results


async def reverse_image_search(image_bytes: bytes) -> list[ReverseSearchResult]:
    """
    Perform a reverse image search via Google Lens using Stagehand.
    Falls back to Yandex if Google returns no useful matches.
    """
    async with _stagehand_client() as client:
        session = await client.sessions.start(
            model_name="anthropic/claude-sonnet-4-6",
            browser={"type": "browserbase"},
        )

        # Upload to Google Lens
        await session.page.goto("https://lens.google.com/", timeout=20000)

        # Use Stagehand to interact with the image upload
        await session.act("Click the camera/image upload button to search by image")
        await session.act("Upload an image file using the file input")

        # Upload the bytes via file input
        # We need to write bytes to a temp file for Playwright's set_input_files
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            file_input = await session.page.query_selector('input[type="file"]')
            if file_input:
                await file_input.set_input_files(tmp_path)
                await session.page.wait_for_timeout(3000)

            from pydantic import Field as PField

            class _SearchResults(BaseModel):
                results: list[dict] = PField(
                    default_factory=list,
                    description="List of search results, each with 'title', 'url', 'source', and 'snippet'"
                )

            raw = await session.extract(
                instruction="Extract the top 5 reverse image search results shown on this page. For each result get the title, URL, source website name, and any date or snippet text.",
                schema=_SearchResults,
            )

            search_results = [
                ReverseSearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    source=r.get("source", ""),
                    snippet=r.get("snippet"),
                )
                for r in raw.results
                if r.get("url")
            ]

            if search_results:
                return search_results

        finally:
            os.unlink(tmp_path)

        # Fallback: Yandex reverse image search
        return await _yandex_reverse_search(image_bytes, session)


async def _yandex_reverse_search(image_bytes: bytes, session) -> list[ReverseSearchResult]:
    """Fallback reverse image search via Yandex."""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        await session.page.goto("https://yandex.com/images/", timeout=20000)
        await session.act("Click the camera icon to search by image")

        file_input = await session.page.query_selector('input[type="file"]')
        if file_input:
            await file_input.set_input_files(tmp_path)
            await session.page.wait_for_timeout(3000)

        from pydantic import Field as PField

        class _YandexResults(BaseModel):
            results: list[dict] = PField(
                default_factory=list,
                description="Top reverse image search results with title, url, source, snippet"
            )

        raw = await session.extract(
            instruction="Extract the top 5 image search results. For each get title, URL, source website, and any date or snippet.",
            schema=_YandexResults,
        )

        return [
            ReverseSearchResult(
                title=r.get("title", ""),
                url=r.get("url", ""),
                source=r.get("source", "Yandex"),
                snippet=r.get("snippet"),
            )
            for r in raw.results
            if r.get("url")
        ]
    finally:
        os.unlink(tmp_path)
