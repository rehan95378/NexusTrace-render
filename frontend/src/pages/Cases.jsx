import { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Cases tab — case management (list, create, delete).
 * No longer a blocking gate; just a regular tab reachable any time.
 */
export default function Cases({ onNavigateToIngestion }) {
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
      await api.createCase(newName.trim())
      setNewName('')
      loadCases()
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
    <div className="page-content">
      <div className="case-selector__panel">
        <h2 className="case-selector__title">Case Management</h2>
        <p className="case-selector__hint">Create new cases or manage existing ones.</p>

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
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Case Name</th>
                  <th>Entities</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.entity_count} {c.entity_count === 1 ? 'entity' : 'entities'}</td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="primary"
                        style={{ marginRight: '8px' }}
                        onClick={onNavigateToIngestion}
                      >
                        Open in Ingestion
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(c.id, c.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
