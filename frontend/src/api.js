const BASE = '/api'

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function getAnalysis(sessionId, lap = null) {
  const url = lap != null
    ? `${BASE}/analyze/${sessionId}?lap=${lap}`
    : `${BASE}/analyze/${sessionId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Analysis failed')
  return res.json()
}

export async function getChannels(sessionId) {
  const res = await fetch(`${BASE}/channels/${sessionId}`)
  if (!res.ok) throw new Error('Failed to fetch channels')
  return res.json()
}

export async function exportCsv(sessionId, canales, lap = null) {
  const res = await fetch(`${BASE}/export-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, canales, lap }),
  })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const match = cd.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : 'telemetry.csv'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
