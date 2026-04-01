import React, { useState } from 'react'

const LEVEL_STYLE = {
  'CRÍTICO': { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  dot: '#ef4444', label: '#fca5a5' },
  'ALERTA':  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', dot: '#f97316', label: '#fdba74' },
  'INFO':    { bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.3)', dot: '#38bdf8', label: '#7dd3fc' },
}

const MODULE_LABEL = {
  dampers:   'Dampers',
  rake:      'Rake',
  tyres:     'Neumáticos',
  pressures: 'Presiones',
}

const styles = {
  title: { fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' },
  empty: { fontSize: '13px', color: '#22c55e', textAlign: 'center', padding: '8px 0' },
  alert: (level) => ({
    background: LEVEL_STYLE[level]?.bg || 'transparent',
    border: `1px solid ${LEVEL_STYLE[level]?.border || '#334155'}`,
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '6px',
    fontSize: '12px',
    lineHeight: 1.4,
  }),
  alertHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' },
  dot: (level) => ({
    width: '7px', height: '7px', borderRadius: '50%',
    background: LEVEL_STYLE[level]?.dot || '#64748b',
    flexShrink: 0,
  }),
  levelLabel: (level) => ({
    fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
    color: LEVEL_STYLE[level]?.label || '#94a3b8',
    textTransform: 'uppercase',
  }),
  moduleTag: {
    marginLeft: 'auto', fontSize: '10px', color: '#475569',
    background: '#0f172a', borderRadius: '4px', padding: '1px 6px',
  },
  msg: { color: '#cbd5e1' },
  toggleBtn: {
    fontSize: '11px', color: '#64748b', background: 'none', border: 'none',
    cursor: 'pointer', padding: '2px 0', marginBottom: '8px',
  },
}

export default function AlertPanel({ alerts = [] }) {
  const [collapsed, setCollapsed] = useState(false)

  const criticals = alerts.filter(a => a.level === 'CRÍTICO')
  const warnings  = alerts.filter(a => a.level === 'ALERTA')
  const infos     = alerts.filter(a => a.level === 'INFO')
  const sorted    = [...criticals, ...warnings, ...infos]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={styles.title}>Alertas ({alerts.length})</span>
        <button style={{ ...styles.toggleBtn, marginLeft: 'auto' }} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? 'mostrar' : 'ocultar'}
        </button>
      </div>

      {!collapsed && (
        <>
          {sorted.length === 0 && (
            <div style={styles.empty}>Sin alertas</div>
          )}
          {sorted.map((a, i) => (
            <div key={i} style={styles.alert(a.level)}>
              <div style={styles.alertHeader}>
                <div style={styles.dot(a.level)} />
                <span style={styles.levelLabel(a.level)}>{a.level}</span>
                <span style={styles.moduleTag}>{MODULE_LABEL[a.module] || a.module}</span>
              </div>
              <div style={styles.msg}>{a.message}</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
