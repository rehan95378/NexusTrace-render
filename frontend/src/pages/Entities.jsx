import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { useListCases, useEntities, useAllEntities } from '../hooks/useQueries'
import { SkeletonTable, SkeletonGrid } from '../components/LoadingSkeleton'

// Minimal inline line icons (currentColor, no external icon library) —
// replaces the previous emoji icons (👤📍🚗📱🏢), which read as a generic
// "AI-generated dashboard" pattern rather than a deliberately designed one.
function PersonIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <circle cx="8" cy="5" r="2.6" />
      <path d="M2.5 13.5c0-2.7 2.5-4.5 5.5-4.5s5.5 1.8 5.5 4.5" strokeLinecap="round" />
    </svg>
  )
}
function PinIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M8 14.5S13 9.9 13 6.3A5 5 0 003 6.3C3 9.9 8 14.5 8 14.5z" strokeLinejoin="round" />
      <circle cx="8" cy="6.3" r="1.7" />
    </svg>
  )
}
function CarIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M2.5 10V8.2l1.4-3.1a1 1 0 01.9-.6h6.4a1 1 0 01.9.6L13.5 8.2V10" strokeLinejoin="round" />
      <rect x="2" y="10" width="12" height="2.6" rx="0.6" />
      <circle cx="4.6" cy="12.6" r="1" />
      <circle cx="11.4" cy="12.6" r="1" />
    </svg>
  )
}
function PhoneIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <rect x="4.5" y="1.5" width="7" height="13" rx="1.3" />
      <path d="M7 12.3h2" strokeLinecap="round" />
    </svg>
  )
}
function BuildingIcon(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <rect x="2.5" y="3" width="7" height="11" />
      <rect x="10.2" y="6.5" width="3.3" height="7.5" />
      <path d="M4.3 5.2h1M4.3 7.6h1M4.3 10h1M6.7 5.2h1M6.7 7.6h1M6.7 10h1" strokeLinecap="round" />
    </svg>
  )
}

const ENTITY_TYPES = [
  { key: 'people', label: 'Suspects', color: 'accent', Icon: PersonIcon },
  { key: 'locations', label: 'Hotspots', color: 'teal', Icon: PinIcon },
  { key: 'vehicles', label: 'Vehicles', color: 'blue', Icon: CarIcon },
  { key: 'phones', label: 'Devices', color: 'purple', Icon: PhoneIcon },
  { key: 'organizations', label: 'Organizations', color: 'green', Icon: BuildingIcon },
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
  const [selectedCaseId, setSelectedCaseId] = useState('')

  // React Query hooks
  const { data: cases = [] } = useListCases()
  const { data: caseEntities, isLoading: isCaseLoading, error: caseError } = useEntities(selectedCaseId)
  const { data: allCasesEntities, isLoading: isAllLoading, error: allError } = useAllEntities()

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

  const isLoading = mode === 'all-cases' ? isAllLoading : isCaseLoading
  const error = mode === 'all-cases' ? allError : caseError
  const data = mode === 'all-cases' ? allCasesEntities : caseEntities

  const isAllCases = mode === 'all-cases'

  function typeColorClasses(entityType) {
    const match = ENTITY_TYPES.find((c) => c.key === entityType + 's')
    return COLOR_CLASSES[match?.color || 'accent']
  }

  const renderError = () => (
    <Panel title="">
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
    <Panel title="" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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
      {isAllCases ? <SkeletonTable rows={5} /> : <SkeletonGrid cols={5} rows={1} />}
    </Panel>
  )

  const renderEmptyCase = () => (
    <Panel title="" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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
      <p className="text-light-muted dark:text-muted text-center py-8">This case is empty. Run extraction on the Ingestion tab first.</p>
    </Panel>
  )

  if (error) return renderError()
  if (isLoading || !data) return renderLoading()
  if (mode === 'this-case' && data && !data.is_processed) return renderEmptyCase()

  return (
    <Panel title="" hint={isAllCases ? "Entities across all cases." : "Entities in the selected case's graph."}>
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

      {isAllCases ? (
        <motion.div
          className="overflow-x-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {!Array.isArray(data) ? (
            <p className="text-danger text-center py-8">Error: Invalid data format (expected array)</p>
          ) : data.length === 0 ? (
            <p className="text-light-muted dark:text-muted text-center py-8">No entities extracted yet across any cases. Run ingestion first.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-light-muted dark:text-muted font-normal border-b border-light-border dark:border-border">
                  <th className="pb-3 font-medium text-light-text dark:text-text">Type</th>
                  <th className="pb-3 font-medium text-light-text dark:text-text">Value</th>
                  <th className="pb-3 font-medium text-light-text dark:text-text">Case</th>
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
                      className="border-b border-light-border dark:border-border/50 hover:bg-light-panel-raised dark:bg-light-panel dark:bg-panel-raised/50 transition-colors"
                    >
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium ${c.bg} ${c.text} ${c.border}`}>
                          {entity.type}
                        </span>
                      </td>
                      <td className="py-3 text-light-text dark:text-text">{entity.value}</td>
                      <td className="py-3 text-light-muted dark:text-muted font-mono">{entity.case_name || entity.case_id}</td>
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
              <div className="bg-light-panel-raised dark:bg-light-panel dark:bg-panel-raised/50 border border-light-border dark:border-border/50 rounded-lg p-4 h-full">
                <div className="flex items-center gap-2 text-sm font-medium text-light-muted dark:text-muted mb-3">
                  <type.Icon className={`w-4 h-4 ${COLOR_CLASSES[type.color].text}`} />
                  <span className="text-light-text dark:text-text">{type.label}</span>
                  <span className="ml-auto px-2 py-0.5 bg-light-bg dark:bg-bg rounded text-xs font-mono text-light-muted dark:text-muted">
                    {data[type.key]?.length || 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[80px]">
                  {(!data[type.key] || data[type.key].length === 0) && (
                    <span className="text-xs text-light-muted dark:text-muted/60 italic w-full">No records extracted for this case yet.</span>
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
