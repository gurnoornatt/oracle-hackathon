import { motion } from 'motion/react'
import { useTheme } from '../theme'
import type { ForensicVerdict } from '../lib/api'

const RISK_CFG = {
  SCAM:       { label: 'Scam Detected',              danger: true,  ambig: false },
  HIGH_RISK:  { label: 'High Risk',                  danger: true,  ambig: false },
  SUSPICIOUS: { label: 'Suspicious — Review Needed', danger: false, ambig: true  },
  VERIFIED:   { label: 'Likely Authentic',           danger: false, ambig: false },
  UNKNOWN:    { label: 'Inconclusive',               danger: false, ambig: true  },
}

const FLAG_LABELS: Record<string, string> = {
  STOLEN_PHOTO:          'Stolen Photo',
  STOLEN_PHOTO_INFERRED: 'Theft Inferred',
  CERT_REDACTED:         'Cert Redacted',
  SHADOW_ZONE_CAMPING:   'Shadow Zone Camping',
  SHADOW_ZONE:           'Shadow Zone Pricing',
  JP_SOURCE_FOUND:       'JP Source Detected',
  REVERSE_MATCH:         'Reverse Image Match',
  NOT_A_SLAB:            'Not a slab image',
}

interface Props { verdict: ForensicVerdict; imageUrl: string | null; onReset: () => void }

export function LegitimacyReport({ verdict, imageUrl, onReset }: Props) {
  const t = useTheme()
  const cfg = RISK_CFG[verdict.risk_level] ?? RISK_CFG.UNKNOWN

  const vColor = cfg.danger ? t.danger : cfg.ambig ? t.warning : t.success

  const score = verdict.integrity_score ?? 0
  const barColor = score >= 70 ? t.danger : score >= 40 ? t.warning : t.success
  const barLabel = score >= 70 ? 'High match — likely stolen'
                 : score >= 40 ? 'Partial — investigate'
                 : 'Low match — appears unique'

  const divider = <div style={{ height: 1, background: t.border }} />

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Card image — hero at top */}
      {imageUrl && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={imageUrl} alt="Analyzed card"
            style={{ width: 150, borderRadius: 8, objectFit: 'contain', background: '#111',
              boxShadow: `0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px ${t.border}` }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Single unified panel */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>

        {/* Verdict row */}
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: vColor }} />
            {cfg.danger && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: vColor,
                opacity: 0.35, animation: 'ping 1.6s cubic-bezier(0,0,0.2,1) infinite' }} />
            )}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: vColor }}>{cfg.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: t.text2 }}>
            Confidence: {verdict.confidence}
          </span>
        </div>

        {divider}

        {/* Score */}
        {verdict.integrity_score !== null && (
          <>
            <div style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: t.text2 }}>Registry Similarity</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: barColor, lineHeight: 1 }}>
                  {score}<span style={{ fontSize: 12, color: t.text3, fontWeight: 400 }}>/100</span>
                </span>
              </div>
              <div style={{ height: 6, background: t.border, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${score}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', background: barColor, borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: t.text3 }}>Unique</span>
                <span style={{ fontSize: 10, color: barColor }}>{barLabel}</span>
                <span style={{ fontSize: 10, color: t.text3 }}>Identical</span>
              </div>
            </div>
            {divider}
          </>
        )}

        {/* Signals */}
        {verdict.flags.length > 0 && (
          <>
            <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {verdict.flags.map(flag => {
                const isRed   = ['STOLEN_PHOTO','STOLEN_PHOTO_INFERRED','JP_SOURCE_FOUND','REVERSE_MATCH'].includes(flag)
                const isAmber = ['CERT_REDACTED','SHADOW_ZONE_CAMPING','SHADOW_ZONE'].includes(flag)
                const c = isRed
                  ? { bg: t.isDark ? 'rgba(248,113,113,0.12)' : '#FEF2F2', color: t.danger,  border: t.isDark ? 'rgba(248,113,113,0.25)' : '#FECACA' }
                  : isAmber
                  ? { bg: t.isDark ? 'rgba(251,191,36,0.1)'   : '#FFFBEB', color: t.warning, border: t.isDark ? 'rgba(251,191,36,0.25)'  : '#FDE68A' }
                  : { bg: t.isDark ? t.border : '#F4F3F0', color: t.text2, border: t.border }
                return (
                  <span key={flag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4,
                    background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 500 }}>
                    {FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ')}
                  </span>
                )
              })}
            </div>
            {divider}
          </>
        )}

        {/* Summary */}
        <div style={{ padding: '14px 18px' }}>
          <p style={{ fontSize: 13, color: t.text, lineHeight: 1.7, marginBottom: verdict.visual_id ? 10 : 0 }}>
            {verdict.evidence_summary}
          </p>
          {verdict.visual_id && (
            <p style={{ fontSize: 11, color: t.text2, lineHeight: 1.55, fontStyle: 'italic',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              borderLeft: `2px solid ${t.border}`, paddingLeft: 10, marginTop: 8 }}>
              {verdict.visual_id}
            </p>
          )}
        </div>

        {/* Shadow zone — inside panel, separated */}
        {verdict.shadow_zone_risk && verdict.shadow_zone_risk !== 'NORMAL' && verdict.shadow_zone_risk !== 'UNKNOWN' && (
          <>
            {divider}
            <div style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: t.warning, fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚠</span>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.warning }}>Shadow Zone — </span>
                <span style={{ fontSize: 12, color: t.text2 }}>
                  {verdict.shadow_zone_risk === 'CRITICAL'
                    ? `$${verdict.listing_price?.toFixed(2)} sits below eBay's $250 authentication threshold`
                    : "Price below eBay's $250 vault trigger"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reset */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
        <button onClick={onReset}
          style={{ padding: '9px 26px', background: t.brand, color: '#fff',
            border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          Analyze Another
        </button>
      </div>

      <style>{`@keyframes ping { 75%,100% { transform:scale(2.2); opacity:0; } }`}</style>
    </motion.div>
  )
}
