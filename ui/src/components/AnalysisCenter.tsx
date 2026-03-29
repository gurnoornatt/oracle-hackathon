import { motion } from 'motion/react'

interface Step { label: string; done: boolean; active: boolean }
interface Props { steps: Step[]; scanning: boolean; done: boolean }

export function AnalysisCenter({ steps, scanning, done }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, paddingTop: 40 }}>
      {/* Top connector */}
      <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, rgba(124,58,237,0.4))' }} />

      {/* Analysis module */}
      <div className="bracket" style={{
        width: '100%', borderRadius: 8,
        border: '1px solid rgba(124,58,237,0.2)',
        background: '#0c0c10', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: scanning ? '#a78bfa' : done ? '#22c55e' : '#3f3f46',
            animation: scanning ? 'pulse 1s infinite' : 'none',
          }} />
          <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#52525b' }}>
            Gemini 2.5 Flash
          </span>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((step, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: step.active || step.done ? 1 : 0.2, x: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: step.done ? '#22c55e' : step.active ? '#a78bfa' : '#27272a',
              }} />
              <span className="font-mono" style={{
                fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: step.done ? '#4ade80' : step.active ? '#c4b5fd' : '#3f3f46',
              }}>
                {step.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Waveform during scan */}
        {scanning && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 3, height: 20 }}>
            {[...Array(6)].map((_, i) => (
              <motion.div key={i}
                style={{ width: 3, borderRadius: 2, background: 'rgba(167,139,250,0.5)' }}
                animate={{ height: ['4px', '16px', '4px'] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        )}

        {done && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4ade80', fontSize: 12,
            }}>✓</div>
          </motion.div>
        )}
      </div>

      {/* Bottom connector */}
      <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, rgba(124,58,237,0.4), transparent)' }} />

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
