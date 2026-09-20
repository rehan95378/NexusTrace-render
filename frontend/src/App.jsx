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
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 -ml-1 rounded-md text-light-muted dark:text-muted hover:text-light-text dark:hover:text-text hover:bg-light-panel-raised dark:hover:bg-panel-raised transition-colors duration-150"
      >
        <SidebarPanelIcon className="w-4 h-4" />
      </button>
      <h1 className="font-display text-light-text dark:text-text text-lg font-semibold truncate">NexusTrace</h1>
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
  const [isDarkMode, setIsDarkMode] = useState(false) // Light mode is default
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
    <div className="app-shell h-screen overflow-hidden flex flex-col bg-light-bg dark:bg-bg text-light-text dark:text-text">
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-light-panel dark:bg-panel border-r border-light-border dark:border-border flex flex-col
                   transition-transform duration-300 ease-out
                   ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 pl-3 pr-4 py-3 border-b border-light-border dark:border-border">
            <BrandRow onToggle={toggleSidebar} />
          </div>

          <nav className="flex-1 overflow-y-auto pt-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`flex w-full items-center px-4 py-3 text-left text-sm font-medium
                          ${tab === t.key
                            ? 'bg-light-panel-raised dark:bg-panel-raised text-accent dark:text-accent border-l-4 border-accent'
                            : 'text-light-muted dark:text-muted hover:bg-light-panel-raised/50 dark:hover:bg-panel/50 hover:text-light-text dark:hover:text-text transition-colors duration-200'}`}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-shrink-0 pt-4 pb-6 border-t border-light-border dark:border-border">
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
          <div className="topbar flex-shrink-0 flex items-center gap-3 py-3 px-4 border-b border-light-border/60 dark:border-border/60 bg-light-panel dark:bg-panel">
            {!sidebarVisible && (
              <button
                onClick={toggleSidebar}
                aria-label="Show sidebar"
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-light-muted dark:text-muted hover:text-light-text dark:hover:text-text hover:bg-light-panel-raised dark:hover:bg-panel-raised transition-colors duration-150"
              >
                <SidebarPanelIcon className="w-4 h-4" />
              </button>
            )}

            <h1 className="font-display text-2xl font-bold text-light-text dark:text-text md:text-3xl flex-1 min-w-0 truncate">
              {activeTab.title}
            </h1>

            {!isMobile && (
              <span className="hidden md:flex items-center gap-2 text-xs font-mono text-light-muted dark:text-muted flex-shrink-0">
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            )}
          </div>
        )}

        <div
          className={
            tab === 'graph'
              ? 'flex-1 min-h-0 flex flex-col p-3 md:p-4 bg-light-bg dark:bg-bg'
              : 'flex-1 min-h-0 overflow-y-auto bg-light-bg dark:bg-bg'
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