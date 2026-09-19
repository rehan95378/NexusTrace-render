import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

export default function AuditTrail({ refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.auditAll().then(setData).catch((e) => setError(e.message))
  }, [refreshKey])

  return (
    <Panel title="Tamper-Evident Audit Log">
      {error && <div className="alert-row">{error}</div>}
      {!error && !data && <p className="empty-state">Loading…</p>}
      {data && (
        <>
          {/* Per-case verification status */}
          {data.verification && Object.keys(data.verification).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <strong>Hash Chain Verification (per case):</strong>
              {Object.entries(data.verification).map(([caseId, status]) => (
                <div key={caseId} style={{ marginTop: 4 }}>
                  {status.valid ? (
                    <div className="info-row" style={{ fontSize: '0.9em' }}>
                      ✓ Case {caseId}: Chain intact
                    </div>
                  ) : (
                    <div className="alert-row" style={{ fontSize: '0.9em' }}>
                      ✗ Case {caseId}: Chain BROKEN at entry {status.broken_entry?.seq}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.entries.length === 0 && (
            <p className="empty-state" style={{ marginTop: 12 }}>No actions logged yet. Run ingestion first.</p>
          )}

          <div style={{ marginTop: 12 }}>
            {data.entries.map((entry, idx) => (
              <details className="audit-entry" key={`${entry.case_id}-${entry.seq}-${idx}`}>
                <summary>
                  <span style={{ fontSize: '0.85em', color: '#8fa0a3', marginRight: 8 }}>
                    [{entry.case_id}]
                  </span>
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
