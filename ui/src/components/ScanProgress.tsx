import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTheme } from '../theme'

export const SCAN_STEPS = [
  'Certificate Check',
  'Slab DNA Extraction',
  'Registry Comparison',
  'Verdict Assembly',
]

const THOUGHTS: Record<number, string[]> = {
  0: [
    'Scanning label area for certificate number...',
    'Checking for blur, obstruction, or deliberate redaction...',
    'Certificate visibility confirmed.',
  ],
  1: [
    'Mapping micro-debris inside acrylic housing...',
    'Measuring label tilt to ±0.3° precision...',
    'Locating holographic star relative to card border...',
  ],
  2: [
    'Loading reference from PSA registry...',
    'Comparing both images in a single vision call...',
    'Measuring card-to-rail gaps on all four sides...',
    'Cross-referencing debris positions...',
  ],
  3: [
    'Aggregating marker scores...',
    'Checking shadow zone pricing signals...',
    'Computing confidence level...',
  ],
}

interface Props { imageUrl: string | null; stepIndex: number }

export function ScanProgress({ imageUrl, stepIndex }: Props) {
  const t = useTheme()
  const [thoughtIdx, setThoughtIdx] = useState(0)
  const thoughts = THOUGHTS[Math.min(stepIndex, 3)] ?? THOUGHTS[0]
  const isDone = stepIndex >= SCAN_STEPS.length

  useEffect(() => {
    setThoughtIdx(0)
    if (isDone) return
    const iv = setInterval(() => setThoughtIdx(i => (i + 1) % thoughts.length), 1800)
    return () => clearInterval(iv)
  }, [stepIndex, thoughts.length, isDone])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, maxWidth: 340, width: '100%' }}>

      {/* Floating card */}
      {imageUrl && (
        <div style={{ position: 'relative', width: 170 }}>
          <motion.div
            animate={isDone
              ? { rotateY: 0, rotateX: 0 }
              : { rotateY: [-3, 3, -1.5, 3, -3], rotateX: [1.5, -1, 2.5, -0.5, 1.5] }
            }
            transition={{ duration: 5.5, repeat: isDone ? 0 : Infinity, ease: 'easeInOut' }}
            style={{ position: 'relative', borderRadius: 9, overflow: 'hidden',
              boxShadow: isDone
                ? `0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px ${t.border}`
                : `0 16px 40px rgba(0,0,0,0.4), 0 0 24px rgba(124,58,237,0.15)` }}>
            <img src={imageUrl} alt="Card under analysis"
              style={{ width: '100%', display: 'block', aspectRatio: '3/4', objectFit: 'contain', background: '#111' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            {!isDone && <div className="scan-beam" />}
            {isDone && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(74,222,128,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0D0C0B', fontSize: 18 }}>
                  ✓
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* Steps */}
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 16, textAlign: 'center' }}>
          {isDone ? 'Analysis complete' : <>Analyzing<span className="cursor" style={{ color: t.brand }}>_</span></>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {SCAN_STEPS.map((label, i) => {
            const done = i < stepIndex, active = i === stepIndex
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: done ? t.success : active ? t.brand : t.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.3s',
                }}>
                  {done && <span style={{ color: t.isDark ? '#0D0C0B' : '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                  {active && (
                    <motion.div animate={{ scale: [0.7, 1.15, 0.7] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                  )}
                </div>
                <span style={{ fontSize: 12, color: done ? t.success : active ? t.brand : t.text3, fontWeight: active || done ? 500 : 400, transition: 'color 0.3s' }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Live thought */}
        {!isDone && (
          <AnimatePresence mode="wait">
            <motion.div key={`${stepIndex}-${thoughtIdx}`}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              style={{ padding: '9px 14px', background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: 7, fontSize: 11, color: t.text2, lineHeight: 1.5,
                fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              <span style={{ color: t.brand, marginRight: 7 }}>›</span>
              {THOUGHTS[Math.min(stepIndex, 3)]?.[thoughtIdx] ?? ''}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
