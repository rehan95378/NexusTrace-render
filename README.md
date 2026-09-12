# NexusTrace — SIH26189 Criminal Network Analysis System

AI-powered criminal network analysis platform for the Ministry of Home Affairs / NCRB Women Safety Division, developed for Smart India Hackathon 2026.

## What is NexusTrace?

NexusTrace ingests fragmented criminal intelligence data (FIRs, CDRs, finance records, surveillance reports), extracts entities (people, locations, organizations, phones, vehicles), dedupes evidence across documents, builds relationship maps (financial, communication, family, associational), detects anomalies via graph analytics, and surfaces low-confidence findings for human review.

**12-stage pipeline**: data ingestion → preprocessing → entity extraction → entity resolution → relationship building → Neo4j graph storage → network analytics → review queue → REST API → frontend visualization → validation metrics → environment & dependencies.

## Deployment

### Option A: Render (free tier, recommended for demo)

1. **Push to GitHub**: commit and push this repo to your account.

2. **Create two Render services:**

   - **Web Service (Backend):**
     - Build command: `pip install -r backend/requirements.txt`
     - Start command: `cd backend && gunicorn app:app --bind 0.0.0.0:$PORT`
     - Add environment variables:
       ```
       GRAPH_MODE=seed
       JWT_SECRET=<random string>
       NEO4J_PASSWORD=<your_password>  (optional, only if using real Neo4j)
       ```
     - Note the backend public URL (e.g., `https://nexustrace-backend.onrender.com`)

   - **Static Site (Frontend):**
     - Build command: `cd frontend && npm install && npm run build`
     - Publish directory: `frontend/dist`
     - Add environment variable:
       ```
       VITE_API_URL=https://nexustrace-backend.onrender.com  (use the backend URL from above)
       ```

3. **Deploy graph data** (optional, for live Neo4j):
   - Set up a Neo4j AuraDB instance (free tier available).
   - Run `database/schema.cypher` in Neo4j Browser to initialize the schema.
   - On Render, set `GRAPH_MODE=neo4j` and add `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` env vars.
   - Or populate via the `/ingest/upload` API endpoint after deploy.

### Option B: Local development

```bash
# Install backend dependencies
cd backend
./venv/bin/python -m pip install -r requirements.txt

# Run the backend API (seed mode, no Neo4j required)
GRAPH_MODE=seed JWT_SECRET=dev ./venv/bin/python -m uvicorn app:app --port 8000

# In another terminal, run the frontend (dev server)
cd frontend
npm install
npm run dev

# Open http://localhost:5173 in your browser
```

## Quick start: ingest your first report

1. **Log in** (any email/password, demo mode):
   - Email: `demo@example.com`
   - Password: `demo`

2. **Upload a report** (FIR JSON, CDR CSV, or PDF):
   - Go to the backend API docs: `http://localhost:8000/docs`
   - POST `/ingest/upload` with a file
   - The backend extracts entities, builds relationships, routes low-confidence items to the review queue, and updates the graph

3. **See the network**:
   - Refresh the frontend graph page
   - New entities appear as nodes, relationships as edges
   - Anomalies are flagged with red (high centrality) or purple (cross-case) borders
   - Pending review items show in the "Review Queue" sidebar panel

## Key files

- `backend/app.py` — FastAPI entry point
- `backend/api/` — routers (auth, graph, alerts, ingest, review)
- `backend/pipeline/` — 12-stage extraction + graph pipeline
- `backend/config/` — gazetteer, trigger phrases, config
- `backend/data/` — sample reports + validation set
- `frontend/src/` — React UI with force-graph visualization
- `database/schema.cypher` — Neo4j node/edge model

## Modes

- **Seed mode** (default, `GRAPH_MODE=seed`): In-memory graph with demo data. Works on Render free tier, no DB needed. Demo graph grows as reports are uploaded.
- **Neo4j mode** (`GRAPH_MODE=neo4j`): Reads/writes a real Neo4j graph. Set `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` env vars. Requires AuraDB or local Neo4j.

## Architecture

```
frontend (React + three.js + force-graph)
    ↓ HTTP
backend (FastAPI)
    ├── /auth/login → JWT
    ├── /graph → get nodes/edges
    ├── /alerts → get flagged nodes
    ├── /ingest/upload → run pipeline → write to graph
    ├── /review → manage low-confidence queue
    └── (optional) Neo4j driver → read/write live graph
```

## Testing

```bash
cd backend
./venv/bin/python -m pytest test/ -v
```

All 40 tests pass (entity extraction, preprocessing, resolution, relationships, review queue, validation metrics).

## Validation

Stage 11 validation over 29 hand-labeled sentences (confident-tier relationships):
- **Entity F1**: 1.0 (100% precision and recall)
- **Relationship F1**: 1.0 (confident: FINANCIAL/COMMUNICATION/FAMILY)
- **ASSOCIATION edges**: 31 low-confidence items routed to review queue (not claimed as verified)

## Known limitations

- Demo auth accepts any email/password (replace with a real user store for production)
- Relationship extraction uses trigger phrases (heuristic, not NLP-based) — incomplete recall is expected for complex relationships
- Validation is on 29 sentences (expand for production)
- No real user authentication or audit logs (recommended for production)

## Contact

Built for SIH26189 (Smart India Hackathon 2026).
Problem statement: AI-Powered Criminal Network Analysis System for Ministry of Home Affairs / NCRB Women Safety Division.