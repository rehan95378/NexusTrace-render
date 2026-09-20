import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_anomalies_case_id'

// Minimal inline line icons — see Entities.jsx for the same pattern and
// rationale (replacing emoji with a deliberate, consistent icon set).
function SearchIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <circle cx="7" cy="7" r="4.3" />
      <path d="M13 13l-2.7-2.7" strokeLinecap="round" />
    </svg>
  )
}
function LoopIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M3 8a5 5 0 018.7-3.4M13 8a5 5 0 01-8.7 3.4" strokeLinecap="round" />
      <path d="M11 3.2v1.6H9.4M5 12.8v-1.6h1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function LinkIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M6.5 9.5l3-3" strokeLinecap="round" />
      <path d="M7.3 4.8l1-1a2.6 2.6 0 013.7 3.7l-1 1M8.7 11.2l-1 1a2.6 2.6 0 01-3.7-3.7l1-1" strokeLinecap="round" />
    </svg>
  )
}
function NetworkIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <circle cx="8" cy="3" r="1.6" />
      <circle cx="3.2" cy="12.5" r="1.6" />
      <circle cx="12.8" cy="12.5" r="1.6" />
      <path d="M6.9 4.3L4.3 11M9.1 4.3l2.6 6.7M4.8 12.5h6.4" strokeLinecap="round" />
    </svg>
  )
}

export default function Anomalies({ refreshKey }) {
  const [mode, setMode] = useState('this-case')
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
      api.anomaliesAll().then(setData).catch((e) => setError(e.message))
    } else if (selectedCaseId) {
      api.anomalies(selectedCaseId).then(setData).catch((e) => setError(e.message))
    }
  }, [mode, selectedCaseId, refreshKey])

  const isAllCases = mode === 'all-cases'

  // Rendered once, directly under the page title and above every Panel
  // below — not nested inside the first panel's card — since it applies
  // to all three sections (cycles, high-connectivity, bridges) at once.
  // Uses the same horizontal inset as Panel's own p-5/md:p-6 padding so
  // it lines up with the panel headings below it instead of sitting
  // flush against the screen edge.
  const CaseSelector = () => (
    <div className="px-5 md:px-6 mb-4">
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-panel border border-border-light rounded-md text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )

  const EmptyState = ({ message, Icon = SearchIcon }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-8 h-8 text-muted/50 mb-3 dark:text-dark-muted/50" />
      <p className="text-muted text-sm dark:text-dark-muted">{message}</p>
    </div>
  )

  const AlertRow = ({ children, type = 'warning', key }) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 p-3 rounded-md text-sm ${
        type === 'warning'
          ? 'bg-warning-dim text-warning border border-warning dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
          : type === 'info'
          ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
          : type === 'success'
          ? 'bg-success-dim text-success border border-success dark:bg-dark-teal/20 dark:text-dark-teal dark:border-dark-teal'
          : 'bg-danger-dim text-danger border border-danger dark:bg-dark-danger/20 dark:text-dark-danger dark:border-dark-danger'
      }`}
    >
      {children}
    </motion.div>
  )

  if (error) return (
    <>
      <CaseSelector />
      <Panel title="Suspicious Pattern Detection">
        <AlertRow type="error">{error}</AlertRow>
      </Panel>
    </>
  )

  if (!data) return (
    <>
      <CaseSelector />
      <Panel title="Suspicious Pattern Detection" hint={isAllCases ? "Anomaly detection across all cases." : "Anomaly detection for the selected case."}>
        <EmptyState message={mode === 'this-case' && !selectedCaseId
          ? 'Select a case to run anomaly detection.'
          : 'Loading…'} />
      </Panel>
    </>
  )

  if (data.message) return (
    <>
      <CaseSelector />
      <Panel title="Suspicious Pattern Detection" hint={isAllCases ? "Anomaly detection across all cases." : "Anomaly detection for the selected case."}>
        <EmptyState message={data.message} />
      </Panel>
    </>
  )

  return (
    <>
      <CaseSelector />

      <Panel title="Financial Transaction Cycles" hint="Circular money-trail patterns detected in the case graph.">
        {data.cycles.length === 0 ? (
          <EmptyState message="No circular transaction trails detected in the current data." Icon={LoopIcon} />
        ) : (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {data.cycles.map((cycle, i) => (
              <AlertRow key={i} type="warning">
                <span className="font-mono text-xs">Cycle #{i + 1}</span>
                <span>{cycle.join(' → ')}</span>
              </AlertRow>
            ))}
          </motion.div>
        )}
      </Panel>

      <Panel title="Unusually High-Connectivity Individuals" hint="People significantly above the network's average number of connections.">
        {data.high_connectivity.length === 0 ? (
          <EmptyState message="No individuals significantly above the network's average connectivity." Icon={LinkIcon} />
        ) : (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {data.high_connectivity.map((row, i) => (
              <AlertRow key={row.name} type="info">
                <div className="flex-1">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs font-mono text-muted dark:text-dark-muted">{row.degree} connections (network average: {row.network_average})</div>
                </div>
              </AlertRow>
            ))}
          </motion.div>
        )}
      </Panel>

      <Panel title="Cluster-Bridging Individuals" hint="People whose removal would split the network into separate clusters.">
        {data.cluster_count > 1 && data.bridges.length === 0 ? (
          <EmptyState
            message={`${data.cluster_count} separate clusters detected in the current graph — no critical bridge individuals within clusters.`}
            Icon={NetworkIcon}
          />
        ) : data.cluster_count > 1 && data.bridges.length > 0 ? (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertRow key="info" type="warning">
              <span className="text-xs">{data.cluster_count} separate clusters — the following individuals bridge clusters or are critical connection points:</span>
            </AlertRow>
            {data.bridges.map((name, i) => (
              <AlertRow key={name} type="danger">
                <span className="font-mono text-xs">Bridge #{i + 1}</span>
                <span>{name} — removing this node would split the network into separate clusters.</span>
              </AlertRow>
            ))}
          </motion.div>
        ) : data.cluster_count <= 1 && data.bridges.length === 0 ? (
          <EmptyState message="No critical bridge individuals identified." Icon={NetworkIcon} />
        ) : (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {data.bridges.map((name, i) => (
              <AlertRow key={name} type="danger">
                <span className="font-mono text-xs">Bridge #{i + 1}</span>
                <span>{name} — removing this node would split the network into separate clusters.</span>
              </AlertRow>
            ))}
          </motion.div>
        )}
      </Panel>
    </>
  )
}