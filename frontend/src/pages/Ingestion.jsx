import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { useListCases, useIngest, useClearCase } from '../hooks/useQueries'

const LAST_CASE_KEY = 'sih_last_ingestion_case_id'

export default function Ingestion({ onIngested }) {
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [files, setFiles] = useState([])
  const [appendMode, setAppendMode] = useState(false)
  const [status, setStatus] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragActive(false) }
  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles((prev) => {
      const newFiles = [...prev]
      dropped.forEach((f) => {
        if (!newFiles.find((p) => p.name === f.name && p.size === f.size)) newFiles.push(f)
      })
      return newFiles
    })
  }

  const { data: cases = [] } = useListCases()
  const ingestMutation = useIngest()
  const clearMutation = useClearCase()

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files)
    // Allow one at a time (user can add more sequentially)
    setFiles((prev) => {
      const newFiles = [...prev]
      selected.forEach((f) => {
        if (!newFiles.find((p) => p.name === f.name && p.size === f.size)) {
          newFiles.push(f)
        }
      })
      return newFiles
    })
  }

  const removeFile = (name) => {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  async function runIngestion() {
    if (!selectedCaseId) {
      setStatus({ kind: 'error', message: 'Select a case before uploading files.' })
      return
    }
    if (files.length === 0) {
      setStatus({ kind: 'error', message: 'Upload at least one file.' })
      return
    }
    setStatus({ kind: 'busy', message: 'Processing files — extracting entities and mapping relationships…' })
    try {
      const result = await ingestMutation.mutateAsync({ caseId: selectedCaseId, files, appendMode })
      setStatus({
        kind: 'success',
        message: `Done — extracted entities, relationships, and wrote to graph.`
      })
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onIngested?.()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message || 'Upload failed' })
    }
  }

  async function clearCase() {
    if (!selectedCaseId) {
      setStatus({ kind: 'error', message: 'Select a case first.' })
      return
    }
    setStatus({ kind: 'busy', message: 'Clearing case graph and audit log…' })
    try {
      await clearMutation.mutateAsync(selectedCaseId)
      setStatus({ kind: 'success', message: 'Case cleared. Ready for a fresh ingestion.' })
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onIngested?.()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message || 'Clear failed' })
    }
  }

  return (
    <>
      <Panel title="" hint="Upload files — PDF/TXT reports, CDR spreadsheets (Excel/CSV), or financial records (Excel/CSV).">
        <div className="mb-4">
          <label htmlFor="case-select" className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Case</label>
          <select id="case-select" value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}
            className="block w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg">
            <option value="">Select a case…</option>
            {cases.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.entity_count} entities)</option>))}
          </select>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl px-6 py-8 text-center hover:border-accent dark:hover:border-accent transition-colors ${dragActive ? 'border-accent bg-accent/5' : 'border-light-border dark:border-border'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}>
          <input type="file" ref={fileInputRef} multiple onChange={handleFileChange}
            accept=".pdf,.txt,.text,.csv,.xlsx,.xls,.tsv"
            className="hidden" id="file-upload-input" />
          <label htmlFor="file-upload-input" className="cursor-pointer block">
            <div className="text-3xl mb-2">📁</div>
            <div className="text-sm font-medium text-light-text dark:text-text">Click to upload files</div>
            <div className="text-xs text-light-muted dark:text-muted mt-1">
            </div>
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f) => (
              <div key={f.name} className="flex items-center gap-2 px-3 py-2 bg-light-bg dark:bg-bg rounded-lg border border-light-border dark:border-border text-sm">
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-xs text-light-muted dark:text-muted">{(f.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => removeFile(f.name)} className="text-danger hover:text-danger/70 text-xs">✕</button>
              </div>
            ))}
            <div className="text-xs text-light-muted dark:text-muted">Upload one file at a time — add more sequentially</div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-light-muted dark:text-muted mt-4">
          <input type="checkbox" checked={appendMode} onChange={(e) => setAppendMode(e.target.checked)}
            className="h-4 w-4 text-accent bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded focus:ring-accent" />
          Add to this case's existing graph instead of replacing it
        </label>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button onClick={runIngestion} disabled={status?.kind === 'busy' || files.length === 0}
            className="flex-1 px-4 py-2 bg-accent text-[#14100a] font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm">
            Process files
          </button>
          <button onClick={clearCase} disabled={status?.kind === 'busy'}
            className="flex-1 px-4 py-2 border border-danger text-danger rounded-lg hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm">
            Clear this case
          </button>
        </div>

        {status && (
          <motion.div className={`mt-4 px-4 py-2 rounded-lg text-sm ${status.kind === 'error' ? 'bg-danger/10 text-danger border border-danger/30' : 'bg-teal/10 text-teal border border-teal/30'}`}
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {status.message}
          </motion.div>
        )}
      </Panel>
    </>
  )
}
