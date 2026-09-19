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
      <div className="text-sm font-mono text-muted whitespace-normal break-all">
        {r.rel_type} {r.target_id ? '→' : '←'} {r.target_type || r.source_type}: {r.target_id || r.source_id}{confidence}{caseInfo}
      </div>
    )
  }

  return (
    <div className="fixed z-20 w-[280px] max-h-[420px] overflow-y-auto bg-panel-raised border border-border border-l-3 border-accent rounded-lg p-4 shadow-lg
                   left-[calc({position.x}px+18px)] top-[calc({position.y}px)] transform-gpu">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-muted text-uppercase tracking-wider">{type}</span>
        <button className="text-muted hover:text-text transition-colors duration-200" onClick={onClose}>×</button>
      </div>

      {error && <div className="bg-danger/10 text-danger border border-danger/30 rounded-lg p-2 mb-2 text-sm font-mono">{error}</div>}
      {!detail && !error && <p className="text-center py-8 text-muted font-mono">Loading…</p>}

      {detail && (
        <>
          <h3 className="font-display text-lg mb-2 break-all whitespace-normal">{detail.value}</h3>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="bg-panel-raised border border-border rounded px-2 py-0.5 text-xs font-mono"><strong>ID:</strong> {detail.id}</span>
            <span className="bg-panel-raised border border-border rounded px-2 py-0.5 text-xs font-mono"><strong>Case:</strong> {detail.case_name || detail.case_id}</span>
          </div>

          {/* All Properties Section */}
          {detail.all_props && Object.keys(detail.all_props).length > 0 && (
            <details className="mb-2">
              <summary className="flex items-center justify-between bg-panel-raised border border-border rounded px-2 py-1 cursor-pointer font-medium text-text">
                All Properties
              </summary>
              <div className="mt-2 space-y-1">
                {Object.entries(detail.all_props).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="font-mono text-accent">{key}:</span>
                    <span className="text-text">{val}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Within-Case Outgoing Relationships */}
          {detail.outgoing && detail.outgoing.length > 0 && (
            <details className="mb-2">
              <summary className="flex items-center justify-between bg-panel-raised border border-border rounded px-2 py-1 cursor-pointer font-medium text-text">
                Outgoing ({detail.outgoing.length})
              </summary>
              <div className="mt-2 space-y-1">
                {detail.outgoing.map((r, index) => (
                  <div key={index} className="border-b border-border/50 pb-1 mb-1 last:border-0 last:mb-0">
                    {formatRel(r)}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Within-Case Incoming Relationships */}
          {detail.incoming && detail.incoming.length > 0 && (
            <details className="mb-2">
              <summary className="flex items-center justify-between bg-panel-raised border border-border rounded px-2 py-1 cursor-pointer font-medium text-text">
                Incoming ({detail.incoming.length})
              </summary>
              <div className="mt-2 space-y-1">
                {detail.incoming.map((r, index) => (
                  <div key={index} className="border-b border-border/50 pb-1 mb-1 last:border-0 last:mb-0">
                    {formatRel(r)}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Cross-Case Outgoing Relationships */}
          {detail.cross_outgoing && detail.cross_outgoing.length > 0 && (
            <details className="mb-2">
              <summary className="flex items-center justify-between bg-panel-raised border border-border rounded px-2 py-1 cursor-pointer font-medium text-text">
                Cross-Case Outgoing ({detail.cross_outgoing.length})
              </summary>
              <div className="mt-2 space-y-1">
                {detail.cross_outgoing.map((r, index) => (
                  <div key={index} className="border-b border-border/50 pb-1 mb-1 last:border-0 last:mb-0">
                    {formatRel(r)}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Cross-Case Incoming Relationships */}
          {detail.cross_incoming && detail.cross_incoming.length > 0 && (
            <details className="mb-2">
              <summary className="flex items-center justify-between bg-panel-raised border border-border rounded px-2 py-1 cursor-pointer font-medium text-text">
                Cross-Case Incoming ({detail.cross_incoming.length})
              </summary>
              <div className="mt-2 space-y-1">
                {detail.cross_incoming.map((r, index) => (
                  <div key={index} className="border-b border-border/50 pb-1 mb-1 last:border-0 last:mb-0">
                    {formatRel(r)}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* No relationships at all */}
          {(!detail.outgoing?.length && !detail.incoming?.length && !detail.cross_outgoing?.length && !detail.cross_incoming?.length) && (
            <p className="text-center py-4 text-muted font-mono italic">No relationships yet.</p>
          )}

          {/* Audit Trail */}
          {detail.audit_trail && detail.audit_trail.length > 0 && (
            <details className="mb-2">
              <summary className="flex items-center justify-between bg-panel-raised border border-border rounded px-2 py-1 cursor-pointer font-medium text-text">
                Recent Activity ({detail.audit_trail.length})
              </summary>
              <div className="mt-2 space-y-1">
                {detail.audit_trail.map((a, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono text-muted py-0.5">
                    <span className="font-mono text-uppercase">{a.action}</span>
                    <span>{new Date(a.timestamp).toLocaleString()}</span>
                    {a.details && <span className="break-all whitespace-normal text-text">{JSON.stringify(a.details)}</span>}
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