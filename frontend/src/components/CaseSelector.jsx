import { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Shown when no case is active. Lists existing cases (with entity counts)
 * and lets the investigator create a new one or open an existing one.
 */
export default function CaseSelector({ onSelectCase }) {
  const [cases, setCases] = useState(null)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  function loadCases() {
    api.listCases().then(setCases).catch((e) => setError(e.message))
  }

  useEffect(loadCases, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await api.createCase(newName.trim())
      setNewName('')
      onSelectCase(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(caseId, caseName) {
    if (!window.confirm(`Permanently delete "${caseName}" and everything in it?`)) return
    try {
      await api.deleteCase(caseId)
      loadCases()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="case-selector">
      <div className="case-selector__panel">
        <h1 className="case-selector__title">SIH26189 — Crime Network Analysis</h1>
        <p className="case-selector__hint">Open an existing case, or start a new one.</p>

        {error && <div className="alert-row">{error}</div>}

        <form className="case-selector__new" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="New case name, e.g. Case 01 — Nagpur Extortion Ring"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="primary" type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'New case'}
          </button>
        </form>

        {!cases && !error && <p className="empty-state">Loading cases…</p>}
        {cases && cases.length === 0 && (
          <p className="empty-state">No cases yet — create one above to get started.</p>
        )}

        {cases && cases.length > 0 && (
          <div className="case-list">
            {cases.map((c) => (
              <div className="case-list__row" key={c.id}>
                <button className="case-list__open" onClick={() => onSelectCase(c)}>
                  <span className="case-list__name">{c.name}</span>
                  <span className="case-list__meta">
                    {c.entity_count} {c.entity_count === 1 ? 'entity' : 'entities'} · opened{' '}
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </button>
                <button className="danger case-list__delete" onClick={() => handleDelete(c.id, c.name)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
