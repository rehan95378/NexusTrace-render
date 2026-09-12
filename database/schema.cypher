// NexusTrace Neo4j Schema (SIH26189)
//
// Run these commands once against your AuraDB instance:
//   neo4j> :use system
//   neo4j> CREATE DATABASE nexustrace
//   neo4j> :use nexustrace
//   neo4j> (paste and run these statements)
//
// The graph models:
//   - Entity nodes (Person, Location, Organization, Phone, Vehicle)
//   - Typed relationships (FINANCIAL, COMMUNICATION, FAMILY, ASSOCIATION, OWNS, LOCATION)
//   - Centrality/pagerank computed during Stage 7 analytics

// Uniqueness constraint on entity ID (creates index automatically)
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (n:Entity) REQUIRE n.id IS UNIQUE;

// Full-text search index on entity labels for rapid lookup
CREATE INDEX entity_label_idx IF NOT EXISTS
FOR (n:Entity) ON (n.label);

// Indexes to accelerate type-based queries
CREATE INDEX entity_type_idx IF NOT EXISTS
FOR (n:Entity) ON (n.type);

// Centrality-based queries (for anomaly alerts)
CREATE INDEX centrality_idx IF NOT EXISTS
FOR (n:Entity) ON (n.centrality);

// Relationship type index (for filtering by relationship category)
CREATE INDEX rel_type_idx IF NOT EXISTS
FOR ()-[r:FINANCIAL]-() ON (r.confidence);
CREATE INDEX rel_type_idx IF NOT EXISTS
FOR ()-[r:COMMUNICATION]-() ON (r.confidence);
CREATE INDEX rel_type_idx IF NOT EXISTS
FOR ()-[r:FAMILY]-() ON (r.confidence);
CREATE INDEX rel_type_idx IF NOT EXISTS
FOR ()-[r:ASSOCIATION]-() ON (r.confidence);

// Data Model (for reference, created dynamically by the pipeline)
//
// Node: Entity
//   - id: string (canonical_id, e.g., "ent_abc123def456")
//   - label: string (canonical text, e.g., "Ramesh Kumar")
//   - type: string (Person | Location | Organization | Phone | Vehicle)
//   - confidence: float (0.0-1.0, how certain the entity is)
//   - aliases: [string] (alternate names, e.g., ["Ramesh", "Ramesh K."])
//   - mentions: [string] (first-name forms, e.g., ["ramesh"])
//   - centrality: float (betweenness centrality from Stage 7)
//   - pagerank: float (pagerank from Stage 7)
//   - anomaly_flags: [string] (["high_centrality", "cross_case_identifier"], from Stage 7)
//
// Edge: typed relationships
//   - FINANCIAL (directed): money transfer, payment, etc. (confidence 0.85+)
//   - COMMUNICATION (directed): call, message, etc. (confidence 0.85+)
//   - FAMILY (directed): brother of, married to, etc. (confidence 0.85+)
//   - ASSOCIATION (directed): co-occurrence, seen together, etc. (confidence 0.4, routed to review)
//   - OWNS (directed): person owns phone/vehicle
//   - LOCATION (directed): person based in location
//
//   Properties on all edges:
//   - type: string (relationship category, e.g., "FINANCIAL")
//   - weight: int (cumulative occurrences across sentences)
//   - confidence: float (0.0-1.0, aggregated from extraction)
//   - label: string (human-readable, e.g., "transferred funds to")
//
// Example query: find high-centrality people and their direct contacts
//
//   MATCH (person:Entity {type: 'Person'})
//   WHERE person.centrality > 0.5 AND 'high_centrality' IN person.anomaly_flags
//   MATCH (person)-[rel]-(contact)
//   WHERE rel.confidence >= 0.85
//   RETURN person.label, contact.label, rel.type, rel.confidence
//   ORDER BY rel.confidence DESC
//
// Example query: find people sharing a phone (cross-case link)
//
//   MATCH (p1:Entity {type: 'Person'})-[o1:OWNS]->(phone:Entity {type: 'Phone'})
//          -[o2:OWNS]-(p2:Entity {type: 'Person'})
//   WHERE p1 <> p2
//   RETURN p1.label, p2.label, phone.label