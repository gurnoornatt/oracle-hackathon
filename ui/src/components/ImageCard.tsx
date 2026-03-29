import { motion } from 'motion/react'

interface Props {
  label: string
  sublabel: string
  imageUrl: string
  certNumber?: string | null
  certRedacted?: boolean
  variant: 'suspect' | 'registry'
  scanning?: boolean
  score?: number | null
}

export function ImageCard({ label, sublabel, imageUrl, certNumber, certRedacted, variant, scanning, score }: Props) {
  const isScamMatch = variant === 'suspect' && score !== null && score !== undefined && score > 70
  const borderColor = variant === 'registry'
    ? 'rgba(34,197,94,0.35)'
    : isScamMatch ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.07)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bracket ${isScamMatch ? 'pulse-alert' : ''}`}
      style={{
        borderRadius: 8, border: `1px solid ${borderColor}`,
        background: '#0c0c10', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: variant === 'registry' ? '#22c55e' : isScamMatch ? '#ef4444' : '#3f3f46',
          }} />
          <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#71717a' }}>
            {label}
          </span>
        </div>
        {variant === 'suspect' && certRedacted && (
          <span className="font-mono" style={{
            fontSize: 8, background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
            border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: 4,
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>CERT REDACTED</span>
        )}
        {variant === 'registry' && (
          <span className="font-mono" style={{
            fontSize: 8, background: 'rgba(34,197,94,0.08)', color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.2)', padding: '2px 8px', borderRadius: 4,
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>VERIFIED SOURCE</span>
        )}
      </div>

      {/* Image */}
      <div style={{ position: 'relative', overflow: 'hidden', background: '#080809', aspectRatio: '3/4' }}>
        <img src={imageUrl} alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />

        {/* Scanning beam */}
        {scanning && <div className="scan-beam" />}

        {/* Corner crosshairs */}
        {(['tl','tr','bl','br'] as const).map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top: pos.startsWith('t') ? 12 : 'auto',
            bottom: pos.startsWith('b') ? 12 : 'auto',
            left: pos.endsWith('l') ? 12 : 'auto',
            right: pos.endsWith('r') ? 12 : 'auto',
            width: 14, height: 14,
            borderTop: pos.startsWith('t') ? '1px solid rgba(124,58,237,0.35)' : 'none',
            borderBottom: pos.startsWith('b') ? '1px solid rgba(124,58,237,0.35)' : 'none',
            borderLeft: pos.endsWith('l') ? '1px solid rgba(124,58,237,0.35)' : 'none',
            borderRight: pos.endsWith('r') ? '1px solid rgba(124,58,237,0.35)' : 'none',
          }} />
        ))}

        {/* Scam match overlay */}
        {isScamMatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.07)', border: '2px solid rgba(239,68,68,0.25)' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, right: 10 }}>
              <div className="font-mono" style={{
                fontSize: 9, color: '#fca5a5', textAlign: 'center',
                background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                padding: '4px 8px', borderRadius: 4, letterSpacing: '0.15em',
              }}>
                ⚠ MATCH DETECTED — {score}/100
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="font-mono" style={{ fontSize: 10, color: '#52525b' }}>{sublabel}</div>
        {certNumber && (
          <div className="font-mono" style={{ fontSize: 9, color: '#3f3f46' }}>
            CERT: <span style={{ color: '#a78bfa' }}>{certNumber}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
