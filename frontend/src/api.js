export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // ignore — no JSON body
    }
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  health: () => request('/health'),
  ingest: (fir_text, cdr_text, append_mode) =>
    request('/ingest', { method: 'POST', body: JSON.stringify({ fir_text, cdr_text, append_mode }) }),
  clear: () => request('/clear', { method: 'POST' }),
  entities: () => request('/entities'),
  graph: () => request('/graph'),
  keyPlayers: () => request('/analysis/key-players'),
  anomalies: () => request('/analysis/anomalies'),
  audit: () => request('/audit'),
}
