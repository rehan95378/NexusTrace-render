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
  allEntities: () => request('/entities/all'),
  relationshipTypeSuggestions: () => request('/relationship-type-suggestions'),
  graph: (caseId) => request(`/cases/${caseId}/graph`),
  allGraph: () => request('/graph/all'),
  keyPlayers: (caseId) => request(`/cases/${caseId}/analysis/key-players`),
  keyPlayersAll: () => request('/analysis/key-players/all'),
  anomalies: (caseId) => request(`/cases/${caseId}/analysis/anomalies`),
  anomaliesAll: () => request('/analysis/anomalies/all'),
  audit: (caseId) => request(`/cases/${caseId}/audit`),
  auditAll: () => request('/audit/all'),

  // Node click popup: read-only entity detail
  entityDetail: (caseId, type, id) =>
    request(`/cases/${caseId}/entities/${type}/${encodeURIComponent(id)}`),

  // "Edit graph" panel: manual entity + relationship CRUD
  addEntity: (caseId, type, value) =>
    request(`/cases/${caseId}/entities/manual`, {
      method: 'POST',
      body: JSON.stringify({ type, value }),
    }),
  renameEntity: (caseId, type, id, value) =>
    request(`/cases/${caseId}/entities/${type}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    }),
  deleteEntity: (caseId, type, id) =>
    request(`/cases/${caseId}/entities/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  mergeEntity: (caseId, type, id, mergeWith) =>
    request(`/cases/${caseId}/entities/${type}/${encodeURIComponent(id)}/merge`, {
      method: 'POST',
      body: JSON.stringify({ merge_with: mergeWith }),
    }),
  changeEntityType: (caseId, type, id, newType) =>
    request(`/cases/${caseId}/entities/${type}/${encodeURIComponent(id)}/type`, {
      method: 'PATCH',
      body: JSON.stringify({ new_type: newType }),
    }),
  addRelationship: (caseId, payload) =>
    request(`/cases/${caseId}/relationships`, { method: 'POST', body: JSON.stringify(payload) }),
  renameRelationship: (caseId, payload) =>
    request(`/cases/${caseId}/relationships`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteRelationship: (caseId, payload) =>
    request(`/cases/${caseId}/relationships`, { method: 'DELETE', body: JSON.stringify(payload) }),
}
