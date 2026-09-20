import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { useListCases, useKeyPlayers } from '../hooks/useQueries'

const LAST_CASE_KEY = 'sih_last_keyplayers_case_id'

export default function KeyPlayers({ refreshKey }) {
  const [mode, setMode] = useState('this-case')
  const [selectedCaseId, setSelectedCaseId] = useState('')

  // React Query hooks
  const { data: cases = [] } = useListCases()
  const { data, isLoading, error } = useKeyPlayers(selectedCaseId)

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

  const renderError = () => (
    <Panel title="Key Player Identification">
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg mb-4"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error?.message}</div>
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg mb-4"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-light-muted dark:text-muted text-center py-8">{mode === 'this-case' && !selectedCaseId
        ? 'Select a case to view key player analysis.'
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg mb-4"
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
        <p className="text-light-muted dark:text-muted text-center py-8">{data.message}</p>
      ) : (
        <p className="text-light-muted dark:text-muted text-center py-8">No key players detected.</p>
      )}
    </Panel>
  )

  if (error) return renderError()
  if (isLoading || !data) return renderLoading()
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

      {data && data.ranked && data.ranked.length > 0 ? (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {data.ranked.map((row, index) => (
            <motion.div
              key={row.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between px-4 py-3 bg-light-panel-raised dark:bg-light-panel dark:bg-panel-raised/50 border border-light-border dark:border-border/50 rounded-lg hover:bg-light-panel-raised dark:bg-light-panel dark:bg-panel-raised/70 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-light-text dark:text-text">
                <span className="text-light-muted dark:text-muted/60">#{index + 1}</span>
                <span className="font-semibold">{row.name}</span>
              </span>
              <span className="text-xs font-mono flex items-center gap-2 text-light-muted dark:text-muted">
                <span>PageRank {row.pagerank.toFixed(4)}</span>
                <span>·</span>
                <span>Betweenness {row.betweenness.toFixed(4)}</span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <p className="text-light-muted dark:text-muted text-center py-8">No key players detected.</p>
      )}
    </Panel>
  )
}