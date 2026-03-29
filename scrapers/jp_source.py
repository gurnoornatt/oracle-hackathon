"""
jp_source.py — Stagehand + Browserbase: Japanese marketplace scrapers.

Searches Mercari Japan and Yahoo Auctions Japan by cert number or card name.
If a JP listing predates the eBay listing by > 7 days, it indicates dropshipping.
"""

from typing import Optional

from pydantic import BaseModel, Field
from stagehand import AsyncStagehand

from src.config import settings


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class JpListing(BaseModel):
    title: str
    url: str
    date: Optional[str] = None       # listing/sold date as text
    price_jpy: Optional[str] = None  # price in JPY as text
    image_urls: list[str] = []
    platform: str                    # "mercari_jp" | "yahoo_jp"
    cert_number_visible: bool = False


# ---------------------------------------------------------------------------
# Stagehand client
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

async def search_mercari_jp(
    cert_number: Optional[str],
    card_name: Optional[str],
) -> list[JpListing]:
    """
    Search Mercari Japan for a card by cert number or name.
    Cert number is the primary search term — more precise than card name.
    """
    query = cert_number or card_name or ""
    if not query:
        return []

    async with _stagehand_client() as client:
        session = await client.sessions.start(
            model_name="anthropic/claude-sonnet-4-6",
            browser={"type": "browserbase"},
        )

        search_url = f"https://jp.mercari.com/search?keyword={query}&status=sold_out"
        await session.page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        await session.page.wait_for_timeout(2000)

        class _MercariResults(BaseModel):
            listings: list[dict] = Field(
                default_factory=list,
                description="List of sold listings, each with: title, url, price (in yen), sold_date, has_cert_number (bool)"
            )

        raw = await session.extract(
            instruction=(
                f"Extract the top 10 sold listings from this Mercari Japan search for '{query}'. "
                "For each listing get: title, full URL, price in yen, sold or listing date, "
                "and whether the PSA/CGC certificate number is visible in the title or description."
            ),
            schema=_MercariResults,
        )

        return [
            JpListing(
                title=r.get("title", ""),
                url=r.get("url", ""),
                date=r.get("sold_date") or r.get("date"),
                price_jpy=str(r.get("price", "")),
                platform="mercari_jp",
                cert_number_visible=bool(r.get("has_cert_number", False)),
            )
            for r in raw.listings
            if r.get("url")
        ]


async def search_yahoo_jp(
    cert_number: Optional[str],
    card_name: Optional[str],
) -> list[JpListing]:
    """
    Search Yahoo Auctions Japan (completed auctions) by cert number or card name.
    """
    query = cert_number or card_name or ""
    if not query:
        return []

    async with _stagehand_client() as client:
        session = await client.sessions.start(
            model_name="anthropic/claude-sonnet-4-6",
            browser={"type": "browserbase"},
        )

        # Search completed (sold) auctions
        search_url = (
            f"https://auctions.yahoo.co.jp/search/search"
            f"?p={query}&va={query}&exflg=1&b=1&n=20&s1=end&o1=d&complete=1"
        )
        await session.page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        await session.page.wait_for_timeout(2000)

        class _YahooResults(BaseModel):
            listings: list[dict] = Field(
                default_factory=list,
                description="List of completed auction listings, each with: title, url, final_price, end_date, has_cert_number (bool)"
            )

        raw = await session.extract(
            instruction=(
                f"Extract the top 10 completed auction listings from this Yahoo Auctions Japan search for '{query}'. "
                "For each listing get: title, full URL, final price in yen, auction end date, "
                "and whether the PSA/CGC certificate number is visible."
            ),
            schema=_YahooResults,
        )

        return [
            JpListing(
                title=r.get("title", ""),
                url=r.get("url", ""),
                date=r.get("end_date") or r.get("date"),
                price_jpy=str(r.get("final_price", "")),
                platform="yahoo_jp",
                cert_number_visible=bool(r.get("has_cert_number", False)),
            )
            for r in raw.listings
            if r.get("url")
        ]


async def check_psa_registry(cert_number: str) -> Optional[dict]:
    """
    Fetch the official PSA Registry entry for a cert number.
    Returns dict with card name, grade, and official image URL if found.
    """
    async with _stagehand_client() as client:
        session = await client.sessions.start(
            model_name="anthropic/claude-sonnet-4-6",
            browser={"type": "browserbase"},
        )

        registry_url = f"https://www.psacard.com/cert/{cert_number}"
        await session.page.goto(registry_url, wait_until="domcontentloaded", timeout=30000)
        await session.page.wait_for_timeout(2000)

        class _RegistryEntry(BaseModel):
            card_name: str = Field(default="", description="The card name and set")
            grade: str = Field(default="", description="The PSA grade (e.g. PSA 10)")
            year: str = Field(default="", description="Year of the card")
            official_image_url: str = Field(default="", description="URL of the official front image")
            cert_number: str = Field(default="", description="The certificate number as shown")

        raw = await session.extract(
            instruction=(
                f"Extract from this PSA Registry page: the card name, grade, year, "
                f"certificate number, and the URL of the official front card image."
            ),
            schema=_RegistryEntry,
        )

        if raw.card_name:
            return {
                "card_name": raw.card_name,
                "grade": raw.grade,
                "year": raw.year,
                "cert_number": raw.cert_number or cert_number,
                "official_image_url": raw.official_image_url,
            }
        return None
