import { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Inline popup anchored to a clicked graph node (via vis-network's
 * canvasToDOM). Read-only: shows the node's value, all properties,
 * relationships (within-case and cross-case), and audit trail.
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

  function formatRel(r) {
    const confidence = r.confidence ? ` (${Math.round(r.confidence * 100)}%)` : ''
    const caseInfo = r.target_case_id ? ` [case: ${r.target_case_id}]` : (r.source_case_id ? ` [case: ${r.source_case_id}]` : '')
    return (
      <div className="node-panel__rel" key={`${r.rel_type}-${r.target_id || r.source_id}`}>
        {r.rel_type} {r.target_id ? '→' : '←'} {r.target_type || r.source_type}: {r.target_id || r.source_id}{confidence}{caseInfo}
      </div>
    )
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
          <div className="node-panel__meta">
            <span className="node-panel__meta-item"><strong>ID:</strong> {detail.id}</span>
            <span className="node-panel__meta-item"><strong>Case:</strong> {detail.case_name || detail.case_id}</span>
          </div>

          {/* All Properties Section */}
          {detail.all_props && Object.keys(detail.all_props).length > 0 && (
            <details className="node-panel__section" open>
              <summary className="node-panel__section-title">All Properties</summary>
              <div className="node-panel__props">
                {Object.entries(detail.all_props).map(([key, val]) => (
                  <div className="node-panel__prop" key={key}>
                    <span className="node-panel__prop-key">{key}:</span>
                    <span className="node-panel__prop-val">{val}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Within-Case Outgoing Relationships */}
          {detail.outgoing && detail.outgoing.length > 0 && (
            <details className="node-panel__section" open>
              <summary className="node-panel__section-title">Outgoing ({detail.outgoing.length})</summary>
              <div className="node-panel__rels">
                {detail.outgoing.map(formatRel)}
              </div>
            </details>
          )}

          {/* Within-Case Incoming Relationships */}
          {detail.incoming && detail.incoming.length > 0 && (
            <details className="node-panel__section" open>
              <summary className="node-panel__section-title">Incoming ({detail.incoming.length})</summary>
              <div className="node-panel__rels">
                {detail.incoming.map(formatRel)}
              </div>
            </details>
          )}

          {/* Cross-Case Outgoing Relationships */}
          {detail.cross_outgoing && detail.cross_outgoing.length > 0 && (
            <details className="node-panel__section" open>
              <summary className="node-panel__section-title">Cross-Case Outgoing ({detail.cross_outgoing.length})</summary>
              <div className="node-panel__rels">
                {detail.cross_outgoing.map(formatRel)}
              </div>
            </details>
          )}

          {/* Cross-Case Incoming Relationships */}
          {detail.cross_incoming && detail.cross_incoming.length > 0 && (
            <details className="node-panel__section" open>
              <summary className="node-panel__section-title">Cross-Case Incoming ({detail.cross_incoming.length})</summary>
              <div className="node-panel__rels">
                {detail.cross_incoming.map(formatRel)}
              </div>
            </details>
          )}

          {/* No relationships at all */}
          {(!detail.outgoing?.length && !detail.incoming?.length && !detail.cross_outgoing?.length && !detail.cross_incoming?.length) && (
            <p className="empty-state">No relationships yet.</p>
          )}

          {/* Audit Trail */}
          {detail.audit_trail && detail.audit_trail.length > 0 && (
            <details className="node-panel__section">
              <summary className="node-panel__section-title">Recent Activity ({detail.audit_trail.length})</summary>
              <div className="node-panel__audit">
                {detail.audit_trail.map((a, i) => (
                  <div className="node-panel__audit-item" key={i}>
                    <span className="node-panel__audit-action">{a.action}</span>
                    <span className="node-panel__audit-time">{new Date(a.timestamp).toLocaleString()}</span>
                    {a.details && <span className="node-panel__audit-details">{JSON.stringify(a.details)}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}