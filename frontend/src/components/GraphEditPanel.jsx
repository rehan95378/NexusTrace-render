import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

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
 * named). Opened via the "Edit graph" button on the Evidence Graph Map —
 * intentionally separate from the node-click popup, which stays read-only.
 * Every successful action re-fetches this panel's own node/edge lists and
 * calls onChanged(), which the caller wires to refresh Entities, Key
 * Players, Anomalies, and the Audit Trail too.
 */
export default function GraphEditPanel({ caseId, onClose, onChanged }) {
  const [tab, setTab] = useState('create-node')
  const [entities, setEntities] = useState(null)
  const [edges, setEdges] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [status, setStatus] = useState(null)

  function refreshLists() {
    api.entities(caseId).then(setEntities).catch(() => {})
    api.graph(caseId).then((g) => setEdges(g.edges)).catch(() => {})
  }

  useEffect(() => {
    refreshLists()
    api.relationshipTypeSuggestions().then((r) => setSuggestions(r.suggestions)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  const nodeOptions = useMemo(() => {
    if (!entities) return []
    const out = []
    for (const nt of NODE_TYPES) {
      for (const value of entities[nt.key] || []) {
        out.push({ type: nt.type, id: value, label: `${nt.label}: ${value}` })
      }
    }
    return out
  }, [entities])

  const edgeOptions = useMemo(() => {
    if (!edges) return []
    return edges.map((e) => {
      const [sType, sId] = splitKey(e.source)
      const [tType, tId] = splitKey(e.target)
      return { sType, sId, tType, tId, relType: e.label, display: `${sId} —[${e.label}]→ ${tId}` }
    })
  }, [edges])

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
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal__header">
          <h2>Edit graph</h2>
          <button className="node-panel__close" onClick={onClose}>×</button>
        </div>

        <div className="edit-modal__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`edit-modal__tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => { setTab(t.key); setStatus(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {status && (
          <div className={status.kind === 'error' ? 'alert-row' : 'info-row'}>{status.message}</div>
        )}

        <div className="edit-modal__body">
          {tab === 'create-node' && <CreateNodeForm caseId={caseId} onDone={notifyChanged} guard={guard} />}
          {tab === 'create-rel' && (
            <CreateRelForm caseId={caseId} nodeOptions={nodeOptions} suggestions={suggestions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'rename-node' && (
            <RenameNodeForm caseId={caseId} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'rename-rel' && (
            <RenameRelForm caseId={caseId} edgeOptions={edgeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'merge' && (
            <MergeNodesForm caseId={caseId} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'delete-node' && (
            <DeleteNodeForm caseId={caseId} nodeOptions={nodeOptions} onDone={notifyChanged} guard={guard} />
          )}
          {tab === 'delete-rel' && (
            <DeleteRelForm caseId={caseId} edgeOptions={edgeOptions} onDone={notifyChanged} guard={guard} />
          )}
        </div>
      </div>
    </div>
  )
}

function NodeSelect({ options, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a node…</option>
      {options.map((o) => (
        <option key={`${o.type}::${o.id}`} value={`${o.type}::${o.id}`}>{o.label}</option>
      ))}
    </select>
  )
}

// 6. Create new node
function CreateNodeForm({ caseId, onDone, guard }) {
  const [type, setType] = useState('Person')
  const [value, setValue] = useState('')
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      guard(async () => {
        await api.addEntity(caseId, type, value.trim())
        const created = value.trim()
        setValue('')
        onDone(`Created ${type}: ${created}.`)
      })
    }}>
      <label>Node type</label>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        {NODE_TYPES.map((nt) => <option key={nt.type} value={nt.type}>{nt.label}</option>)}
      </select>
      <label>Value</label>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Ramesh Yadav" required />
      <button className="primary" type="submit" disabled={!value.trim()}>Create node</button>
    </form>
  )
}

// 7. Create relationship between existing nodes, named freely
function CreateRelForm({ caseId, nodeOptions, suggestions, onDone, guard }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [relType, setRelType] = useState('')
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      const [sType, sId] = source.split('::')
      const [tType, tId] = target.split('::')
      guard(async () => {
        await api.addRelationship(caseId, {
          source_type: sType, source_id: sId, target_type: tType, target_id: tId, rel_type: relType,
        })
        const name = relType
        setRelType('')
        onDone(`Created relationship "${name}" from ${sId} to ${tId}.`)
      })
    }}>
      <label>From node</label>
      <NodeSelect options={nodeOptions} value={source} onChange={setSource} />
      <label>To node</label>
      <NodeSelect options={nodeOptions} value={target} onChange={setTarget} />
      <label>Relationship name</label>
      <input
        value={relType}
        onChange={(e) => setRelType(e.target.value)}
        placeholder="e.g. Business Partner"
        list="rel-type-suggestions"
        required
      />
      <datalist id="rel-type-suggestions">
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
      <button className="primary" type="submit" disabled={!source || !target || !relType.trim()}>
        Create relationship
      </button>
    </form>
  )
}

// 1. Rename any node
function RenameNodeForm({ caseId, nodeOptions, onDone, guard }) {
  const [node, setNode] = useState('')
  const [newValue, setNewValue] = useState('')
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      const [type, id] = node.split('::')
      guard(async () => {
        await api.renameEntity(caseId, type, id, newValue.trim())
        const to = newValue.trim()
        setNewValue('')
        onDone(`Renamed ${id} to ${to}.`)
      })
    }}>
      <label>Node</label>
      <NodeSelect options={nodeOptions} value={node} onChange={setNode} />
      <label>New name</label>
      <input value={newValue} onChange={(e) => setNewValue(e.target.value)} required />
      <button className="primary" type="submit" disabled={!node || !newValue.trim()}>Rename</button>
    </form>
  )
}

// 2. Rename a relationship
function RenameRelForm({ caseId, edgeOptions, onDone, guard }) {
  const [edgeKey, setEdgeKey] = useState('')
  const [newName, setNewName] = useState('')
  const edge = edgeOptions[Number(edgeKey)]
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      if (!edge) return
      guard(async () => {
        await api.renameRelationship(caseId, {
          source_type: edge.sType, source_id: edge.sId,
          target_type: edge.tType, target_id: edge.tId,
          old_rel_type: edge.relType, new_rel_type: newName,
        })
        const to = newName
        setNewName('')
        setEdgeKey('')
        onDone(`Renamed relationship to "${to}".`)
      })
    }}>
      <label>Relationship</label>
      <select value={edgeKey} onChange={(e) => setEdgeKey(e.target.value)}>
        <option value="">Select a relationship…</option>
        {edgeOptions.map((e, i) => <option key={i} value={i}>{e.display}</option>)}
      </select>
      <label>New name</label>
      <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
      <button className="primary" type="submit" disabled={!edge || !newName.trim()}>Rename relationship</button>
    </form>
  )
}

// 5. Merge nodes
function MergeNodesForm({ caseId, nodeOptions, onDone, guard }) {
  const [keep, setKeep] = useState('')
  const [merge, setMerge] = useState('')
  const keepType = keep.split('::')[0]
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      const [keepTypeVal, keepId] = keep.split('::')
      const [, mergeId] = merge.split('::')
      guard(async () => {
        await api.mergeEntity(caseId, keepTypeVal, keepId, mergeId)
        setMerge('')
        onDone(`Merged ${mergeId} into ${keepId}.`)
      })
    }}>
      <label>Keep this node</label>
      <NodeSelect options={nodeOptions} value={keep} onChange={setKeep} />
      <label>Merge this node into it (same type — it's deleted after merging)</label>
      <NodeSelect
        options={nodeOptions.filter((o) => !keepType || o.type === keepType)}
        value={merge}
        onChange={setMerge}
      />
      <button className="primary" type="submit" disabled={!keep || !merge || keep === merge}>Merge</button>
    </form>
  )
}

// 3. Delete a node
function DeleteNodeForm({ caseId, nodeOptions, onDone, guard }) {
  const [node, setNode] = useState('')
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      const [type, id] = node.split('::')
      if (!window.confirm(`Delete ${id} and all its relationships?`)) return
      guard(async () => {
        await api.deleteEntity(caseId, type, id)
        setNode('')
        onDone(`Deleted ${id}.`)
      })
    }}>
      <label>Node</label>
      <NodeSelect options={nodeOptions} value={node} onChange={setNode} />
      <button className="danger" type="submit" disabled={!node}>Delete node</button>
    </form>
  )
}

// 4. Delete a relationship between any two nodes
function DeleteRelForm({ caseId, edgeOptions, onDone, guard }) {
  const [edgeKey, setEdgeKey] = useState('')
  const edge = edgeOptions[Number(edgeKey)]
  return (
    <form className="edit-form" onSubmit={(e) => {
      e.preventDefault()
      if (!edge) return
      if (!window.confirm('Delete this relationship?')) return
      guard(async () => {
        await api.deleteRelationship(caseId, {
          source_type: edge.sType, source_id: edge.sId,
          target_type: edge.tType, target_id: edge.tId, rel_type: edge.relType,
        })
        setEdgeKey('')
        onDone('Relationship deleted.')
      })
    }}>
      <label>Relationship</label>
      <select value={edgeKey} onChange={(e) => setEdgeKey(e.target.value)}>
        <option value="">Select a relationship…</option>
        {edgeOptions.map((e, i) => <option key={i} value={i}>{e.display}</option>)}
      </select>
      <button className="danger" type="submit" disabled={!edge}>Delete relationship</button>
    </form>
  )
}