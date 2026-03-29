import { motion } from 'motion/react'
import type { ForensicVerdict } from '../lib/api'

const FLAG_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  STOLEN_PHOTO:          { label: 'STOLEN PHOTO',         color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  STOLEN_PHOTO_INFERRED: { label: 'THEFT INFERRED',       color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  CERT_REDACTED:         { label: 'CERT REDACTED',         color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  SHADOW_ZONE_CAMPING:   { label: 'SHADOW ZONE CAMPING',   color: '#fb923c', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  SHADOW_ZONE:           { label: 'SHADOW ZONE PRICING',   color: '#fde047', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)' },
  JP_SOURCE_FOUND:       { label: 'JP SOURCE DETECTED',    color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  REVERSE_MATCH:         { label: 'REVERSE IMAGE MATCH',   color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
  NO_IMAGES_FOUND:       { label: 'NO IMAGES EXTRACTED',   color: '#a1a1aa', bg: 'rgba(113,113,122,0.1)',border: 'rgba(113,113,122,0.3)' },
}

const RISK_CFG = {
  SCAM:       { label: 'ALERT: SCAM DETECTED',         color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)', dot: '#ef4444', pulse: 'pulse-alert' },
  HIGH_RISK:  { label: 'HIGH RISK: INVESTIGATE',       color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)',dot: '#f97316', pulse: '' },
  SUSPICIOUS: { label: 'SUSPICIOUS: MANUAL REVIEW',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',dot: '#f59e0b', pulse: '' },
  VERIFIED:   { label: 'VERIFIED: UNIQUE IMAGE',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  dot: '#22c55e', pulse: 'pulse-verified' },
  UNKNOWN:    { label: 'UNKNOWN: INSUFFICIENT DATA',   color: '#71717a', bg: 'rgba(113,113,122,0.08)',border: 'rgba(113,113,122,0.2)', dot: '#71717a', pulse: '' },
}

interface Props { verdict: ForensicVerdict }

export function VerdictPanel({ verdict }: Props) {
  const risk = RISK_CFG[verdict.risk_level] ?? RISK_CFG.UNKNOWN
  const score = verdict.integrity_score ?? 0
  const scoreColor = score >= 85 ? '#ef4444' : score >= 70 ? '#f59e0b' : '#22c55e'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="bracket"
      style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: '#0c0c10', overflow: 'hidden' }}
    >
      {/* Banner */}
      <div className={risk.pulse}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 24px', borderBottom: `1px solid ${risk.border}`,
          background: risk.bg,
        }}>
        <div className={`${risk.pulse}`} style={{ position: 'relative', width: 12, height: 12, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: risk.dot }} />
        </div>
        <span className="font-mono" style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: risk.color }}>
          {risk.label}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <span className="font-mono" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Confidence: {verdict.confidence}
          </span>
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Score + Shadow Zone row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Score meter */}
          {verdict.integrity_score !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="font-mono" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Integrity Score
                </span>
                <span className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
                  {score}<span style={{ fontSize: 13, color: '#3f3f46' }}>/100</span>
                </span>
              </div>
              <div style={{ height: 4, background: '#18181b', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', borderRadius: 2, background: scoreColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="font-mono" style={{ fontSize: 8, color: '#27272a', textTransform: 'uppercase' }}>UNIQUE</span>
                <span className="font-mono" style={{ fontSize: 8, color: '#27272a', textTransform: 'uppercase' }}>IDENTICAL SLAB</span>
              </div>
            </div>
          )}

          {/* Shadow Zone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Shadow Zone Risk
            </span>
            {(() => {
              const sz = verdict.shadow_zone_risk
              const c = sz === 'CRITICAL' ? { color:'#fb923c', bg:'rgba(249,115,22,0.1)', border:'rgba(249,115,22,0.3)' }
                      : sz === 'ELEVATED' ? { color:'#fde047', bg:'rgba(234,179,8,0.1)',  border:'rgba(234,179,8,0.3)' }
                      : sz === 'NORMAL'   ? { color:'#4ade80', bg:'rgba(34,197,94,0.07)', border:'rgba(34,197,94,0.2)' }
                      :                    { color:'#52525b', bg:'rgba(63,63,70,0.3)',    border:'rgba(63,63,70,0.5)' }
              return (
                <span className="font-mono" style={{
                  fontSize: 11, padding: '6px 12px', borderRadius: 4, width: 'fit-content',
                  color: c.color, background: c.bg, border: `1px solid ${c.border}`,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>{sz ?? 'N/A'}</span>
              )
            })()}
            {verdict.listing_price !== null && (
              <span className="font-mono" style={{ fontSize: 10, color: '#52525b' }}>
                Price: <span style={{ color: '#a1a1aa' }}>${verdict.listing_price?.toFixed(2)}</span>
                {(verdict.listing_price ?? 0) >= 230 && (verdict.listing_price ?? 0) < 250 && (
                  <span style={{ color: '#f97316', marginLeft: 6 }}>← below $250 threshold</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Flags */}
        {verdict.flags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Detected Flags
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {verdict.flags.map(flag => {
                const f = FLAG_MAP[flag] ?? { label: flag, color: '#71717a', bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.3)' }
                return (
                  <span key={flag} className="font-mono" style={{
                    fontSize: 9, padding: '4px 10px', borderRadius: 4,
                    color: f.color, background: f.bg, border: `1px solid ${f.border}`,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                  }}>{f.label}</span>
                )
              })}
            </div>
          </div>
        )}

        {/* Visual ID */}
        {verdict.visual_id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Slab DNA — Visual ID
            </span>
            <div className="font-mono" style={{
              fontSize: 12, color: 'rgba(196,181,253,0.8)',
              background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: 6, padding: '14px 16px', lineHeight: 1.65,
            }}>
              "{verdict.visual_id}"
            </div>
          </div>
        )}

        {/* Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Evidence Summary
          </span>
          <div className="font-mono" style={{
            fontSize: 12, color: '#71717a',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 6, padding: '14px 16px', lineHeight: 1.65,
          }}>
            <span style={{ color: 'rgba(74,222,128,0.5)', marginRight: 8 }}>›</span>
            {verdict.evidence_summary}
          </div>
        </div>

        {/* Registry hit */}
        {verdict.registry_match && (
          <div className="font-mono" style={{
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 10,
            background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 6, padding: '10px 16px',
          }}>
            <span style={{ color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Registry Hit:</span>
            <span style={{ color: '#71717a' }}>{verdict.registry_match}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
