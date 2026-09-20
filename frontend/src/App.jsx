import { useEffect, useState } from 'react'
import { api } from './api'
import Cases from './pages/Cases'
import Ingestion from './pages/Ingestion'
import Entities from './pages/Entities'
import GraphView from './pages/GraphView'
import KeyPlayers from './pages/KeyPlayers'
import Anomalies from './pages/Anomalies'
import AuditTrail from './pages/AuditTrail'
import { motion } from 'framer-motion'

const TABS = [
  { key: 'cases', label: 'Cases', title: 'Case Management' },
  { key: 'ingestion', label: 'Data Ingestion', title: 'Multi-Channel Ingestion' },
  { key: 'entities', label: 'Entity Profiles', title: 'Extracted Entity Profiles' },
  { key: 'graph', label: 'Evidence Graph Map', title: 'Evidence Graph Map' },
  { key: 'key-players', label: 'Key Player ID', title: 'Key Player Identification' },
  { key: 'anomalies', label: 'Anomaly Detection', title: 'Suspicious Pattern Detection' },
  { key: 'audit', label: 'Audit Trail', title: 'Tamper-Evident Audit Log' },
]

// Tracks window width in state via a resize listener, instead of reading
// window.innerWidth directly during render (which only ever reflects
// whatever width happened to be current the last time some *other* state
// change caused a re-render).
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}

export default function App() {
  const [tab, setTab] = useState('cases')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [health, setHealth] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  // Apply the initial theme class on mount (previously the `dark` class was
  // only ever toggled inside the click handler, so the default isDarkMode
  // state never actually got reflected on <html> until the user clicked
  // the toggle once).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)
  const activeTab = TABS.find((t) => t.key === tab)

  function selectTab(key) {
    setTab(key)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="app-shell min-h-screen flex flex-col bg-bg text-text">
      {/* Mobile Menu Button (hidden on desktop) */}
      <button
        className="md:hidden p-2 bg-panel-raised border-border rounded-lg hover:bg-panel/80 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle case menu"
      >
        <motion.div
          className="flex flex-col gap-1.5 w-6 h-5"
          initial={{ scale: 0.8 }}
          animate={{ scale: sidebarOpen ? 1 : 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <span className="block h-0.5 bg-text rounded" />
          <span className="block h-0.5 bg-text rounded" />
          <span className="block h-0.5 bg-text rounded" />
        </motion.div>
      </button>

      {/* Sidebar Overlay (mobile only) */}
      {sidebarOpen && isMobile && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* Sidebar Navigation — always fixed to the left edge. Previously this
          only got `fixed` positioning while the mobile drawer was open;
          on desktop it was a normal block sitting in the page's flow, so
          under the outer flex-col wrapper, <main> was actually rendering
          BELOW the sidebar's full height instead of beside it — which is
          the large empty gap you were seeing above every tab's content. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-panel border-r border-border flex flex-col
                   transition-transform duration-300 ease-out
                   ${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="text-sm font-mono text-muted tracking-wide">SIH26189</div>
            <h1 className="font-display text-text text-lg mt-1">Evidence Graph System</h1>
          </div>

          <nav className="flex-1 overflow-y-auto pt-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`flex w-full items-center px-4 py-3 text-left text-sm font-medium
                          ${tab === t.key
                            ? 'bg-panel-raised text-accent border-l-4 border-accent'
                            : 'text-muted hover:bg-panel/50 hover:text-text transition-colors duration-200'}`}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-shrink-0 pt-4 pb-6 border-t border-border">
            <div className="flex items-center px-4">
              <span className="flex items-center gap-2 text-xs font-mono">
                {health ? (
                  <>
                    {health.status === 'unreachable' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-danger/20 text-danger rounded">
                        ● Backend Unreachable
                      </span>
                    ) : (
                      <>
                        {/* Fixed: these were plain strings before (no
                            backticks), so `${...}` never interpolated and
                            the conditional color classes never applied. */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${health.status === 'ok' ? 'bg-teal/20 text-teal' : 'bg-danger/20 text-danger'} rounded`}>
                          ● Backend {health.status}
                        </span>
                        {'neo4j_connected' in health && (
                          <span className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 ${health.neo4j_connected ? 'bg-teal/20 text-teal' : 'bg-danger/20 text-danger'} rounded text-xs`}>
                            Neo4j {health.neo4j_connected ? 'Up' : 'Down'}
                          </span>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/20 text-muted rounded">
                    ● Checking...
                  </span>
                )}
              </span>

              {/* Theme Toggle */}
              <button
                className="ml-auto p-1 rounded hover:bg-panel/50 transition-colors duration-200"
                onClick={() => setIsDarkMode((d) => !d)}
                aria-label="Toggle dark/light mode"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 min-w-0
                   ${isMobile
                     ? sidebarOpen
                       ? 'pl-64'
                       : 'pl-0'
                     : 'pl-64'}`}
      >
        <div className="topbar flex flex-col md:flex-row md:items-center md:justify-between md:gap-4 md:p-4">
          <h1 className="font-display text-2xl font-bold text-text md:text-3xl">
            {activeTab.title}
          </h1>

          {/* Theme label (desktop only) */}
          {!isMobile && (
            <span className="hidden md:flex items-center gap-2 text-xs font-mono text-muted">
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
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