const BASE = '/api'

export interface ForensicVerdict {
  is_scam: boolean
  risk_level: 'SCAM' | 'HIGH_RISK' | 'SUSPICIOUS' | 'VERIFIED' | 'UNKNOWN'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  flags: string[]
  visual_id: string | null
  integrity_score: number | null
  registry_match: string | null
  jp_hits: string[]
  reverse_search_hits: string[]
  evidence_summary: string
  listing_url: string | null
  listing_price: number | null
  shadow_zone_risk: string | null
  cert_number: string | null
  cert_redacted: boolean
}

async function _post(path: string, body: unknown): Promise<ForensicVerdict> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

export function scanLocal(suspect: string, registry: string): Promise<ForensicVerdict> {
  return _post('/scan/local', { suspect, registry })
}

export function scanLive(url: string): Promise<ForensicVerdict> {
  return _post('/scan', { url })
}

export function scanImageUrl(url: string): Promise<ForensicVerdict> {
  return _post('/scan/url-image', { url })
}

export async function scanFile(file: File): Promise<ForensicVerdict> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/scan/image`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

export function suspectImageUrl(filename: string): string {
  return `${BASE}/images/suspect/${filename}`
}

export function registryImageUrl(filename: string): string {
  return `${BASE}/images/registry/${filename}`
}
