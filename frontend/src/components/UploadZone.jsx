import React, { useCallback, useState } from 'react'

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 53px)',
    padding: '40px',
  },
  zone: (drag, uploading) => ({
    width: '100%',
    maxWidth: '520px',
    border: `2px dashed ${drag ? '#38bdf8' : uploading ? '#22c55e' : '#334155'}`,
    borderRadius: '16px',
    padding: '60px 40px',
    textAlign: 'center',
    cursor: uploading ? 'wait' : 'pointer',
    background: drag ? 'rgba(56,189,248,0.05)' : '#1e293b',
    transition: 'all 0.2s',
  }),
  icon: { fontSize: '48px', marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' },
  sub: { fontSize: '14px', color: '#64748b', marginBottom: '24px' },
  btn: {
    background: '#38bdf8',
    color: '#0f172a',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 28px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  progress: {
    width: '100%',
    maxWidth: '520px',
    marginTop: '24px',
    background: '#1e293b',
    borderRadius: '8px',
    overflow: 'hidden',
    height: '6px',
  },
  bar: {
    height: '6px',
    background: '#38bdf8',
    width: '100%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  error: {
    marginTop: '16px',
    color: '#ef4444',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    padding: '10px 16px',
    maxWidth: '520px',
    width: '100%',
    fontSize: '14px',
  },
}

export default function UploadZone({ uploading, error, onFile }) {
  const [drag, setDrag] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }, [uploading, onFile])

  const handleChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }, [onFile])

  return (
    <div style={styles.wrapper}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>

      <label
        style={styles.zone(drag, uploading)}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <div style={styles.icon}>{uploading ? '⏳' : drag ? '📂' : '📁'}</div>
        <div style={styles.title}>
          {uploading ? 'Analizando telemetría...' : 'Arrastra tu fichero .ibt aquí'}
        </div>
        <div style={styles.sub}>
          {uploading
            ? 'Esto puede tardar unos segundos en ficheros grandes'
            : 'O haz clic para seleccionar el archivo'}
        </div>
        {!uploading && (
          <>
            <button style={styles.btn} type='button' onClick={(e) => {
              e.preventDefault()
              document.getElementById('ibt-input').click()
            }}>
              Seleccionar .ibt
            </button>
            <input
              id='ibt-input'
              type='file'
              accept='.ibt'
              style={{ display: 'none' }}
              onChange={handleChange}
            />
          </>
        )}
      </label>

      {uploading && (
        <div style={styles.progress}>
          <div style={styles.bar} />
        </div>
      )}

      {error && <div style={styles.error}>Error: {error}</div>}
    </div>
  )
}
