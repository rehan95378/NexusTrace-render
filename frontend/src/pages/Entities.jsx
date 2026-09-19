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
      // Try to restore last selected case
      const lastId = localStorage.getItem(LAST_CASE_KEY)
      if (lastId && list.find(c => c.id === lastId)) {
        setSelectedCaseId(lastId)
      } else if (list.length > 0) {
        // If no saved case or saved case not found, select the first case
        setSelectedCaseId(list[0].id)
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

    const fetchData = async () => {
      if (mode === 'all-cases') {
        try {
          const result = await api.allEntities()
          console.log('All entities response:', result)
          // Ensure result is an array
          if (Array.isArray(result)) {
            setData(result)
          } else {
            console.error('Expected array but got:', result)
            setError('Invalid data format: expected array of entities')
          }
        } catch (e) {
          console.error('Failed to load all entities:', e)
          setError(`Failed to load entities: ${e.message}`)
        }
      } else if (selectedCaseId) {
        try {
          const result = await api.entities(selectedCaseId)
          console.log('Case entities response:', result)
          setData(result)
        } catch (e) {
          console.error('Failed to load case entities:', e)
          setError(`Failed to load entities: ${e.message}`)
        }
      }
    }

    fetchData()
  }, [mode, selectedCaseId, refreshKey])

  if (error) return (
    <Panel title="Extracted Entity Profiles">
      <select
        value={mode === 'all-cases' ? '__all__' : selectedCaseId}
        onChange={(e) => {
          if (e.target.value === '__all__') {
            setMode('all-cases')
            setSelectedCaseId('')
          } else {
            setMode('this-case')
            setSelectedCaseId(e.target.value)
          }
        }}
        style={{ padding: '6px 12px', minWidth: 250, marginBottom: 16 }}
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="alert-row">{error}</div>
    </Panel>
  )

  if (!data) {
    return (
      <Panel title="Extracted Entity Profiles">
        <select
          value={mode === 'all-cases' ? '__all__' : selectedCaseId}
          onChange={(e) => {
            if (e.target.value === '__all__') {
              setMode('all-cases')
              setSelectedCaseId('')
            } else {
              setMode('this-case')
              setSelectedCaseId(e.target.value)
            }
          }}
          style={{ padding: '6px 12px', minWidth: 250, marginBottom: 16 }}
        >
          <option value="">Select a case…</option>
          <option value="__all__">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="empty-state">{mode === 'all-cases' ? 'Loading…' : 'Select a case to view its entity profiles.'}</p>
      </Panel>
    )
  }

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
        style={{ padding: '6px 12px', minWidth: 250, marginBottom: 16 }}
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {isAllCases ? (
        <div style={{ overflowX: 'auto' }}>
          {!Array.isArray(data) ? (
            <p className="empty-state" style={{ color: 'red' }}>Error: Invalid data format (expected array)</p>
          ) : data.length === 0 ? (
            <p className="empty-state">No entities extracted yet across any cases. Run ingestion first.</p>
          ) : (
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Case</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entity, idx) => (
                  <tr key={idx}>
                    <td><span className={`tag ${COLUMNS.find(c => c.key === entity.type + 's')?.cls || ''}`}>{entity.type}</span></td>
                    <td>{entity.value}</td>
                    <td>{entity.case_name || entity.case_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
