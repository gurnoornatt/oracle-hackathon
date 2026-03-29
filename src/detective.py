"""
detective.py — Cross-platform investigation orchestrator.

Chains together: eBay scrape → registry comparison → JP marketplace search
→ reverse image search → forensic verdict.

Tweak 1 (Shadow Zone): $230–$249.99 is CRITICAL risk — scammers deliberately
camp below eBay's $250 authentication trigger. This escalates the verdict.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import httpx
from pydantic import BaseModel

from src.forensic_eye import (
    IntegrityResult,
    RegistryMatch,
    analyze_slab,
    compare_registry,
    find_registry_match,
    validate_and_check_cert,
)
from scrapers.ebay_stealth import (
    EbayListing,
    ReverseSearchResult,
    download_images,
    reverse_image_search,
    scrape_listing,
)
from scrapers.jp_source import (
    JpListing,
    check_psa_registry,
    search_mercari_jp,
    search_yahoo_jp,
)


# ---------------------------------------------------------------------------
# Shadow Zone pricing logic (Tweak 1)
# ---------------------------------------------------------------------------

SHADOW_ZONE_MAX = 250.00
SHADOW_ZONE_CRITICAL_MIN = 230.00  # $230–$249.99 = deliberate threshold camping


def shadow_zone_risk(price: Optional[float]) -> str:
    """
    $249.99 is MORE suspicious than $251. Scammers deliberately sit just
    below eBay's mandatory authentication vault trigger.

    Returns:
        "CRITICAL"  — $230–$249.99, intentional threshold camping
        "ELEVATED"  — below $230, in shadow zone but not camping
        "NORMAL"    — $250+, eBay vault authentication applies
        "UNKNOWN"   — price not available
    """
    if price is None:
        return "UNKNOWN"
    if SHADOW_ZONE_CRITICAL_MIN <= price < SHADOW_ZONE_MAX:
        return "CRITICAL"
    if price < SHADOW_ZONE_CRITICAL_MIN:
        return "ELEVATED"
    return "NORMAL"


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class ForensicVerdict(BaseModel):
    # Core verdict
    is_scam: bool
    risk_level: str              # SCAM | HIGH_RISK | SUSPICIOUS | VERIFIED | UNKNOWN
    confidence: str              # HIGH | MEDIUM | LOW | UNKNOWN
    flags: list[str]             # e.g. ["STOLEN_PHOTO", "CERT_REDACTED", "SHADOW_ZONE_CAMPING"]

    # Evidence
    visual_id: Optional[str] = None
    integrity_score: Optional[int] = None
    registry_match: Optional[str] = None   # registry filename if matched
    jp_hits: list[str] = []               # JP marketplace URLs found
    reverse_search_hits: list[str] = []   # reverse image search URLs
    evidence_summary: str = ""

    # Listing metadata
    listing_url: Optional[str] = None
    listing_price: Optional[float] = None
    shadow_zone_risk: Optional[str] = None
    cert_number: Optional[str] = None
    cert_redacted: bool = False


# ---------------------------------------------------------------------------
# Verdict assembly
# ---------------------------------------------------------------------------

def _build_verdict(
    listing: Optional[EbayListing],
    integrity: Optional[IntegrityResult],
    registry: Optional[RegistryMatch],
    jp_results: list[JpListing],
    reverse_results: list[ReverseSearchResult],
    visual_id: Optional[str],
    listing_url: Optional[str] = None,
) -> ForensicVerdict:
    flags: list[str] = []
    evidence_parts: list[str] = []

    price = listing.price if listing else None
    sz_risk = shadow_zone_risk(price)
    cert_redacted = integrity.cert_redacted if integrity else False
    cert_number = listing.cert_number if listing else None

    # --- Cert redaction flag (always surface, never suppress) ---
    if cert_redacted:
        flags.append("CERT_REDACTED")
        evidence_parts.append("Certificate number is hidden in the listing photo.")

    # --- Shadow zone flags ---
    if sz_risk == "CRITICAL":
        flags.append("SHADOW_ZONE_CAMPING")
        evidence_parts.append(
            f"Price ${price:.2f} sits deliberately below eBay's $250 authentication threshold."
        )
    elif sz_risk == "ELEVATED":
        flags.append("SHADOW_ZONE")

    # --- Registry match ---
    score = integrity.score if integrity else 0
    if registry and integrity and integrity.is_same_slab:
        flags.append("STOLEN_PHOTO")
        evidence_parts.append(
            f"Registry match: {registry.registry_file} (integrity score {score}/100). "
            f"{integrity.explanation}"
        )

    # --- JP marketplace hits ---
    jp_urls = [j.url for j in jp_results if j.url]
    if jp_urls:
        flags.append("JP_SOURCE_FOUND")
        evidence_parts.append(
            f"Found {len(jp_urls)} matching listing(s) on Japanese marketplaces."
        )

    # --- Reverse image search hits ---
    rev_urls = [r.url for r in reverse_results if r.url]
    if rev_urls:
        flags.append("REVERSE_MATCH")
        evidence_parts.append(
            f"Reverse image search found {len(rev_urls)} prior appearance(s) online."
        )

    # --- Determine risk level with shadow zone escalation ---
    if "STOLEN_PHOTO" in flags:
        risk_level = "SCAM"
        is_scam = True
        confidence = "HIGH" if score >= 85 else "MEDIUM"
    elif cert_redacted and sz_risk == "CRITICAL":
        # Hidden cert + deliberate threshold camping = scam regardless of image score
        risk_level = "SCAM"
        is_scam = True
        confidence = "MEDIUM"
        flags.append("STOLEN_PHOTO_INFERRED")
        evidence_parts.append(
            "Hidden certificate + shadow zone camping combination is a strong scam indicator."
        )
    elif "JP_SOURCE_FOUND" in flags:
        risk_level = "HIGH_RISK"
        is_scam = False
        confidence = "HIGH"
    elif "REVERSE_MATCH" in flags:
        risk_level = "SCAM"
        is_scam = True
        confidence = "MEDIUM"
    elif score >= 70 and score < 85:
        risk_level = "SUSPICIOUS"
        is_scam = False
        confidence = "LOW"
        # Escalate if shadow zone camping
        if sz_risk == "CRITICAL":
            risk_level = "HIGH_RISK"
            confidence = "MEDIUM"
            evidence_parts.append("Suspicious image score escalated by shadow zone pricing.")
    elif cert_redacted:
        risk_level = "SUSPICIOUS"
        is_scam = False
        confidence = "LOW"
    else:
        risk_level = "VERIFIED"
        is_scam = False
        confidence = "HIGH" if score > 0 else "UNKNOWN"

    # Build natural-language summary from evidence parts
    if evidence_parts:
        summary = _narrative_summary(evidence_parts, risk_level, integrity)
    else:
        summary = "No fraud indicators detected. The slab appears unique relative to the registry."

    return ForensicVerdict(
        is_scam=is_scam,
        risk_level=risk_level,
        confidence=confidence,
        flags=flags,
        visual_id=visual_id,
        integrity_score=score if integrity else None,
        registry_match=registry.registry_file if registry else None,
        jp_hits=jp_urls,
        reverse_search_hits=rev_urls,
        evidence_summary=summary,
        listing_url=listing_url or (listing.url if listing else None),
        listing_price=price,
        shadow_zone_risk=sz_risk,
        cert_number=cert_number,
        cert_redacted=cert_redacted,
    )


# ---------------------------------------------------------------------------
# Evidence narrative builder
# ---------------------------------------------------------------------------

def _narrative_summary(parts: list[str], risk_level: str, integrity: Optional[IntegrityResult]) -> str:
    """
    Convert raw evidence parts into a single readable paragraph.
    Avoids pipe-joined strings that sound mechanical.
    """
    sentences: list[str] = []

    # Lead with the Gemini explanation if we have one — it's the most specific
    if integrity and integrity.explanation:
        sentences.append(integrity.explanation.strip().rstrip(".") + ".")

    # Add other flags as supporting context
    for part in parts:
        clean = part.strip().rstrip(".")
        # Skip if already covered by Gemini's explanation (overlap detection)
        if integrity and integrity.explanation and any(
            word in integrity.explanation.lower()
            for word in clean.lower().split()[:4]
        ):
            continue
        sentences.append(clean + ".")

    return " ".join(sentences) if sentences else " ".join(p.rstrip(".") + "." for p in parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def investigate(url: str) -> ForensicVerdict:
    """
    Full live pipeline: scrape eBay → fingerprint → registry check → JP search → verdict.
    """
    # 1. Scrape eBay listing
    listing = await scrape_listing(url)

    if not listing.image_urls:
        return ForensicVerdict(
            is_scam=False,
            risk_level="UNKNOWN",
            confidence="UNKNOWN",
            flags=["NO_IMAGES_FOUND"],
            evidence_summary="Could not extract images from the listing.",
            listing_url=url,
        )

    # 2. Download primary image (first = main gallery shot)
    image_data = await download_images(listing.image_urls, max_images=1)
    if not image_data:
        return ForensicVerdict(
            is_scam=False,
            risk_level="UNKNOWN",
            confidence="UNKNOWN",
            flags=["IMAGE_DOWNLOAD_FAILED"],
            evidence_summary="Could not download listing images.",
            listing_url=url,
        )

    suspect_bytes, suspect_mime = image_data[0]

    # 3. Generate Visual ID fingerprint
    visual_id = await analyze_slab(suspect_bytes, suspect_mime)

    # 4. Compare against local registry
    registry_match = await find_registry_match(suspect_bytes)

    # 5. JP marketplace search (only if cert number available)
    jp_results: list[JpListing] = []
    if listing.cert_number:
        mercari = await search_mercari_jp(listing.cert_number, listing.title)
        yahoo = await search_yahoo_jp(listing.cert_number, listing.title)
        jp_results = mercari + yahoo

    # 6. Reverse image search
    reverse_results = await reverse_image_search(suspect_bytes)

    # 7. Get integrity result from registry match (if any)
    integrity = registry_match.result if registry_match else None

    return _build_verdict(
        listing=listing,
        integrity=integrity,
        registry=registry_match,
        jp_results=jp_results,
        reverse_results=reverse_results,
        visual_id=visual_id,
        listing_url=url,
    )


async def investigate_local(
    suspect_filename: str,
    registry_filename: str,
) -> ForensicVerdict:
    """
    Demo mode — no eBay scraping or Browserbase needed.
    Compares files directly from test_images/ vs registry_cache/.
    """
    root = Path(__file__).parent.parent
    suspect_path = root / "test_images" / suspect_filename
    registry_path = root / "registry_cache" / registry_filename

    suspect_bytes = suspect_path.read_bytes()
    registry_bytes = registry_path.read_bytes()

    # Stage 1: combined gate + cert check (1 Gemini call instead of 2)
    is_slab, is_redacted = await validate_and_check_cert(suspect_bytes)
    if not is_slab:
        return _NOT_SLAB_VERDICT

    # Compare in a single Gemini call
    integrity = await compare_registry(
        suspect_bytes=suspect_bytes,
        registry_bytes=registry_bytes,
        is_redacted=is_redacted,
    )

    # Visual ID for the suspect image
    visual_id = integrity.visual_id_suspect

    # Build a minimal "listing" for verdict logic (no price/seller in local mode)
    verdict = _build_verdict(
        listing=None,
        integrity=integrity,
        registry=RegistryMatch(
            cert_number=_cert_from_filename(registry_filename),
            registry_file=registry_filename,
            result=integrity,
        ) if integrity.is_same_slab else None,
        jp_results=[],
        reverse_results=[],
        visual_id=visual_id,
        listing_url=f"local://{suspect_filename}",
    )

    return verdict


_NOT_SLAB_VERDICT = ForensicVerdict(
    is_scam=False,
    risk_level="UNKNOWN",
    confidence="UNKNOWN",
    flags=["NOT_A_SLAB"],
    evidence_summary=(
        "The uploaded image does not appear to be a PSA or CGC graded card slab. "
        "Please upload a clear photo of a graded card in its hard plastic case with a visible label."
    ),
)


async def investigate_bytes(suspect_bytes: bytes) -> ForensicVerdict:
    """
    Analyze raw image bytes — no filenames needed.
    Automatically finds the best matching registry file.
    Used by the /scan/image and /scan/url-image endpoints.
    """
    # Stage 1: combined gate + cert check (1 Gemini call)
    is_slab, is_redacted = await validate_and_check_cert(suspect_bytes)
    if not is_slab:
        return _NOT_SLAB_VERDICT

    # Stage 2: parallel registry comparisons (all files run simultaneously)
    registry_match = await find_registry_match(suspect_bytes, is_redacted=is_redacted)

    if registry_match:
        integrity = registry_match.result
        visual_id = integrity.visual_id_suspect
    else:
        # No match in registry — still fingerprint and return VERIFIED
        visual_id = await analyze_slab(suspect_bytes)
        integrity = IntegrityResult(
            score=0,
            is_same_slab=False,
            confidence="MEDIUM",
            explanation="No matching entry found in the PSA registry.",
            visual_id_suspect=visual_id or "",
            visual_id_registry="",
            cert_redacted=False,
        )

    return _build_verdict(
        listing=None,
        integrity=integrity,
        registry=registry_match,
        jp_results=[],
        reverse_results=[],
        visual_id=visual_id,
        listing_url=None,
    )


def _cert_from_filename(filename: str) -> str:
    """Extract cert number from registry filename pattern."""
    import re
    m = re.search(r'_(\d+)_official', filename)
    return m.group(1) if m else "unknown"
