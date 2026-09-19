import { useEffect, useState } from 'react'
import { api } from './api'
import Cases from './pages/Cases'
import Ingestion from './pages/Ingestion'
import Entities from './pages/Entities'
import GraphView from './pages/GraphView'
import KeyPlayers from './pages/KeyPlayers'
import Anomalies from './pages/Anomalies'
import AuditTrail from './pages/AuditTrail'

const TABS = [
  { key: 'cases', label: 'Cases', title: 'Case Management' },
  { key: 'ingestion', label: 'Data Ingestion', title: 'Multi-Channel Ingestion' },
  { key: 'entities', label: 'Entity Profiles', title: 'Extracted Entity Profiles' },
  { key: 'graph', label: 'Evidence Graph Map', title: 'Evidence Graph Map' },
  { key: 'key-players', label: 'Key Player ID', title: 'Key Player Identification' },
  { key: 'anomalies', label: 'Anomaly Detection', title: 'Suspicious Pattern Detection' },
  { key: 'audit', label: 'Audit Trail', title: 'Tamper-Evident Audit Log' },
]

export default function App() {
  const [tab, setTab] = useState('cases')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [health, setHealth] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)
  const activeTab = TABS.find((t) => t.key === tab)

  function selectTab(key) {
    setTab(key)
    setSidebarOpen(false)
  }

  const isGraphTab = tab === 'graph'

  return (
    <div className="app-shell">
      <button
        className="menu-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle case menu"
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <nav className={`case-nav ${sidebarOpen ? 'open' : ''}`}>
        <div className="case-nav__header">
          <div className="case-nav__case-no">SIH26189</div>
          <h1 className="case-nav__title">Evidence Graph System</h1>
        </div>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`case-nav__item ${tab === t.key ? 'active' : ''}`}
            onClick={() => selectTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <div className="case-nav__footer">
          <StatusPill health={health} />
        </div>
      </nav>

      <main className={`main ${isGraphTab ? 'main--graph' : ''}`}>
        <div className="topbar">
          <h1>{activeTab.title}</h1>
        </div>

        {tab === 'cases' && <Cases onNavigateToIngestion={() => selectTab('ingestion')} />}
        {tab === 'ingestion' && (
          <Ingestion key={resetKey} onIngested={bumpRefresh} />
        )}
        {tab === 'entities' && <Entities refreshKey={refreshKey} />}
        {tab === 'graph' && (
          <GraphView refreshKey={refreshKey} onGraphChanged={bumpRefresh} />
        )}
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
