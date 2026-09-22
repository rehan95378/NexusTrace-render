# NexusTrace - System Architecture Documentation

## Overview

NexusTrace (SIH26189) is a graph-based intelligence analysis platform that processes FIR (First Information Report) and CDR (Call Detail Record) texts to extract entities, build relationship graphs, and perform analysis like Key Player Identification and Anomaly Detection. It supports multi-case management with cross-case entity linking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             User Interface (React)                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬───────────────┐ │
│  │   Cases     │ Ingestion   │  Entities   │   Graph     │ Key Players   │ │
│  │ Management  │   Panel     │   View      │  Visualization│  Analysis   │ │
│  ├─────────────┼─────────────┼─────────────┼─────────────┼───────────────┤ │
│  │ Anomalies   │   Audit     │             │             │               │ │
│  │  Detection  │   Trail     │             │             │               │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┴───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FastAPI Backend Server                             │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬───────────────┐ │
│  │   Cases     │   Ingest    │  Entities   │   Graph     │  Analysis     │ │
│  │  Router     │  Router     │  Router     │  Router     │  Router       │ │
│  ├─────────────┼─────────────┼─────────────┼─────────────┼───────────────┤ │
│  │   Audit     │  Graph Edit │             │             │               │ │
│  │  Router     │  Router     │             │             │               │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┴───────────────┘ │
│                                    │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            Services Layer                               │  │
│  │  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌────────────────────────┐ │  │
│  │ │ Cases   ││ Ingest  ││ Graph   ││ Entities││ Cross-Case Linking     │ │  │
│  │ │ Service ││ Service ││ Service ││ Service ││ (Entity Resolution)    │ │  │
│  │ └─────────┘└─────────┘└─────────┘└─────────┘└────────────────────────┘ │  │
│  │  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌────────────────────────┐ │  │
│  │ │ Analysis││ Audit   ││ LLM     ││ Pre-    ││                        │ │  │
│  │ │ Service ││ Service ││ Service ││ trained ││                        │ │  │
│  │ └─────────┘└─────────┘└─────────┘└─────────┘└────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Neo4j Graph Database                             │  │
│  │  - Case nodes (metadata)                                              │  │
│  │  - Entity nodes (Person, Location, Vehicle, Phone, Organization)      │  │
│  │  - Relationship edges with confidence scores                          │  │
│  │  - Audit entries with SHA-256 hash chain                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: Built-in component routing (no external router)
- **State Management**: React Context + `useUIStore` (zustand pattern)
- **HTTP Client**: Custom `api.js` wrapper using fetch
- **Data Fetching**: React Query for caching/invalidation
- **Graph Visualization**: vis-network (vis.js library)
- **Styling**: Custom CSS with light/dark mode
- **Animations**: Framer Motion
- **Icons**: Emoji-based (minimal dependencies)

### Backend
- **Framework**: FastAPI (Python)
- **Database**: Neo4j Graph Database
- **LLM/NLP**: spaCy (pretrained models)
- **Graph Analysis**: NetworkX
- **Validation**: Pydantic models

---

## Core Components

### 1. Backend Router Layer (`backend/routers/`)

Each router handles HTTP routing only - all business logic is delegated to services.

| Router | Purpose | Endpoints |
|--------|---------|-----------|
| `cases.py` | Case CRUD | POST, GET, PATCH, DELETE /cases |
| `ingest.py` | Data ingestion | POST /cases/{id}/ingest, POST /cases/{id}/clear |
| `entities.py` | Entity queries | GET /cases/{id}/entities, GET /entities/all |
| `graph.py` | Graph retrieval | GET /cases/{id}/graph, GET /graph/all |
| `analysis.py` | Analysis queries | Key players, anomalies (all/single case) |
| `audit.py` | Audit trail | GET /cases/{id}/audit, GET /audit/all |
| `graph_edit.py` | Graph mutation | POST/PATCH/DELETE relationships, entity operations |

### 2. Services Layer (`backend/services/`)

Contains all business logic, database operations, and data processing.

| Service | Purpose |
|---------|---------|
| `cases.py` | Case creation, listing, deletion |
| `ingest.py` | FIR/CDR ingestion workflow |
| `graph.py` | Graph building (nodes, edges) |
| `entities.py` | Entity extraction and retrieval |
| `analysis.py` | Key player ID, anomaly detection using NetworkX |
| `audit.py` | Tamper-evident audit log with SHA-256 chain |
| `cross_case.py` | Cross-case entity linking (exact + fuzzy matching) |
| `graph_edit.py` | Manual graph editing operations |
| `pretrained/` | Pretrained model wrappers (NER, entity resolution) |
| `llm/` | LLM-based extraction services |

### 3. Database Layer (`backend/utils/`)

| File | Purpose |
|------|---------|
| `neo4j_driver.py` | Singleton driver, query execution, helper functions |

### 4. Frontend Structure (`frontend/src/`)

```
frontend/src/
├── api.js              # HTTP client wrapper
├── App.jsx             # Main app with sidebar navigation
├── main.jsx            # React entry point
├── index.css           # Global styles
├── graph-edit.css      # Graph editor styles
├── components/         # Reusable components
│   ├── GraphView.jsx           # Vis-Network graph visualization
│   ├── GraphEditPanel.jsx      # Graph editing panel (modal)
│   ├── NodeDetailsPanel.jsx    # Node info popup
│   ├── CaseSelector.jsx        # Case switcher
│   └── ...
├── pages/              # Top-level page components
│   ├── Cases.jsx               # Case management page
│   ├── Ingestion.jsx           # FIR/CDR ingestion
│   ├── Entities.jsx            # Entity listing
│   ├── GraphView.jsx           # Graph display
│   ├── KeyPlayers.jsx          # Key player analysis
│   ├── Anomalies.jsx           # Anomaly detection
│   └── AuditTrail.jsx          # Audit log
└── store/              # State management
    └── uiStore.js        # UI state (dark mode, sidebar)
```

---

## Data Models

### Neo4j Schema

#### Node Labels

| Label | ID Property | Display Property |
|-------|-------------|------------------|
| `Case` | `id` | `name` |
| `Person` | `id` | `name` |
| `Location` | `id` | `name` |
| `Vehicle` | `id` | `plate` |
| `Phone` | `id` | `number` |
| `Organization` | `id` | `org_name` |

#### Common Node Properties

- `case_id`: String - Case this entity belongs to
- `id`: String - Unique identifier within case

#### Relationship Properties

- `confidence`: Float (0-1) - Confidence score from extraction
- `match_kind`: String - "exact" or "fuzzy" (cross-case only)

---

## Key Workflows

### 1. Ingestion Workflow

```
User Input (FIR Text + CDR Text)
    ▼
PretrainedPipeline.run_ingestion()
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FIR Text Processing                                                 │
│  • Extract entities using NER (Person, Location, Organization)     │
│  • Link phone numbers to persons                                   │
│  • Build relationships from FIR narrative                          │
└─────────────────────────────────────────────────────────────────────┘
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CDR (Call Detail Record) Processing                                 │
│  • Extract Phone nodes (callers, recipients)                       │
│  • Build CDR relationships (CALL_RECEIVED, CALL_MADE, etc.)       │
│  • Link phones to persons from FIR                                 │
└─────────────────────────────────────────────────────────────────────┘
    ▼
Database Write (all in single transaction)
    ▼
Audit Log Entry (SHA-256 hash chain)
```

### 2. Cross-Case Entity Linking

```
find_cross_case_links()
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Exact Match Types (Phone, Vehicle, Organization)                  │
│  • Group entities by id across all cases                           │
│  • Create links for entities appearing in multiple cases          │
└─────────────────────────────────────────────────────────────────────┘
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Fuzzy Match (Person only)                                         │
│  • Compare all Person names across cases                          │
│  • Use EntityResolver.compute_person_match_score()               │
│  • Threshold: 85 (within-case), 93 (cross-case)                  │
└─────────────────────────────────────────────────────────────────────┘
    ▼
Returns: List of {type, case_a, id_a, case_b, id_b, match_kind, score}
```

### 3. Audit Trail Hash Chain

```
Each write operation:
    ▼
1. Get previous hash (cached in memory or from DB)
    ▼
2. Compute: SHA256(JSON(entry) + prev_hash)
    ▼
3. Create AuditEntry node with:
   - seq: sequence number
   - hash: computed hash
   - prev_hash: previous entry's hash
   - action: ADD_ENTITY, ADD_RELATIONSHIP, etc.
   - timestamp
    ▼
4. Update cache with new hash
```

### 4. Graph View Rendering

```
GET /cases/{id}/graph
    ▼
services.graph.get_graph(case_id)
    ▼
1. Fetch all nodes (with labels)
    ▼
2. Fetch outgoing relationships
    ▼
3. Fetch incoming relationships (cross-case)
    ▼
4. Build node/edge list
    ▼
Frontend receives:
{
  nodes: [{id, label, type, color, case_id?}],
  edges: [{source, target, label, confidence, link_type?}]
}
    ▼
vis-network renders interactive graph
```

---

## API Endpoints Reference

### Cases
- `POST /cases` - Create new case
- `GET /cases` - List all cases
- `GET /cases/{case_id}` - Get case details
- `PATCH /cases/{case_id}` - Rename case
- `DELETE /cases/{case_id}` - Delete case

### Ingestion
- `POST /cases/{case_id}/ingest` - Ingest FIR/CDR text
- `POST /cases/{case_id}/clear` - Clear case data (keep case)

### Graph
- `GET /cases/{case_id}/graph` - Get single case graph
- `GET /graph/all` - Get all cases combined graph

### Entities
- `GET /cases/{case_id}/entities` - Get entities by type
- `GET /entities/all` - Get all entities across cases

### Graph Editing (Manual)
- `POST /cases/{case_id}/entities/manual` - Create node
- `PATCH /cases/{case_id}/entities/{type}/{id}` - Rename node
- `DELETE /cases/{case_id}/entities/{type}/{id}` - Delete node
- `POST /cases/{case_id}/relationships` - Create relationship
- `PATCH /cases/{case_id}/relationships` - Rename relationship
- `DELETE /cases/{case_id}/relationships` - Delete relationship

### Analysis
- `GET /cases/{case_id}/analysis/key-players` - Top key players
- `GET /cases/{case_id}/analysis/anomalies` - Detected anomalies
- `GET /analysis/key-players/all` - Key players across all cases
- `GET /analysis/anomalies/all` - Anomalies across all cases

### Audit
- `GET /cases/{case_id}/audit` - Case audit log
- `GET /audit/all` - All cases audit log

---

## Frontend Pages

### Cases Page
- Case list with entity counts
- Create new case button
- Case switcher in top bar
- Navigation to Ingestion from cases

### Ingestion Page
- FIR text input (multi-line)
- CDR text input (multi-line)
- "Append mode" toggle for adding to existing entities
- Real-time ingestion feedback

### Entities Page
- Tabbed view: People, Locations, Vehicles, Phones, Organizations
- Clickable entity cards with details
- View button opens node details panel

### Graph View Page
- Interactive vis-network graph
- Pan/zoom support
- Node click shows details
- "All cases" toggle for cross-case view
- "Edit graph" button opens GraphEditPanel
- Legend and case filter

### Key Players Page
- PageRank and betweenness centrality rankings
- Table view with scores
- Top N configurable
- All-cases mode

### Anomalies Page
- Cycle detection (directed cycles)
- High connectivity analysis
- Cluster count visualization
- Bridge detection (graph connectivity)

### Audit Trail Page
- SHA-256 hash chain display
- Per-case verification
- Tamper evidence indicator
- Timestamp and action history

---

## State Management

### React Query Caching
- Key patterns: `['entities', caseId]`, `['graph', caseId]`, `['graph', 'all']`
- Auto-invalidation on mutations via `onSuccess` callbacks

### UI Store (zustand)
```javascript
{
  isDarkMode: boolean,
  sidebarCollapsed: boolean,
  toggleDarkMode: () => void,
  setSidebarCollapsed: (val) => void
}
```

---

## Key Design Decisions

### 1. No External Router
React's component-based routing is simpler than react-router for this use case.

### 2. No Backend Routing Logic
Routers only validate inputs and delegate to services. This makes testing easier.

### 3. Cross-Case Node Key Format
Format: `case_id:Type:id` to avoid collisions (e.g., "case1:Person:John Doe").

### 4. Hash Chain for Audit
Each audit entry hashes previous entry's hash + current data. Tampering breaks chain.

### 5. Confidence Scores
All relationships have confidence scores (default 1.0), accumulated via MERGE.

### 6. Virtual Cross-Case Links
Computed on-demand, not stored in database. Allows dynamic cross-case analysis.

---

## Testing Checklist

### Backend
- [ ] Cases can be created, listed, renamed, deleted
- [ ] Ingestion creates entities and relationships
- [ ] Audit trail entries are created with proper hashes
- [ ] Cross-case linking works correctly
- [ ] Key player analysis returns results
- [ ] Anomaly detection works

### Frontend
- [ ] Sidebar navigation works
- [ ] Dark mode toggle works
- [ ] Graph renders correctly
- [ ] Graph editing panel opens/closes
- [ ] Cross-case mode toggle works
- [ ] Keyboard shortcuts work (Ctrl+B for sidebar, Ctrl+? for help)

---

## Deployment Notes

### Environment Variables (required)
```
NEO4J_URI=neo4j://...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...
NEO4J_DATABASE=...  # optional, defaults to 'neo4j'
PORT=8000
```

### Backend Startup
```python
# Main entry point loads spaCy model at startup
# to avoid first-request latency
get_nlp()
```

### Frontend Build
```bash
npm run build  # produces dist/ directory
npm run dev    # development server
```

---

## Future Enhancements

1. **Multi-worker support**: Move audit hash chain tip to Redis
2. **Incremental ingestion**: Only process new text, not full re-ingestion
3. **Export functionality**: Export graphs as JSON/GEXF
4. **Advanced filtering**: Filter nodes by confidence, date, etc.
5. **Relationship types dropdown**: Suggested relationship types per entity pair
6. **Bulk operations**: Multi-select and bulk delete/rename

---

## Troubleshooting

### Common Issues

1. **Neo4j connection fails**: Check `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
2. **spaCy model missing**: Run `python -m spacy download en_core_web_sm`
3. **Frontend can't reach backend**: Check CORS in `backend/main.py`
4. **Graph not rendering**: Check vis-network in browser console
5. **Cross-case links not showing**: Verify `cross_case.py` is importing correctly

---

## Contribution Guidelines

1. **Backend**: Add business logic to `services/`, not `routers/`
2. **Frontend**: Add reusable components to `components/`
3. **Testing**: Test both single-case and cross-case scenarios
4. **Database**: Use parameterized queries to prevent injection
5. **Code style**: Follow existing patterns, match style of surrounding code

---
