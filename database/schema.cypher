// Run these once against your AuraDB instance (Neo4j Browser or cypher-shell)

// Uniqueness constraints (also creates an index automatically)
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (n:Entity) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT user_email_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.email IS UNIQUE;

// Indexes to speed up lookups by type and name
CREATE INDEX entity_type_index IF NOT EXISTS
FOR (n:Entity) ON (n.type);

CREATE INDEX entity_name_index IF NOT EXISTS
FOR (n:Entity) ON (n.name);

// Tamper-evident audit log (see backend/services/audit.py). Entries are
// ordered by seq rather than timestamp, since two writes in the same
// ingestion request can share a timestamp.
CREATE CONSTRAINT audit_seq_unique IF NOT EXISTS
FOR (a:AuditEntry) REQUIRE a.seq IS UNIQUE;

// Note: relationships (ASSOCIATE_OF, FINANCIAL_TRAIL, SPOTTED_AT, etc.) don't
// need a schema up front in Neo4j — they're created dynamically at ingest
// time by backend/services/pipeline.py. Add relationship property indexes
// here later if query performance needs it (e.g. on confidence).
