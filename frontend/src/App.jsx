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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const isMobile = useIsMobile()
  const sidebarVisible = isMobile ? sidebarOpen : !sidebarCollapsed

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
  }, [])

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

  function toggleSidebar() {
    if (isMobile) {
      setSidebarOpen((o) => !o)
    } else {
      setSidebarCollapsed((c) => !c)
    }
  }

  return (
    <div className="app-shell h-screen overflow-hidden flex flex-col bg-bg text-text">
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

      {/* Sidebar Navigation — toggleable at every screen size via the
          single button below. On mobile it's an overlay drawer; on
          desktop it's a collapsible column that frees up the full page
          width when hidden. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-panel border-r border-border flex flex-col
                   transition-transform duration-300 ease-out
                   ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="text-sm font-mono text-muted tracking-wide">SIH26189</div>
            <h1 className="font-display text-text text-lg mt-1 truncate">Evidence Graph System</h1>
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

      {/* Single sidebar toggle — one button, one DOM node, for both open
          and closed states. It's a sibling of <aside> and <main> (fixed to
          the viewport), so it's never affected by main's pl-64/pl-0
          padding transition below. Its own `left` offset animates with the
          SAME duration/easing as the sidebar's own transform, so it
          visibly rides along the sidebar's edge instead of instantly
          snapping to a new spot when the state flips. */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        className={`fixed top-4 z-[70] p-2 bg-panel-raised border border-border rounded-lg text-muted hover:text-text hover:bg-panel shadow-lg transition-[left] duration-300 ease-out ${
          sidebarVisible ? 'left-[228px]' : 'left-4'
        }`}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={`w-4 h-4 transition-transform duration-300 ${sidebarVisible ? 'rotate-180' : ''}`}
        >
          <path d="M6 3l4.5 5-4.5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Main Content */}
      <main
        className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden transition-[padding] duration-300 ease-out
                   ${!isMobile && sidebarVisible ? 'pl-64' : 'pl-0'}`}
      >
        {tab !== 'graph' && (
          <div className="topbar flex-shrink-0 flex items-center gap-3 md:gap-4 md:p-4 px-4 py-3 border-b border-border/60">
            <h1 className="font-display text-2xl font-bold text-text md:text-3xl flex-1 min-w-0 truncate">
              {activeTab.title}
            </h1>

            {!isMobile && (
              <span className="hidden md:flex items-center gap-2 text-xs font-mono text-muted flex-shrink-0">
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            )}
          </div>
        )}

        <div className={tab === 'graph' ? 'flex-1 min-h-0 flex flex-col p-3 md:p-4' : 'flex-1 min-h-0 overflow-y-auto'}>
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
        </div>
      </main>
    </div>
  )
}