/**
 * Adapter to convert FastAPI graph response to Cytoscape.js elements format
 */

export function graphToCytoscapeElements(data) {
  if (!data || !data.nodes || !data.edges) {
    return { nodes: [], edges: [] }
  }

  // Convert nodes to Cytoscape format
  const nodes = data.nodes.map(n => ({
    data: {
      id: n.id,
      label: n.label,
      type: n.type,
      color: n.color,
      case_id: n.case_id,
      // These will be set by backend in next task
      // For now, use defaults
      betweenness: n.betweenness ?? 1,
      community: n.community ?? 'default'
    }
  }))

  // Convert edges to Cytoscape format
  const edges = data.edges.map((e, i) => ({
    data: {
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      label: e.label || '',
      link_type: e.link_type || 'in_case',
      case_id: e.case_id,
      confidence: e.confidence
    }
  }))

  return { nodes, edges }
}

/**
 * Create Cytoscape stylesheet for styling nodes and edges
 */
export function createCytoscapeStylesheet() {
  return [
    // Node styling
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'width': 'mapData(betweenness, 0, 100, 50, 160)',
        'height': 'mapData(betweenness, 0, 100, 50, 160)',
        'font-size': 'mapData(betweenness, 0, 100, 14, 24)',
        'font-weight': 600,
        'color': '#ffffff',
        'text-outline-width': 4,
        'text-outline-color': '#000000',
        'text-valign': 'center',
        'text-halign': 'center',
        'border-width': 3,
        'border-color': '#ffffff',
        'border-opacity': 0.8,
        'shadow-blur': 15,
        'shadow-color': 'rgba(0,0,0,0.6)',
        'shadow-offset-x': 4,
        'shadow-offset-y': 4,
        'shadow-opacity': 0.6,
        'z-index': 10,
        'transition-property': 'width, height, font-size',
        'transition-duration': '0.3s'
      }
    },
    // Node on hover
    {
      selector: 'node:hover',
      style: {
        'border-width': 3,
        'z-index': 11
      }
    },
    // Selected node
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#fbbf24',
        'z-index': 12
      }
    },
    // Edge styling - in-case edges
    {
      selector: 'edge[link_type != "cross_case"]',
      style: {
        'line-color': '#0f766e',
        'width': 3.5,
        'curve-style': 'bezier',
        'control-point-distance': 80,
        'control-point-weight': 0.5,
        'arrow-scale': 2,
        'target-arrow-color': '#0f766e',
        'target-arrow-shape': 'triangle-backcurve',
        'target-arrow-fill': 'filled',
        'label': 'data(label)',
        'font-size': 15,
        'font-weight': 500,
        'color': '#000000',
        'text-outline-width': 4,
        'text-outline-color': '#ffffff',
        'text-background-shape': 'round-rectangle',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.95,
        'text-background-padding': '8px',
        'text-wrap': 'wrap',
        'text-max-width': 100,
        'z-index': 8
      }
    },
    // Edge styling - cross-case edges (dashed blue)
    {
      selector: 'edge[link_type = "cross_case"]',
      style: {
        'line-color': '#3b82f6',
        'width': 4,
        'line-style': 'dashed',
        'dash-pattern': [10, 8],
        'curve-style': 'bezier',
        'control-point-distance': 120,
        'control-point-weight': 0.6,
        'arrow-scale': 2,
        'target-arrow-color': '#3b82f6',
        'target-arrow-shape': 'triangle-backcurve',
        'target-arrow-fill': 'filled',
        'label': 'data(label)',
        'font-size': 16,
        'font-weight': 600,
        'color': '#000000',
        'text-outline-width': 5,
        'text-outline-color': '#ffffff',
        'text-background-shape': 'round-rectangle',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.95,
        'text-background-padding': '10px',
        'text-wrap': 'wrap',
        'text-max-width': 120,
        'z-index': 9
      }
    },
    // Edge on hover
    {
      selector: 'edge:hover',
      style: {
        'width': 4,
        'z-index': 11
      }
    },
    // Edge connected to selected node
    {
      selector: 'edge.highlight',
      style: {
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b'
      }
    }
  ]
}
