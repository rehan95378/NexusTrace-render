import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'

// Backend base URL. Dev default is localhost:8000; Render sets VITE_API_URL
// to the public backend URL at build time.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'nexustrace_token'
const typeColors = {
  Person: '#60a5fa',
  Organization: '#34d399',
  Location: '#fbbf24',
  Phone: '#f87171',
  Vehicle: '#a78bfa',
}
const flagColors = {
  high_centrality: '#fc8181',
  cross_case_identifier: '#9f7aea',
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` }
}

/* ---------------------------- Auth screen ---------------------------- */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error('Login failed')
      const data = await res.json()
      localStorage.setItem(TOKEN_KEY, data.access_token)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>NexusTrace</h1>
        <p>Criminal Network Analysis System — SIH26189</p>
        {error && <div className="error" style={{ display: 'block' }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="test@example.com" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  )
}

/* ---------------------------- Main app ---------------------------- */
function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [alerts, setAlerts] = useState([])
  const [review, setReview] = useState([])
  const [graphStatus, setGraphStatus] = useState('loading')
  const [info, setInfo] = useState({ title: 'NexusTrace', desc: 'Criminal network graph • Click nodes to inspect' })

  const canvasRef = useRef(null)
  const selectedRef = useRef(null)
  const graphRef = useRef(null) // holds the ForceGraph instance

  const loadReview = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/review?status=pending`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load review queue')
      const data = await res.json()
      setReview(data.items || [])
    } catch (err) {
      setReview([])
    }
  }, [])

  // Load graph + alerts on mount / when token appears.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    setGraphStatus('loading')

    async function load() {
      try {
        const [graphRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE}/graph`, { headers: authHeaders() }),
          fetch(`${API_BASE}/alerts`, { headers: authHeaders() }),
        ])
        if (!graphRes.ok || !alertsRes.ok) throw new Error('Failed to load graph')
        const graphData = await graphRes.json()
        const alertsData = await alertsRes.json()
        if (cancelled) return
        setAlerts(alertsData.alerts || [])
        renderForceGraph(graphData)
        loadReview()
      } catch (err) {
        if (!cancelled) setGraphStatus(`error: ${err.message}`)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token, loadReview])

  // Create / tear down the ForceGraph inside the canvas container.
  function renderForceGraph(graphData) {
    if (!canvasRef.current) return
    const container = canvasRef.current

    if (!graphData.nodes || graphData.nodes.length === 0) {
      setGraphStatus('empty')
      return
    }

    const nodes = graphData.nodes.map((n) => ({
      id: n.id,
      name: n.label,
      type: n.type,
      centrality: n.centrality || 0,
      flags: n.anomaly_flags || [],
      val: Math.max(3, (n.centrality || 0.1) * 20),
    }))
    const links = (graphData.edges || []).map((e) => ({
      source: e.source,
      target: e.target,
      value: e.weight || 1,
      type: e.type,
      confidence: e.confidence || 0,
    }))

    // force-graph is a global injected via the CDN <script> in index.html.
    // Universal API: call ForceGraph(), chain configurators, then invoke the
    // result with the container element.
    if (typeof window.ForceGraph !== 'function') {
      setGraphStatus('error: force-graph library missing (CDN blocked?)')
      return
    }

    const Graph = window.ForceGraph()
      .container(container)
      .graphData({ nodes, links })
      .nodeLabel((n) => `${n.name} (${n.type})`)
      .nodeColor((n) => {
        if (n.flags && n.flags.length > 0) return flagColors[n.flags[0]] || '#60a5fa'
        return typeColors[n.type] || '#60a5fa'
      })
      .nodeVal((n) => n.val)
      .linkLabel((l) => `${l.type} (${l.confidence.toFixed(2)})`)
      .linkColor((l) => (l.confidence > 0.7 ? '#fbbf24' : '#4b5563'))
      .linkWidth((l) => Math.max(0.5, l.confidence))
      .onNodeClick((node) => {
        selectedRef.current = node
        setInfo({ title: node.name, desc: `${node.type} • Centrality: ${node.centrality.toFixed(3)}` })
      })

    graphRef.current = Graph
    setGraphStatus('ok')
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    if (graphRef.current) {
      graphRef.current.graphData({ nodes: [], links: [] })
    }
  }

  async function reviewAction(itemId, action) {
    try {
      const res = await fetch(`${API_BASE}/review/${itemId}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`${action} failed`)
      loadReview() // refresh the queue
    } catch (err) {
      alert(err.message)
    }
  }

  if (!token) {
    return <LoginPage onLogin={() => setToken(localStorage.getItem(TOKEN_KEY))} />
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>NexusTrace</h2>
          <button onClick={logout}>Log Out</button>
        </div>

        <div className="alerts-section">
          <h3>Anomalies ({alerts.length})</h3>
          {alerts.length === 0 ? (
            <p className="muted">No anomalies detected</p>
          ) : (
            alerts.map((a, i) => (
              <div className={`alert-item ${a.flags[0] || ''}`} key={i}>
                <strong>{a.label}</strong>
                <small>{a.type} • {a.reason}</small>
              </div>
            ))
          )}
        </div>

        <div className="alerts-section">
          <h3>Review Queue ({review.length})</h3>
          {review.length === 0 ? (
            <p className="muted">Nothing pending review</p>
          ) : (
            review.map((it) => (
              <div className="review-item" key={it.item_id}>
                <span className={`tag ${it.kind}`}>{it.kind}</span>
                <strong>{it.text}</strong>
                <div className="conf">{it.type} • confidence {Number(it.confidence || 0).toFixed(2)}</div>
                <div className="actions">
                  <button className="approve" onClick={() => reviewAction(it.item_id, 'approve')}>Approve</button>
                  <button className="reject" onClick={() => reviewAction(it.item_id, 'reject')}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="canvas-container">
        <div
          ref={canvasRef}
          className="graph-canvas"
          style={{ width: '100%', height: '100%' }}
        />
        {graphStatus === 'loading' && <div className="loading-overlay">Loading graph...</div>}
        {graphStatus === 'error' && <div className="loading-overlay">{graphStatus}</div>}
        {graphStatus === 'empty' && <div className="loading-overlay">No data to display</div>}
        <div className="info-overlay">
          <strong>{info.title}</strong>
          <p>{info.desc}</p>
        </div>
      </div>
    </div>
  )
}

export default App