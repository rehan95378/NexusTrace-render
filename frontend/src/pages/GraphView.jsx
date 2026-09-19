import { useEffect, useRef, useState } from 'react'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import Panel from '../components/Panel'
import NodeDetailsPanel from '../components/NodeDetailsPanel'
import GraphEditPanel from '../components/GraphEditPanel'
import { api } from '../api'

const LAST_CASE_KEY = 'sih_last_graph_case_id'

export default function GraphView({ refreshKey, onGraphChanged }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [mode, setMode] = useState('this-case')
  const [cases, setCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [visibleCaseIds, setVisibleCaseIds] = useState(new Set())
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [bump, setBump] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    api.listCases().then((list) => {
      setCases(list)
      const allIds = new Set(list.map(c => c.id))
      setVisibleCaseIds(allIds)
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

  useEffect(() => {
    let cancelled = false
    setSelected(null)

    const isAllCases = mode === 'all-cases'
    const fetchPromise = isAllCases ? api.allGraph() : (selectedCaseId ? api.graph(selectedCaseId) : null)

    if (!fetchPromise) {
      setEmpty(true)
      return
    }

    fetchPromise.then((result) => {
      if (cancelled) return

      let nodes = result.nodes
      let edges = result.edges

      // In all-cases mode, filter nodes/edges by visible case checkboxes
      if (isAllCases) {
        nodes = nodes.filter(n => visibleCaseIds.has(n.case_id))
        edges = edges.filter(e => {
          // For cross-case edges, show if either endpoint's case is visible
          if (e.link_type === 'cross_case') {
            const srcCase = nodes.find(n => n.id === e.source)?.case_id
            const tgtCase = nodes.find(n => n.id === e.target)?.case_id
            return (srcCase && visibleCaseIds.has(srcCase)) || (tgtCase && visibleCaseIds.has(tgtCase))
          }
          // For in-case edges, show if the case is visible
          return visibleCaseIds.has(e.case_id)
        })
      }

      if (nodes.length === 0) {
        setEmpty(true)
        // Destroy the network to clear the canvas for empty cases
        if (networkRef.current) {
          networkRef.current.destroy()
          networkRef.current = null
        }
        return
      }
      setEmpty(false)

      const visNodes = new DataSet(
        nodes.map((n) => ({ id: n.id, label: n.label, color: n.color, font: { color: '#e7ece9', size: 12 } }))
      )

      const visEdges = new DataSet(
        edges.map((e, i) => {
          const isCrossCase = e.link_type === 'cross_case'
          return {
            id: i,
            from: e.source,
            to: e.target,
            label: e.label,
            arrows: 'to',
            // Cross-case edges: dashed, distinct color
            dashes: isCrossCase ? [5, 5] : false,
            color: {
              color: isCrossCase ? '#b076e0' : '#3a4548',
              highlight: '#e3a008'
            },
            font: { color: '#8fa0a3', size: 10, strokeWidth: 0, align: 'middle' },
            width: isCrossCase ? 2 : 1,
          }
        })
      )

      const options = {
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -120,
            centralGravity: 0.005,
            springLength: 220,
            springConstant: 0.08,
            avoidOverlap: 1,
          },
          minVelocity: 0.75,
          stabilization: { iterations: 200 },
        },
        nodes: { shape: 'dot', size: 14, borderWidth: 1 },
        interaction: { hover: true },
      }

      if (networkRef.current) {
        networkRef.current.destroy()
      }
      const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
      networkRef.current = network

      network.once('stabilizationIterationsDone', () => {
        network.setOptions({ physics: false })
      })
      network.on('dragStart', () => network.setOptions({ physics: true }))
      network.on('dragEnd', () => network.setOptions({ physics: false }))

      network.on('click', (params) => {
        if (params.nodes.length === 0) {
          setSelected(null)
          return
        }
        const nodeId = params.nodes[0]

        // For all-cases mode, nodeId format is "case_id:Type:actual_id"
        // For this-case mode, nodeId format is "Type:actual_id"
        let type, id, nodeCaseId
        if (isAllCases) {
          const parts = nodeId.split(':')
          nodeCaseId = parts[0]
          type = parts[1]
          id = parts.slice(2).join(':')
        } else {
          const sep = nodeId.indexOf(':')
          type = nodeId.slice(0, sep)
          id = nodeId.slice(sep + 1)
          nodeCaseId = selectedCaseId
        }

        const canvasPos = network.getPositions([nodeId])[nodeId]
        const domPos = network.canvasToDOM(canvasPos)

        const PANEL_WIDTH = 280
        const PANEL_MAX_HEIGHT = 420
        const bounds = containerRef.current.getBoundingClientRect()

        let x = domPos.x + 18
        let y = domPos.y
        if (x + PANEL_WIDTH > bounds.width) {
          x = domPos.x - PANEL_WIDTH - 18
        }
        y = Math.max(0, Math.min(y, bounds.height - PANEL_MAX_HEIGHT))
        x = Math.max(0, x)

        setSelected({ type, id, caseId: nodeCaseId, position: { x, y } })
      })
    }).catch((e) => setError(e.message))

    return () => {
      cancelled = true
    }
  }, [mode, selectedCaseId, refreshKey, bump, visibleCaseIds])

  function handleChanged() {
    setBump((b) => b + 1)
    onGraphChanged?.()
  }

  function toggleCaseVisibility(caseId) {
    setVisibleCaseIds(prev => {
      const next = new Set(prev)
      if (next.has(caseId)) {
        next.delete(caseId)
      } else {
        next.add(caseId)
      }
      return next
    })
  }

  const isAllCases = mode === 'all-cases'
  const currentCaseId = isAllCases ? null : selectedCaseId

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
        {/* Compact toolbar at top */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-800 text-sm font-mono">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Single dropdown for case selection */}
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
              style={{ padding: '4px 8px', fontSize: '0.9em', minWidth: 180 }}
            >
              <option value="">Select case…</option>
              <option value="__all__">All cases</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button
              className="primary"
              onClick={() => setEditOpen(true)}
              style={{ padding: '4px 12px', fontSize: '0.9em' }}
            >
              Edit
            </button>
          </div>
          <button
            onClick={() => setFullscreen(false)}
            style={{
              background: '#2a3740',
              border: 'none',
              color: '#e7ece9',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '0.9em',
              borderRadius: '4px'
            }}
          >
            Exit Fullscreen
          </button>
        </div>

        {/* Full canvas - takes remaining space */}
        <div className="graph-canvas-wrap" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {error && <div className="alert-row" style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }}>{error}</div>}
          {empty && !error && <p className="empty-state" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>Canvas empty. Run ingestion first.</p>}
          {!empty && !error && (
            <>
              <div id="graph-canvas" ref={containerRef} style={{ width: '100%', height: '100%' }} />
              {selected && (
                <NodeDetailsPanel
                  caseId={selected.caseId}
                  type={selected.type}
                  id={selected.id}
                  position={selected.position}
                  onClose={() => setSelected(null)}
                />
              )}
            </>
          )}
        </div>

        {editOpen && (
          <GraphEditPanel
            caseId={currentCaseId}
            allCasesMode={isAllCases}
            onClose={() => setEditOpen(false)}
            onChanged={handleChanged}
          />
        )}
      </div>
    )
  }

  return (
    <Panel title="Evidence Graph Map" hint={isAllCases ? "Combined graph across cases. Dashed edges = cross-case links." : "Force-directed map of entities in the selected case."}>
      <div className="flex flex-wrap items-center gap-4 mb-4">
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
          className="px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg min-w-[250px]"
        >
          <option value="">Select a case…</option>
          <option value="__all__">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {isAllCases && cases.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Show:</span>
            {cases.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleCaseIds.has(c.id)}
                  onChange={() => toggleCaseVisibility(c.id)}
                  className="h-4 w-4 text-accent bg-bg border border-border rounded focus:ring-accent"
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          className="px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg text-sm"
          onClick={() => setEditOpen(true)}
        >
          Edit graph
        </button>
        <button
          className="px-4 py-2 bg-accent text-accent-content font-semibold rounded-lg hover:bg-accent/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg text-sm"
          onClick={() => setFullscreen(true)}
        >
          Fullscreen
        </button>
        {isAllCases && <span className="text-sm text-muted ml-2">Editing in all-cases mode allows cross-case linking</span>}
      </div>

      {error && <div className="bg-danger/10 text-danger border border-danger/30 rounded-lg p-3 mb-4 text-sm font-mono">{error}</div>}
      {empty && !error && <p className="text-center py-8 text-muted font-mono">Canvas empty. Run ingestion in the Ingestion tab first.</p>}
      <div className="relative">
        <div id="graph-canvas" ref={containerRef} className="w-full h-[640px] bg-bg rounded-lg" />
        {selected && (
          <NodeDetailsPanel
            caseId={selected.caseId}
            type={selected.type}
            id={selected.id}
            position={selected.position}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {editOpen && (
        <GraphEditPanel
          caseId={currentCaseId}
          allCasesMode={isAllCases}
          onClose={() => setEditOpen(false)}
          onChanged={handleChanged}
        />
      )}
    </Panel>
  )
}
