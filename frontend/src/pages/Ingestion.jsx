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
    <>
      <Panel
        title=""
        hint="Add FIR reports and call/transaction records for a case — entities and relationships are extracted and added to the case graph automatically."
      >
        <div className="mb-4">
          <label htmlFor="case-select" className="block text-sm font-medium text-light-muted dark:text-muted mb-1">
            Case
          </label>
          <select
            id="case-select"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="block w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
          >
            <option value="">Select a case…</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.entity_count} entities)
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="fir" className="block text-sm font-medium text-light-muted dark:text-muted mb-1">
              FIR / Field Report
            </label>
            <textarea
              id="fir"
              rows={4}
              className="block w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg h-[120px] resize-none"
              placeholder="Paste FIR or field report text…"
              value={firText}
              onChange={(e) => setFirText(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cdr" className="block text-sm font-medium text-light-muted dark:text-muted mb-1">
              Call Records / Transaction Log
            </label>
            <textarea
              id="cdr"
              rows={4}
              className="block w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg h-[120px] resize-none"
              placeholder="Paste CDR, call log, or ledger text…"
              value={cdrText}
              onChange={(e) => setCdrText(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-light-muted dark:text-muted">
          <input
            type="checkbox"
            checked={appendMode}
            onChange={(e) => setAppendMode(e.target.checked)}
            className="h-4 w-4 text-accent bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded focus:ring-accent"
          />
          Add to this case's existing graph, instead of replacing it
        </label>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={runIngestion}
            disabled={status?.kind === 'busy'}
            className="flex-1 px-4 py-2 bg-accent text-[#14100a] font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg text-sm"
          >
            Run extraction
          </button>
          <button
            onClick={clearCase}
            disabled={status?.kind === 'busy'}
            className="flex-1 px-4 py-2 border border-danger text-danger rounded-lg hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg text-sm"
          >
            Clear this case
          </button>
        </div>

        {status && (
          <motion.div
            className={`mt-4 px-4 py-2 rounded-lg text-sm ${status.kind === 'error' ? 'bg-danger/10 text-danger border border-danger/30' : 'bg-teal/10 text-teal border border-teal/30'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {status.message}
          </motion.div>
        )}
      </Panel>
    </>
  )
}
