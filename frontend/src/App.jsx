import { useEffect, useState } from 'react'
import { api } from './api'
import Ingestion from './pages/Ingestion'
import Entities from './pages/Entities'
import GraphView from './pages/GraphView'
import KeyPlayers from './pages/KeyPlayers'
import Anomalies from './pages/Anomalies'
import AuditTrail from './pages/AuditTrail'

const TABS = [
  { key: 'ingestion', label: 'Data Ingestion', title: 'Multi-Channel Ingestion' },
  { key: 'entities', label: 'Entity Profiles', title: 'Extracted Entity Profiles' },
  { key: 'graph', label: 'Evidence Graph Map', title: 'Evidence Graph Map' },
  { key: 'key-players', label: 'Key Player ID', title: 'Key Player Identification' },
  { key: 'anomalies', label: 'Anomaly Detection', title: 'Suspicious Pattern Detection' },
  { key: 'audit', label: 'Audit Trail', title: 'Tamper-Evident Audit Log' },
]

export default function App() {
  const [tab, setTab] = useState('ingestion')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [health, setHealth] = useState(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)
  const activeTab = TABS.find((t) => t.key === tab)

  async function handleReset() {
    if (!window.confirm('This will permanently wipe the graph and audit log. Continue?')) {
      return
    }
    setResetting(true)
    try {
      await api.clear()
      bumpRefresh()
      setResetKey((k) => k + 1) // remounts Ingestion, clearing its pasted text
      setTab('ingestion')
    } catch (err) {
      window.alert(`Reset failed: ${err.message}`)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="app-shell">
      <nav className="case-nav">
        <div className="case-nav__header">
          <div className="case-nav__case-no">SIH26189</div>
          <h1 className="case-nav__title">Crime Network Analysis</h1>
        </div>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`case-nav__item ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <div className="case-nav__footer">
          <StatusPill health={health} />
          <button
            className="danger"
            style={{ width: '100%', marginTop: 12 }}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? 'Resetting…' : 'Reset case (wipe all)'}
          </button>
        </div>
      </nav>

      <main className="main">
        <div className="topbar">
          <h1>{activeTab.title}</h1>
        </div>

        {tab === 'ingestion' && <Ingestion key={resetKey} onIngested={bumpRefresh} />}
        {tab === 'entities' && <Entities refreshKey={refreshKey} />}
        {tab === 'graph' && <GraphView refreshKey={refreshKey} />}
        {tab === 'key-players' && <KeyPlayers refreshKey={refreshKey} />}
        {tab === 'anomalies' && <Anomalies refreshKey={refreshKey} />}
        {tab === 'audit' && <AuditTrail refreshKey={refreshKey} />}
      </main>
    </div>
  )
}

function StatusPill({ health }) {
  if (!health) return <span className="status-pill">checking…</span>
  const ok = health.status === 'ok'
  const cls = health.status === 'unreachable' ? 'bad' : ok ? 'ok' : 'bad'
  const label =
    health.status === 'unreachable'
      ? 'backend unreachable'
      : `backend ${health.status}${'neo4j_connected' in health ? ` · neo4j ${health.neo4j_connected ? 'up' : 'down'}` : ''}`
  return <span className={`status-pill ${cls}`}>{label}</span>
}