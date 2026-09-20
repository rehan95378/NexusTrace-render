import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { useListCases, useAnomalies } from '../hooks/useQueries'

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
  const [selectedCaseId, setSelectedCaseId] = useState('')

  // React Query hooks
  const { data: cases = [] } = useListCases()
  const { data, isLoading, error } = useAnomalies(mode === 'this-case' ? selectedCaseId : null)

  useEffect(() => {
    if (cases.length > 0) {
      const lastId = localStorage.getItem(LAST_CASE_KEY)
      if (lastId && cases.find(c => c.id === lastId)) {
        setSelectedCaseId(lastId)
      } else {
        setSelectedCaseId(cases[0].id)
      }
    }
  }, [cases])

  useEffect(() => {
    if (selectedCaseId) {
      localStorage.setItem(LAST_CASE_KEY, selectedCaseId)
    }
  }, [selectedCaseId])

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
        className="block w-full sm:w-[250px] px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
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
      <Icon className="w-8 h-8 text-light-muted dark:text-muted/50 mb-3" />
      <p className="text-light-muted dark:text-muted text-sm">{message}</p>
    </div>
  )

  const AlertRow = ({ children, type = 'warning', key }) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
        type === 'warning'
          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
          : type === 'info'
          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
          : type === 'success'
          ? 'bg-teal/10 text-teal border border-teal/30'
          : 'bg-danger/10 text-danger border border-danger/30'
      }`}
    >
      {children}
    </motion.div>
  )

  if (error) return (
    <>
      <CaseSelector />
      <Panel title="Suspicious Pattern Detection">
        <AlertRow type="error">{error?.message}</AlertRow>
      </Panel>
    </>
  )

  if (isLoading || !data) return (
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
                <span className="font-mono text-xs text-amber-300">Cycle #{i + 1}</span>
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
                  <div className="font-medium text-blue-300">{row.name}</div>
                  <div className="text-xs font-mono text-light-muted dark:text-muted">{row.degree} connections (network average: {row.network_average})</div>
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
                <span className="font-mono text-xs text-danger">Bridge #{i + 1}</span>
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
                <span className="font-mono text-xs text-danger">Bridge #{i + 1}</span>
                <span>{name} — removing this node would split the network into separate clusters.</span>
              </AlertRow>
            ))}
          </motion.div>
        )}
      </Panel>
    </>
  )
}