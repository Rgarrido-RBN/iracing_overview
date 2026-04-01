import React, { useState, useCallback } from 'react'
import { uploadFile, getAnalysis } from './api'
import UploadZone from './components/UploadZone'
import AlertPanel from './components/AlertPanel'
import DashboardDampers from './components/DashboardDampers'
import DashboardRake from './components/DashboardRake'
import DashboardTyres from './components/DashboardTyres'
import DashboardPressures from './components/DashboardPressures'
import CsvExporter from './components/CsvExporter'

const TABS = ['Dampers', 'Rake', 'Neumáticos', 'Presiones', 'Exportar CSV']

const styles = {
  app: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' },
  header: {
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logo: { fontSize: '20px', fontWeight: 700, color: '#38bdf8', letterSpacing: '-0.5px' },
  sessionBadge: {
    fontSize: '13px', color: '#94a3b8',
    background: '#0f172a', borderRadius: '6px',
    padding: '4px 10px', border: '1px solid #334155',
  },
  main: { display: 'flex', height: 'calc(100vh - 53px)' },
  sidebar: {
    width: '260px', minWidth: '260px',
    background: '#1e293b',
    borderRight: '1px solid #334155',
    overflowY: 'auto',
    padding: '16px',
  },
  content: { flex: 1, overflowY: 'auto', padding: '24px' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' },
  tab: (active) => ({
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    background: active ? '#38bdf8' : '#1e293b',
    color: active ? '#0f172a' : '#94a3b8',
    transition: 'all 0.15s',
  }),
  lapRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  label: { fontSize: '13px', color: '#94a3b8' },
  select: {
    background: '#1e293b', color: '#e2e8f0',
    border: '1px solid #334155', borderRadius: '6px',
    padding: '6px 10px', fontSize: '13px',
  },
  metaCard: {
    background: '#0f172a', borderRadius: '8px',
    border: '1px solid #334155', padding: '12px 16px',
    marginBottom: '12px',
  },
  metaRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' },
  metaKey: { fontSize: '12px', color: '#64748b' },
  metaVal: { fontSize: '13px', fontWeight: 600, color: '#e2e8f0' },
}

function formatTime(s) {
  if (!s) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(3).padStart(6, '0')
  return `${m}:${sec}`
}

export default function App() {
  const [state, setState] = useState('idle')  // idle | uploading | ready
  const [uploadData, setUploadData] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [selectedLap, setSelectedLap] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [error, setError] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)

  const handleFile = useCallback(async (file) => {
    setState('uploading')
    setError(null)
    try {
      const data = await uploadFile(file)
      setUploadData(data)
      setSelectedLap(null)
      setLoadingAnalysis(true)
      const analysis = await getAnalysis(data.session_id)
      setAnalysis(analysis)
      setState('ready')
    } catch (e) {
      setError(e.message)
      setState('idle')
    } finally {
      setLoadingAnalysis(false)
    }
  }, [])

  const handleLapChange = useCallback(async (lap) => {
    if (!uploadData) return
    setSelectedLap(lap)
    setLoadingAnalysis(true)
    try {
      const a = await getAnalysis(uploadData.session_id, lap)
      setAnalysis(a)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingAnalysis(false)
    }
  }, [uploadData])

  const handleReset = () => {
    setState('idle')
    setUploadData(null)
    setAnalysis(null)
    setError(null)
    setSelectedLap(null)
    setActiveTab(0)
  }

  if (state === 'idle' || state === 'uploading') {
    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <span style={styles.logo}>iRacing GT3 Analyzer</span>
        </div>
        <UploadZone
          uploading={state === 'uploading'}
          error={error}
          onFile={handleFile}
        />
      </div>
    )
  }

  const lapOptions = Array.from({ length: uploadData.lap_count }, (_, i) => i + 1)

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.logo}>iRacing GT3 Analyzer</span>
        {uploadData && (
          <span style={styles.sessionBadge}>
            {uploadData.session_info?.track_name || 'Unknown track'} &nbsp;·&nbsp;
            {uploadData.lap_count} vueltas &nbsp;·&nbsp;
            Mejor: {formatTime(uploadData.best_lap_time)}
          </span>
        )}
        <button
          onClick={handleReset}
          style={{ marginLeft: 'auto', ...styles.tab(false), fontSize: '12px', padding: '6px 14px' }}
        >
          Nueva sesión
        </button>
      </div>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          {uploadData && (
            <div style={styles.metaCard}>
              {uploadData.session_info?.track_name && (
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>Circuito</span>
                  <span style={styles.metaVal}>{uploadData.session_info.track_name}</span>
                </div>
              )}
              {uploadData.session_info?.track_config && (
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>Config</span>
                  <span style={styles.metaVal}>{uploadData.session_info.track_config}</span>
                </div>
              )}
              {uploadData.session_info?.car_name && (
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>Coche</span>
                  <span style={styles.metaVal}>{uploadData.session_info.car_name}</span>
                </div>
              )}
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Vueltas</span>
                <span style={styles.metaVal}>{uploadData.lap_count}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Mejor vuelta</span>
                <span style={styles.metaVal}>{formatTime(uploadData.best_lap_time)}</span>
              </div>
            </div>
          )}

          {lapOptions.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ ...styles.label, marginBottom: '6px' }}>Vuelta analizada</div>
              <select
                style={styles.select}
                value={selectedLap ?? ''}
                onChange={(e) => handleLapChange(e.target.value ? Number(e.target.value) : null)}
              >
                <option value=''>Todas las vueltas</option>
                {lapOptions.map((n) => (
                  <option key={n} value={n}>
                    Vuelta {n} — {formatTime(uploadData.lap_times?.[n - 1])}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingAnalysis && (
            <div style={{ color: '#38bdf8', fontSize: '13px', marginBottom: '12px' }}>
              Analizando...
            </div>
          )}

          {analysis && (
            <AlertPanel alerts={analysis.all_alerts} />
          )}
        </div>

        <div style={styles.content}>
          <div style={styles.tabs}>
            {TABS.map((t, i) => (
              <button key={t} style={styles.tab(activeTab === i)} onClick={() => setActiveTab(i)}>
                {t}
              </button>
            ))}
          </div>

          {analysis && !loadingAnalysis && (
            <>
              {activeTab === 0 && <DashboardDampers data={analysis.dampers} />}
              {activeTab === 1 && <DashboardRake data={analysis.rake} />}
              {activeTab === 2 && <DashboardTyres data={analysis.tyres} sessionType={uploadData?.session_info?.session_type} />}
              {activeTab === 3 && <DashboardPressures data={analysis.pressures} />}
              {activeTab === 4 && (
                <CsvExporter
                  sessionId={uploadData.session_id}
                  channels={uploadData.available_channels}
                  lapCount={uploadData.lap_count}
                  selectedLap={selectedLap}
                />
              )}
            </>
          )}
          {loadingAnalysis && (
            <div style={{ color: '#64748b', textAlign: 'center', marginTop: '80px', fontSize: '16px' }}>
              Procesando telemetría...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
