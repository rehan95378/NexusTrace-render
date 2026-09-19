# BUILD.md Progress Update — 2026-09-19

## Completed Steps (2-8)

### Backend (Steps 2-6) ✅
- **Step 2**: `backend/services/cross_case.py` created with exact-match linking for Phone/Vehicle/Organization
- **Step 3**: Fuzzy Person matching implemented using `resolution.py`'s scoring logic at threshold 93
- **Step 4**: Cross-case links wired into `GET /graph/all` with `link_type: "cross_case"` tagging (was already done in graph.py from Step 1)
- **Step 5**: 
  - `backend/services/analysis.py`: Added `key_players_all_cases()` and `anomalies_all_cases()`
  - `backend/utils/neo4j_driver.py`: Added `fetch_all_graph_edges()` helper
  - `backend/routers/analysis.py`: Added `GET /analysis/key-players/all` and `GET /analysis/anomalies/all`
- **Step 6**: 
  - `backend/services/audit.py`: Added `list_all_entries()` and `verify_all_chains()`
  - `backend/routers/audit.py`: Added `GET /audit/all`

All backend modules load successfully without errors.

### Frontend (Steps 7-8) ✅
- **Step 7**: 
  - `frontend/src/App.jsx`: Removed case-gating logic, added "Cases" to TABS, removed activeCase state
  - `frontend/src/pages/Cases.jsx`: Created new Cases tab (repurposed from CaseSelector)
  - App now starts on Cases tab, navigation is always accessible
- **Step 8**: 
  - `frontend/src/pages/Ingestion.jsx`: Added case dropdown with localStorage persistence
  - `frontend/src/api.js`: Added `keyPlayersAll()`, `anomaliesAll()`, `auditAll()` helpers

## Remaining Steps (9-13)

### Step 9: Entities This-case/All-cases toggle
- Add toggle UI to `frontend/src/pages/Entities.jsx`
- Wire to `api.entities(caseId)` vs `api.allEntities()`
- Show case_id column in all-cases mode

### Step 10: GraphView This-case/All-cases toggle + cross-case edge styling
- Add toggle UI to `frontend/src/pages/GraphView.jsx`
- Wire to `api.graph(caseId)` vs `api.allGraph()`
- Add per-case show/hide checkboxes in all-cases mode
- Style cross-case edges as dashed (vis-network edge configuration)
- Test that `link_type: "cross_case"` edges render distinctly

### Step 11: Key Players + Anomalies This-case/All-cases toggle
- Update `frontend/src/pages/KeyPlayers.jsx` with toggle
- Update `frontend/src/pages/Anomalies.jsx` with toggle
- Wire to new all-cases endpoints

### Step 12: AuditTrail global view
- Update `frontend/src/pages/AuditTrail.jsx` to use `api.auditAll()`
- Display per-case verification status (not one combined chain)
- Show case_id for each entry

### Step 13: Testing
- Ingest seed data split across 3-4 cases
- Verify cross-case links appear (e.g., Case 1 ↔ Case 5 share Rohan Sharma/Deepak Nair/Shree Ganesh)
- Verify dashed edges render correctly in all-cases graph
- Verify Key Players analysis surfaces cross-case bridges

## Next Actions

**For next session**: Start with Step 9 (Entities toggle). All backend infrastructure is ready and tested.

**Files to modify**:
- Step 9: `frontend/src/pages/Entities.jsx`
- Step 10: `frontend/src/pages/GraphView.jsx`
- Step 11: `frontend/src/pages/KeyPlayers.jsx`, `frontend/src/pages/Anomalies.jsx`
- Step 12: `frontend/src/pages/AuditTrail.jsx`

**Key implementation notes**:
- Cross-case Person threshold is 93 (vs 85 in-case)
- Cross-case edges have `link_type: "cross_case"` and should render dashed
- Audit verification stays per-case (not one global chain)
- Location entities deliberately NOT linked across cases (too noisy)
