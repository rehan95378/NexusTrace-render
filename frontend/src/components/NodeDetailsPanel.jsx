import { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Inline popup anchored to a clicked graph node (via vis-network's
 * canvasToDOM). Read-only: shows the node's value and its relationships.
 * All editing (rename/delete/merge/create) now lives in the separate
 * "Edit graph" panel (GraphEditPanel.jsx), not here.
 */
export default function NodeDetailsPanel({ caseId, type, id, position, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    api.entityDetail(caseId, type, id).then(setDetail).catch((e) => setError(e.message))
  }, [caseId, type, id])

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
        </>
      )}
    </div>
  )
}
