import { useEffect, useRef, useState } from "react";
import { DataSet } from "vis-data";
import { Network } from "vis-network";
import NodeDetailsPanel from "../components/NodeDetailsPanel";
import GraphEditPanel from "../components/GraphEditPanel";
import { useListCases, useGraph, useAllGraph } from "../hooks/useQueries";

const LAST_CASE_KEY = "sih_last_graph_case_id";

// Single-case mode node ids come in two shapes from GET /cases/{case_id}/graph:
//   "Type:id"              — a node that belongs to the case being viewed
//   "case_id:Type:id"      — a cross-case neighbor node
function parseSingleCaseNodeId(nodeId, viewedCaseId) {
  const parts = nodeId.split(":");
  if (parts.length >= 3) {
    const [nodeCaseId, type, ...rest] = parts;
    return { type, id: rest.join(":"), nodeCaseId };
  }
  const sep = nodeId.indexOf(":");
  return {
    type: nodeId.slice(0, sep),
    id: nodeId.slice(sep + 1),
    nodeCaseId: viewedCaseId,
  };
}

// ---- Sizing knobs ----
const BASE_NODE_SIZE = 90;
const NODE_FONT_SIZE = 50;
const EDGE_FONT_SIZE = 34;
// const MIN_FIT_SCALE = 0.3; // never let fit() zoom out further than this

// Relationship colors. Keys must match backend relationship names exactly
// (after uppercasing and turning spaces into underscores). Add your real
// relationship types here; unmatched edges fall back to gray.
const EDGE_COLORS = {
  ASSOCIATE_OF: "#3b82f6",
  ASSOCIATED_WITH: "#2563eb",
  CONTACTED: "#22c55e",
  FINANCIAL_TRAIL: "#f59e0b",
  CDR_LINK: "#a855f7",
  SPOTTED_AT: "#ef4444",
  DEVICE: "#06b6d4",
};
const CROSS_CASE_COLOR = "#b076e0";
const DEFAULT_EDGE_COLOR = "#6b7f83";

// Optional community palette, used only when the backend sends n.community
const COMMUNITY_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

function edgeColor(label, isCrossCase) {
  const key = (label || "").toUpperCase().replace(/\s+/g, "_");
  return (
    EDGE_COLORS[key] || (isCrossCase ? CROSS_CASE_COLOR : DEFAULT_EDGE_COLOR)
  );
}

// Strip "Person: " style prefixes from display labels
function cleanLabel(label) {
  return String(label ?? "").replace(/^[A-Za-z_]+:\s*/, "");
}

// Node size: scale by betweenness (expected 0..1) when the backend sends it
function nodeSize(n) {
  if (typeof n.betweenness === "number") {
    return BASE_NODE_SIZE + Math.min(1, n.betweenness) * 50;
  }
  return BASE_NODE_SIZE;
}

function nodeColor(n) {
  if (typeof n.community === "number") {
    return COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length];
  }
  return n.color;
}

// Text/halo colors follow the app theme (Tailwind `dark` class on <html>)
function themeColors() {
  const dark = document.documentElement.classList.contains("dark");
  return dark
    ? { text: "#e7ece9", halo: "#0b0f10" }
    : { text: "#1a2225", halo: "#ffffff" };
}

// sidebarToggle: optional node (the app-level "show sidebar" icon button),
// rendered as the first item in the controls row below — deliberately NOT a
// separate header bar, so collapsing the sidebar never costs the graph
// canvas any vertical space.
export default function GraphView({
  refreshKey,
  onGraphChanged,
  sidebarToggle,
}) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const networkRef = useRef(null);
  const nodesDataRef = useRef(null); // vis DataSet of nodes, used by search
  const [mode, setMode] = useState("this-case");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [visibleCaseIds, setVisibleCaseIds] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchMsg, setSearchMsg] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // React Query hooks
  const { data: cases = [] } = useListCases();
  const { data: caseGraphData } = useGraph(selectedCaseId);
  const { data: allGraphData } = useAllGraph();

  const isAllCases = mode === "all-cases";
  const graphData = isAllCases ? allGraphData : caseGraphData;
  const empty = !graphData || !graphData.nodes || graphData.nodes.length === 0;

  useEffect(() => {
    if (cases.length > 0) {
      setVisibleCaseIds(new Set(cases.map((c) => c.id)));
      const lastId = localStorage.getItem(LAST_CASE_KEY);
      if (lastId && cases.find((c) => c.id === lastId)) {
        setSelectedCaseId(lastId);
      }
    }
  }, [cases]);

  useEffect(() => {
    if (selectedCaseId) {
      localStorage.setItem(LAST_CASE_KEY, selectedCaseId);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      setSelected(null);
      nodesDataRef.current = null;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
      return;
    }

    let nodes = graphData.nodes;
    let edges = graphData.edges || [];

    // In all-cases mode, filter nodes/edges by visible case checkboxes
    if (isAllCases) {
      nodes = nodes.filter((n) => visibleCaseIds.has(n.case_id));
      edges = edges.filter((e) => {
        // For cross-case edges, show if either endpoint's case is visible
        if (e.link_type === "cross_case") {
          const srcCase = nodes.find((n) => n.id === e.source)?.case_id;
          const tgtCase = nodes.find((n) => n.id === e.target)?.case_id;
          return (
            (srcCase && visibleCaseIds.has(srcCase)) ||
            (tgtCase && visibleCaseIds.has(tgtCase))
          );
        }
        // For in-case edges, show if the case is visible
        return visibleCaseIds.has(e.case_id);
      });
    }

    if (nodes.length === 0) {
      setSelected(null);
      nodesDataRef.current = null;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
      return;
    }

    const { text: textColor, halo: haloColor } = themeColors();

    const visNodes = new DataSet(
      nodes.map((n) => {
        const size = nodeSize(n);
        const color = nodeColor(n);
        return {
          id: n.id,
          label: cleanLabel(n.label),
          size,
          color: {
            background: color,
            border: haloColor,
            highlight: { background: color, border: "#e3a008" },
            hover: { background: color, border: textColor },
          },
          borderWidth: 3,
          borderWidthSelected: 6,
          font: {
            color: textColor,
            size: NODE_FONT_SIZE,
            face: "Inter, system-ui, sans-serif",
            strokeWidth: 6,
            strokeColor: haloColor,
            // Label sits under the node; offset scales with node size
          },
        };
      }),
    );
    nodesDataRef.current = visNodes;

    // Count edges per node pair so parallel edges fan out instead of stacking
    const pairSeen = {};

    const visEdges = new DataSet(
      edges.map((e, i) => {
        const isCrossCase = e.link_type === "cross_case";
        const color = edgeColor(e.label, isCrossCase);
        const pairKey = [e.source, e.target].sort().join("|");
        const idx = (pairSeen[pairKey] = (pairSeen[pairKey] ?? -1) + 1);
        // 0 -> slight curve, then alternate sides with growing roundness
        const side = idx % 2 === 0 ? "curvedCW" : "curvedCCW";
        const roundness = 0.15 + Math.floor(idx / 2) * 0.2;
        return {
          id: i,
          from: e.source,
          to: e.target,
          label: e.label,
          arrows: { to: { enabled: true, scaleFactor: 1.2 } },
          dashes: isCrossCase ? [8, 6] : false,
          color: { color, highlight: "#e3a008", hover: color },
          // Labels hidden at rest (size 0); revealed on hover/select below
          font: {
            color: textColor,
            size: EDGE_FONT_SIZE,
            strokeWidth: 6,
            strokeColor: haloColor,
            align: "middle",
          },
          width: 3,
          selectionWidth: 2,
          // smooth: { type: "dynamic" },
          smooth: { enabled: true, type: side, roundness },
        };
      }),
    );

    const options = {
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -1340,
          centralGravity: 0.03,
          springLength: 260,
          springConstant: 0.03,
          damping: 0.8,
          avoidOverlap: 1,
        },
        minVelocity: 0.5,
        stabilization: { iterations: 1500, updateInterval: 50 },
      },
      nodes: { shape: "dot", borderWidth: 3 },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        navigationButtons: true,
        keyboard: true,
        multiselect: true,
      },
    };

    if (networkRef.current) {
      networkRef.current.destroy();
    }
    const network = new Network(
      containerRef.current,
      { nodes: visNodes, edges: visEdges },
      options,
    );
    networkRef.current = network;

    // Freeze physics once settled, fit everything in, then make sure fit did
    // not zoom out so far that labels become unreadable.
    network.once("stabilizationIterationsDone", () => {
      network.setOptions({ physics: false });
      // Park unconnected nodes in a tidy row under the graph
      const connected = new Set();
      visEdges.forEach((e) => {
        connected.add(e.from);
        connected.add(e.to);
      });
      // Hard collision pass: no two nodes closer than MIN_GAP (canvas units)
      const MIN_GAP = 150;
      const allIds = visNodes.getIds();
      const p = network.getPositions(allIds);
      for (let pass = 0; pass < 60; pass++) {
        let moved = false;
        for (let a = 0; a < allIds.length; a++) {
          for (let b = a + 1; b < allIds.length; b++) {
            const A = p[allIds[a]],
              B = p[allIds[b]];
            let dx = B.x - A.x,
              dy = B.y - A.y;
            let d = Math.hypot(dx, dy) || 0.01;
            if (d < MIN_GAP) {
              const push = (MIN_GAP - d) / 2;
              dx /= d;
              dy /= d;
              A.x -= dx * push;
              A.y -= dy * push;
              B.x += dx * push;
              B.y += dy * push;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
      allIds.forEach((id) => network.moveNode(id, p[id].x, p[id].y));
      // Push nodes off edges they aren't attached to
      const EDGE_CLEAR = 60;
      const edgeList = visEdges.get();
      for (let pass = 0; pass < 30; pass++) {
        let moved = false;
        allIds.forEach((id) => {
          const P = p[id];
          edgeList.forEach((e) => {
            if (e.from === id || e.to === id) return;
            const S = p[e.from],
              T = p[e.to];
            if (!S || !T) return;
            const vx = T.x - S.x,
              vy = T.y - S.y;
            const len2 = vx * vx + vy * vy || 1;
            let t = ((P.x - S.x) * vx + (P.y - S.y) * vy) / len2;
            if (t < 0.05 || t > 0.95) return;
            const cx = S.x + t * vx,
              cy = S.y + t * vy;
            let dx = P.x - cx,
              dy = P.y - cy;
            const d = Math.hypot(dx, dy) || 0.01;
            if (d < EDGE_CLEAR) {
              const push = EDGE_CLEAR - d;
              P.x += (dx / d) * push;
              P.y += (dy / d) * push;
              moved = true;
            }
          });
        });
        if (!moved) break;
      }
      allIds.forEach((id) => network.moveNode(id, p[id].x, p[id].y));
      const orphans = visNodes.getIds().filter((id) => !connected.has(id));
      if (orphans.length > 0) {
        const connectedIds = visNodes
          .getIds()
          .filter((id) => connected.has(id));
        const cp = network.getPositions(connectedIds);
        const xs = connectedIds.map((id) => cp[id].x);
        const ys = connectedIds.map((id) => cp[id].y);
        const left = Math.min(...xs),
          right = Math.max(...xs);
        const bottom = Math.max(...ys) + 160;
        const step = (right - left) / Math.max(orphans.length - 1, 1);
        orphans.forEach((id, i) => {
          network.moveNode(
            id,
            orphans.length === 1 ? (left + right) / 2 : left + i * step,
            bottom,
          );
        });
      }
      // Stretch layout horizontally to match the canvas aspect ratio, so fit()
      // fills the wide laptop screen instead of leaving empty left/right bands.
      const ids = visNodes.getIds();
      const pos = network.getPositions(ids);
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      ids.forEach((id) => {
        const { x, y } = pos[id];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
      const graphW = Math.max(maxX - minX, 1);
      const graphH = Math.max(maxY - minY, 1);
      const box = containerRef.current.getBoundingClientRect();
      const canvasRatio = box.width / box.height;
      const graphRatio = graphW / graphH;
      if (graphRatio < canvasRatio) {
        const stretch = canvasRatio / graphRatio;
        const cx = (minX + maxX) / 2;
        ids.forEach((id) => {
          network.moveNode(id, cx + (pos[id].x - cx) * stretch, pos[id].y);
        });
      }
      network.fit({
        animation: { duration: 800, easingFunction: "easeInOutQuad" },
      });
      setTimeout(() => {
        if (networkRef.current !== network) return; // graph changed meanwhile
        if (network.getScale() < MIN_FIT_SCALE) {
          network.moveTo({
            scale: MIN_FIT_SCALE,
            animation: { duration: 500, easingFunction: "easeInOutQuad" },
          });
        }
      }, 900);
    });
    // network.on("dragStart", (params) => {
    //   if (params.nodes.length > 0) network.setOptions({ physics: true });
    // });
    // network.on("dragEnd", (params) => {
    //   if (params.nodes.length > 0) network.setOptions({ physics: false });
    // });
    network.on("click", (params) => {
      if (params.nodes.length === 0) {
        setSelected(null);
        return;
      }
      const nodeId = params.nodes[0];

      let type, id, nodeCaseId;
      if (isAllCases) {
        const parts = nodeId.split(":");
        nodeCaseId = parts[0];
        type = parts[1];
        id = parts.slice(2).join(":");
      } else {
        ({ type, id, nodeCaseId } = parseSingleCaseNodeId(
          nodeId,
          selectedCaseId,
        ));
      }

      const canvasPos = network.getPositions([nodeId])[nodeId];
      const domPos = network.canvasToDOM(canvasPos);

      const PANEL_WIDTH = 280;
      const PANEL_MAX_HEIGHT = 420;
      const bounds = containerRef.current.getBoundingClientRect();

      let x = domPos.x + 50;
      let y = domPos.y;
      if (x + PANEL_WIDTH > bounds.width) {
        x = domPos.x - PANEL_WIDTH - 50;
      }
      y = Math.max(0, Math.min(y, bounds.height - PANEL_MAX_HEIGHT));
      x = Math.max(0, x);

      setSelected({ type, id, caseId: nodeCaseId, position: { x, y } });
    });

    return () => {
      nodesDataRef.current = null;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData, isAllCases, visibleCaseIds, selectedCaseId]);

  // ---- Fullscreen ----
  // Uses the browser Fullscreen API on the wrapper so the graph fills the
  // whole screen. The wrapper's flex layout gives the canvas all the space.
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
      // Canvas size changed; let vis-network re-measure and redraw
      setTimeout(() => {
        networkRef.current?.redraw();
        networkRef.current?.fit({ animation: { duration: 400 } });
      }, 150);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Refit only when the canvas size really changes (sidebar toggle, window resize)
  useEffect(() => {
    if (!containerRef.current) return;
    let timer;
    let lastW = containerRef.current.clientWidth;
    let lastH = containerRef.current.clientHeight;
    const observer = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth ?? 0;
      const h = containerRef.current?.clientHeight ?? 0;
      // Ignore observer noise where the size didn't actually change
      if (Math.abs(w - lastW) < 8 && Math.abs(h - lastH) < 8) return;
      lastW = w;
      lastH = h;
      clearTimeout(timer);
      timer = setTimeout(() => {
        networkRef.current?.redraw();
        networkRef.current?.fit({ animation: { duration: 300 } });
      }, 200);
    });
    observer.observe(containerRef.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current?.requestFullscreen?.();
    }
  }

  // ---- Search ----
  function handleSearch(e) {
    e.preventDefault();
    const q = search.trim().toLowerCase();
    setSearchMsg("");
    if (!q || !nodesDataRef.current || !networkRef.current) return;

    const match = nodesDataRef.current
      .get()
      .find((n) => String(n.label).toLowerCase().includes(q));

    if (!match) {
      setSearchMsg("No match");
      return;
    }
    networkRef.current.selectNodes([match.id]);
    networkRef.current.focus(match.id, {
      scale: 1.1,
      animation: { duration: 600, easingFunction: "easeInOutQuad" },
    });
  }

  function toggleCaseVisibility(caseId) {
    setVisibleCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }

  function handleChanged() {
    onGraphChanged?.();
  }

  return (
    <div
      ref={wrapperRef}
      className={
        "flex flex-col h-full " +
        (isFullscreen ? "p-3 bg-light-bg dark:bg-bg" : "")
      }
    >
      <div className="flex flex-wrap items-center gap-3 mb-3 flex-shrink-0">
        {sidebarToggle}

        <select
          value={isAllCases ? "__all__" : selectedCaseId}
          onChange={(e) => {
            if (e.target.value === "__all__") {
              setMode("all-cases");
              setSelectedCaseId("");
            } else {
              setMode("this-case");
              setSelectedCaseId(e.target.value);
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

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchMsg("");
            }}
            placeholder="Search node…"
            className="px-3 py-2 bg-light-bg dark:bg-bg border border-light-border dark:border-border rounded-lg text-sm font-mono text-light-text dark:text-text focus:outline-none focus:ring-2 focus:ring-accent w-44"
          />
          <button
            type="submit"
            className="px-3 py-2 border border-light-border dark:border-border rounded-lg text-sm text-light-text dark:text-text hover:bg-accent/10 transition-colors duration-200"
          >
            Find
          </button>
          {searchMsg && (
            <span className="text-xs text-light-muted dark:text-muted">
              {searchMsg}
            </span>
          )}
        </form>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="px-3 py-2 border border-light-border dark:border-border rounded-lg text-sm text-light-text dark:text-text hover:bg-accent/10 transition-colors duration-200"
        >
          {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        </button>

        {isAllCases && cases.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-light-muted dark:text-muted">Show:</span>
            {cases.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-1.5 cursor-pointer"
              >
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

      <div className="relative flex-1 min-h-0 rounded-lg overflow-hidden bg-light-bg dark:bg-bg border border-light-border dark:border-border">
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-light-muted dark:text-muted font-mono text-sm px-4 text-center pointer-events-none">
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
          caseId={isAllCases ? null : selectedCaseId}
          allCasesMode={isAllCases}
          onClose={() => setEditOpen(false)}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}
