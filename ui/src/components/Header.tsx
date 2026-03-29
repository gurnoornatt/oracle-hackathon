export function Header() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center',
      padding: '14px 28px',
      borderBottom: '1px solid #E8E7E3',
      background: '#FFFFFF',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, background: '#7C3AED',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.85)', transform: 'rotate(45deg)' }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1917', letterSpacing: '-0.2px' }}>
          Visual Oracle
        </span>
        <span style={{
          fontSize: 11, color: '#9C9992', paddingLeft: 10,
          borderLeft: '1px solid #E8E7E3', marginLeft: 2,
          letterSpacing: '0.02em',
        }}>
          PSA Fraud Detection
        </span>
      </div>

      {/* Status */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#16A34A' }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: '#16A34A', opacity: 0.35,
            animation: 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
          }} />
        </div>
        <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 500 }}>Online</span>
      </div>

      <style>{`@keyframes ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }`}</style>
    </header>
  )
}
