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
  { key: 'cases', label: 'Case Directory', title: 'Case Directory' },
  { key: 'ingestion', label: 'Evidence Processing', title: 'Evidence Processing' },
  { key: 'entities', label: 'Suspect Dossiers', title: 'Suspect Dossiers' },
  { key: 'graph', label: 'Relational Link Matrix', title: 'Relational Link Matrix' },
  { key: 'key-players', label: 'Network Centrality', title: 'Network Centrality' },
  { key: 'anomalies', label: 'Suspicious Pattern Alerts', title: 'Suspicious Pattern Alerts' },
  { key: 'audit', label: 'Compliance & Session Logs', title: 'Compliance & Session Logs' },
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

function SidebarPanelIcon(props) {
  // A simple "sidebar" glyph: outer rect + a vertical divider near the
  // left edge, mirroring the icon Claude's own collapse button uses.
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" />
      <path d="M6 2.75v10.5" />
    </svg>
  )
}

/**
 * Icon + wordmark shown together only inside the sidebar's own header,
 * while the sidebar is open. When the sidebar is closed, only the bare
 * toggle icon is shown (in the main content's header row, below) — no
 * wordmark — matching Claude's own collapsed-sidebar look.
 */
function BrandRow({ onToggle }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={onToggle}
        aria-label="Toggle sidebar"
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 -ml-1 rounded-md text-muted hover:text-text hover:bg-panel-raised transition-colors duration-150 dark:text-dark-muted dark:hover:text-dark-text dark:hover:bg-dark-panel-raised"
      >
        <SidebarPanelIcon className="w-4 h-4" />
      </button>
      <h1 className="font-display text-text text-lg font-semibold truncate dark:text-dark-text">NexusTrace</h1>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('cases')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [health, setHealth] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const isMobile = useIsMobile()
  const sidebarVisible = isMobile ? sidebarOpen : !sidebarCollapsed

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  // Ctrl+B / Cmd+B toggles the sidebar from anywhere, same as Claude's own UI.
  useEffect(() => {
    function onKeyDown(e) {
      const key = e.key?.toLowerCase()
      if (key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile])

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
    <div className="app-shell h-screen overflow-hidden flex flex-col bg-bg text-text dark:bg-dark-bg dark:text-dark-text">
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

      {/* Sidebar Navigation — toggleable at every screen size. On mobile
          it's an overlay drawer; on desktop it's a collapsible column
          that frees up the full page width when hidden. Its header row
          holds the toggle button and wordmark as ordinary flex content —
          no fixed positioning, so nothing else on the page needs special
          padding to avoid it. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-panel border-r border-border-light flex flex-col
                   transition-transform duration-300 ease-out
                   dark:bg-dark-panel dark:border-dark-border
                   ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 pl-3 pr-4 py-3 border-b border-border-light dark:border-dark-border">
            <BrandRow onToggle={toggleSidebar} />
          </div>

          <nav className="flex-1 overflow-y-auto pt-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`flex w-full items-center px-4 py-3 text-left text-sm font-medium
                          ${tab === t.key
                            ? 'bg-accent/10 text-accent border-l-4 border-accent dark:bg-dark-accent/20 dark:text-dark-accent dark:border-dark-accent'
                            : 'text-muted hover:bg-panel-raised hover:text-text transition-colors duration-200 dark:text-dark-muted dark:hover:bg-dark-panel-raised dark:hover:text-dark-text'}`}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-shrink-0 pt-4 pb-6 border-t border-border-light dark:border-dark-border">
            <div className="flex items-center px-4 gap-2">
              <span className="flex items-center gap-2 text-xs font-mono flex-1">
                {health ? (
                  <>
                    {health.status === 'unreachable' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-danger-dim text-danger rounded text-xs dark:bg-dark-danger/20 dark:text-dark-danger">
                        ● Backend Unreachable
                      </span>
                    ) : (
                      <>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${health.status === 'ok' ? 'bg-success-dim text-success dark:bg-dark-teal/20 dark:text-dark-teal' : 'bg-danger-dim text-danger dark:bg-dark-danger/20 dark:text-dark-danger'}`}>
                          ● Backend {health.status}
                        </span>
                        {'neo4j_connected' in health && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${health.neo4j_connected ? 'bg-success-dim text-success dark:bg-dark-teal/20 dark:text-dark-teal' : 'bg-danger-dim text-danger dark:bg-dark-danger/20 dark:text-dark-danger'}`}>
                            Neo4j {health.neo4j_connected ? 'Up' : 'Down'}
                          </span>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/20 text-muted rounded text-xs dark:bg-dark-muted/20 dark:text-dark-muted">
                    ● Checking...
                  </span>
                )}
              </span>

              <button
                className="p-1 rounded hover:bg-accent/10 transition-colors duration-200 dark:hover:bg-dark-accent/10 flex-shrink-0"
                onClick={() => setIsDarkMode((d) => !d)}
                aria-label="Toggle dark/light mode"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden transition-[padding] duration-300 ease-out
                   ${!isMobile && sidebarVisible ? 'pl-64' : 'pl-0'}`}
      >
        {/* Only non-graph tabs get this header row (title + toggle icon
            when the sidebar is closed). The graph tab has no title and
            deliberately gets zero extra header bar — its own toggle icon
            (when needed) is squeezed into GraphView's existing controls
            row below instead, so the canvas loses no vertical space. */}
        {tab !== 'graph' && (
          <div className="topbar flex-shrink-0 flex items-center gap-3 py-3 px-4 border-b border-border-light dark:border-dark-border bg-panel dark:bg-dark-panel">
            {!sidebarVisible && (
              <button
                onClick={toggleSidebar}
                aria-label="Show sidebar"
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-muted hover:text-text hover:bg-panel-raised transition-colors duration-150 dark:text-dark-muted dark:hover:text-dark-text dark:hover:bg-dark-panel-raised"
              >
                <SidebarPanelIcon className="w-4 h-4" />
              </button>
            )}

            <h1 className="font-display text-2xl font-bold text-text md:text-3xl flex-1 min-w-0 truncate dark:text-dark-text">
              {activeTab.title}
            </h1>

            {!isMobile && (
              <span className="hidden md:flex items-center gap-2 text-xs font-mono text-muted dark:text-dark-muted flex-shrink-0">
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            )}
          </div>
        )}

        <div
          className={
            tab === 'graph'
              ? 'flex-1 min-h-0 flex flex-col p-3 md:p-4'
              : 'flex-1 min-h-0 overflow-y-auto'
          }
        >
          {tab === 'cases' && <Cases onNavigateToIngestion={() => selectTab('ingestion')} />}
          {tab === 'ingestion' && (
            <Ingestion key={resetKey} onIngested={bumpRefresh} />
          )}
          {tab === 'entities' && <Entities refreshKey={refreshKey} />}
          {tab === 'graph' && (
            <GraphView
              refreshKey={refreshKey}
              onGraphChanged={bumpRefresh}
              sidebarToggle={
                !sidebarVisible && (
                  <button
                    onClick={toggleSidebar}
                    aria-label="Show sidebar"
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-text hover:bg-panel-raised transition-colors duration-150"
                  >
                    <SidebarPanelIcon className="w-4 h-4" />
                  </button>
                )
              }
            />
          )}
          {tab === 'key-players' && <KeyPlayers refreshKey={refreshKey} />}
          {tab === 'anomalies' && <Anomalies refreshKey={refreshKey} />}
          {tab === 'audit' && <AuditTrail refreshKey={refreshKey} />}
        </div>
      </main>
    </div>
  )
}