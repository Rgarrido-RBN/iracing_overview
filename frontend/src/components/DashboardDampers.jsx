import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell,
  ReferenceLine
} from 'recharts'

const ZONE_COLORS = {
  HS_Reb:  '#3b82f6',
  LS_Reb:  '#93c5fd',
  Neutral: '#9ca3af',
  LS_Comp: '#f97316',
  HS_Comp: '#ef4444',
}
const ZONE_ORDER = ['HS_Reb', 'LS_Reb', 'Neutral', 'LS_Comp', 'HS_Comp']
const WHEEL_LABELS = { FL: 'Delantera Izq', FR: 'Delantera Der', RL: 'Trasera Izq', RR: 'Trasera Der' }
const PHASE_LABELS = { braking: 'Frenada', accel: 'Aceleración', left_corner: 'Curva Izq', right_corner: 'Curva Der' }

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' },
  card: { background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px' },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', color: '#64748b', padding: '4px 8px', fontWeight: 600, fontSize: '12px', borderBottom: '1px solid #334155' },
  td: { padding: '5px 8px', borderBottom: '1px solid #1e293b' },
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', marginTop: '8px' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' },
  legendItem: (color) => ({ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#94a3b8' }),
  legendDot: (color) => ({ width: '10px', height: '10px', borderRadius: '2px', background: color, flexShrink: 0 }),
}

const ZONE_LINES = [
  { x: -100, label: 'LS/HS' },
  { x: -25,  label: 'Neutral' },
  { x: 25,   label: 'Neutral' },
  { x: 100,  label: 'LS/HS' },
]

function PyramidHistogram({ corner, data }) {
  const histogram = data.histogram || []
  if (histogram.length === 0) return null

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{WHEEL_LABELS[corner] || corner}</div>
      <ResponsiveContainer width='100%' height={200}>
        <BarChart
          data={histogram}
          margin={{ top: 4, right: 8, left: -22, bottom: 0 }}
          barCategoryGap='0%'
          barGap={0}
        >
          <CartesianGrid strokeDasharray='3 3' stroke='#1e3a5f' vertical={false} />
          <XAxis
            dataKey='v'
            type='number'
            domain={['dataMin', 'dataMax']}
            tickCount={7}
            tick={{ fill: '#64748b', fontSize: 10 }}
            unit=' mm/s'
          />
          <YAxis
            unit='%'
            tick={{ fill: '#64748b', fontSize: 10 }}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
            formatter={(v, _, props) => [`${v.toFixed(2)}%`, props.payload.zone]}
            labelFormatter={(v) => `${v} mm/s`}
          />
          {ZONE_LINES.map((l, i) => (
            <ReferenceLine key={i} x={l.x} stroke='#334155' strokeDasharray='3 3' strokeWidth={1} />
          ))}
          <Bar dataKey='pct' isAnimationActive={false} maxBarSize={20}>
            {histogram.map((entry, index) => (
              <Cell key={index} fill={ZONE_COLORS[entry.zone] || '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={s.legend}>
        {ZONE_ORDER.map(z => (
          <span key={z} style={s.legendItem(ZONE_COLORS[z])}>
            <span style={s.legendDot(ZONE_COLORS[z])} />
            {z}: {(data.zones?.[z] || 0).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function StatsTable({ wheels }) {
  const corners = Object.keys(wheels).filter(c => wheels[c]?.stats)
  return (
    <div style={{ ...s.card, marginBottom: '24px' }}>
      <div style={s.cardTitle}>Estadísticas de velocidad (mm/s)</div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Rueda</th>
            <th style={s.th}>Media abs</th>
            <th style={s.th}>p95</th>
            <th style={s.th}>p99</th>
          </tr>
        </thead>
        <tbody>
          {corners.map(c => {
            const st = wheels[c].stats
            return (
              <tr key={c}>
                <td style={{ ...s.td, fontWeight: 600, color: '#94a3b8' }}>{WHEEL_LABELS[c] || c}</td>
                <td style={s.td}>{st.mean_abs.toFixed(1)}</td>
                <td style={s.td}>{st.p95.toFixed(1)}</td>
                <td style={{ ...s.td, color: st.p99 > 200 ? '#f97316' : '#e2e8f0' }}>{st.p99.toFixed(1)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PhaseChart({ wheels }) {
  const corners = Object.keys(wheels).filter(c => wheels[c]?.phases)
  if (!corners.length) return null

  const phases = Object.keys(wheels[corners[0]].phases)
  const data = phases.map(phase => {
    const row = { phase: PHASE_LABELS[phase] || phase }
    corners.forEach(c => {
      row[c] = wheels[c].phases[phase]?.mean_abs || 0
    })
    return row
  })

  const cornerColors = { FL: '#38bdf8', FR: '#818cf8', RL: '#34d399', RR: '#f472b6' }

  return (
    <div style={{ ...s.card, marginBottom: '24px' }}>
      <div style={s.cardTitle}>Velocidad media por fase (mm/s)</div>
      <ResponsiveContainer width='100%' height={200}>
        <BarChart data={data} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
          <XAxis dataKey='phase' tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          {corners.map(c => (
            <Bar key={c} dataKey={c} fill={cornerColors[c] || '#94a3b8'} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DashboardDampers({ data }) {
  if (!data?.wheels || Object.keys(data.wheels).length === 0) {
    return <div style={{ color: '#64748b' }}>No hay datos de amortiguadores disponibles.</div>
  }

  const wheels = data.wheels

  return (
    <div>
      <div style={s.sectionTitle}>Amortiguadores — Histograma de velocidad</div>
      <div style={s.grid}>
        {Object.keys(wheels).map(corner => (
          <PyramidHistogram key={corner} corner={corner} data={wheels[corner]} />
        ))}
      </div>
      <StatsTable wheels={wheels} />
      <PhaseChart wheels={wheels} />
    </div>
  )
}
