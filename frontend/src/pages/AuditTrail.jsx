import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

export default function AuditTrail({ refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.audit().then(setData).catch((e) => setError(e.message))
  }, [refreshKey])

  return (
    <Panel title="Tamper-Evident Audit Log">
      {error && <div className="alert-row">{error}</div>}
      {!error && !data && <p className="empty-state">Loading…</p>}
      {data && (
        <>
          {data.valid ? (
            <div className="info-row">Chain verified — all {data.entries.length} entries intact.</div>
          ) : (
            <div className="alert-row">Chain integrity check FAILED at entry: {JSON.stringify(data.broken_entry)}</div>
          )}

          {data.entries.length === 0 && (
            <p className="empty-state" style={{ marginTop: 12 }}>No actions logged yet. Run ingestion first.</p>
          )}

          <div style={{ marginTop: 12 }}>
            {data.entries.map((entry) => (
              <details className="audit-entry" key={entry.seq}>
                <summary>
                  {entry.timestamp}
                  <span className="action">{entry.action}</span>
                </summary>
                <pre>{JSON.stringify(entry, null, 2)}</pre>
              </details>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
