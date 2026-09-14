# SIH26189 — Crime Network Analysis Prototype

Minimal skeleton for fastest possible deploy. Each service has a `/health`
endpoint so you can confirm deployment works before building real features.

## Stack
- **Database:** Neo4j AuraDB (free tier)
- **Backend:** FastAPI (Python)
- **AI/ML service:** FastAPI (Python)
- **Frontend:** React + Vite

## Run locally

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in your real Neo4j credentials
uvicorn main:app --reload --port 8000
```
Visit http://localhost:8000/health — should return `{"status":"ok"}`.

### AI/ML service
```bash
cd ai-ml
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --port 5000
```
Visit http://localhost:5000/health

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Visit http://localhost:5173 — should show "Backend status: connected" if the
backend is running.

## Deploy (Render)

1. Create a Neo4j AuraDB free instance at https://neo4j.com/cloud/aura — copy
   the URI, username, password.
2. Push this repo to GitHub.
3. On Render, create a **Web Service** for `backend/` — root directory
   `backend`, build `pip install -r requirements.txt`, start
   `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add env vars from
   `.env.example` (with real Neo4j credentials).
4. Create a second **Web Service** for `ai-ml/` the same way, root directory
   `ai-ml`, start `uvicorn api:app --host 0.0.0.0 --port $PORT`.
5. Add `AI_SERVICE_URL` on the backend service pointing to the AI/ML
   service's Render URL.
6. Create a **Static Site** for `frontend/` — root directory `frontend`,
   build `npm run build`, publish directory `dist`. Add `VITE_API_URL`
   pointing to the backend's Render URL.
7. Open the frontend's Render URL — that's the link for your PPT.

## Build order (what to add next, one file at a time)
See the team's build-order plan: schema → AI/ML extraction → normalizer →
graph construction → pattern detection → AI/ML API → demo data generator →
backend auth → ingest service → graph service → frontend login → graph
visualization → search/detail panel → end-to-end test.
