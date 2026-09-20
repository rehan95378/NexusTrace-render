import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { api } from '../api'

const ENTITY_TYPES = [
  { key: 'people', label: 'Suspects', color: 'accent', icon: '👤' },
  { key: 'locations', label: 'Hotspots', color: 'teal', icon: '📍' },
  { key: 'vehicles', label: 'Vehicles', color: 'blue', icon: '🚗' },
  { key: 'phones', label: 'Devices', color: 'purple', icon: '📱' },
  { key: 'organizations', label: 'Organizations', color: 'green', icon: '🏢' },
]

// NOTE: hover classes are listed here as full, static literal strings
// (e.g. 'hover:bg-accent/20') rather than built at runtime with
// `hover:${...}`. Tailwind's JIT scanner only picks up class names that
// appear literally in source — a template-built `hover:${var}` never
// generates any CSS, which is why the previous version's chip hover effect
// silently did nothing.
const COLOR_CLASSES = {
  accent: {
    bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/30',
    hoverBg: 'hover:bg-accent/20', hoverBorder: 'hover:border-accent/50',
  },
  teal: {
    bg: 'bg-teal/10', text: 'text-teal', border: 'border-teal/30',
    hoverBg: 'hover:bg-teal/20', hoverBorder: 'hover:border-teal/50',
  },
  blue: {
    bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30',
    hoverBg: 'hover:bg-blue-500/20', hoverBorder: 'hover:border-blue-500/50',
  },
  purple: {
    bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30',
    hoverBg: 'hover:bg-purple-500/20', hoverBorder: 'hover:border-purple-500/50',
  },
  green: {
    bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30',
    hoverBg: 'hover:bg-green-500/20', hoverBorder: 'hover:border-green-500/50',
  },
}

const LAST_CASE_KEY = 'sih_last_entities_case_id'

export default function Entities({ refreshKey }) {
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
      } else if (list.length > 0) {
        setSelectedCaseId(list[0].id)
      }
    })
  }, [])

  // Re-fetch the case list (entity counts etc.) whenever something upstream
  // (ingestion, clear, graph edit) bumps refreshKey — previously this list
  // was only ever fetched once on mount, so counts went stale after any
  // ingest/clear until the tab was revisited.
  useEffect(() => {
    api.listCases().then(setCases).catch(() => {})
  }, [refreshKey])

  useEffect(() => {
    if (selectedCaseId) {
      localStorage.setItem(LAST_CASE_KEY, selectedCaseId)
    }
  }, [selectedCaseId])

  useEffect(() => {
    setData(null)
    setError(null)

    const fetchData = async () => {
      if (mode === 'all-cases') {
        try {
          const result = await api.allEntities()
          if (Array.isArray(result)) {
            setData(result)
          } else {
            console.error('Expected array but got:', result)
            setError('Invalid data format: expected array of entities')
          }
        } catch (e) {
          console.error('Failed to load all entities:', e)
          setError(`Failed to load entities: ${e.message}`)
        }
      } else if (selectedCaseId) {
        try {
          const result = await api.entities(selectedCaseId)
          setData(result)
        } catch (e) {
          console.error('Failed to load case entities:', e)
          setError(`Failed to load entities: ${e.message}`)
        }
      }
    }

    fetchData()
  }, [mode, selectedCaseId, refreshKey])

  const isAllCases = mode === 'all-cases'

  function typeColorClasses(entityType) {
    const match = ENTITY_TYPES.find((c) => c.key === entityType + 's')
    return COLOR_CLASSES[match?.color || 'accent']
  }

  const renderError = () => (
    <Panel title="Extracted Entity Profiles">
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg mb-4"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>
    </Panel>
  )

  const renderLoading = () => (
    <Panel title="Extracted Entity Profiles" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg mb-4"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-muted text-center py-8">{isAllCases ? 'Loading…' : 'Select a case to view its entity profiles.'}</p>
    </Panel>
  )

  const renderEmptyCase = () => (
    <Panel title="Extracted Entity Profiles" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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
        className="block w-full sm:w-[250px] px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg mb-4"
      >
        <option value="">Select a case…</option>
        <option value="__all__">All cases</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-muted text-center py-8">This case is empty. Run extraction on the Ingestion tab first.</p>
    </Panel>
  )

  if (error) return renderError()
  if (!data) return renderLoading()
  if (mode === 'this-case' && !data.is_processed) return renderEmptyCase()

  return (
    <Panel title="Extracted Entity Profiles" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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

      {isAllCases ? (
        <motion.div
          className="overflow-x-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {!Array.isArray(data) ? (
            <p className="text-danger text-center py-8">Error: Invalid data format (expected array)</p>
          ) : data.length === 0 ? (
            <p className="text-muted text-center py-8">No entities extracted yet across any cases. Run ingestion first.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted font-normal border-b border-border">
                  <th className="pb-3 font-medium text-text">Type</th>
                  <th className="pb-3 font-medium text-text">Value</th>
                  <th className="pb-3 font-medium text-text">Case</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entity, idx) => {
                  const c = typeColorClasses(entity.type)
                  return (
                    <motion.tr
                      key={`${entity.case_id}-${entity.type}-${entity.value}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-border/50 hover:bg-panel-raised/50 transition-colors"
                    >
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium ${c.bg} ${c.text} ${c.border}`}>
                          {entity.type}
                        </span>
                      </td>
                      <td className="py-3 text-text">{entity.value}</td>
                      <td className="py-3 text-muted font-mono">{entity.case_name || entity.case_id}</td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {ENTITY_TYPES.map((type, typeIndex) => (
            <motion.div
              key={type.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: typeIndex * 0.08 }}
            >
              <div className="bg-panel-raised/50 border border-border/50 rounded-lg p-4 h-full">
                <div className="flex items-center gap-2 text-sm font-medium text-muted mb-3">
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-text">{type.label}</span>
                  <span className="ml-auto px-2 py-0.5 bg-bg rounded text-xs font-mono text-muted">
                    {data[type.key]?.length || 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[80px]">
                  {(!data[type.key] || data[type.key].length === 0) && (
                    <span className="text-xs text-muted/60 italic w-full">None yet</span>
                  )}
                  {data[type.key]?.map((item, itemIndex) => (
                    <motion.span
                      key={item}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: itemIndex * 0.03 }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${COLOR_CLASSES[type.color].bg} ${COLOR_CLASSES[type.color].text} ${COLOR_CLASSES[type.color].border} ${COLOR_CLASSES[type.color].hoverBg} ${COLOR_CLASSES[type.color].hoverBorder} transition-colors cursor-default`}
                    >
                      {item}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </Panel>
  )
}
