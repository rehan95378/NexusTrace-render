import { useState } from 'react'
import Panel from '../components/Panel'
import { api } from '../api'

export default function Ingestion({ caseId, onIngested }) {
  const [firText, setFirText] = useState('')
  const [cdrText, setCdrText] = useState('')
  const [appendMode, setAppendMode] = useState(false)
  const [status, setStatus] = useState(null) // { kind: 'success'|'error'|'busy', message }

  async function runIngestion() {
    if (!firText.trim() && !cdrText.trim()) {
      setStatus({ kind: 'error', message: 'Paste at least one FIR or CDR text block first.' })
      return
    }
    setStatus({ kind: 'busy', message: 'Processing cross-channel inputs…' })
    try {
      const result = await api.ingest(caseId, firText, cdrText, appendMode)
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
      let msg = `Fused. Case graph now holds ${parts.join(', ')}.`
      if (result.tabular_cdr_detected) {
        msg += ` Detected tabular CDR format — parsed ${result.tabular_numbers_parsed} numbers directly.`
      }
      setStatus({ kind: 'success', message: msg })
      onIngested?.()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message })
    }
  }

  async function clearCase() {
    setStatus({ kind: 'busy', message: 'Wiping this case\u2019s graph and audit log…' })
    try {
      await api.clearCase(caseId)
      setStatus({ kind: 'success', message: 'This case\u2019s graph and audit log are wiped clean.' })
      onIngested?.()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message })
    }
  }

  return (
    <>
      <Panel
        title="Multi-Channel Ingestion"
        hint="Paste any combination of text blocks from your reference dossiers below to trigger network mapping for this case."
      >
        <div className="grid cols-2">
          <div>
            <label htmlFor="fir">Raw FIR / Intelligence Field Report</label>
            <textarea
              id="fir"
              rows={12}
              placeholder="Paste FIR / field report text…"
              value={firText}
              onChange={(e) => setFirText(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cdr">Call Log / CDR / Ledger Summary</label>
            <textarea
              id="cdr"
              rows={12}
              placeholder="Paste CDR / call log / ledger text…"
              value={cdrText}
              onChange={(e) => setCdrText(e.target.value)}
            />
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={appendMode}
            onChange={(e) => setAppendMode(e.target.checked)}
          />
          Append new report to this case's existing graph (live-update)
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="primary" onClick={runIngestion} disabled={status?.kind === 'busy'}>
            Run extraction
          </button>
          <button className="danger" onClick={clearCase} disabled={status?.kind === 'busy'}>
            Clear this case
          </button>
        </div>

        {status && (
          <div style={{ marginTop: 16 }}>
            {status.kind === 'error' && <div className="alert-row">{status.message}</div>}
            {status.kind !== 'error' && <div className="info-row">{status.message}</div>}
          </div>
        )}
      </Panel>
    </>
  )
}
