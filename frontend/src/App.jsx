import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking...')

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status === 'ok' ? 'connected' : 'unknown'))
      .catch(() => setBackendStatus('unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '4rem' }}>
      <h1>Crime Network Analysis</h1>
      <p>SIH26189 — AI-Powered Criminal Network Analysis System</p>
      <p>Backend status: <strong>{backendStatus}</strong></p>
      <p style={{ color: '#888' }}>Prototype in progress — coming soon</p>
    </div>
  )
}
