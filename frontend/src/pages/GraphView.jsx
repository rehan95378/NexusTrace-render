import { useEffect, useRef, useState } from 'react'
import { DataSet } from 'vis-data'
import { Network } from 'vis-network'
import Panel from '../components/Panel'
import { api } from '../api'

export default function GraphView({ refreshKey }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    api.graph().then(({ nodes, edges }) => {
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
      networkRef.current = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
    }).catch((e) => setError(e.message))

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <Panel title="Evidence Graph Map" hint="Force-directed map of every entity and relationship currently in the graph.">
      {error && <div className="alert-row">{error}</div>}
      {empty && !error && <p className="empty-state">Canvas empty. Run ingestion in the Ingestion tab first.</p>}
      <div id="graph-canvas" ref={containerRef} style={{ display: empty || error ? 'none' : 'block' }} />
    </Panel>
  )
}
