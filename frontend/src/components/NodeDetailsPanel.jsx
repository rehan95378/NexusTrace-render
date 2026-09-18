import { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Inline popup anchored to a clicked graph node (via vis-network's
 * canvasToDOM), not a separate side panel. Shows the node's relationships
 * and lets the investigator rename, delete, or merge it into another node
 * of the same type.
 */
export default function NodeDetailsPanel({ caseId, type, id, position, onClose, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [mergeValue, setMergeValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDetail(null)
    setError(null)
    api.entityDetail(caseId, type, id).then((d) => {
      setDetail(d)
      setRenameValue(d.value)
    }).catch((e) => setError(e.message))
  }, [caseId, type, id])

  async function handleRename(e) {
    e.preventDefault()
    if (!renameValue.trim() || renameValue.trim() === id) return
    setBusy(true)
    try {
      await api.renameEntity(caseId, type, id, renameValue.trim())
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete this ${type.toLowerCase()} and all its relationships?`)) return
    setBusy(true)
    try {
      await api.deleteEntity(caseId, type, id)
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMerge(e) {
    e.preventDefault()
    if (!mergeValue.trim()) return
    setBusy(true)
    try {
      await api.mergeEntity(caseId, type, id, mergeValue.trim())
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="node-panel" style={{ left: position.x, top: position.y }}>
      <div className="node-panel__header">
        <span className="node-panel__type">{type}</span>
        <button className="node-panel__close" onClick={onClose}>×</button>
      </div>

      {error && <div className="alert-row">{error}</div>}
      {!detail && !error && <p className="empty-state">Loading…</p>}

      {detail && (
        <>
          <h3 className="node-panel__title">{detail.value}</h3>

          <div className="node-panel__rels">
            {detail.outgoing.length === 0 && detail.incoming.length === 0 && (
              <p className="empty-state">No relationships yet.</p>
            )}
            {detail.outgoing.map((r, i) => (
              <div className="node-panel__rel" key={`out-${i}`}>
                → {r.rel_type} → {r.target_type}: {r.target_id}
              </div>
            ))}
            {detail.incoming.map((r, i) => (
              <div className="node-panel__rel" key={`in-${i}`}>
                ← {r.rel_type} ← {r.source_type}: {r.source_id}
              </div>
            ))}
          </div>

          <form className="node-panel__form" onSubmit={handleRename}>
            <label>Rename</label>
            <div className="node-panel__row">
              <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} disabled={busy} />
              <button className="primary" type="submit" disabled={busy}>Save</button>
            </div>
          </form>

          <form className="node-panel__form" onSubmit={handleMerge}>
            <label>Merge into existing {type.toLowerCase()}</label>
            <div className="node-panel__row">
              <input
                placeholder={`Exact name/value of the ${type.toLowerCase()} to merge into…`}
                value={mergeValue}
                onChange={(e) => setMergeValue(e.target.value)}
                disabled={busy}
              />
              <button type="submit" disabled={busy}>Merge</button>
            </div>
          </form>

          <button className="danger" style={{ width: '100%', marginTop: 10 }} onClick={handleDelete} disabled={busy}>
            Delete this node
          </button>
        </>
      )}
    </div>
  )
}
