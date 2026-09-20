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
    <div className="space-y-6">
      <Panel
        title="Case Management"
        hint="Create new cases or manage existing ones."
      >
        {error && (
          <motion.div
            className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm"
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
            placeholder="New case name, e.g. Case 01 — Nagpur Extortion Ring"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 w-full sm:flex-1 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg px-4 py-2.5 text-light-text dark:text-text placeholder:text-light-muted dark:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
            required
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-5 py-2.5 bg-accent text-[#14100a] font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
          >
            {creating ? 'Creating…' : 'New Case'}
          </button>
        </form>

        {!cases && !error && (
          <p className="text-light-muted dark:text-muted text-center py-8">Loading cases…</p>
        )}
        {cases && cases.length === 0 && (
          <motion.p
            className="text-light-muted dark:text-muted text-center py-8"
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
                <tr className="text-left text-light-muted dark:text-muted font-normal border-b border-light-border dark:border-border">
                  <th className="pb-3 font-medium text-light-text dark:text-text">Case Name</th>
                  <th className="pb-3 font-medium text-light-text dark:text-text">Entities</th>
                  <th className="pb-3 font-medium text-light-text dark:text-text">Created</th>
                  <th className="pb-3 font-medium text-light-text dark:text-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, index) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-light-border dark:border-border/50 hover:bg-light-panel-raised dark:bg-light-panel dark:bg-panel-raised/50 transition-colors"
                  >
                    <td className="py-4 font-medium text-light-text dark:text-text">{c.name}</td>
                    <td className="py-4 text-light-muted dark:text-muted">
                      {c.entity_count} {c.entity_count === 1 ? 'entity' : 'entities'}
                    </td>
                    <td className="py-4 text-light-muted dark:text-muted font-mono">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          className="flex-1 px-3 py-1.5 bg-accent text-[#14100a] font-semibold rounded-lg hover:bg-accent/90 transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
                          onClick={onNavigateToIngestion}
                        >
                          Open in Ingestion
                        </button>
                        <button
                          className="flex-1 px-3 py-1.5 border border-danger text-danger rounded-lg hover:bg-danger/10 transition-colors duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg"
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