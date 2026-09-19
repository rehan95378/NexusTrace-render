import { useEffect, useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

const COLUMNS = [
  { key: 'people', label: 'Suspects', cls: '' },
  { key: 'locations', label: 'Hotspots', cls: 'location' },
  { key: 'vehicles', label: 'Vehicles', cls: 'vehicle' },
  { key: 'phones', label: 'Devices', cls: 'phone' },
  { key: 'organizations', label: 'Organizations', cls: 'org' },
]

const LAST_CASE_KEY = 'sih_last_entities_case_id'

export default function Entities({ refreshKey }) {
  const [mode, setMode] = useState('this-case') // 'this-case' or 'all-cases'
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
      api.allEntities().then(setData).catch((e) => setError(e.message))
    } else if (selectedCaseId) {
      api.entities(selectedCaseId).then(setData).catch((e) => setError(e.message))
    }
  }, [mode, selectedCaseId, refreshKey])

  if (error) return (
    <Panel title="Extracted Entity Profiles">
      <div className="alert-row">{error}</div>
    </Panel>
  )

  if (!data) return (
    <Panel title="Extracted Entity Profiles">
      <p className="empty-state">Loading…</p>
    </Panel>
  )

  if (mode === 'this-case' && !data.is_processed) {
    return (
      <Panel title="Extracted Entity Profiles">
        <p className="empty-state">This case is empty. Run extraction on the Ingestion tab first.</p>
      </Panel>
    )
  }

  // For all-cases mode, data is an array of entities with case_id
  // For this-case mode, data has the same structure as before
  const isAllCases = mode === 'all-cases'

  return (
    <Panel title="Extracted Entity Profiles" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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

      {isAllCases ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="entity-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>Case</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center' }}>No entities yet</td>
                </tr>
              )}
              {data.map((entity, idx) => (
                <tr key={idx}>
                  <td><span className={`tag ${COLUMNS.find(c => c.key === entity.type + 's')?.cls || ''}`}>{entity.type}</span></td>
                  <td>{entity.value}</td>
                  <td>{entity.case_name || entity.case_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key}>
              <label>{col.label} ({data[col.key]?.length || 0})</label>
              <div className="tag-list">
                {(!data[col.key] || data[col.key].length === 0) && <span className="empty-state">None yet</span>}
                {data[col.key]?.map((item) => (
                  <div key={item} className={`tag ${col.cls}`}>{item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
