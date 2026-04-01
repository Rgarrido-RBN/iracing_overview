import React, { useState } from 'react'
import { exportCsv } from '../api'

const CHANNEL_GROUPS = [
  {
    label: 'Velocidad y tiempo',
    channels: ['Speed', 'LapDistPct', 'LapCurrentLapTime', 'LapLastLapTime', 'Lap'],
  },
  {
    label: 'Aceleraciones',
    channels: ['LatAccel', 'LongAccel'],
  },
  {
    label: 'Amortiguadores — Posición (mm)',
    channels: ['LFshockDefl', 'RFshockDefl', 'LRshockDefl', 'RRshockDefl'],
  },
  {
    label: 'Amortiguadores — Velocidad (mm/s)',
    channels: ['LFshockVel', 'RFshockVel', 'LRshockVel', 'RRshockVel'],
  },
  {
    label: 'Ride Height (mm)',
    channels: ['LFrideHeight', 'RFrideHeight', 'LRrideHeight', 'RRrideHeight',
               'CFrideHeight', 'CRrideHeight'],
  },
  {
    label: 'Temperatura neumáticos (°C)',
    channels: [
      'LFtempCL', 'LFtempCM', 'LFtempCR',
      'RFtempCL', 'RFtempCM', 'RFtempCR',
      'LRtempCL', 'LRtempCM', 'LRtempCR',
      'RRtempCL', 'RRtempCM', 'RRtempCR',
    ],
  },
  {
    label: 'Presiones neumáticos (kPa)',
    channels: ['LFpressure', 'RFpressure', 'LRpressure', 'RRpressure'],
  },
  {
    label: 'Desgaste neumáticos',
    channels: [
      'LFwearL', 'LFwearM', 'LFwearR',
      'RFwearL', 'RFwearM', 'RFwearR',
      'LRwearL', 'LRwearM', 'LRwearR',
      'RRwearL', 'RRwearM', 'RRwearR',
    ],
  },
]

const s = {
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' },
  card: { background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '20px', marginBottom: '16px' },
  groupTitle: {
    fontSize: '13px', fontWeight: 700, color: '#94a3b8',
    marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px',
  },
  channelGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  checkLabel: (checked, available) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '12px',
    color: !available ? '#334155' : checked ? '#38bdf8' : '#94a3b8',
    cursor: available ? 'pointer' : 'not-allowed',
    padding: '4px 10px',
    borderRadius: '6px',
    background: checked && available ? 'rgba(56,189,248,0.1)' : 'transparent',
    border: `1px solid ${checked && available ? 'rgba(56,189,248,0.3)' : '#334155'}`,
    transition: 'all 0.15s',
  }),
  footer: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  btn: (disabled) => ({
    background: disabled ? '#1e293b' : '#38bdf8',
    color: disabled ? '#475569' : '#0f172a',
    border: 'none', borderRadius: '8px',
    padding: '10px 28px', fontSize: '14px', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  }),
  selectBtn: {
    background: 'none', border: '1px solid #334155',
    color: '#94a3b8', borderRadius: '6px',
    padding: '6px 14px', fontSize: '12px', cursor: 'pointer',
  },
  info: { fontSize: '13px', color: '#64748b' },
  select: {
    background: '#0f172a', color: '#e2e8f0',
    border: '1px solid #334155', borderRadius: '6px',
    padding: '8px 12px', fontSize: '13px',
  },
}

export default function CsvExporter({ sessionId, channels = [], lapCount = 0, selectedLap }) {
  const availableNames = new Set(channels.map(c => c.name))
  const [selected, setSelected] = useState(new Set(['Speed', 'LapDistPct']))
  const [exportLap, setExportLap] = useState(selectedLap ?? '')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const toggle = (name) => {
    if (!availableNames.has(name)) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const selectGroup = (channels) => {
    setSelected(prev => {
      const next = new Set(prev)
      channels.forEach(n => { if (availableNames.has(n)) next.add(n) })
      return next
    })
  }

  const deselectGroup = (channels) => {
    setSelected(prev => {
      const next = new Set(prev)
      channels.forEach(n => next.delete(n))
      return next
    })
  }

  const handleExport = async () => {
    if (selected.size === 0) return
    setExporting(true)
    setError(null)
    try {
      await exportCsv(sessionId, Array.from(selected), exportLap || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div style={s.sectionTitle}>Exportar CSV</div>

      {lapCount > 0 && (
        <div style={{ ...s.card, padding: '16px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Filtrar por vuelta</div>
          <select
            style={s.select}
            value={exportLap}
            onChange={e => setExportLap(e.target.value)}
          >
            <option value=''>Todas las vueltas</option>
            {Array.from({ length: lapCount }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Vuelta {n}</option>
            ))}
          </select>
        </div>
      )}

      {CHANNEL_GROUPS.map(group => {
        const groupAvailable = group.channels.filter(n => availableNames.has(n))
        if (groupAvailable.length === 0) return null
        const groupSelected = group.channels.filter(n => selected.has(n))

        return (
          <div key={group.label} style={s.card}>
            <div style={s.groupTitle}>
              {group.label}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button style={s.selectBtn} onClick={() => selectGroup(group.channels)}>
                  Todo
                </button>
                <button style={s.selectBtn} onClick={() => deselectGroup(group.channels)}>
                  Ninguno
                </button>
              </span>
            </div>
            <div style={s.channelGrid}>
              {group.channels.map(name => {
                const avail = availableNames.has(name)
                const checked = selected.has(name)
                return (
                  <label key={name} style={s.checkLabel(checked, avail)}>
                    <input
                      type='checkbox'
                      checked={checked}
                      disabled={!avail}
                      onChange={() => toggle(name)}
                      style={{ accentColor: '#38bdf8', width: '13px', height: '13px' }}
                    />
                    {name}
                  </label>
                )
              })}
            </div>
            {groupSelected.length > 0 && (
              <div style={{ ...s.info, marginTop: '8px' }}>{groupSelected.length} seleccionados</div>
            )}
          </div>
        )
      })}

      <div style={s.footer}>
        <button
          style={s.btn(selected.size === 0 || exporting)}
          onClick={handleExport}
          disabled={selected.size === 0 || exporting}
        >
          {exporting ? 'Exportando...' : `Descargar CSV (${selected.size} canales)`}
        </button>
        {error && <span style={{ color: '#ef4444', fontSize: '13px' }}>{error}</span>}
        <span style={s.info}>
          Solo se incluyen muestras con Speed {'>'} 18 km/h
        </span>
      </div>
    </div>
  )
}
