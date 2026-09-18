# SIH26189 — Crime Network Analysis

## Stack
- **Database:** Neo4j AuraDB (free tier)
- **Backend:** FastAPI (Python) — NLP extraction, graph writes, key-player
  ranking, anomaly detection, and the tamper-evident audit log all live here
  now (the previous separate `ai-ml/` service and the Streamlit prototype
  have both been merged into this one service).
- **Frontend:** React + Vite — a case-file style dashboard with six panels:
  Data Ingestion, Entity Profiles, Evidence Graph Map, Key Player ID,
  Anomaly Detection, and Audit Trail.

## What changed from the previous version
- `backend/` and `ai-ml/` are merged into a single `backend/` service.
  `services/extraction.py`, `services/resolution.py`, `services/pipeline.py`,
  and `services/analysis.py` are the old Streamlit script's logic, ported
  as-is into importable functions.
- The Streamlit app is gone. Every panel it had is now a real API endpoint
  plus a React page that calls it:
  - `POST /ingest`, `POST /clear` → Data Ingestion page
  - `GET /entities` → Entity Profiles page
  - `GET /graph` → Evidence Graph Map page (rendered with `vis-network`)
  - `GET /analysis/key-players` → Key Player ID page
  - `GET /analysis/anomalies` → Anomaly Detection page
  - `GET /audit` → Audit Trail page
- The audit log used to live in `st.session_state` (lost on every refresh).
  It's now persisted as `:AuditEntry` nodes in Neo4j, so it survives
  restarts and is shared across everyone hitting the same database.

## Run locally

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt --break-system-packages
cp .env.example .env   # fill in your real Neo4j credentials
uvicorn main:app --reload --port 8000
```
Visit http://localhost:8000/health — should return `{"status":"ok", "neo4j_connected": true}`.
The spaCy model (`en_core_web_sm`) is installed straight from
`requirements.txt`; if that install ever fails in your environment, run
`python -m spacy download en_core_web_sm` once inside the venv.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Visit http://localhost:5173.

## Deploy (Render)

1. Create a Neo4j AuraDB free instance at https://neo4j.com/cloud/aura — copy
   the URI, username, password. Run `database/schema.cypher` against it
   once (Neo4j Browser or `cypher-shell`).
2. Push this repo to GitHub.
3. On Render, create a **Web Service** for `backend/` — root directory
   `backend`, build `pip install -r requirements.txt`, start
   `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add env vars from
   `.env.example` (with real Neo4j credentials).
4. Create a **Static Site** for `frontend/` — root directory `frontend`,
   build `npm run build`, publish directory `dist`. Add `VITE_API_URL`
   pointing to the backend's Render URL.
5. Open the frontend's Render URL — that's the link for your PPT.

## Project layout
```
backend/
  main.py                  FastAPI app, CORS, /health
  requirements.txt
  utils/neo4j_driver.py    driver + query/clear/fetch_graph_edges helpers
  services/
    extraction.py          regex + spaCy NER extraction (people/locs/vehicles/phones/orgs)
    resolution.py          fuzzy alias resolution for person names
    pipeline.py            the end-to-end ingestion pipeline
    analysis.py            PageRank/betweenness ranking + anomaly detection
    audit.py               hash-chained audit log, persisted in Neo4j
  routers/
    ingest.py   entities.py   graph.py   analysis.py   audit.py
frontend/
  src/
    api.js                 fetch helpers for every backend endpoint
    App.jsx                case-file nav rail + tab routing
    pages/                 Ingestion, Entities, GraphView, KeyPlayers, Anomalies, AuditTrail
database/
  schema.cypher            constraints + indexes, run once against AuraDB
```

## Build order (what's left)
backend auth (JWT is in requirements but not wired up yet) → per-user access
control → richer NER (custom spaCy patterns for Indian names/places) →
end-to-end test with real dossiers.
