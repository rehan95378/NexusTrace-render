# NexusTrace (SIH26189) - Crime Network Analysis Platform

An intelligent graph-based analysis platform for extracting entities from police FIR (First Information Report) and CDR (Call Detail Record) texts, building relationship networks, identifying key players, and detecting suspicious patterns across multiple cases.

**[Full System Architecture Documentation](ARCHITECTURE.md)** — Comprehensive guide for senior engineers, and new contributors.

---

## 🎯 Quick Overview

NexusTrace processes unstructured crime investigation documents and transforms them into interactive knowledge graphs. Key features include:

- **Multi-case Management** — Create, manage, and switch between independent cases
- **Intelligent Data Ingestion** — Extract entities (persons, locations, vehicles, phones, organizations) from FIR/CDR text using NLP
- **Interactive Graph Visualization** — Explore relationships with vis-network
- **Cross-case Linking** — Automatically link same entities across cases (exact match + fuzzy name matching)
- **Key Player Identification** — PageRank and betweenness centrality analysis
- **Anomaly Detection** — Find cycles, high-connectivity nodes, and graph bridges
- **Tamper-Evident Audit Trail** — SHA-256 hash chain for every change
- **Dark Mode Support** — Full light/dark theme

---

## 🏗️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | Interactive UI with real-time updates |
| **Graph Viz** | vis-network | Force-directed graph rendering |
| **Backend** | FastAPI (Python) | REST API with async support |
| **NLP** | spaCy + custom patterns | Named entity recognition |
| **Graph Analysis** | NetworkX | Key player & anomaly detection |
| **Database** | Neo4j | Property graph storage |
| **State Management** | React Query + Zustand | Client-side caching |

---

## 📋 Project Structure

```
.
├── backend/                          # FastAPI backend service
│   ├── main.py                       # App entry point, routing setup
│   ├── requirements.txt               # Python dependencies
│   ├── .env                           # Neo4j credentials (not committed)
│   │
│   ├── routers/                       # HTTP route handlers (thin layer)
│   │   ├── cases.py                   # Case CRUD endpoints
│   │   ├── ingest.py                  # Data ingestion endpoints
│   │   ├── entities.py                # Entity query endpoints
│   │   ├── graph.py                   # Graph retrieval endpoints
│   │   ├── graph_edit.py              # Graph mutation endpoints
│   │   ├── analysis.py                # Key players & anomalies
│   │   └── audit.py                   # Audit trail endpoints
│   │
│   ├── services/                      # Business logic (thick layer)
│   │   ├── cases.py                   # Case management
│   │   ├── ingest.py                  # Ingestion orchestration
│   │   ├── entities.py                # Entity operations
│   │   ├── graph.py                   # Graph building
│   │   ├── graph_edit.py              # Graph mutations
│   │   ├── analysis.py                # Network analysis algorithms
│   │   ├── audit.py                   # Audit trail with hash chain
│   │   ├── cross_case.py              # Cross-case linking logic
│   │   └── pretrained/                # NLP models
│   │       ├── pipeline.py            # End-to-end ingestion
│   │       ├── nlp_loader.py          # spaCy model management
│   │       └── entity_resolver.py     # Fuzzy name matching
│   │
│   └── utils/
│       └── neo4j_driver.py            # Database connection & queries
│
├── frontend/                          # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx                   # React entry point
│   │   ├── App.jsx                    # Main layout with sidebar
│   │   ├── api.js                     # HTTP client wrapper
│   │   │
│   │   ├── pages/                     # Page-level components
│   │   │   ├── Cases.jsx              # Case management
│   │   │   ├── Ingestion.jsx          # FIR/CDR input form
│   │   │   ├── Entities.jsx           # Entity browser
│   │   │   ├── GraphView.jsx          # Interactive graph
│   │   │   ├── KeyPlayers.jsx         # Key player rankings
│   │   │   ├── Anomalies.jsx          # Pattern detection
│   │   │   └── AuditTrail.jsx         # Audit log viewer
│   │   │
│   │   ├── components/                # Reusable components
│   │   │   ├── GraphEditPanel.jsx     # Graph editing modal
│   │   │   ├── NodeDetailsPanel.jsx   # Node info popup
│   │   │   ├── CaseSelector.jsx       # Case switcher
│   │   │   └── ...
│   │   │
│   │   ├── store/                     # State management
│   │   │   └── uiStore.js             # Dark mode, sidebar state
│   │   │
│   │   ├── hooks/                     # Custom React hooks
│   │   └── lib/                       # Utilities
│   │
│   ├── index.html                     # HTML template
│   ├── vite.config.js                 # Vite configuration
│   └── package.json                   # npm dependencies
│
├── database/
│   └── schema.cypher                  # Neo4j constraints & indexes
│
├── ARCHITECTURE.md                    # Complete architecture guide
└── README.md                          # This file
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 16+
- Neo4j instance (free AuraDB at https://neo4j.com/cloud/aura)

### Local Development

#### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt
# If spaCy install fails: python -m spacy download en_core_web_sm

# Copy .env template and fill in Neo4j credentials
cp .env.example .env
# Edit .env with your Neo4j URI, username, password

# Start backend
python -m uvicorn main:app --reload --port 8000
```

Visit http://localhost:8000/health to verify:
```json
{
  "status": "ok",
  "service": "backend",
  "neo4j_connected": true
}
```

#### 2. Frontend Setup

```bash
cd frontend
npm install

# Copy .env and set backend URL
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8000

# Start dev server
npm run dev
```

Visit http://localhost:5173 in your browser.

---

## 📡 API Overview

### Case Management
```
POST   /cases                    Create new case
GET    /cases                    List all cases
GET    /cases/{id}               Get case details
PATCH  /cases/{id}               Rename case
DELETE /cases/{id}               Delete case
```

### Data Ingestion
```
POST   /cases/{id}/ingest        Ingest FIR/CDR text
POST   /cases/{id}/clear         Clear case data (keep case)
```

### Graph Queries
```
GET    /cases/{id}/graph         Single case graph
GET    /graph/all                All cases combined graph
GET    /relationship-type-suggestions  Suggested relationship types
```

### Entity Queries
```
GET    /cases/{id}/entities      Get entities by type
GET    /entities/all             Get all entities across cases
```

### Graph Editing
```
POST   /cases/{id}/entities/manual          Create entity
PATCH  /cases/{id}/entities/{type}/{id}     Rename entity
DELETE /cases/{id}/entities/{type}/{id}     Delete entity
POST   /cases/{id}/relationships            Create relationship
PATCH  /cases/{id}/relationships            Rename relationship
DELETE /cases/{id}/relationships            Delete relationship
```

### Analysis
```
GET    /cases/{id}/analysis/key-players     Top key players (single case)
GET    /cases/{id}/analysis/anomalies       Detected anomalies (single case)
GET    /analysis/key-players/all            Key players across all cases
GET    /analysis/anomalies/all              Anomalies across all cases
```

### Audit Trail
```
GET    /cases/{id}/audit         Case audit log
GET    /audit/all                Global audit log
```

---

## 🗄️ Database Schema

### Node Labels

| Label | Properties | Purpose |
|-------|-----------|---------|
| `Case` | `id`, `name`, `created_at` | Case metadata |
| `Person` | `id`, `name`, `case_id` | Extracted persons |
| `Location` | `id`, `name`, `case_id` | Extracted locations |
| `Vehicle` | `id`, `plate`, `case_id` | Extracted vehicles |
| `Phone` | `id`, `number`, `case_id` | Extracted phone numbers |
| `Organization` | `id`, `org_name`, `case_id` | Extracted organizations |
| `AuditEntry` | `case_id`, `seq`, `hash`, `action`, `timestamp` | Tamper-evident log |

### Relationship Types

- `CALL_RECEIVED` — CDR call incoming
- `CALL_MADE` — CDR call outgoing
- `OWNS_VEHICLE` — Person owns vehicle
- `USES_DEVICE` — Person uses phone
- `ASSOCIATED_WITH` — FIR-extracted associations
- `FINANCIAL_TRAIL` — Financial connections
- (+ any custom types created manually)

---

## 💡 Key Features

### 1. Cross-Case Linking

Automatically finds same entities across different cases:

- **Exact Match**: Phone numbers, vehicle plates, organization names
- **Fuzzy Match**: Person names (92-93% threshold for cross-case, 85% for within-case)

Virtual cross-case links appear as dashed edges in "All Cases" mode.

### 2. Tamper-Evident Audit Trail

Every write operation creates an audit entry with:
- Sequential number per case
- SHA-256 hash of: `JSON(entry) + previous_hash`
- Breaking any past entry breaks the entire chain from that point

Verification status shown in Audit Trail page.

### 3. Key Player Identification

Uses NetworkX algorithms on the case graph:
- **PageRank** — Importance in network
- **Betweenness Centrality** — Bridge roles

Ranked list of top 10 persons by PageRank.

### 4. Anomaly Detection

Finds suspicious patterns:
- **Cycles** — Mutual connections indicating potential loops
- **High Connectivity** — Nodes with unusually many connections
- **Bridges** — Critical connection points
- **Clusters** — Number of strongly connected components

---

## 🔧 Configuration

### Environment Variables

```bash
# Backend (.env)
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=xxxxx
NEO4J_DATABASE=neo4j          # optional, defaults to 'neo4j'
PORT=8000

# Frontend (.env)
VITE_API_URL=http://localhost:8000   # local dev
# or
VITE_API_URL=https://nexustrace-1.onrender.com/ # production
```

### Performance Tuning

- **spaCy Model**: Loaded once at startup via `get_nlp()`
- **Audit Tip Caching**: In-memory cache per case (assumes single backend process)
- **Neo4j Indexes**: Create indexes on `case_id`, `id` for faster queries

---

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:8000/health
```

### Manual API Testing
```bash
# Create a case
curl -X POST http://localhost:8000/cases \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Case"}'

# List cases
curl http://localhost:8000/cases
```

### Frontend Testing Checklist

- [ ] Sidebar navigation works
- [ ] Dark/light mode toggle works
- [ ] Graph renders with sample data
- [ ] Cross-case toggle shows all cases
- [ ] Keyboard shortcuts (Ctrl+B, Ctrl+?) work
- [ ] No console errors

---

## 🚢 Deployment (Render.com)

### 1. Prepare Database

- Create Neo4j AuraDB free instance at https://neo4j.com/cloud/aura
- Copy URI, username, password
- Run `database/schema.cypher` against it (Neo4j Browser)

### 2. Deploy Backend

Create a **Web Service** on Render:

| Setting | Value |
|---------|-------|
| Repository | Your GitHub repo |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Environment | Add `NEO4J_*` vars from `.env` |

### 3. Deploy Frontend

Create a **Static Site** on Render:

| Setting | Value |
|---------|-------|
| Repository | Your GitHub repo |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Publish Directory | `dist` |
| Environment | `VITE_API_URL=<backend-render-url>` |

### 4. Access

Open the frontend Render URL — that's your live app!

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Neo4j connection fails** | Check `NEO4J_URI`, credentials in `.env` |
| **spaCy model missing** | Run `python -m spacy download en_core_web_sm` |
| **Frontend can't reach backend** | Check `VITE_API_URL` in `.env`, CORS in backend |
| **Graph won't render** | Check browser console for vis-network errors |
| **Cross-case links not showing** | Verify `cross_case.py` imports, check Neo4j schema |
| **Audit chain broken** | Only affects verification status, not data integrity |

---

## 📚 Architecture & Design

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for:

- Complete system architecture diagram
- Data flow for each workflow
- Neo4j schema deep-dive
- Routing vs. services separation
- State management patterns
- API endpoint reference
- Design decisions & rationale

---

## 📝 License

Project for Smart India Hackathon 2026 - SIH26189

---

## 👥 Team

Built for crime network analysis and law enforcement intelligence gathering.

---

## 🔗 Links

- **Live Demo**:

First Start Backend Using This Link
https://nexustrace-65jm.onrender.com/
Then See The Demo
https://nexustrace-1.onrender.com/

- **Neo4j**: https://neo4j.com/cloud/aura
- **spaCy**: https://spacy.io
- **FastAPI**: https://fastapi.tiangolo.com
- **React**: https://react.dev
- **vis-network**: https://visjs.github.io/vis-network/

---

## 📞 Support

For issues or questions:
1. Check the **[ARCHITECTURE.md](./ARCHITECTURE.md)** guide
2. Review **API Overview** section above
3. Check browser console for errors
4. Verify Neo4j connectivity with `/health` endpoint

---