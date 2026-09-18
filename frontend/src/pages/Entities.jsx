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

export default function Entities({ refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.entities().then(setData).catch((e) => setError(e.message))
  }, [refreshKey])

  if (error) return <Panel title="Extracted Entity Profiles"><div className="alert-row">{error}</div></Panel>
  if (!data) return <Panel title="Extracted Entity Profiles"><p className="empty-state">Loading…</p></Panel>

  if (!data.is_processed) {
    return (
      <Panel title="Extracted Entity Profiles">
        <p className="empty-state">Ingestion channels clear. Run extraction on the Ingestion tab first.</p>
      </Panel>
    )
  }

  return (
    <Panel title="Extracted Entity Profiles" hint="Isolated cross-channel entities currently in the graph.">
      <div className="grid cols-3">
        {COLUMNS.map((col) => (
          <div key={col.key}>
            <label>{col.label} ({data[col.key].length})</label>
            <div className="tag-list">
              {data[col.key].length === 0 && <span className="empty-state">None yet</span>}
              {data[col.key].map((item) => (
                <div key={item} className={`tag ${col.cls}`}>{item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
