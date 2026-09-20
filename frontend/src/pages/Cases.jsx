import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

/**
 * Cases tab — case management (list, create, delete).
 * No longer a blocking gate; just a regular tab reachable any time.
 */
export default function Cases({ onNavigateToIngestion }) {
  const [cases, setCases] = useState(null)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  function loadCases() {
    api.listCases().then(setCases).catch((e) => setError(e.message))
  }

  useEffect(loadCases, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.createCase(newName.trim())
      setNewName('')
      loadCases()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(caseId, caseName) {
    if (!window.confirm(`Permanently delete "${caseName}" and everything in it?`)) return
    try {
      await api.deleteCase(caseId)
      loadCases()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6 p-5 md:p-6">
      <Panel
        title="Create Case"
        hint="Start a new investigation or manage existing cases."
      >
        {error && (
          <motion.div
            className="mb-4 p-3 bg-danger-dim border border-danger rounded-md text-danger text-sm dark:bg-dark-danger/20 dark:border-dark-danger"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        <form
          className="flex flex-col sm:flex-row gap-3 mb-6"
          onSubmit={handleCreate}
        >
          <input
            type="text"
            placeholder="e.g. FIR 402/2026 — Cyber Stalking Ring"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 w-full sm:flex-1 bg-panel border border-border-light rounded-md px-4 py-2.5 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg transition-all duration-200 dark:bg-dark-panel dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-muted dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
            required
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-5 py-2.5 bg-accent text-white font-semibold rounded-md hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg dark:bg-dark-accent dark:text-dark-text dark:hover:bg-dark-accent/90 dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
          >
            {creating ? 'Creating…' : 'New Case'}
          </button>
        </form>

        {!cases && !error && (
          <p className="text-muted text-center py-8 dark:text-dark-muted">Loading cases…</p>
        )}
        {cases && cases.length === 0 && (
          <motion.p
            className="text-muted text-center py-8 dark:text-dark-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            No cases yet — create one above to get started.
          </motion.p>
        )}

        {cases && cases.length > 0 && (
          <motion.div
            className="overflow-x-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted font-semibold border-b border-border-light bg-panel-raised dark:text-dark-muted dark:border-dark-border dark:bg-dark-panel-raised">
                  <th className="py-3 px-4 font-semibold text-text dark:text-dark-text">Case Name</th>
                  <th className="py-3 px-4 font-semibold text-text dark:text-dark-text">Entities</th>
                  <th className="py-3 px-4 font-semibold text-text dark:text-dark-text">Created</th>
                  <th className="py-3 px-4 font-semibold text-text dark:text-dark-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, index) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border-light hover:bg-panel-raised/50 transition-colors dark:border-dark-border dark:hover:bg-dark-panel-raised/50"
                  >
                    <td className="py-3 px-4 font-medium text-text dark:text-dark-text">{c.name}</td>
                    <td className="py-3 px-4 text-muted font-mono dark:text-dark-muted">
                      {c.entity_count}
                    </td>
                    <td className="py-3 px-4 text-muted font-mono dark:text-dark-muted">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          className="px-3 py-1.5 bg-accent text-white font-medium rounded-md hover:bg-accent/90 transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg dark:bg-dark-accent dark:text-dark-text dark:hover:bg-dark-accent/90 dark:focus:ring-dark-accent dark:focus:ring-offset-dark-bg"
                          onClick={onNavigateToIngestion}
                        >
                          Open
                        </button>
                        <button
                          className="px-3 py-1.5 border border-danger text-danger rounded-md hover:bg-danger-dim transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-bg dark:border-dark-danger dark:text-dark-danger dark:hover:bg-dark-danger/20 dark:focus:ring-dark-danger dark:focus:ring-offset-dark-bg"
                          onClick={() => handleDelete(c.id, c.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </Panel>
    </div>
  )
}