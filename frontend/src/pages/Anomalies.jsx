import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

export default function Anomalies({ refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.anomalies().then(setData).catch((e) => setError(e.message))
  }, [refreshKey])

  if (error) return <Panel title="Suspicious Pattern Detection"><div className="alert-row">{error}</div></Panel>
  if (!data) return <Panel title="Suspicious Pattern Detection"><p className="empty-state">Loading…</p></Panel>
  if (data.message) return <Panel title="Suspicious Pattern Detection"><p className="empty-state">{data.message}</p></Panel>

  return (
    <>
      <Panel title="Financial Transaction Cycles">
        {data.cycles.length === 0 && <p className="empty-state">No circular financial trails detected in current data.</p>}
        {data.cycles.map((cycle, i) => (
          <div className="alert-row" key={i}>Circular financial trail detected: {cycle.join(' → ')}</div>
        ))}
      </Panel>

      <Panel title="Unusually High-Connectivity Individuals">
        {data.high_connectivity.length === 0 && (
          <p className="empty-state">No individuals significantly above the network's average connectivity.</p>
        )}
        {data.high_connectivity.map((row) => (
          <div className="alert-row" key={row.name}>
            {row.name} — {row.degree} connections (network average: {row.network_average})
          </div>
        ))}
      </Panel>

      <Panel title="Cluster-Bridging Individuals">
        {data.cluster_count > 1 && (
          <p className="empty-state">
            {data.cluster_count} separate clusters detected in the current graph — no single bridge yet linking them.
          </p>
        )}
        {data.cluster_count <= 1 && data.bridges.length === 0 && (
          <p className="empty-state">No critical bridge individuals identified.</p>
        )}
        {data.cluster_count <= 1 && data.bridges.map((name) => (
          <div className="alert-row" key={name}>{name} — removing this node would split the network into separate clusters.</div>
        ))}
      </Panel>
    </>
  )
}
