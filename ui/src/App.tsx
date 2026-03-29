import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ScanProgress, SCAN_STEPS } from './components/ScanProgress'
import { LegitimacyReport } from './components/LegitimacyReport'
import { ThemeCtx, DARK, LIGHT, useTheme } from './theme'
import { scanLocal, scanFile, scanImageUrl, type ForensicVerdict, suspectImageUrl } from './lib/api'

const DEMOS = [
  { id: 'charizard', label: 'Charizard Base Set', suspect: 'sus_charizard.png', registry: 'charizard_73606485_official.png' },
  { id: 'lugia',     label: 'Lugia Neo Genesis',  suspect: 'sus_lugia.png',     registry: 'lugia_108435597_official.png',    note: 'cert hidden' },
]

type AppState = 'input' | 'scanning' | 'done' | 'error'

// ── Root with theme provider ─────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(true)
  return (
    <ThemeCtx.Provider value={isDark ? DARK : LIGHT}>
      <Inner isDark={isDark} toggleTheme={() => setIsDark(d => !d)} />
    </ThemeCtx.Provider>
  )
}

// ── Inner app ────────────────────────────────────────────────────────────────
function Inner({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) {
  const t = useTheme()
  const [appState, setAppState] = useState<AppState>('input')
  const [urlInput, setUrlInput] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(-1)
  const [verdict, setVerdict] = useState<ForensicVerdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const runFileRef = useRef<(f: File) => void>(() => {})

  function startSteps() {
    setStepIndex(0)
    const iv = setInterval(() => setStepIndex(p => p >= SCAN_STEPS.length - 1 ? p : p + 1), 2500)
    return iv
  }

  function finish(r: ForensicVerdict) {
    setStepIndex(SCAN_STEPS.length)
    setTimeout(() => { setVerdict(r); setAppState('done') }, 500)
  }

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : 'Unknown error')
    setAppState('error')
  }

  function reset() {
    setAppState('input'); setVerdict(null); setError(null)
    setStepIndex(-1); setPreviewUrl(null); setUrlInput('')
  }

  async function runDemo(d: typeof DEMOS[0]) {
    setPreviewUrl(suspectImageUrl(d.suspect)); setAppState('scanning')
    const iv = startSteps()
    try { const r = await scanLocal(d.suspect, d.registry); clearInterval(iv); finish(r) }
    catch (e) { clearInterval(iv); fail(e) }
  }

  async function runUrl() {
    const url = urlInput.trim(); if (!url) return
    setPreviewUrl(url); setAppState('scanning')
    const iv = startSteps()
    try { const r = await scanImageUrl(url); clearInterval(iv); finish(r) }
    catch (e) { clearInterval(iv); fail(e) }
  }

  async function runFileScan(file: File) {
    if (appState !== 'input') return
    setPreviewUrl(URL.createObjectURL(file)); setAppState('scanning')
    const iv = startSteps()
    try { const r = await scanFile(file); clearInterval(iv); finish(r) }
    catch (e) { clearInterval(iv); fail(e) }
  }

  runFileRef.current = runFileScan

  // Clipboard paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (appState !== 'input') return
      const img = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (img) { const f = img.getAsFile(); if (f) runFileRef.current(f) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [appState])

  const inputStyle: React.CSSProperties = {
    height: 40, padding: '0 12px',
    border: `1px solid ${t.inputBorder}`,
    borderRadius: 7, background: t.inputBg, color: t.text,
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text,
      display: 'flex', flexDirection: 'column', transition: 'background 0.2s, color 0.2s' }}>

      {/* ── Nav — same background, no border ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: t.brand,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.85)', transform: 'rotate(45deg)' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: '-0.2px' }}>Visual Oracle</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Online dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', width: 7, height: 7 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: t.success }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: t.success,
                opacity: 0.35, animation: 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
            </div>
            <span style={{ fontSize: 11, color: t.success, fontWeight: 500 }}>Online</span>
          </div>
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${t.border}`,
              background: t.surface, color: t.text2, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s', flexShrink: 0 }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? '☀' : '☾'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Input ── */}
        {appState === 'input' && (
          <motion.main key="input"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '0 20px 40px' }}>

            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 24, maxWidth: 400 }}>
              <h1 style={{ fontSize: 32, fontWeight: 700, color: t.text, lineHeight: 1.2,
                letterSpacing: '-0.5px', marginBottom: 8 }}>
                Is this PSA slab real?
              </h1>
              <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.65 }}>
                Upload or paste a card image. We fingerprint the slab's physical DNA and cross-reference the PSA registry.
              </p>
            </div>

            {/* Input card */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: 12, padding: '20px 20px 18px', width: '100%', maxWidth: 400,
              boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)' }}>

              {/* URL row */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.text3,
                  letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Image URL
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <input type="text" placeholder="https://i.ebayimg.com/..."
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runUrl()}
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => (e.currentTarget.style.borderColor = t.brand)}
                    onBlur={e => (e.currentTarget.style.borderColor = t.inputBorder)}
                  />
                  <button onClick={runUrl} disabled={!urlInput.trim()}
                    style={{ height: 40, padding: '0 16px',
                      background: urlInput.trim() ? t.brand : t.border,
                      color: urlInput.trim() ? '#fff' : t.text3,
                      border: 'none', borderRadius: 7,
                      cursor: urlInput.trim() ? 'pointer' : 'default',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                    Analyze
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                <div style={{ flex: 1, height: 1, background: t.border }} />
                <span style={{ fontSize: 11, color: t.text3 }}>or</span>
                <div style={{ flex: 1, height: 1, background: t.border }} />
              </div>

              {/* Drop zone */}
              <div className="drop-zone"
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) runFileScan(f) }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `1.5px dashed ${t.border}`, borderRadius: 9,
                  padding: '20px 14px', textAlign: 'center', cursor: 'pointer',
                  background: t.inputBg, transition: 'border-color 0.15s' }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>↑</div>
                <div style={{ fontSize: 12, color: t.text2, fontWeight: 500 }}>
                  Drop, <span style={{ color: t.brand }}>browse</span>, or paste
                </div>
                <div style={{ fontSize: 10, color: t.text3, marginTop: 3 }}>PNG · JPG · WebP</div>
                <input ref={fileInputRef} type="file" accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) runFileScan(f) }}
                  style={{ display: 'none' }} />
              </div>
            </div>

            {/* Demo */}
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: t.text3, marginBottom: 10,
                letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Quick demo
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {DEMOS.map(d => (
                  <button key={d.id} onClick={() => runDemo(d)}
                    style={{ padding: '7px 16px', background: t.surface,
                      border: `1px solid ${t.border}`, borderRadius: 7,
                      cursor: 'pointer', fontSize: 12, color: t.text, fontWeight: 500,
                      transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = t.brand)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}>
                    {d.label}
                    {'note' in d && d.note && (
                      <span style={{ color: t.warning, marginLeft: 5, fontSize: 10 }}>({d.note})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.main>
        )}

        {/* ── Scanning ── */}
        {appState === 'scanning' && (
          <motion.main key="scanning"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <ScanProgress imageUrl={previewUrl} stepIndex={stepIndex} />
          </motion.main>
        )}

        {/* ── Done ── */}
        {appState === 'done' && verdict && (
          <motion.main key="done"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 48px' }}>
            <LegitimacyReport verdict={verdict} imageUrl={previewUrl} onReset={reset} />
          </motion.main>
        )}

        {/* ── Error ── */}
        {appState === 'error' && (
          <motion.main key="error"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ maxWidth: 420, width: '100%', padding: '18px 20px',
              background: isDark ? 'rgba(248,113,113,0.07)' : '#FEF2F2',
              border: `1px solid ${isDark ? 'rgba(248,113,113,0.2)' : '#FECACA'}`,
              borderRadius: 10 }}>
              <div style={{ fontWeight: 600, color: t.danger, marginBottom: 5, fontSize: 13 }}>Analysis failed</div>
              <div style={{ fontSize: 12, color: t.text2, lineHeight: 1.6, marginBottom: 14 }}>{error}</div>
              <button onClick={reset}
                style={{ padding: '8px 18px', background: t.brand, color: '#fff',
                  border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Try again
              </button>
            </div>
          </motion.main>
        )}

      </AnimatePresence>

      <style>{`@keyframes ping { 75%,100% { transform:scale(2.2); opacity:0; } }`}</style>
    </div>
  )
}
