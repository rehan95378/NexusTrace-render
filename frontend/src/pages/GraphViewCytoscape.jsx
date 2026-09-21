import { useEffect, useRef, useState } from 'react'
import CytoscapeComponent from 'cytoscape'
import FCose from 'cytoscape-fcose'
import NodeDetailsPanel from '../components/NodeDetailsPanel'
import GraphEditPanel from '../components/GraphEditPanel'
import { useListCases, useGraph, useAllGraph } from '../hooks/useQueries'
import { graphToCytoscapeElements, createCytoscapeStylesheet } from '../hooks/useGraphAdapter'

// Register fcose layout
CytoscapeComponent.use(FCose)

const LAST_CASE_KEY = 'sih_last_graph_case_id'

function parseSingleCaseNodeId(nodeId, viewedCaseId) {
  const parts = nodeId.split(':')
  if (parts.length >= 3) {
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

export default function GraphViewCytoscape({ refreshKey, onGraphChanged, sidebarToggle }) {
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const [mode, setMode] = useState('this-case')
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [visibleCaseIds, setVisibleCaseIds] = useState(new Set())
  const [selected, setSelected] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  const { data: cases = [] } = useListCases()
  const { data: caseGraphData } = useGraph(selectedCaseId)
  const { data: allGraphData } = useAllGraph()

  const isAllCases = mode === 'all-cases'
  const graphData = isAllCases ? allGraphData : caseGraphData
  const empty = !graphData || !graphData.nodes || graphData.nodes.length === 0

  // Initialize case selection
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

  // Initialize and update Cytoscape graph
  useEffect(() => {
    if (!containerRef.current) return

    // Clean up old instance
    if (cyRef.current) {
      cyRef.current.destroy()
      cyRef.current = null
    }

    if (empty) {
      setSelected(null)
      return
    }

    let nodes = graphData.nodes
    let edges = graphData.edges || []

    // Filter by visible cases in all-cases mode
    if (isAllCases) {
      nodes = nodes.filter(n => visibleCaseIds.has(n.case_id))
      edges = edges.filter(e => {
        if (e.link_type === 'cross_case') {
          const srcCase = nodes.find(n => n.id === e.source)?.case_id
          const tgtCase = nodes.find(n => n.id === e.target)?.case_id
          return (srcCase && visibleCaseIds.has(srcCase)) || (tgtCase && visibleCaseIds.has(tgtCase))
        }
        return visibleCaseIds.has(e.case_id)
      })
    }

    if (nodes.length === 0) {
      setSelected(null)
      return
    }

    // Convert to Cytoscape format
    const { nodes: cyNodes, edges: cyEdges } = graphToCytoscapeElements({
      nodes,
      edges
    })

    // Initialize Cytoscape
    const cy = CytoscapeComponent({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: createCytoscapeStylesheet(),
      layout: {
        name: 'fcose',
        animate: true,
        animationDuration: 800,
        animationEasing: 'ease-in-out',
        fit: true,
        padding: 80,
        nodeSpacing: 120,
        edgeSeparation: 40,
        packMargin: 20,
        sampleSize: 800,
        randomize: true,
        gravity: 0.5,
        gravityRange: 2,
        gravityCompound: 1,
        gravityRangeCompound: 1.5,
        friction: 0.1,
        numIter: 20000,
        tileToRectRatio: 0.8,
        convergenceThreshold: 0.00001,
        nestingFactor: 0.2,
        quality: 'draft',
        directed: true,
        spacingFactor: 1.5,
        step: 'all',
        zoom: 1,
        pan: { x: 0, y: 0 }
      },
      wheelSensitivity: 0.08,
      boxSelectionEnabled: false,
      selectionType: 'single',
      minZoom: 0.1,
      maxZoom: 4.0,
      textureOnViewport: true,
      motionBlur: false,
      hideEdgesOnViewport: false
    })

    cyRef.current = cy

    // Handle node click
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const nodeId = node.id()

      let type, id, nodeCaseId

      if (isAllCases) {
        const parts = nodeId.split(':')
        nodeCaseId = parts[0]
        type = parts[1]
        id = parts.slice(2).join(':')
      } else {
        ;({ type, id, nodeCaseId } = parseSingleCaseNodeId(nodeId, selectedCaseId))
      }

      // Get node position for panel
      const pos = node.renderedPosition()
      const PANEL_WIDTH = 280
      const PANEL_MAX_HEIGHT = 420
      const bounds = containerRef.current.getBoundingClientRect()

      let x = pos.x + 18
      let y = pos.y
      if (x + PANEL_WIDTH > bounds.width) {
        x = pos.x - PANEL_WIDTH - 18
      }
      y = Math.max(0, Math.min(y, bounds.height - PANEL_MAX_HEIGHT))
      x = Math.max(0, x)

      setSelected({ type, id, caseId: nodeCaseId, position: { x, y } })
    })

    // Clear selection on background click
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelected(null)
      }
    })

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy()
        cyRef.current = null
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

  function handleChanged() {
    onGraphChanged?.()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-4 px-3 py-2.5 flex-shrink-0 bg-light-panel dark:bg-panel border-b border-light-border dark:border-border">
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

        <button
          className="px-4 py-2 bg-light-panel-raised dark:bg-panel-raised text-light-text dark:text-text font-semibold rounded-lg hover:bg-light-panel-raised/80 dark:hover:bg-panel-raised/80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-light-border dark:focus:ring-border focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-bg text-sm"
          onClick={() => {
            if (cyRef.current) {
              cyRef.current.fit(undefined, 50)
            }
          }}
        >
          Fit to screen
        </button>

        {isAllCases && cases.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm ml-auto">
            <span className="text-light-muted dark:text-muted">Show:</span>
            {cases.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleCaseIds.has(c.id)}
                  onChange={() => toggleCaseVisibility(c.id)}
                  className="h-4 w-4 text-accent bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded focus:ring-accent"
                />
                <span className="text-light-text dark:text-text">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex-1 min-h-0 bg-light-bg dark:bg-bg">
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-light-muted dark:text-muted font-mono text-sm px-4 text-center pointer-events-none z-50">
            Canvas empty. Run ingestion in the Ingestion tab first.
          </p>
        )}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
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
          caseId={isAllCases ? null : selectedCaseId}
          allCasesMode={isAllCases}
          onClose={() => setEditOpen(false)}
          onChanged={handleChanged}
        />
      )}
    </div>
  )
}
