"""
forensic_eye.py — Gemini Vision: Slab DNA fingerprinting and comparison.

Analyzes PSA/CGC slab images for three micro-markers:
1. Internal Debris — dust specks trapped inside acrylic during sealing
2. Label Physics — exact tilt angle of the paper label
3. Holo-Star Alignment — holographic element position vs card printed border
"""

import json
import re
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types
from pydantic import BaseModel

from src.config import settings


# ---------------------------------------------------------------------------
# Gemini client (singleton)
# ---------------------------------------------------------------------------

_client: Optional[genai.Client] = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class IntegrityResult(BaseModel):
    score: int                  # 0–100 (100 = identical slab)
    is_same_slab: bool
    confidence: str             # HIGH | MEDIUM | LOW
    explanation: str
    visual_id_suspect: str
    visual_id_registry: str
    cert_redacted: bool = False


class RegistryMatch(BaseModel):
    cert_number: str
    registry_file: str
    result: IntegrityResult


# ---------------------------------------------------------------------------
# MIME type detection
# ---------------------------------------------------------------------------

def _detect_mime(image_bytes: bytes) -> str:
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    if image_bytes[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    if image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "image/webp"
    return "image/jpeg"  # safe default for eBay images


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_ANALYZE_PROMPT = """You are a forensic slab analyst specializing in PSA/CGC graded trading cards.
Examine this slab image. Ignore the card's printed content entirely.
Focus only on the physical properties of the plastic case.

Identify exactly 3 unique physical micro-markers:
1. Internal Debris: Describe specific dust specks or particles trapped inside the acrylic (location relative to corners/edges, approximate size, shape).
2. Label Physics: Describe the exact tilt angle and direction of the paper label relative to the top edge of the slab (e.g., "label tilted 2° clockwise").
3. Holo-Star Alignment: Describe the position of holographic elements relative to the card's printed border (e.g., "holo star cluster 1mm left of top-right corner").

Output a single 1-sentence "Visual ID" in this format:
"Dust [description] at [location], label tilted [angle] [direction], [holo description] near [position]."

If a marker is not clearly visible, describe the absence (e.g., "no visible dust specks in upper quadrant")."""


_COMPARE_STANDARD_PROMPT = """You are a forensic slab analyst comparing two PSA graded card photos.
Image 1 = SUSPECT listing. Image 2 = OFFICIAL REGISTRY scan.
Examine ONLY the physical plastic slab case — ignore all card content, grades, and serial numbers.

Work through each marker step by step before scoring:

MARKER A — INTERNAL DEBRIS (0–34 pts):
  List every visible dust speck or particle you can locate in the suspect image (rough position: e.g. "~4mm from upper-left corner, small oval").
  Cross-check each against the registry image. Each confirmed match at the same location = 8–10 pts. Approximate position match = 4 pts. Not visible in registry = 0 pts.
  Typical range: 0–34 pts.

MARKER B — LABEL TILT (0–33 pts):
  Estimate the paper label's clockwise tilt angle in both images separately.
  Same slab after sealing will have <0.5° difference. Score: <0.5° diff = 33, <1° = 22, <2° = 11, >2° = 0.

MARKER C — HOLO POSITION (0–33 pts):
  Estimate position of holographic star/element relative to the card's top-right corner in both images.
  Score: <1mm diff = 33, 1–2mm = 22, 2–4mm = 11, >4mm or not visible = 0.

SCORING RULES (critical — read carefully):
  • Final score = A + B + C (max 100). Do NOT default to 0 or 100.
  • Most non-identical slabs score 5–35. Most identical slabs score 75–98.
  • Score 36–74 = partial match (similar card type, different physical slab, or poor image quality).
  • Only give >90 if you can confirm specific matching debris AND matching tilt AND matching holo position.
  • Only give <10 if all three markers clearly differ AND the card types are visually distinct.
  • If image quality prevents assessing a marker, score it as 11 (middle partial) and flag in explanation.

Your 'explanation' MUST include at least 2 specific observations with approximate measurements.
Good: "Dust cluster ~3mm from upper-left corner matches in both images. Label tilt ~2° clockwise in suspect vs ~0° in registry — mismatch."
Bad: "The slabs appear different."

Respond with ONLY valid JSON (no markdown, no code fences).
IMPORTANT: visual_id_suspect and visual_id_registry must each be a single plain STRING sentence, NOT an object or dict.

{
  "score": <integer 0-100>,
  "is_same_slab": <true if score >= 78>,
  "confidence": "<HIGH if score>88 or score<15, MEDIUM if 50-88 or 15-30, LOW if 30-50>",
  "explanation": "<2-3 sentences with specific measurements and positions>",
  "visual_id_suspect": "<single string: dust at [location], label [tilt]°, holo at [position]>",
  "visual_id_registry": "<single string: dust at [location], label [tilt]°, holo at [position]>"
}"""


_COMPARE_REDACTED_PROMPT = """You are a forensic slab analyst comparing two PSA graded card photos.
Image 1 = SUSPECT listing. Image 2 = OFFICIAL REGISTRY scan.

CRITICAL: The certificate number on the SUSPECT image is obscured or hidden.
Ignore ALL label text on the suspect — it may be edited. Focus only on geometry and debris.

Work through each marker before scoring:

MARKER A — CARD-WITHIN-RAILS GEOMETRY (0–34 pts):
  Estimate the gap (in mm) between the card edge and the inner plastic rails on all four sides in both images.
  Same sealed slab = gaps differ by <0.5mm on all sides. Score: All 4 sides match <0.5mm = 34 pts. 3 sides match = 22 pts. 2 sides = 11 pts. Fewer = 0 pts.

MARKER B — INTERNAL DEBRIS (0–33 pts):
  List visible particles in suspect image with positions. Cross-check against registry.
  Each confirmed match = 8 pts. Approximate match = 4 pts. No match = 0.

MARKER C — HOLO POSITION (0–33 pts):
  Position of holographic element relative to card top-right corner in both images.
  <1mm diff = 33, 1–2mm = 22, 2–4mm = 11, >4mm = 0.

SCORING RULES:
  • Final score = A + B + C.
  • Do NOT default to 0 or 100. Most non-identical slabs score 5–35. Identical = 75–98.
  • Only give >90 if all three geometric markers confirm a match.
  • Only give <10 if geometry clearly differs on all four rail sides.

Your 'explanation' MUST cite specific rail gap measurements or debris positions observed.

Respond with ONLY valid JSON (no markdown, no code fences).
IMPORTANT: visual_id_suspect and visual_id_registry must each be a single plain STRING sentence, NOT an object or dict.

{
  "score": <integer 0-100>,
  "is_same_slab": <true if score >= 78>,
  "confidence": "<HIGH if score>88 or score<15, MEDIUM if 50-88 or 15-30, LOW if 30-50>",
  "explanation": "<2-3 sentences with specific rail gap measurements and debris positions>",
  "visual_id_suspect": "<single string: rail gaps [measurements], debris at [location], holo at [position]>",
  "visual_id_registry": "<single string: rail gaps [measurements], debris at [location], holo at [position]>"
}"""


_PRECHECK_PROMPT = """Look at this image and answer two questions:
1. Is this a PSA or CGC graded trading card slab — a card sealed in a hard rectangular plastic case with a printed label?
   Screenshots, logos, ungraded cards, and non-card images are NOT slabs.
2. If it IS a slab: is the certificate/serial number on the label obscured, hidden, blurred, or cropped out?

Respond with exactly this format (no other text):
IS_SLAB:YES|NO,CERT_HIDDEN:YES|NO"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def analyze_slab(image_bytes: bytes, mime_type: str | None = None) -> str:
    """Generate a Visual ID fingerprint string for a single slab image."""
    mime = mime_type or _detect_mime(image_bytes)
    client = _get_client()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            _ANALYZE_PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
        ],
    )
    return response.text.strip()


async def validate_and_check_cert(
    image_bytes: bytes, mime_type: str | None = None
) -> tuple[bool, bool]:
    """
    Single Gemini call that answers two questions at once:
      - Is this actually a PSA/CGC graded card slab?
      - Is the certificate number hidden/obscured?

    Returns (is_slab, is_cert_redacted).
    Replaces the previous two-call validate_is_slab + detect_redacted_cert pattern.
    """
    mime = mime_type or _detect_mime(image_bytes)
    client = _get_client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            _PRECHECK_PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
        ],
    )
    text = response.text.strip().upper()
    is_slab = "IS_SLAB:YES" in text
    is_redacted = "CERT_HIDDEN:YES" in text
    return is_slab, is_redacted


async def compare_registry(
    suspect_bytes: bytes,
    registry_bytes: bytes,
    is_redacted: bool = False,
    suspect_mime: str | None = None,
    registry_mime: str | None = None,
) -> IntegrityResult:
    """
    Compare a suspect listing image against an official registry scan.
    Sends both images in a single Gemini call for direct side-by-side analysis.

    Args:
        suspect_bytes: Image bytes from the suspicious listing
        registry_bytes: Image bytes from the official PSA/CGC registry
        is_redacted: If True, uses the rails-geometry prompt (cert number hidden)
    """
    s_mime = suspect_mime or _detect_mime(suspect_bytes)
    r_mime = registry_mime or _detect_mime(registry_bytes)
    prompt = _COMPARE_REDACTED_PROMPT if is_redacted else _COMPARE_STANDARD_PROMPT
    client = _get_client()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            prompt,
            types.Part.from_bytes(data=suspect_bytes, mime_type=s_mime),
            types.Part.from_bytes(data=registry_bytes, mime_type=r_mime),
        ],
    )

    raw = response.text.strip()
    # Strip any accidental markdown fences Gemini may add
    raw = re.sub(r'^```[a-z]*\n?', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\n?```$', '', raw, flags=re.MULTILINE)
    raw = raw.strip()

    data = json.loads(raw)

    def _str(val: object) -> str:
        """Flatten whatever Gemini returns into a plain string."""
        if isinstance(val, str):
            return val
        if isinstance(val, dict):
            return ". ".join(str(v) for v in val.values() if v)
        return str(val) if val is not None else ""

    return IntegrityResult(
        score=int(data["score"]),
        is_same_slab=bool(data["is_same_slab"]),
        confidence=data["confidence"],
        explanation=_str(data.get("explanation", "")),
        visual_id_suspect=_str(data.get("visual_id_suspect", "")),
        visual_id_registry=_str(data.get("visual_id_registry", "")),
        cert_redacted=is_redacted,
    )


async def find_registry_match(
    suspect_bytes: bytes,
    registry_dir: Path | None = None,
    is_redacted: bool | None = None,
) -> RegistryMatch | None:
    """
    Compare suspect image against every PNG in registry_cache/ IN PARALLEL.
    Returns the best match if any IntegrityResult.score > 70, else None.

    Args:
        is_redacted: Pre-computed from validate_and_check_cert — skips an extra
                     Gemini call if already known.

    Filename convention: {cardname}_{certnumber}_official.png
    e.g. charizard_73606485_official.png  →  cert = "73606485"
    """
    import asyncio

    if registry_dir is None:
        registry_dir = Path(__file__).parent.parent / "registry_cache"

    registry_files = list(registry_dir.glob("*_official.png"))
    if not registry_files:
        return None

    suspect_mime = _detect_mime(suspect_bytes)

    # Use pre-computed value if provided; otherwise detect now (single call)
    if is_redacted is None:
        _, is_redacted = await validate_and_check_cert(suspect_bytes, suspect_mime)

    # Compare against ALL registry files simultaneously
    async def _compare_one(registry_path: Path) -> RegistryMatch:
        m = re.search(r'_(\d+)_official', registry_path.name)
        cert_number = m.group(1) if m else "unknown"
        registry_bytes = registry_path.read_bytes()
        result = await compare_registry(
            suspect_bytes=suspect_bytes,
            registry_bytes=registry_bytes,
            is_redacted=is_redacted,
            suspect_mime=suspect_mime,
            registry_mime=_detect_mime(registry_bytes),
        )
        return RegistryMatch(cert_number=cert_number, registry_file=registry_path.name, result=result)

    all_matches = await asyncio.gather(*[_compare_one(p) for p in registry_files])

    best = max(all_matches, key=lambda r: r.result.score) if all_matches else None

    if best and best.result.score > 70:
        return best
    return None
