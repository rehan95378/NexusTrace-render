import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_keyplayers_case_id'

export default function KeyPlayers({ refreshKey }) {
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
      api.keyPlayersAll().then(setData).catch((e) => setError(e.message))
    } else if (selectedCaseId) {
      api.keyPlayers(selectedCaseId).then(setData).catch((e) => setError(e.message))
    }
  }, [mode, selectedCaseId, refreshKey])

  const isAllCases = mode === 'all-cases'

  const renderError = () => (
    <Panel title="Network Centrality">
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-panel border border-border-light rounded-md text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg mb-4 dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="p-3 bg-danger-dim border border-danger rounded-md text-danger text-sm dark:bg-dark-danger/20 dark:border-dark-danger dark:text-dark-danger">{error}</div>
    </Panel>
  )

  const renderLoading = () => (
    <Panel title="" hint={isAllCases ? "PageRank and betweenness across all cases — surfaces cross-case bridges." : "Computed via PageRank and betweenness centrality on the selected case's graph."}>
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-panel border border-border-light rounded-md text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg mb-4 dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-muted text-center py-8 dark:text-dark-muted">{mode === 'this-case' && !selectedCaseId
        ? 'Select a case to view network centrality analysis.'
        : 'Loading…'}
      </p>
    </Panel>
  )

  const renderNoData = () => (
    <Panel title="" hint={isAllCases ? "PageRank and betweenness across all cases — surfaces cross-case bridges." : "Computed via PageRank and betweenness centrality on the selected case's graph."}>
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-panel border border-border-light rounded-md text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg mb-4 dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {data && data.message ? (
        <p className="text-muted text-center py-8 dark:text-dark-muted">{data.message}</p>
      ) : (
        <p className="text-muted text-center py-8 dark:text-dark-muted">No key players detected.</p>
      )}
    </Panel>
  )

  if (error) return renderError()
  if (!data) return renderLoading()
  if (data && data.message && !data.ranked) return renderNoData()

  return (
    <Panel title="" hint={isAllCases ? "PageRank and betweenness across all cases — surfaces cross-case bridges." : "Computed via PageRank and betweenness centrality on the selected case's graph."}>
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

      {data && data.ranked && data.ranked.length > 0 ? (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {data.ranked.map((row, index) => (
            <motion.div
              key={row.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between px-4 py-3 bg-panel-raised/50 border border-border-light rounded-md hover:bg-panel-raised/70 transition-colors dark:bg-dark-panel-raised/50 dark:border-dark-border dark:hover:bg-dark-panel-raised/70"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-text dark:text-dark-text">
                <span className="text-muted/60 font-mono dark:text-dark-muted/60">#{index + 1}</span>
                <span className="font-semibold">{row.name}</span>
              </span>
              <span className="text-xs font-mono flex items-center gap-2 text-muted dark:text-dark-muted">
                <span>PR {row.pagerank.toFixed(3)}</span>
                <span>·</span>
                <span>BW {row.betweenness.toFixed(3)}</span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <p className="text-muted text-center py-8 dark:text-dark-muted">No key players detected.</p>
      )}
    </Panel>
  )
}