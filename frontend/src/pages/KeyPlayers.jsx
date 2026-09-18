import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

export default function KeyPlayers({ caseId, refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.keyPlayers(caseId).then(setData).catch((e) => setError(e.message))
  }, [caseId, refreshKey])

  return (
    <Panel
      title="Key Player Identification"
      hint="Computed via PageRank and betweenness centrality on this case's evidence graph."
    >
      {error && <div className="alert-row">{error}</div>}
      {!error && !data && <p className="empty-state">Loading…</p>}
      {data && data.message && <p className="empty-state">{data.message}</p>}
      {data && !data.message && (
        <div>
          {data.ranked.map((row, i) => (
            <div className="rank-row" key={row.name}>
              <span className="rank-row__name">#{i + 1} {row.name}</span>
              <span className="rank-row__scores">
                PageRank {row.pagerank.toFixed(4)} · Betweenness {row.betweenness.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
