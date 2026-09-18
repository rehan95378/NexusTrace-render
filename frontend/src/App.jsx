import { useEffect, useState } from 'react'
import { api } from './api'
import CaseSelector from './components/CaseSelector'
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

const LAST_CASE_KEY = 'sih_last_case_id'

export default function App() {
  const [activeCase, setActiveCase] = useState(null) // { id, name, created_at }
  const [caseLoading, setCaseLoading] = useState(true)
  const [tab, setTab] = useState('ingestion')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [health, setHealth] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  // Try to restore the last-opened case on load.
  useEffect(() => {
    const lastId = localStorage.getItem(LAST_CASE_KEY)
    if (!lastId) {
      setCaseLoading(false)
      return
    }
    api
      .listCases()
      .then((cases) => {
        const found = cases.find((c) => c.id === lastId)
        if (found) setActiveCase(found)
      })
      .finally(() => setCaseLoading(false))
  }, [])

  function selectCase(caseObj) {
    setActiveCase(caseObj)
    localStorage.setItem(LAST_CASE_KEY, caseObj.id)
    setTab('ingestion')
    bumpRefresh()
  }

  function switchCase() {
    setActiveCase(null)
    localStorage.removeItem(LAST_CASE_KEY)
  }

  const bumpRefresh = () => setRefreshKey((k) => k + 1)
  const activeTab = TABS.find((t) => t.key === tab)

  function selectTab(key) {
    setTab(key)
    setSidebarOpen(false)
  }

  async function handleReset() {
    if (!activeCase) return
    if (!window.confirm(`This will wipe all entities, the graph, and the audit log for "${activeCase.name}" — the case itself stays. Continue?`)) {
      return
    }
    setResetting(true)
    try {
      await api.clearCase(activeCase.id)
      bumpRefresh()
      setResetKey((k) => k + 1)
      selectTab('ingestion')
    } catch (err) {
      window.alert(`Reset failed: ${err.message}`)
    } finally {
      setResetting(false)
    }
  }

  if (caseLoading) {
    return <div className="app-loading">Loading…</div>
  }

  if (!activeCase) {
    return <CaseSelector onSelectCase={selectCase} />
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
          <h1 className="case-nav__title">{activeCase.name}</h1>
          <button className="case-nav__switch" onClick={switchCase}>
            Switch case
          </button>
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
          <button
            className="danger"
            style={{ width: '100%', marginTop: 12 }}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? 'Resetting…' : 'Reset this case (wipe data)'}
          </button>
        </div>
      </nav>

      <main className={`main ${isGraphTab ? 'main--graph' : ''}`}>
        <div className="topbar">
          <h1>{activeTab.title}</h1>
        </div>

        {tab === 'ingestion' && (
          <Ingestion key={resetKey} caseId={activeCase.id} onIngested={bumpRefresh} />
        )}
        {tab === 'entities' && <Entities caseId={activeCase.id} refreshKey={refreshKey} />}
        {tab === 'graph' && <GraphView caseId={activeCase.id} refreshKey={refreshKey} />}
        {tab === 'key-players' && <KeyPlayers caseId={activeCase.id} refreshKey={refreshKey} />}
        {tab === 'anomalies' && <Anomalies caseId={activeCase.id} refreshKey={refreshKey} />}
        {tab === 'audit' && <AuditTrail caseId={activeCase.id} refreshKey={refreshKey} />}
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
