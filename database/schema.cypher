// Run these once against your AuraDB instance (Neo4j Browser or cypher-shell)
// NOTE: this replaces the previous global-graph schema with a per-case model.
// If you're upgrading an existing instance, wipe it first (MATCH (n) DETACH
// DELETE n) — node identity has changed from "unique by id" to "unique by
// (case_id, id)", so old nodes are not compatible with the new app code.

// --- Cases ---
CREATE CONSTRAINT case_id_unique IF NOT EXISTS
FOR (c:Case) REQUIRE c.id IS UNIQUE;

// --- Entities ---
// Previously there was a single global uniqueness constraint on a generic
// :Entity label — but the app never actually labels nodes :Entity (they're
// created as :Person, :Location, :Vehicle, :Phone, :Organization directly),
// so that constraint was silently inert. Replaced here with a real,
// per-label composite constraint: an entity is now unique per case, not
// globally, since the same name/plate/number can legitimately refer to two
// different real-world entities in two unrelated cases.
CREATE CONSTRAINT person_case_id_unique IF NOT EXISTS
FOR (n:Person) REQUIRE (n.case_id, n.id) IS UNIQUE;
CREATE CONSTRAINT location_case_id_unique IF NOT EXISTS
FOR (n:Location) REQUIRE (n.case_id, n.id) IS UNIQUE;
CREATE CONSTRAINT vehicle_case_id_unique IF NOT EXISTS
FOR (n:Vehicle) REQUIRE (n.case_id, n.id) IS UNIQUE;
CREATE CONSTRAINT phone_case_id_unique IF NOT EXISTS
FOR (n:Phone) REQUIRE (n.case_id, n.id) IS UNIQUE;
CREATE CONSTRAINT organization_case_id_unique IF NOT EXISTS
FOR (n:Organization) REQUIRE (n.case_id, n.id) IS UNIQUE;

CREATE INDEX person_case_index IF NOT EXISTS FOR (n:Person) ON (n.case_id);
CREATE INDEX location_case_index IF NOT EXISTS FOR (n:Location) ON (n.case_id);
CREATE INDEX vehicle_case_index IF NOT EXISTS FOR (n:Vehicle) ON (n.case_id);
CREATE INDEX phone_case_index IF NOT EXISTS FOR (n:Phone) ON (n.case_id);
CREATE INDEX organization_case_index IF NOT EXISTS FOR (n:Organization) ON (n.case_id);

// --- Tamper-evident audit log (see backend/services/audit.py) ---
// Each case now has its own independent hash chain, ordered by seq within
// that case (two writes in the same ingestion request can share a
// timestamp, hence ordering by seq rather than timestamp).
CREATE CONSTRAINT audit_case_seq_unique IF NOT EXISTS
FOR (a:AuditEntry) REQUIRE (a.case_id, a.seq) IS UNIQUE;
CREATE INDEX audit_case_index IF NOT EXISTS FOR (a:AuditEntry) ON (a.case_id);

// Note: relationships (ASSOCIATE_OF, FINANCIAL_TRAIL, SPOTTED_AT, etc.) don't
// need a schema up front in Neo4j — they're created dynamically at ingest
// time by backend/services/pipeline.py.
