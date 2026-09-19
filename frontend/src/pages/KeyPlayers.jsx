import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_keyplayers_case_id'

export default function KeyPlayers({ refreshKey }) {
  const [mode, setMode] = useState('this-case')
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listCases().then((list) => {
      setCases(list)
      const lastId = localStorage.getItem(LAST_CASE_KEY)
      if (lastId && list.find(c => c.id === lastId)) {
        setSelectedCaseId(lastId)
      }
    })
  }, [])

  useEffect(() => {
    if (selectedCaseId) {
      localStorage.setItem(LAST_CASE_KEY, selectedCaseId)
    }
  }, [selectedCaseId])

  useEffect(() => {
    setData(null)
    setError(null)

    if (mode === 'all-cases') {
      api.keyPlayersAll().then(setData).catch((e) => setError(e.message))
    } else if (selectedCaseId) {
      api.keyPlayers(selectedCaseId).then(setData).catch((e) => setError(e.message))
    }
  }, [mode, selectedCaseId, refreshKey])

  const isAllCases = mode === 'all-cases'

  return (
    <Panel
      title="Key Player Identification"
      hint={isAllCases ? "PageRank and betweenness across all cases — surfaces cross-case bridges." : "Computed via PageRank and betweenness centrality on the selected case's graph."}
    >
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div>
          <label style={{ marginRight: 8 }}>
            <input
              type="radio"
              value="this-case"
              checked={mode === 'this-case'}
              onChange={(e) => setMode(e.target.value)}
            />
            This case
          </label>
          <label>
            <input
              type="radio"
              value="all-cases"
              checked={mode === 'all-cases'}
              onChange={(e) => setMode(e.target.value)}
            />
            All cases
          </label>
        </div>

        {mode === 'this-case' && (
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            style={{ padding: '6px 12px', minWidth: 250 }}
          >
            <option value="">Select a case…</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

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
