import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

export default function AuditTrail({ refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.auditAll().then(setData).catch((e) => setError(e.message))
  }, [refreshKey])

  const renderError = () => (
    <Panel title="Tamper-Evident Audit Log">
      <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>
    </Panel>
  )

  const renderLoading = () => (
    <Panel title="">
      <motion.p
        className="text-muted text-center py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Loading…
      </motion.p>
    </Panel>
  )

  return (
    <>
      {error && renderError()}
      {!error && !data && renderLoading()}
      {data && (
        <Panel>
          {/* Per-case verification status */}
          {data.verification && Object.keys(data.verification).length > 0 && (
            <motion.div
              key="verification"
              className="mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-sm font-medium text-muted mb-2">Hash Chain Verification (per case):</div>
              <div className="space-y-2 text-xs font-mono">
                {Object.entries(data.verification).map(([caseId, status], idx) => (
                  <motion.div
                    key={caseId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    // Fixed: was `Math.random() * 0.1`, which recomputes to a
                    // new value on every re-render, so the "animation" delay
                    // was nondeterministic instead of a one-time staggered
                    // entrance. Deterministic, index-based delay instead —
                    // matches the pattern already used for entries below.
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-2 rounded-lg "
                  >
                    <span>
                      {status.valid ? '✓' : '✗'} Case {caseId}:
                      {status.valid ? 'Chain intact' : `Chain BROKEN at entry ${status.broken_entry?.seq}`}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      status.valid ? 'bg-teal/20 text-teal' : 'bg-danger/20 text-danger'
                    }`}>
                      {status.valid ? 'OK' : 'BROKEN'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {data.entries.length === 0 && (
            <motion.p
              key="empty"
              className="text-muted text-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              No actions logged yet. Run ingestion first.
            </motion.p>
          )}

          <div key="entries" className="mt-4 space-y-2">
            {data.entries.map((entry, idx) => (
              <motion.details
                key={`${entry.case_id}-${entry.seq}-${idx}`}
                className="audit-entry bg-panel-raised/50 border border-border/50 rounded-lg overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <motion.summary
                  className="flex items-center gap-2 p-3 cursor-pointer select-none"
                >
                  <span className="flex-shrink-0 text-xs font-mono text-muted">
                    [{entry.case_id}]
                  </span>
                  <span className="flex-shrink-0 text-xs font-mono text-muted">
                    {entry.timestamp}
                  </span>
                  <span className="flex-1 text-sm font-medium text-text action">
                    {entry.action}
                  </span>
                </motion.summary>
                <motion.div
                  className="p-3 bg-bg text-xs font-mono text-text overflow-auto max-h-[200px]"
                >
                  <pre>{JSON.stringify(entry, null, 2)}</pre>
                </motion.div>
              </motion.details>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
