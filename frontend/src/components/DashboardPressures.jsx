import React from 'react'

const WHEEL_LABELS = { FL: 'Del. Izq', FR: 'Del. Der', RL: 'Tras. Izq', RR: 'Tras. Der' }
const STATUS_COLORS = {
  'Óptima':   '#22c55e',
  'Alta':     '#f97316',
  'Baja':     '#f97316',
  'Muy baja': '#ef4444',
}

const OPTIMAL_MIN = 14
const OPTIMAL_MAX = 18
const BAR_MIN     = 0
const BAR_MAX     = 30

const s = {
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' },
  card: { background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '20px' },
  cardTitle: { fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' },
  label: { fontSize: '13px', color: '#64748b' },
  value: { fontSize: '15px', fontWeight: 600, color: '#e2e8f0' },
  badge: (status) => ({
    display: 'inline-block',
    fontSize: '12px', fontWeight: 700,
    padding: '4px 14px',
    borderRadius: '20px',
    background: `${STATUS_COLORS[status] || '#64748b'}22`,
    color: STATUS_COLORS[status] || '#64748b',
    border: `1px solid ${STATUS_COLORS[status] || '#64748b'}55`,
    marginTop: '4px',
  }),
  barWrap: {
    width: '100%', height: '20px',
    background: '#0f172a', borderRadius: '6px',
    position: 'relative', overflow: 'visible',
    marginTop: '12px', marginBottom: '4px',
  },
  optimalZone: {
    position: 'absolute',
    left: `${((OPTIMAL_MIN - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100}%`,
    width: `${((OPTIMAL_MAX - OPTIMAL_MIN) / (BAR_MAX - BAR_MIN)) * 100}%`,
    top: 0, bottom: 0,
    background: 'rgba(34,197,94,0.2)',
    border: '1px solid rgba(34,197,94,0.4)',
    borderRadius: '2px',
  },
  deltaBar: (delta, color) => ({
    position: 'absolute',
    left: 0,
    width: `${Math.min(100, Math.max(0, ((delta - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100))}%`,
    top: '4px', bottom: '4px',
    background: color,
    borderRadius: '4px',
    transition: 'width 0.3s',
  }),
  barLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569' },
  legend: { fontSize: '11px', color: '#64748b', marginTop: '4px' },
}

function deltaColor(status) {
  return STATUS_COLORS[status] || '#38bdf8'
}

function PressureCard({ corner, data }) {
  if (!data?.available) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{WHEEL_LABELS[corner] || corner}</div>
        <div style={{ color: '#475569', fontSize: '13px' }}>Sin datos</div>
      </div>
    )
  }

  const color = deltaColor(data.status)

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{WHEEL_LABELS[corner] || corner}</div>
      <div style={s.row}>
        <span style={s.label}>Presión fría</span>
        <span style={s.value}>{data.cold_kpa.toFixed(1)} kPa</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Presión caliente</span>
        <span style={s.value}>{data.hot_mean_kpa.toFixed(1)} kPa</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>Delta</span>
        <span style={{ ...s.value, color }}>{data.delta_kpa > 0 ? '+' : ''}{data.delta_kpa.toFixed(1)} kPa</span>
      </div>
      <div style={s.badge(data.status)}>{data.status}</div>

      <div style={s.barWrap}>
        <div style={s.optimalZone} title={`Óptimo: ${OPTIMAL_MIN}–${OPTIMAL_MAX} kPa`} />
        <div style={s.deltaBar(data.delta_kpa, color)} />
      </div>
      <div style={s.barLabels}>
        <span>0</span>
        <span style={{ position: 'absolute', left: `${((OPTIMAL_MIN - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100}%`, transform: 'translateX(-50%)', color: '#22c55e' }}>{OPTIMAL_MIN}</span>
        <span style={{ position: 'absolute', left: `${((OPTIMAL_MAX - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100}%`, transform: 'translateX(-50%)', color: '#22c55e' }}>{OPTIMAL_MAX}</span>
        <span>30 kPa</span>
      </div>
      <div style={{ ...s.legend, marginTop: '14px' }}>Zona verde = rango óptimo GT3 (+14 a +18 kPa)</div>
    </div>
  )
}

export default function DashboardPressures({ data }) {
  if (!data?.wheels) {
    return <div style={{ color: '#64748b' }}>No hay datos de presiones disponibles.</div>
  }

  const wheels = data.wheels

  return (
    <div>
      <div style={s.sectionTitle}>Presiones — Delta frío/caliente</div>
      <div style={s.grid}>
        {Object.keys(wheels).map(c => (
          <PressureCard key={c} corner={c} data={wheels[c]} />
        ))}
      </div>
      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
        Delta = presión caliente media − presión mínima (fría). Rango óptimo GT3: +14 a +18 kPa.
      </div>
    </div>
  )
}
