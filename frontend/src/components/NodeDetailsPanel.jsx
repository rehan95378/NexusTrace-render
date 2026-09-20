import { useEffect, useState } from 'react'
import { api } from '../api'

const TYPE_COLORS = {
  Person: '#E3A008',
  Location: '#2FA8A0',
  Vehicle: '#5B8DEF',
  Phone: '#B076E0',
  Organization: '#6FCF6F',
}

function TypeBadge({ type }) {
  const color = TYPE_COLORS[type] || '#8A8A8A'
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium uppercase tracking-wide"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {type}
    </span>
  )
}

function Section({ label, count, children }) {
  if (!count) return null
  return (
    <details className="group py-1">
      <summary className="flex items-center justify-between py-1.5 cursor-pointer select-none text-xs font-medium text-light-muted dark:text-muted hover:text-light-text dark:hover:text-text transition-colors">
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="currentColor">
            <path d="M2 1l5 4-5 4z" />
          </svg>
          {label}
        </span>
        <span className="text-[10px] font-mono text-light-muted/70 dark:text-muted/70">{count}</span>
      </summary>
      <div className="pl-4 pb-1 space-y-1">{children}</div>
    </details>
  )
}

function RelRow({ direction, r }) {
  const targetType = r.target_type || r.source_type
  const targetId = r.target_id || r.source_id
  const color = TYPE_COLORS[targetType] || '#8A8A8A'
  const caseTag = r.target_case_id || r.source_case_id
  const confidence = r.confidence ? Math.round(r.confidence * 100) : null
  return (
    <div className="flex items-start gap-2 text-xs py-1">
      <span className="text-light-muted/60 dark:text-muted/60 font-mono mt-0.5">{direction === 'out' ? '→' : '←'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] text-light-muted dark:text-muted uppercase">{r.rel_type}</span>
          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-light-text dark:text-text truncate">{targetId}</span>
        </div>
        {(caseTag || confidence) && (
          <div className="text-[10px] font-mono text-light-muted/70 dark:text-muted/70 mt-0.5">
            {confidence ? `${confidence}% confidence` : ''}
            {caseTag ? `${confidence ? ' · ' : ''}case ${caseTag}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Inline popup anchored to a clicked graph node. Read-only: value,
 * properties, relationships (in-case + cross-case), audit trail.
 * Editing lives in GraphEditPanel.jsx, not here.
 */
export default function NodeDetailsPanel({ caseId, type, id, position, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    api.entityDetail(caseId, type, id).then(setDetail).catch((e) => setError(e.message))
  }, [caseId, type, id])

  const color = TYPE_COLORS[type] || '#8A8A8A'
  const hasAnyRelationship =
    detail?.outgoing?.length || detail?.incoming?.length ||
    detail?.cross_outgoing?.length || detail?.cross_incoming?.length

  return (
    <div
      className="fixed z-20 w-[300px] max-h-[440px] overflow-y-auto bg-light-panel-raised dark:bg-panel-raised border border-light-border dark:border-border rounded-lg shadow-elevated"
      style={{ left: position.x, top: position.y, borderTopColor: color, borderTopWidth: '2px' }}
    >
      <div className="sticky top-0 bg-light-panel-raised dark:bg-panel-raised px-4 pt-3 pb-2 border-b border-light-border/60 dark:border-border/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <TypeBadge type={type} />
          {detail && (
            <h3 className="font-display text-base font-semibold text-light-text dark:text-text mt-1.5 leading-tight break-words">
              {detail.value}
            </h3>
          )}
        </div>
        <button
          className="flex-shrink-0 text-light-muted dark:text-muted hover:text-light-text dark:hover:text-text transition-colors text-lg leading-none mt-0.5"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3">
        {error && (
          <div className="bg-danger/10 text-danger border border-danger/30 rounded-lg p-2 text-xs font-mono">
            {error}
          </div>
        )}
        {!detail && !error && (
          <p className="text-center py-6 text-light-muted dark:text-muted text-xs font-mono">Loading…</p>
        )}

        {detail && (
          <>
            <div className="text-[11px] font-mono text-light-muted dark:text-muted mb-3">
              {detail.case_name || detail.case_id}
            </div>

            <div className="divide-y divide-light-border/40 dark:divide-border/40">
              <Section label="Properties" count={detail.all_props ? Object.keys(detail.all_props).length : 0}>
                {detail.all_props && Object.entries(detail.all_props).map(([key, val]) => (
                  <div key={key} className="flex justify-between gap-2 text-xs py-0.5">
                    <span className="font-mono text-light-muted dark:text-muted">{key}</span>
                    <span className="text-light-text dark:text-text text-right break-all">{String(val)}</span>
                  </div>
                ))}
              </Section>

              <Section label="Connections" count={(detail.outgoing?.length || 0) + (detail.incoming?.length || 0)}>
                {detail.outgoing?.map((r, i) => <RelRow key={`o${i}`} direction="out" r={r} />)}
                {detail.incoming?.map((r, i) => <RelRow key={`i${i}`} direction="in" r={r} />)}
              </Section>

              <Section
                label="Cross-case links"
                count={(detail.cross_outgoing?.length || 0) + (detail.cross_incoming?.length || 0)}
              >
                {detail.cross_outgoing?.map((r, i) => <RelRow key={`co${i}`} direction="out" r={r} />)}
                {detail.cross_incoming?.map((r, i) => <RelRow key={`ci${i}`} direction="in" r={r} />)}
              </Section>

              <Section label="Recent activity" count={detail.audit_trail?.length || 0}>
                {detail.audit_trail?.map((a, i) => (
                  <div key={i} className="flex items-baseline justify-between text-[11px] py-0.5 gap-2">
                    <span className="font-mono text-light-muted dark:text-muted uppercase truncate">{a.action}</span>
                    <span className="font-mono text-light-muted/60 dark:text-muted/60 flex-shrink-0">
                      {new Date(a.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </Section>
            </div>

            {!hasAnyRelationship && (
              <p className="text-center py-3 text-light-muted dark:text-muted text-xs font-mono italic">No relationships yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}