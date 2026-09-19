import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_anomalies_case_id'

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

  const CaseSelector = () => (
    <div className="mb-4">
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
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

  const EmptyState = ({ message, icon = '🔍' }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-muted text-sm">{message}</p>
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
    <Panel title="Suspicious Pattern Detection">
      <CaseSelector />
      <AlertRow type="error">{error}</AlertRow>
    </Panel>
  )

  if (!data) return (
    <Panel title="Suspicious Pattern Detection" hint={isAllCases ? "Anomaly detection across all cases." : "Anomaly detection for the selected case."}>
      <CaseSelector />
      <EmptyState message={mode === 'this-case' && !selectedCaseId
        ? 'Select a case to view anomaly detection.'
        : 'Loading…'} />
    </Panel>
  )

  if (data.message) return (
    <Panel title="Suspicious Pattern Detection" hint={isAllCases ? "Anomaly detection across all cases." : "Anomaly detection for the selected case."}>
      <CaseSelector />
      <EmptyState message={data.message} />
    </Panel>
  )

  return (
    <>
      <Panel title="Financial Transaction Cycles" hint="Detected circular financial trails in the network.">
        <CaseSelector />
        {data.cycles.length === 0 ? (
          <EmptyState message="No circular financial trails detected in current data." icon="🔄" />
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

      <Panel title="Unusually High-Connectivity Individuals" hint="Individuals significantly above the network's average connectivity.">
        {data.high_connectivity.length === 0 ? (
          <EmptyState message="No individuals significantly above the network's average connectivity." icon="🔗" />
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
                  <div className="text-xs font-mono text-muted">{row.degree} connections (network average: {row.network_average})</div>
                </div>
              </AlertRow>
            ))}
          </motion.div>
        )}
      </Panel>

      <Panel title="Cluster-Bridging Individuals" hint="Individuals whose removal would split the network into separate clusters.">
        {data.cluster_count > 1 && data.bridges.length === 0 ? (
          <EmptyState
            message={`${data.cluster_count} separate clusters detected in the current graph — no critical bridge individuals within clusters.`}
            icon="🌐"
          />
        ) : data.cluster_count > 1 && data.bridges.length > 0 ? (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertRow key="info" type="warning">
              <span className="text-xs">{data.cluster_count} separate clusters — the following individuals bridge clusters or critical points:</span>
            </AlertRow>
            {data.bridges.map((name, i) => (
              <AlertRow key={name} type="danger">
                <span className="font-mono text-xs text-danger">Bridge #{i + 1}</span>
                <span>{name} — removing this node would split the network into separate clusters.</span>
              </AlertRow>
            ))}
          </motion.div>
        ) : data.cluster_count <= 1 && data.bridges.length === 0 ? (
          <EmptyState message="No critical bridge individuals identified." icon="🌐" />
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