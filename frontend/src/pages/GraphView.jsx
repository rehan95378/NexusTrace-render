import { useEffect, useRef, useState } from 'react'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import Panel from '../components/Panel'
import NodeDetailsPanel from '../components/NodeDetailsPanel'
import GraphEditPanel from '../components/GraphEditPanel'
import { api } from '../api'

export default function GraphView({ caseId, refreshKey, onGraphChanged }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // { type, id, position } — click = details only
  const [bump, setBump] = useState(0)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSelected(null)

    api.graph(caseId).then(({ nodes, edges }) => {
      if (cancelled) return
      if (nodes.length === 0) {
        setEmpty(true)
        return
      }
      setEmpty(false)

      const visNodes = new DataSet(
        nodes.map((n) => ({ id: n.id, label: n.label, color: n.color, font: { color: '#e7ece9', size: 12 } }))
      )
      const visEdges = new DataSet(
        edges.map((e, i) => ({
          id: i,
          from: e.source,
          to: e.target,
          label: e.label,
          arrows: 'to',
          color: { color: '#3a4548', highlight: '#e3a008' },
          font: { color: '#8fa0a3', size: 10, strokeWidth: 0, align: 'middle' },
        }))
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

      // Physics settles the initial layout, then turns off so the graph
      // stays put instead of jittering forever — re-enabled only around an
      // active drag so dragging a node still feels physical.
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
        const nodeId = params.nodes[0] // "Type:actual_id"
        const sep = nodeId.indexOf(':')
        const type = nodeId.slice(0, sep)
        const id = nodeId.slice(sep + 1)
        const canvasPos = network.getPositions([nodeId])[nodeId]
        const domPos = network.canvasToDOM(canvasPos)

        const PANEL_WIDTH = 280
        const PANEL_MAX_HEIGHT = 420
        const bounds = containerRef.current.getBoundingClientRect()

        let x = domPos.x + 18
        let y = domPos.y
        // Flip to the node's left if there isn't room on the right.
        if (x + PANEL_WIDTH > bounds.width) {
          x = domPos.x - PANEL_WIDTH - 18
        }
        // Clamp vertically so the panel never runs past the canvas bottom
        // (or above the top) — this is what was getting clipped before.
        y = Math.max(0, Math.min(y, bounds.height - PANEL_MAX_HEIGHT))
        x = Math.max(0, x)

        setSelected({ type, id, position: { x, y } })
      })
    }).catch((e) => setError(e.message))

    return () => {
      cancelled = true
    }
  }, [caseId, refreshKey, bump])

  function handleChanged() {
    // Re-fetch this case's graph, and tell the parent so Entities, Key
    // Players, Anomalies, and the Audit Trail pick up the edit too.
    setBump((b) => b + 1)
    onGraphChanged?.()
  }

  return (
    <Panel title="Evidence Graph Map" hint="Force-directed map of every entity and relationship currently in this case's graph. Click a node for its details.">
      <div className="graph-toolbar">
        <button className="primary" onClick={() => setEditOpen(true)}>Edit graph</button>
      </div>

      {error && <div className="alert-row">{error}</div>}
      {empty && !error && <p className="empty-state">Canvas empty. Run ingestion in the Ingestion tab first.</p>}
      <div className={`graph-canvas-wrap${empty || error ? ' graph-canvas-wrap--hidden' : ''}`}>
        <div id="graph-canvas" ref={containerRef} />
        {selected && (
          <NodeDetailsPanel
            caseId={caseId}
            type={selected.type}
            id={selected.id}
            position={selected.position}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {editOpen && (
        <GraphEditPanel
          caseId={caseId}
          onClose={() => setEditOpen(false)}
          onChanged={handleChanged}
        />
      )}
    </Panel>
  )
}
