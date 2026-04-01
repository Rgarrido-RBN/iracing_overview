import React, { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

const WHEEL_LABELS = { FL: 'Del. Izq', FR: 'Del. Der', RL: 'Tras. Izq', RR: 'Tras. Der' }
const CAMBER_COLORS = {
  'Correcto': '#22c55e',
  'Camber algo bajo': '#84cc16',
  'Camber insuficiente': '#f97316',
  'Revisar exceso': '#f97316',
  'Exceso de camber': '#ef4444',
}
const TEMP_MAX = 120
const TEMP_MIN = 50
const LINE_COLORS = { FL: '#38bdf8', FR: '#818cf8', RL: '#34d399', RR: '#f472b6' }

const s = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' },
  card: { background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px' },
  cardTitle: { fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' },
  tempRow: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' },
  tempLabel: { fontSize: '11px', color: '#64748b', width: '50px' },
  tempBar: (val, max, color) => ({
    height: '14px',
    width: `${Math.min(100, Math.max(0, ((val - TEMP_MIN) / (max - TEMP_MIN)) * 100))}%`,
    background: color,
    borderRadius: '3px',
    transition: 'width 0.3s',
  }),
  tempBarWrap: { flex: 1, background: '#0f172a', borderRadius: '3px', height: '14px', overflow: 'hidden' },
  tempVal: { fontSize: '12px', color: '#e2e8f0', width: '44px', textAlign: 'right' },
  badge: (status) => ({
    display: 'inline-block',
    fontSize: '11px', fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '20px',
    background: `${CAMBER_COLORS[status] || '#64748b'}22`,
    color: CAMBER_COLORS[status] || '#64748b',
    border: `1px solid ${CAMBER_COLORS[status] || '#64748b'}55`,
    marginTop: '8px',
  }),
  cold: { fontSize: '11px', color: '#f97316', marginTop: '4px' },
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' },
  chartCard: { background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px' },
}

function tempColor(val) {
  if (val > 110) return '#ef4444'
  if (val > 95)  return '#f97316'
  if (val > 75)  return '#22c55e'
  return '#64748b'
}

function WheelCard({ corner, data }) {
  if (!data?.available) {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>{WHEEL_LABELS[corner] || corner}</div>
        <div style={{ color: '#475569', fontSize: '13px' }}>Sin datos</div>
      </div>
    )
  }

  const zones = [
    { label: 'Inner', val: data.inner_mean, max: data.inner_max },
    { label: 'Centre', val: data.centre_mean, max: data.centre_max },
    { label: 'Outer', val: data.outer_mean, max: data.outer_max },
  ]

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{WHEEL_LABELS[corner] || corner}</div>
      {zones.map(z => (
        <div key={z.label} style={s.tempRow}>
          <span style={s.tempLabel}>{z.label}</span>
          <div style={s.tempBarWrap}>
            <div style={s.tempBar(z.val, TEMP_MAX, tempColor(z.val))} />
          </div>
          <span style={{ ...s.tempVal, color: tempColor(z.val) }}>
            {z.val.toFixed(0)}°C
          </span>
        </div>
      ))}
      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
        Máx: Inner {data.inner_max.toFixed(0)}° / Centre {data.centre_max.toFixed(0)}° / Outer {data.outer_max.toFixed(0)}°
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
        Diferencial I-O: <strong>{data.diff_inner_outer.toFixed(1)}°C</strong>
      </div>
      <div style={s.badge(data.camber_status)}>{data.camber_status}</div>
      {data.cold_tyre && <div style={s.cold}>Neumático frío — análisis orientativo</div>}
    </div>
  )
}

function sessionTempNote(sessionType) {
  const t = (sessionType || '').toLowerCase()
  if (t.includes('test') || t.includes('practice') || t.includes('práctica')) {
    return 'Las temperaturas de neumáticos solo se actualizan en iRacing durante Test Drive. En esta sesión se muestra la temperatura de referencia del setup.'
  }
  if (t.includes('race') || t.includes('carrera')) {
    return 'Las temperaturas de neumáticos no se actualizan frame a frame en sesiones de carrera en este .ibt. Se muestran los valores de referencia.'
  }
  if (t.includes('qualify') || t.includes('clasificación')) {
    return 'Las temperaturas de neumáticos no se actualizan frame a frame en clasificación. Se muestran los valores de referencia.'
  }
  return 'La temperatura no varía durante la sesión en este .ibt. Se muestran los valores medios registrados.'
}

// Shown when tyre temp channel is constant throughout the session
function StaticTempChart({ wheels, availCorners, sessionType }) {
  const chartData = availCorners.map(c => ({
    name: WHEEL_LABELS[c] || c,
    Inner:  wheels[c].inner_mean,
    Centre: wheels[c].centre_mean,
    Outer:  wheels[c].outer_mean,
  }))

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#f97316', marginBottom: '10px' }}>
        ⚠ {sessionTempNote(sessionType)}
      </div>
      <ResponsiveContainer width='100%' height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#334155' vertical={false} />
          <XAxis dataKey='name' tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis unit='°C' tick={{ fill: '#64748b', fontSize: 11 }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
            formatter={(v) => [`${v.toFixed(1)}°C`]}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          <Bar dataKey='Inner'  fill={ZONE_LINE_COLORS.inner}  radius={[4, 4, 0, 0]} />
          <Bar dataKey='Centre' fill={ZONE_LINE_COLORS.centre} radius={[4, 4, 0, 0]} />
          <Bar dataKey='Outer'  fill={ZONE_LINE_COLORS.outer}  radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const ZONE_LINE_COLORS = {
  inner:  '#f472b6',
  centre: '#fbbf24',
  outer:  '#34d399',
}

export default function DashboardTyres({ data, sessionType }) {
  const [chartCorner, setChartCorner] = useState('FL')

  if (!data?.wheels) {
    return <div style={{ color: '#64748b' }}>No hay datos de temperatura de neumáticos.</div>
  }

  const wheels = data.wheels
  const corners = Object.keys(wheels)
  const availCorners = corners.filter(c => wheels[c]?.available)

  // Detect if any wheel has low-freq data
  const isLowFreq = availCorners.some(c => wheels[c]?.timeseries?.low_freq)

  // Build per-corner timeseries (inner + centre + outer for selected corner)
  const selectedWheel = wheels[chartCorner]
  let chartData = []
  if (selectedWheel?.available && selectedWheel?.timeseries?.inner?.length > 0) {
    const ts = selectedWheel.timeseries
    chartData = ts.inner.map((innerVal, i) => ({
      x:      ts.x?.[i] ?? i,
      inner:  Math.round(innerVal * 10) / 10,
      centre: ts.centre?.[i] != null ? Math.round(ts.centre[i] * 10) / 10 : null,
      outer:  ts.outer?.[i]  != null ? Math.round(ts.outer[i]  * 10) / 10 : null,
    }))
  }

  const lineType = isLowFreq ? 'stepAfter' : 'monotone'

  return (
    <div>
      <div style={s.sectionTitle}>Neumáticos — Temperatura y Camber</div>
      <div style={s.grid}>
        {corners.map(c => (
          <WheelCard key={c} corner={c} data={wheels[c]} />
        ))}
      </div>

      {availCorners.length > 0 && (
        <div style={s.chartCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={s.cardTitle}>Temperatura por zona — </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {availCorners.map(c => (
                <button
                  key={c}
                  onClick={() => setChartCorner(c)}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: 'none',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    background: chartCorner === c ? LINE_COLORS[c] : '#0f172a',
                    color: chartCorner === c ? '#0f172a' : '#64748b',
                  }}
                >
                  {WHEEL_LABELS[c] || c}
                </button>
              ))}
            </div>
            {isLowFreq && (
              <span style={{ fontSize: '11px', color: '#f97316', marginLeft: 'auto' }}>
                ⚠ Temperatura actualizada a baja frecuencia en este .ibt
              </span>
            )}
          </div>

          {chartData.length > 1 ? (
            <ResponsiveContainer width='100%' height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                <XAxis
                  dataKey='x'
                  unit='%'
                  type='number'
                  domain={[0, 100]}
                  tickCount={6}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis unit='°C' tick={{ fill: '#64748b', fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v, name) => [`${v}°C`, name]}
                  labelFormatter={(l) => `${Number(l).toFixed(1)}% sesión`}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                {['inner', 'centre', 'outer'].map(zone => (
                  <Line
                    key={zone}
                    type={lineType}
                    dataKey={zone}
                    stroke={ZONE_LINE_COLORS[zone]}
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <StaticTempChart wheels={wheels} availCorners={availCorners} sessionType={sessionType} />
          )}
        </div>
      )}
    </div>
  )
}
