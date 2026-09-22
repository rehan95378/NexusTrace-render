"""
Entity queries - Read-only operations for entities.

This module handles all entity data retrieval (list, get details).
It does NOT modify the graph - all write operations are in graph_edit.py.
"""

from utils import neo4j_driver as db

# Entity type mapping
PROP_MAP = {
    "Person": "name",
    "Location": "name",
    "Vehicle": "plate",
    "Phone": "number",
    "Organization": "name",
}


def get_entities_for_case(case_id):
    """
    Get all entities for a specific case, grouped by type.
    Returns lists of people, locations, vehicles, phones, organizations.
    """
    people = [r["v"] for r in db.query(
        "MATCH (n:Person {case_id: $case_id}) RETURN n.name AS v ORDER BY v",
        {"case_id": case_id}
    )]

    locations = [r["v"] for r in db.query(
        "MATCH (n:Location {case_id: $case_id}) RETURN n.name AS v ORDER BY v",
        {"case_id": case_id}
    )]

    vehicles = [r["v"] for r in db.query(
        "MATCH (n:Vehicle {case_id: $case_id}) RETURN n.plate AS v ORDER BY v",
        {"case_id": case_id}
    )]

    phones = [r["v"] for r in db.query(
        "MATCH (n:Phone {case_id: $case_id}) RETURN n.number AS v ORDER BY v",
        {"case_id": case_id}
    )]

    orgs = [r["v"] for r in db.query(
        "MATCH (n:Organization {case_id: $case_id}) RETURN n.name AS v ORDER BY v",
        {"case_id": case_id}
    )]

    return {
        "people": people,
        "locations": locations,
        "vehicles": vehicles,
        "phones": phones,
        "organizations": orgs,
        "is_processed": bool(people or locations or vehicles or phones or orgs),
    }


def get_all_entities():
    """
    Get entities across all cases - flat list with case information.
    Used for the 'All cases' toggle on the Entities tab.
    """
    cases = db.query(
        "MATCH (c:Case) RETURN c.id AS id, c.name AS name, c.created_at AS created_at "
        "ORDER BY c.created_at DESC"
    )

    entities = []
    type_map = {
        "people": "person",
        "locations": "location",
        "vehicles": "vehicle",
        "phones": "phone",
        "organizations": "organization",
    }

    for c in cases:
        entry = get_entities_for_case(c["id"])
        for group_key, type_val in type_map.items():
            for val in entry.get(group_key, []):
                entities.append({
                    "type": type_val,
                    "value": val,
                    "case_id": c["id"],
                    "case_name": c["name"]
                })

    return entities


def get_entity_detail(case_id, label, node_id):
    """
    Get detailed information about a specific entity including:
    - All node properties
    - Case information
    - All relationships (incoming and outgoing, within-case and cross-case)
    - Audit trail for this entity

    Returns None if entity not found.
    """
    # Validate label
    if label not in PROP_MAP:
        raise ValueError(f"Unknown entity type: {label}")

    prop = PROP_MAP[label]

    # Get all properties of the node
    rows = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}}) "
        f"RETURN properties(n) AS props",
        {"id": node_id, "case_id": case_id},
    )
    if not rows:
        return None

    props = dict(rows[0]["props"])

    # Get case name for display
    case_rows = db.query(
        "MATCH (c:Case {id: $case_id}) RETURN c.name AS case_name",
        {"case_id": case_id}
    )
    case_name = case_rows[0]["case_name"] if case_rows else case_id

    # Outgoing relationships (within case)
    outgoing = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}})-[r]->(m {{case_id: $case_id}}) "
        "RETURN type(r) AS rel_type, labels(m)[0] AS target_type, m.id AS target_id, "
        "coalesce(r.confidence, 1) AS confidence, properties(r) AS rel_props",
        {"id": node_id, "case_id": case_id},
    )

    # Incoming relationships (within case)
    incoming = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}})<-[r]-(m {{case_id: $case_id}}) "
        "RETURN type(r) AS rel_type, labels(m)[0] AS source_type, m.id AS source_id, "
        "coalesce(r.confidence, 1) AS confidence, properties(r) AS rel_props",
        {"id": node_id, "case_id": case_id},
    )

    # Cross-case outgoing relationships
    cross_outgoing = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}})-[r]->(m) "
        "WHERE m.case_id <> $case_id AND m.case_id IS NOT NULL "
        "RETURN type(r) AS rel_type, labels(m)[0] AS target_type, m.id AS target_id, "
        "m.case_id AS target_case_id, coalesce(r.confidence, 1) AS confidence, properties(r) AS rel_props",
        {"id": node_id, "case_id": case_id},
    )

    # Cross-case incoming relationships
    cross_incoming = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}})<-[r]-(m) "
        "WHERE m.case_id <> $case_id AND m.case_id IS NOT NULL "
        "RETURN type(r) AS rel_type, labels(m)[0] AS source_type, m.id AS source_id, "
        "m.case_id AS source_case_id, coalesce(r.confidence, 1) AS confidence, properties(r) AS rel_props",
        {"id": node_id, "case_id": case_id},
    )

    # Get audit trail for this entity
    audit_rows = db.query(
        "MATCH (a:AuditEntry {case_id: $case_id}) "
        "WHERE a.details CONTAINS $type AND a.details CONTAINS $id "
        "RETURN a.action AS action, a.timestamp AS timestamp, a.details AS details "
        "ORDER BY a.timestamp DESC LIMIT 10",
        {"case_id": case_id, "type": label, "id": node_id},
    )

    return {
        "type": label,
        "id": node_id,
        "value": props.get(prop, node_id),
        "all_props": props,
        "case_id": case_id,
        "case_name": case_name,
        "outgoing": outgoing,
        "incoming": incoming,
        "cross_outgoing": cross_outgoing,
        "cross_incoming": cross_incoming,
        "audit_trail": audit_rows,
    }
