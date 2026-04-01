import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea, ReferenceLine
} from 'recharts'

const ZONE_COLORS = {
  peligroso: '#ef4444',
  bajo:      '#f97316',
  optimo:    '#22c55e',
  alto:      '#f97316',
  excesivo:  '#ef4444',
}
const ZONE_BG = {
  peligroso: 'rgba(239,68,68,0.08)',
  bajo:      'rgba(249,115,22,0.08)',
  optimo:    'rgba(34,197,94,0.08)',
  alto:      'rgba(249,115,22,0.08)',
  excesivo:  'rgba(239,68,68,0.08)',
}

const s = {
  card: { background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px', marginBottom: '20px' },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px' },
  metricsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' },
  metric: { background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '12px 18px', flex: '1', minWidth: '100px' },
  metricLabel: { fontSize: '11px', color: '#64748b', marginBottom: '4px' },
  metricValue: { fontSize: '22px', fontWeight: 700, color: '#e2e8f0' },
  metricUnit: { fontSize: '11px', color: '#64748b' },
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' },
  zoneBar: { display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', marginTop: '8px' },
  zoneLabel: { fontSize: '12px', color: '#94a3b8', marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  zoneDot: (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', marginRight: '4px' }),
}

function MetricCard({ label, value, unit, color }) {
  return (
    <div style={s.metric}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color: color || '#e2e8f0' }}>{value ?? '--'}</div>
      {unit && <div style={s.metricUnit}>{unit}</div>}
    </div>
  )
}

function rakeColor(v) {
  if (v < 10) return '#ef4444'
  if (v < 15) return '#f97316'
  if (v <= 35) return '#22c55e'
  if (v <= 45) return '#f97316'
  return '#ef4444'
}

export default function DashboardRake({ data }) {
  if (!data?.available) {
    return (
      <div style={{ color: '#64748b', fontSize: '14px' }}>
        {data?.message || 'No hay datos de ride height disponibles para calcular el rake.'}
      </div>
    )
  }

  const { stats, zones, phase_stats, lateral, timeseries } = data

  const chartData = timeseries?.rake?.map((r, i) => ({
    dist: timeseries.lap_dist_pct?.[i] != null
      ? Math.round(timeseries.lap_dist_pct[i] * 1000) / 10
      : i,
    rake: Math.round(r * 10) / 10,
  })) || []

  const ZONE_RANGES = [
    { y1: -50,  y2: 10,  name: 'peligroso' },
    { y1: 10,   y2: 15,  name: 'bajo' },
    { y1: 15,   y2: 35,  name: 'optimo' },
    { y1: 35,   y2: 45,  name: 'alto' },
    { y1: 45,   y2: 120, name: 'excesivo' },
  ]

  return (
    <div>
      <div style={s.sectionTitle}>Rake — Ángulo de ataque</div>

      <div style={s.metricsRow}>
        <MetricCard label='Media' value={stats?.mean?.toFixed(1)} unit='mm' color={rakeColor(stats?.mean || 0)} />
        <MetricCard label='p5' value={stats?.p5?.toFixed(1)} unit='mm' />
        <MetricCard label='p95' value={stats?.p95?.toFixed(1)} unit='mm' />
        {phase_stats?.braking && (
          <MetricCard label='Frenada (media)' value={phase_stats.braking.mean?.toFixed(1)} unit='mm' color={rakeColor(phase_stats.braking.mean || 0)} />
        )}
        {phase_stats?.accel && (
          <MetricCard label='Aceleración (media)' value={phase_stats.accel.mean?.toFixed(1)} unit='mm' color={rakeColor(phase_stats.accel.mean || 0)} />
        )}
      </div>

      {chartData.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Rake a lo largo de la vuelta</div>
          <ResponsiveContainer width='100%' height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
              <XAxis dataKey='dist' unit='%' tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Distancia vuelta (%)', position: 'insideBottom', fill: '#475569', fontSize: 11 }} />
              <YAxis unit='mm' tick={{ fill: '#64748b', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v) => [`${v} mm`, 'Rake']}
                labelFormatter={(l) => `${l}%`}
              />
              {ZONE_RANGES.map(z => (
                <ReferenceArea key={z.name} y1={z.y1} y2={z.y2} fill={ZONE_BG[z.name]} ifOverflow='extendDomain' />
              ))}
              <ReferenceLine y={15} stroke='#22c55e' strokeDasharray='4 2' strokeWidth={1} />
              <ReferenceLine y={35} stroke='#22c55e' strokeDasharray='4 2' strokeWidth={1} />
              <Line type='monotone' dataKey='rake' stroke='#38bdf8' dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {zones && (
        <div style={s.card}>
          <div style={s.cardTitle}>Distribución por zonas</div>
          <div style={s.zoneBar}>
            {zones.map(z => (
              <div
                key={z.zone}
                style={{ width: `${z.pct}%`, background: z.color, minWidth: z.pct > 0 ? '2px' : 0 }}
                title={`${z.zone}: ${z.pct}%`}
              />
            ))}
          </div>
          <div style={s.zoneLabel}>
            {zones.map(z => (
              <span key={z.zone}>
                <span style={s.zoneDot(z.color)} />
                {z.zone}: {z.pct.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {lateral && (
        <div style={s.card}>
          <div style={s.cardTitle}>Desequilibrio lateral (media absoluta)</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: lateral.front_diff > 3 ? '#f97316' : '#e2e8f0' }}>
              Eje delantero: <strong>{lateral.front_diff?.toFixed(1)} mm</strong>
            </div>
            <div style={{ fontSize: '14px', color: lateral.rear_diff > 3 ? '#f97316' : '#e2e8f0' }}>
              Eje trasero: <strong>{lateral.rear_diff?.toFixed(1)} mm</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
