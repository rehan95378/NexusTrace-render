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

  // Cases
  listCases: () => request('/cases'),
  createCase: (name) => request('/cases', { method: 'POST', body: JSON.stringify({ name }) }),
  renameCase: (caseId, name) =>
    request(`/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteCase: (caseId) => request(`/cases/${caseId}`, { method: 'DELETE' }),

  // Everything below is scoped to one case
  ingest: (caseId, fir_text, cdr_text, append_mode) =>
    request(`/cases/${caseId}/ingest`, {
      method: 'POST',
      body: JSON.stringify({ fir_text, cdr_text, append_mode }),
    }),
  clearCase: (caseId) => request(`/cases/${caseId}/clear`, { method: 'POST' }),
  entities: (caseId) => request(`/cases/${caseId}/entities`),
  graph: (caseId) => request(`/cases/${caseId}/graph`),
  keyPlayers: (caseId) => request(`/cases/${caseId}/analysis/key-players`),
  anomalies: (caseId) => request(`/cases/${caseId}/analysis/anomalies`),
  audit: (caseId) => request(`/cases/${caseId}/audit`),
}
