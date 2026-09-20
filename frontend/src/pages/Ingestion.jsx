import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_ingestion_case_id'

export default function Ingestion({ onIngested }) {
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [firText, setFirText] = useState('')
  const [cdrText, setCdrText] = useState('')
  const [appendMode, setAppendMode] = useState(false)
  const [status, setStatus] = useState(null) // { kind: 'success'|'error'|'busy', message }

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

  async function runIngestion() {
    if (!selectedCaseId) {
      setStatus({ kind: 'error', message: 'Select a case before running extraction.' })
      return
    }
    if (!firText.trim() && !cdrText.trim()) {
      setStatus({ kind: 'error', message: 'Add an FIR report or CDR log before running extraction.' })
      return
    }
    setStatus({ kind: 'busy', message: 'Extracting entities and mapping relationships…' })
    try {
      const result = await api.ingest(selectedCaseId, firText, cdrText, appendMode)
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error })
        return
      }
      const parts = [
        `${result.people.length} people`,
        `${result.locations.length} locations`,
        `${result.vehicles.length} vehicles`,
        `${result.phones.length} phones`,
        `${result.organizations.length} organizations`,
      ]
      let msg = `Extraction complete — case graph now has ${parts.join(', ')}.`
      if (result.tabular_cdr_detected) {
        msg += ` Tabular CDR format detected — ${result.tabular_numbers_parsed} numbers parsed directly.`
      }
      setStatus({ kind: 'success', message: msg })
      onIngested?.()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message })
    }
  }

  async function clearCase() {
    if (!selectedCaseId) {
      setStatus({ kind: 'error', message: 'Select a case first.' })
      return
    }
    setStatus({ kind: 'busy', message: 'Clearing case graph and audit log…' })
    try {
      await api.clearCase(selectedCaseId)
      setStatus({ kind: 'success', message: 'Case cleared. Ready for a fresh ingestion.' })
      onIngested?.()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message })
    }
  }

  return (
    <div className="p-5 md:p-6">
      <Panel
        title="Add Evidence"
        hint="Upload FIR reports and call/transaction records — entities and relationships are extracted and added to the case graph automatically."
      >
        <div className="mb-4">
          <label htmlFor="case-select" className="block text-sm font-medium text-muted mb-2 dark:text-dark-muted">
            Case
          </label>
          <select
            id="case-select"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="block w-full px-3 py-2 bg-panel border border-border-light rounded-md text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
          >
            <option value="">Select a case…</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.entity_count} entities)
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div>
            <label htmlFor="fir" className="block text-sm font-medium text-muted mb-2 dark:text-dark-muted">
              FIR / Field Report
            </label>
            <textarea
              id="fir"
              rows={4}
              className="block w-full px-3 py-2 bg-panel border border-border-light rounded-md text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg h-[120px] resize-none dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
              placeholder="Paste FIR or field report text…"
              value={firText}
              onChange={(e) => setFirText(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cdr" className="block text-sm font-medium text-muted mb-2 dark:text-dark-muted">
              Call Records / Transaction Log
            </label>
            <textarea
              id="cdr"
              rows={4}
              className="block w-full px-3 py-2 bg-panel border border-border-light rounded-md text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg h-[120px] resize-none dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
              placeholder="Paste CDR, call log, or ledger text…"
              value={cdrText}
              onChange={(e) => setCdrText(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted mb-4 dark:text-dark-muted">
          <input
            type="checkbox"
            checked={appendMode}
            onChange={(e) => setAppendMode(e.target.checked)}
            className="h-4 w-4 text-accent bg-panel border border-border-light rounded focus:ring-accent dark:bg-dark-panel dark:border-dark-border dark:text-dark-accent dark:focus:ring-dark-accent"
          />
          Add to this case's existing graph, instead of replacing it
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={runIngestion}
            disabled={status?.kind === 'busy'}
            className="flex-1 px-4 py-2 bg-accent text-white font-semibold rounded-md hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg text-sm dark:bg-dark-accent dark:text-dark-text dark:hover:bg-dark-accent/90 dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
          >
            Run extraction
          </button>
          <button
            onClick={clearCase}
            disabled={status?.kind === 'busy'}
            className="flex-1 px-4 py-2 border border-danger text-danger rounded-md hover:bg-danger-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-bg text-sm dark:border-dark-danger dark:text-dark-danger dark:hover:bg-dark-danger/20 dark:focus:ring-dark-danger dark:focus:ring-offset-dark-bg"
          >
            Clear this case
          </button>
        </div>

        {status && (
          <motion.div
            className={`mt-4 px-4 py-3 rounded-md text-sm ${status.kind === 'error' ? 'bg-danger-dim text-danger border border-danger dark:bg-dark-danger/20 dark:text-dark-danger dark:border-dark-danger' : 'bg-success-dim text-success border border-success dark:bg-dark-teal/20 dark:text-dark-teal dark:border-dark-teal'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {status.message}
          </motion.div>
        )}
      </Panel>
    </div>
  )
}
