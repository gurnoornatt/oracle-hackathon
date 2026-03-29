# Visual Oracle

Ghost listing detector for PSA-graded TCG collectibles. Fingerprints slab DNA and cross-references the PSA registry to catch stolen auction photos before a buyer gets scammed.

## How it works

1. **Slab DNA extraction** — Gemini 2.5 Flash analyzes three physical micro-markers trapped inside the acrylic that can't be faked in a photo: internal debris position, label tilt angle, and holographic element alignment.
2. **Registry comparison** — The suspect listing photo is compared against official PSA registry scans in parallel. A high similarity score means the listing photo was likely copied from the registry or a prior auction.
3. **Shadow zone detection** — Listings priced $230–$249.99 are flagged as deliberately camping below eBay's $250 mandatory authentication threshold.
4. **Cert redaction** — A hidden certificate number is itself a red flag, caught automatically.

## Stack

| Layer | Tech |
|---|---|
| Vision / AI | Gemini 2.5 Flash |
| Backend | FastAPI + Python 3.12 (uv) |
| Frontend | React + Vite + TypeScript |
| Scraping | Stagehand + Browserbase |

## Setup

```bash
# 1. Clone and configure keys
cp .env.example .env
# fill in GEMINI_API_KEY, BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, ANTHROPIC_API_KEY

# 2. Backend
uv sync
uv run uvicorn src.main:app --reload --port 8001

# 3. Frontend (separate terminal)
cd ui
npm install
npm run dev
# → http://localhost:5173
```

## API

```
GET  /health              service status
POST /scan                live eBay listing (requires Browserbase)
POST /scan/local          demo mode — compares files from test_images/ vs registry_cache/
POST /scan/image          upload an image file directly
POST /scan/url-image      analyze a direct image URL
```

## Adding cards to the registry

Drop official PSA scan PNGs into `registry_cache/` named `{cardname}_{certnumber}_official.png`:

```
registry_cache/
  charizard_73606485_official.png
  lugia_108435597_official.png
  your_card_12345678_official.png   ← just add more here
```

All registry files are compared in parallel so adding more cards doesn't increase scan time.
