import { useEffect, useRef, useState } from 'react'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import NodeDetailsPanel from '../components/NodeDetailsPanel'
import GraphEditPanel from '../components/GraphEditPanel'
import { useListCases, useGraph, useAllGraph } from '../hooks/useQueries'

const LAST_CASE_KEY = 'sih_last_graph_case_id'

// Single-case mode node ids come in two shapes from GET /cases/{case_id}/graph:
//   "Type:id"              — a node that belongs to the case being viewed
//   "case_id:Type:id"      — a cross-case neighbor node the endpoint pulls
//                            in so its edge has somewhere to point
// The previous version always split on the *first* colon, so a cross-case
// id like "9a1c...:Person:Rohan Sharma" got parsed as
// type = "9a1c..." and id = "Person:Rohan Sharma" — garbage — and always
// assumed nodeCaseId === the currently selected case, which is wrong for
// the foreign node. This mirrors the case-aware parsing GraphEditPanel.jsx
// already uses for its edge options.
function parseSingleCaseNodeId(nodeId, viewedCaseId) {
  const parts = nodeId.split(':')
  if (parts.length >= 3) {
    // Cross-case node: case_id:Type:id (id itself may contain colons, so
    // rejoin everything after the first two segments)
    const [nodeCaseId, type, ...rest] = parts
    return { type, id: rest.join(':'), nodeCaseId }
  }
  const sep = nodeId.indexOf(':')
  return {
    type: nodeId.slice(0, sep),
    id: nodeId.slice(sep + 1),
    nodeCaseId: viewedCaseId,
  }
}

// sidebarToggle: optional node (the app-level "show sidebar" icon button),
// passed in from App.jsx and rendered as the first item in the controls
// row below — this is deliberately NOT a separate header bar of its own,
// so collapsing the sidebar never costs the graph canvas any vertical
// space, whichever case is selected.
export default function GraphView({ refreshKey, onGraphChanged, sidebarToggle }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [mode, setMode] = useState('this-case')
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [visibleCaseIds, setVisibleCaseIds] = useState(new Set())
  const [selected, setSelected] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  // React Query hooks
  const { data: cases = [] } = useListCases()
  const { data: caseGraphData } = useGraph(selectedCaseId)
  const { data: allGraphData } = useAllGraph()

  const isAllCases = mode === 'all-cases'
  const graphData = isAllCases ? allGraphData : caseGraphData
  const empty = !graphData || !graphData.nodes || graphData.nodes.length === 0

  useEffect(() => {
    if (cases.length > 0) {
      setVisibleCaseIds(new Set(cases.map(c => c.id)))
      const lastId = localStorage.getItem(LAST_CASE_KEY)
      if (lastId && cases.find(c => c.id === lastId)) {
        setSelectedCaseId(lastId)
      }
    }
  }, [cases])

  useEffect(() => {
    if (selectedCaseId) {
      localStorage.setItem(LAST_CASE_KEY, selectedCaseId)
    }
  }, [selectedCaseId])

  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      setSelected(null)
      if (networkRef.current) {
        networkRef.current.destroy()
        networkRef.current = null
      }
      return
    }

    let nodes = graphData.nodes
    let edges = graphData.edges || []

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
      setSelected(null)
      if (networkRef.current) {
        networkRef.current.destroy()
        networkRef.current = null
      }
      return
    }

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

      let type, id, nodeCaseId
      if (isAllCases) {
        const parts = nodeId.split(':')
        nodeCaseId = parts[0]
        type = parts[1]
        id = parts.slice(2).join(':')
      } else {
        ;({ type, id, nodeCaseId } = parseSingleCaseNodeId(nodeId, selectedCaseId))
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

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy()
        networkRef.current = null
      }
    }
  }, [graphData, isAllCases, visibleCaseIds, selectedCaseId])

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-3 mb-3 flex-shrink-0">
        {sidebarToggle}

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
          className="px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg min-w-[220px]"
        >
          <option value="">Select a case…</option>
          <option value="__all__">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          className="px-4 py-2 bg-accent text-[#14100a] font-semibold rounded-lg hover:bg-accent/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg text-sm"
          onClick={() => setEditOpen(true)}
        >
          Edit graph
        </button>

        {isAllCases && cases.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-light-muted dark:text-muted">Show:</span>
            {cases.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleCaseIds.has(c.id)}
                  onChange={() => toggleCaseVisibility(c.id)}
                  className="h-4 w-4 text-accent bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded focus:ring-accent"
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex-shrink-0 bg-danger/10 text-danger border border-danger/30 rounded-lg p-3 mb-3 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="relative flex-1 min-h-0 rounded-lg overflow-hidden bg-light-bg dark:bg-bg border border-light-border dark:border-border">
        {empty && !error && (
          <p className="absolute inset-0 flex items-center justify-center text-light-muted dark:text-muted font-mono text-sm px-4 text-center">
            Canvas empty. Run ingestion in the Ingestion tab first.
          </p>
        )}
        <div id="graph-canvas" ref={containerRef} className="w-full h-full" />
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
    </div>
  )
}