import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_anomalies_case_id'

export default function Anomalies({ refreshKey }) {
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
      api.anomaliesAll().then(setData).catch((e) => setError(e.message))
    } else if (selectedCaseId) {
      api.anomalies(selectedCaseId).then(setData).catch((e) => setError(e.message))
    }
  }, [mode, selectedCaseId, refreshKey])

  const isAllCases = mode === 'all-cases'
  const scopeControls = (
    <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
      <select
        value={isAllCases ? '__all__' : selectedCaseId}
        onChange={(e) => {
          if (e.target.value === '__all__') {
            setMode('all-cases')
            setSelectedCaseId('')
          } else {
            setMode('this-case')
            setSelectedCaseId(e.target.value)
          }
        }}
        style={{ padding: '6px 12px', minWidth: 250 }}
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )

  if (error) return (
    <Panel title="Suspicious Pattern Detection">
      {scopeControls}
      <div className="alert-row">{error}</div>
    </Panel>
  )

  if (!data) return (
    <Panel title="Suspicious Pattern Detection">
      {scopeControls}
      <p className="empty-state">
        {mode === 'this-case' && !selectedCaseId
          ? 'Select a case to view anomaly detection.'
          : 'Loading…'}
      </p>
    </Panel>
  )

  if (data.message) return (
    <Panel title="Suspicious Pattern Detection">
      {scopeControls}
      <p className="empty-state">{data.message}</p>
    </Panel>
  )

  return (
    <>
      <Panel title="Financial Transaction Cycles">
        {scopeControls}
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
        {data.cluster_count > 1 && data.bridges.length === 0 && (
          <p className="empty-state">
            {data.cluster_count} separate clusters detected in the current graph — no critical bridge individuals within clusters.
          </p>
        )}
        {data.cluster_count > 1 && data.bridges.length > 0 && (
          <p className="empty-state" style={{ color: 'orange' }}>
            {data.cluster_count} separate clusters — the following individuals bridge clusters or critical points:
          </p>
        )}
        {data.cluster_count <= 1 && data.bridges.length === 0 && (
          <p className="empty-state">No critical bridge individuals identified.</p>
        )}
        {data.bridges.map((name) => (
          <div className="alert-row" key={name}>{name} — removing this node would split the network into separate clusters.</div>
        ))}
      </Panel>
    </>
  )
}
