import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { motion } from 'framer-motion'

const NODE_TYPES = [
  { key: 'people', type: 'Person', label: 'Person' },
  { key: 'locations', type: 'Location', label: 'Location' },
  { key: 'vehicles', type: 'Vehicle', label: 'Vehicle' },
  { key: 'phones', type: 'Phone', label: 'Phone' },
  { key: 'organizations', type: 'Organization', label: 'Organization' },
]

const TABS = [
  { key: 'create-node', label: 'Create node' },
  { key: 'create-rel', label: 'Create relationship' },
  { key: 'change-type', label: 'Change type' },
  { key: 'rename-node', label: 'Rename node' },
  { key: 'rename-rel', label: 'Rename relationship' },
  { key: 'merge', label: 'Merge nodes' },
  { key: 'delete-node', label: 'Delete node' },
  { key: 'delete-rel', label: 'Delete relationship' },
]

function splitKey(key) {
  const sep = key.indexOf(':')
  return [key.slice(0, sep), key.slice(sep + 1)]
}

/**
 * The single entry point for every graph-editing action: create/rename/
 * delete/merge nodes, and create/rename/delete relationships (freely
 * named). Opened via the "Edit graph" button on the Evidence Graph Map.
 * In all-cases mode, allows creating relationships between nodes in different
 * cases (cross-case manual linking).
 */
export default function GraphEditPanel({ caseId, allCasesMode, onClose, onChanged }) {
  const [tab, setTab] = useState('create-node')
  const [entities, setEntities] = useState(null)
  const [edges, setEdges] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [status, setStatus] = useState(null)

  function refreshLists() {
    if (allCasesMode) {
      api.allEntities().then(setEntities).catch(() => {})
      api.allGraph().then((g) => setEdges(g.edges)).catch(() => {})
    } else {
      api.entities(caseId).then(setEntities).catch(() => {})
      api.graph(caseId).then((g) => setEdges(g.edges)).catch(() => {})
    }
  }

  useEffect(() => {
    refreshLists()
    api.relationshipTypeSuggestions().then((r) => setSuggestions(r.suggestions)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, allCasesMode])

  const nodeOptions = useMemo(() => {
    if (!entities) return []

    if (allCasesMode) {
      // All-cases mode: entities array has { type, value, case_id, case_name }
      // type is lowercase (e.g., "person", "phone") so capitalize it
      const typeMap = {
        'person': 'Person',
        'location': 'Location',
        'vehicle': 'Vehicle',
        'phone': 'Phone',
        'organization': 'Organization'
      }

      // Defensive: ensure entities is an array
      if (!Array.isArray(entities)) {
        console.error('Expected entities to be an array in all-cases mode, got:', entities)
        return []
      }

      return entities.map((e) => {
        // Defensive: ensure entity has required fields
        if (!e || !e.type || !e.value || !e.case_id) {
          console.warn('Skipping invalid entity:', e)
          return null
        }

        return {
          type: typeMap[e.type] || e.type.charAt(0).toUpperCase() + e.type.slice(1),
          id: e.value,
          caseId: e.case_id,
          label: `${typeMap[e.type] || e.type}: ${e.value} [${e.case_name || e.case_id}]`
        }
      }).filter(Boolean) // Remove any null entries
    } else {
      // Single-case mode: entities object has { people: [], phones: [], ... }
      const out = []
      for (const nt of NODE_TYPES) {
        for (const value of entities[nt.key] || []) {
          out.push({ type: nt.type, id: value, caseId, label: `${nt.label}: ${value}` })
        }
      }
      return out
    }
  }, [entities, allCasesMode, caseId])

  const edgeOptions = useMemo(() => {
    if (!edges) return []

    // Defensive: ensure edges is an array
    if (!Array.isArray(edges)) {
      console.error('Expected edges to be an array, got:', edges)
      return []
    }

    return edges.map((e, index) => {
      // Defensive: ensure edge has required fields
      if (!e || !e.source || !e.target || !e.label) {
        console.warn('Skipping invalid edge:', e)
        return null
      }

      let sType, sId, tType, tId, sCaseId, tCaseId

      try {
        if (allCasesMode) {
          // All-cases format: "case_id:Type:id"
          const sParts = e.source.split(':')
          const tParts = e.target.split(':')
          sCaseId = sParts[0]
          sType = sParts[1]
          sId = sParts.slice(2).join(':')
          tCaseId = tParts[0]
          tType = tParts[1]
          tId = tParts.slice(2).join(':')

          // Skip edges with invalid case IDs (e.g., "None" or empty)
          if (!sCaseId || sCaseId === 'None' || sCaseId === 'null' ||
              !tCaseId || tCaseId === 'None' || tCaseId === 'null') {
            console.warn('Skipping edge with invalid case_id:', e)
            return null
          }
        } else {
          // Single-case format:
          // - Same case: "Type:id"
          // - Cross-case source: "case_id:Type:id" (incoming from another case)
          // - Cross-case target: "case_id:Type:id" (outgoing to another case)

          // Check if source is cross-case (has format case_id:Type:id with 3+ parts)
          const sParts = e.source.split(':')
          if (sParts.length >= 3 && sParts[0] !== sParts[1]) {
            // Cross-case source: case_id:Type:id
            sCaseId = sParts[0]
            sType = sParts[1]
            sId = sParts.slice(2).join(':')
          } else {
            // Same-case source: Type:id
            const [sT, ...sRest] = e.source.split(':')
            sType = sT
            sId = sRest.join(':')
            sCaseId = caseId
          }

          // Check if target is cross-case (has format case_id:Type:id with 3+ parts)
          const tParts = e.target.split(':')
          if (tParts.length >= 3 && tParts[0] !== tParts[1]) {
            // Cross-case target: case_id:Type:id
            tCaseId = tParts[0]
            tType = tParts[1]
            tId = tParts.slice(2).join(':')
          } else {
            // Same-case target: Type:id
            const [tT, ...tRest] = e.target.split(':')
            tType = tT
            tId = tRest.join(':')
            tCaseId = caseId
          }
        }

        return {
          sType, sId, sCaseId,
          tType, tId, tCaseId,
          relType: e.label,
          isVirtual: !!e.match_kind,  // Mark virtual links so rename can filter them
          display: `${sId} —[${e.label}]→ ${tId}${!allCasesMode && sCaseId !== tCaseId ? ` [cross→${tCaseId}]` : ''}${e.match_kind ? ' [virtual]' : ''}`
        }
      } catch (err) {
        console.error('Error parsing edge:', e, err)
        return null
      }
    }).filter(Boolean) // Remove any null entries
  }, [edges, allCasesMode, caseId])

  function notifyChanged(message) {
    setStatus({ kind: 'success', message })
    refreshLists()
    onChanged?.()
    // Brief pause so the confirmation is actually readable, then the panel
    // closes itself — no need to manually dismiss it after every edit.
    setTimeout(() => onClose?.(), 900)
  }

  async function guard(fn) {
    try {
      await fn()
    } catch (err) {
      setStatus({ kind: 'error', message: err.message })
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-light-panel dark:bg-panel border border-light-border dark:border-border rounded-lg shadow-xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-light-border dark:border-border">
          <h2 className="font-display text-lg font-semibold text-light-text dark:text-text">Edit graph</h2>
          <button className="text-light-muted dark:text-muted hover:text-light-text dark:text-text transition-colors duration-200" onClick={onClose}>×</button>
        </div>

        <div className="flex flex-wrap gap-2 px-5 pt-2 border-b border-light-border dark:border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-200
                ${tab === t.key
                  ? 'bg-light-panel dark:bg-panel-raised border-accent text-accent'
                  : 'bg-light-panel dark:bg-panel border-light-border dark:border-border text-light-muted dark:text-muted hover:text-light-text dark:text-text hover:border-light-border dark:border-border/50'}`}
              onClick={() => { setTab(t.key); setStatus(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {status && (
          <div className={`mx-5 mt-3 px-4 py-2 rounded-lg text-sm font-mono ${
            status.kind === 'error'
              ? 'bg-danger/10 text-danger border border-danger/30'
              : 'bg-teal/10 text-teal border border-teal/30'
          }`}>
            {status.message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'create-node' && <CreateNodeForm caseId={caseId} allCasesMode={allCasesMode} onDone={notifyChanged} guard={guard} />}
          {tab === 'create-rel' && (
            <CreateRelForm caseId={caseId} allCasesMode={allCasesMode} nodeOptions={nodeOptions} suggestions={suggestions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'change-type' && (
            <ChangeTypeForm caseId={caseId} allCasesMode={allCasesMode} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'rename-node' && (
            <RenameNodeForm caseId={caseId} allCasesMode={allCasesMode} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'rename-rel' && (
            <RenameRelForm caseId={caseId} allCasesMode={allCasesMode} edgeOptions={edgeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'merge' && (
            <MergeNodesForm caseId={caseId} allCasesMode={allCasesMode} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'delete-node' && (
            <DeleteNodeForm caseId={caseId} allCasesMode={allCasesMode} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'delete-rel' && (
            <DeleteRelForm caseId={caseId} allCasesMode={allCasesMode} edgeOptions={edgeOptions} onDone={notifyChanged} guard={guard} />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function NodeSelect({ options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
    >
      <option value="">Select a node…</option>
      {options.map((o) => (
        <option key={`${o.caseId}::${o.type}::${o.id}`} value={`${o.caseId}::${o.type}::${o.id}`}>{o.label}</option>
      ))}
    </select>
  )
}

// 6. Create new node
// Only available in single-case mode - can't create without specifying a case
function CreateNodeForm({ caseId, allCasesMode, onDone, guard }) {
  const [type, setType] = useState('Person')
  const [value, setValue] = useState('')

  if (allCasesMode) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-light-muted dark:text-muted">
        <p>Node creation is only available in single-case mode.</p>
        <p className="mt-1">Switch to "This case" to create new entities.</p>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      guard(async () => {
        await api.addEntity(caseId, type, value.trim())
        const created = value.trim()
        setValue('')
        onDone(`Created ${type}: ${created}.`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Node type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        >
          {NODE_TYPES.map((nt) => <option key={nt.type} value={nt.type}>{nt.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Value</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Ramesh Yadav"
          required
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim()}
        className="w-full px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      >
        Create node
      </button>
    </form>
  )
}

// 7. Create relationship between existing nodes, named freely
// Supports cross-case relationships in all-cases mode
function CreateRelForm({ caseId, allCasesMode, nodeOptions, suggestions, onDone, guard }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [relType, setRelType] = useState('')

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      const sourceParts = source.split('::')
      const targetParts = target.split('::')

      // Parse format: caseId::Type::id (works for both single-case and all-cases)
      const sCaseId = sourceParts[0]
      const sType = sourceParts[1]
      const sId = sourceParts.slice(2).join('::')
      const tCaseId = targetParts[0]
      const tType = targetParts[1]
      const tId = targetParts.slice(2).join('::')

      guard(async () => {
        await api.addRelationship(sCaseId, {
          source_type: sType, source_id: sId,
          target_type: tType, target_id: tId,
          target_case_id: tCaseId, // For cross-case relationships
          rel_type: relType,
        })
        const crossCaseNote = sCaseId !== tCaseId ? ' (cross-case)' : ''
        setRelType('')
        onDone(`Created relationship "${relType}" from ${sId} to ${tId}${crossCaseNote}.`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">From node</label>
        <NodeSelect options={nodeOptions} value={source} onChange={setSource} />
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">To node</label>
        <NodeSelect options={nodeOptions} value={target} onChange={setTarget} />
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Relationship name</label>
        <input
          value={relType}
          onChange={(e) => setRelType(e.target.value)}
          placeholder="e.g. Business Partner, Connected To"
          list="rel-type-suggestions"
          required
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        />
        <datalist id="rel-type-suggestions">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      {allCasesMode && source && target && source.split('::')[0] !== target.split('::')[0] && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-mono">
          ⚠️ Creating cross-case relationship between different cases
        </div>
      )}
      <button
        type="submit"
        disabled={!source || !target || !relType.trim()}
        className="w-full px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      >
        Create relationship
      </button>
    </form>
  )
}

// 1. Rename any node
function RenameNodeForm({ caseId, allCasesMode, nodeOptions, onDone, guard }) {
  const [node, setNode] = useState('')
  const [newValue, setNewValue] = useState('')

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      // Parse format: caseId::Type::id
      const parts = node.split('::')
      const nodeCaseId = parts[0]
      const type = parts[1]
      const id = parts.slice(2).join('::')

      guard(async () => {
        await api.renameEntity(nodeCaseId, type, id, newValue.trim())
        const to = newValue.trim()
        setNewValue('')
        onDone(`Renamed ${id} to ${to}.`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Node</label>
        <NodeSelect options={nodeOptions} value={node} onChange={setNode} />
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">New name</label>
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          required
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        />
      </div>
      <button
        type="submit"
        disabled={!node || !newValue.trim()}
        className="w-full px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      >
        Rename
      </button>
    </form>
  )
}

// 2. Rename a relationship
function RenameRelForm({ caseId, edgeOptions, onDone, guard }) {
  const [edgeKey, setEdgeKey] = useState('')
  const [newName, setNewName] = useState('')
  const edge = edgeOptions[Number(edgeKey)]

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      if (!edge) return

      // Prevent renaming virtual cross-case links
      if (edge.isVirtual) {
        alert('Cannot rename virtual cross-case links. These are automatically computed relationships.')
        return
      }

      guard(async () => {
        // Use source case from the edge itself
        await api.renameRelationship(edge.sCaseId, {
          source_type: edge.sType, source_id: edge.sId,
          target_type: edge.tType, target_id: edge.tId,
          target_case_id: edge.tCaseId,  // Support cross-case
          old_rel_type: edge.relType, new_rel_type: newName,
        })
        const to = newName
        setNewName('')
        setEdgeKey('')
        onDone(`Renamed relationship to "${to}".`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Relationship</label>
        <select
          value={edgeKey}
          onChange={(e) => setEdgeKey(e.target.value)}
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        >
          <option value="">Select a relationship…</option>
          {edgeOptions.map((e, i) => <option key={i} value={i}>{e.display}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">New name</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text placeholder:text-light-muted dark:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        />
      </div>
      <button
        type="submit"
        disabled={!edge || !newName.trim()}
        className="w-full px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      >
        Rename relationship
      </button>
    </form>
  )
}

// 5. Merge nodes
function MergeNodesForm({ caseId, allCasesMode, nodeOptions, onDone, guard }) {
  const [keep, setKeep] = useState('')
  const [merge, setMerge] = useState('')

  // Parse keep node format: caseId::Type::id
  const keepParts = keep.split('::')
  const keepType = keepParts[1] // Type is at position 1

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      // Parse format: caseId::Type::id
      const keepCaseId = keepParts[0]
      const keepTypeVal = keepParts[1]
      const keepId = keepParts.slice(2).join('::')

      const mergeParts = merge.split('::')
      const mergeCaseId = mergeParts[0]
      const mergeId = mergeParts.slice(2).join('::')

      // Only allow merging within the same case
      if (keepCaseId !== mergeCaseId) {
        guard(async () => {
          throw new Error('Cannot merge nodes from different cases')
        })
        return
      }

      guard(async () => {
        await api.mergeEntity(keepCaseId, keepTypeVal, keepId, mergeId)
        setMerge('')
        onDone(`Merged ${mergeId} into ${keepId}.`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Keep this node</label>
        <NodeSelect options={nodeOptions} value={keep} onChange={setKeep} />
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Merge this node into it (same type — it's deleted after merging)</label>
        <NodeSelect
          options={nodeOptions.filter((o) => !keepType || o.type === keepType)}
          value={merge}
          onChange={setMerge}
        />
      </div>
      <button
        type="submit"
        disabled={!keep || !merge || keep === merge}
        className="w-full px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      >
        Merge
      </button>
    </form>
  )
}

// 3. Delete a node
function DeleteNodeForm({ caseId, allCasesMode, nodeOptions, onDone, guard }) {
  const [node, setNode] = useState('')

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      // Parse format: caseId::Type::id
      const parts = node.split('::')
      const nodeCaseId = parts[0]
      const type = parts[1]
      const id = parts.slice(2).join('::')

      if (!window.confirm(`Delete ${id} and all its relationships?`)) return
      guard(async () => {
        await api.deleteEntity(nodeCaseId, type, id)
        setNode('')
        onDone(`Deleted ${id}.`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Node</label>
        <NodeSelect options={nodeOptions} value={node} onChange={setNode} />
      </div>
      <button
        type="submit"
        disabled={!node}
        className="w-full px-4 py-2 border border-danger text-danger rounded-lg hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-bg"
      >
        Delete node
      </button>
    </form>
  )
}

// 4. Delete a relationship between any two nodes
function DeleteRelForm({ caseId, edgeOptions, onDone, guard }) {
  const [edgeKey, setEdgeKey] = useState('')
  const edge = edgeOptions[Number(edgeKey)]

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      if (!edge) return

      // Handle virtual links differently - they can't be "deleted" from database
      if (edge.isVirtual) {
        alert('This is a virtual cross-case link (algorithmically generated based on matching entities across cases). It will disappear once you correct the matching entities or they are no longer identical.')
        return
      }

      // Regular relationship (manual or in-case) - can be deleted
      if (!window.confirm('Delete this relationship?')) return
      guard(async () => {
        // Use source case from the edge itself
        await api.deleteRelationship(edge.sCaseId, {
          source_type: edge.sType, source_id: edge.sId,
          target_type: edge.tType, target_id: edge.tId,
          target_case_id: edge.tCaseId,  // Support cross-case
          rel_type: edge.relType,
        })
        setEdgeKey('')
        onDone('Relationship deleted.')
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Relationship</label>
        <select
          value={edgeKey}
          onChange={(e) => setEdgeKey(e.target.value)}
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        >
          <option value="">Select a relationship…</option>
          {edgeOptions.map((e, i) => <option key={i} value={i}>{e.display}</option>)}
        </select>
      </div>
      <button
        type="submit"
        disabled={!edge}
        className="w-full px-4 py-2 border border-danger text-danger rounded-lg hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-bg"
      >
        Delete relationship
      </button>
    </form>
  )
}

// 8. Change node type
function ChangeTypeForm({ caseId, allCasesMode, nodeOptions, onDone, guard }) {
  const [node, setNode] = useState('')
  const [newType, setNewType] = useState('')

  // Parse node format: caseId::Type::id
  const nodeParts = node.split('::')
  const currentType = nodeParts[1]

  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      const nodeCaseId = nodeParts[0]
      const nodeId = nodeParts.slice(2).join('::')

      if (!window.confirm(`Change ${currentType} to ${newType}? All relationships will be preserved.`)) return

      guard(async () => {
        await api.changeEntityType(nodeCaseId, currentType, nodeId, newType)
        setNode('')
        setNewType('')
        onDone(`Changed type from ${currentType} to ${newType}.`)
      })
    }}>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">Node</label>
        <NodeSelect options={nodeOptions} value={node} onChange={setNode} />
      </div>
      <div>
        <label className="block text-sm font-medium text-light-muted dark:text-muted mb-1">New type</label>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          disabled={!node}
          className="w-full px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
        >
          <option value="">Select new type…</option>
          {NODE_TYPES.map((nt) => (
            currentType && nt.type !== currentType ? (
              <option key={nt.type} value={nt.type}>{nt.label}</option>
            ) : null
          ))}
        </select>
      </div>
      {currentType && newType && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-lg text-sm font-mono">
          ℹ️ Node will be converted from {currentType} to {newType}
        </div>
      )}
      <button
        type="submit"
        disabled={!node || !newType || currentType === newType}
        className="w-full px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      >
        Change type
      </button>
    </form>
  )
}