"""
Manual entity/relationship CRUD, scoped to one case. Powers the graph's
"Edit graph" panel: create/rename/delete/merge nodes, and create/rename/
delete relationships (with a freely-chosen relationship name).

Node identity stays consistent with pipeline.py: for a given label, the
node's `id` property IS its identifying value (name/plate/number). So a
"rename" has to update `id` itself, not just the display property — every
relationship MATCH elsewhere in the app keys off `id`.

Relationship types used to be restricted to a fixed VALID_REL_TYPES set.
The "create relationship" and "rename relationship" features let the
investigator name the relationship freely, so that restriction is gone —
replaced with sanitize_rel_type(), which is still mandatory because Neo4j
relationship types can't be parameterized: any type used in an interpolated
Cypher string has to be validated to a safe identifier first.
"""
import re

from utils import neo4j_driver as db
from services import audit

# Only these five labels exist in the schema — never interpolate a raw
# caller-supplied label into Cypher without checking it against this map.
PROP_MAP = {
    "Person": "name",
    "Location": "name",
    "Vehicle": "plate",
    "Phone": "number",
    "Organization": "name",
}

# The relationship types the ingestion pipeline creates automatically.
# Shown to the frontend as suggestions — manual relationships are no longer
# restricted to this list, see sanitize_rel_type() below.
REL_TYPE_SUGGESTIONS = sorted({
    "ASSOCIATE_OF", "FINANCIAL_TRAIL", "CDR_LINK", "SPOTTED_AT",
    "OWNS_VEHICLE", "USES_DEVICE", "INTERCEPTED_CALL", "ASSOCIATED_WITH",
    "CAMERA_LOG",
})


def _check_label(label):
    if label not in PROP_MAP:
        raise ValueError(f"Unknown entity type: {label}")
    return PROP_MAP[label]


def sanitize_rel_type(raw):
    """Turn a free-text relationship name into a safe Neo4j relationship
    type: upper-cased, non-alphanumeric runs collapsed to a single
    underscore, guaranteed to start with a letter."""
    cleaned = re.sub(r'[^A-Za-z0-9]+', '_', (raw or '').strip()).strip('_').upper()
    if not cleaned:
        raise ValueError("Relationship name is required.")
    if not cleaned[0].isalpha():
        cleaned = f"REL_{cleaned}"
    return cleaned[:60]


def get_entities_for_case(case_id):
    """The same per-case entity lists GET /cases/{case_id}/entities returns —
    pulled into a shared helper so the all-cases endpoint isn't a second,
    drifting copy of this query."""
    people = [r["v"] for r in db.query(
        "MATCH (n:Person {case_id: $case_id}) RETURN n.name AS v ORDER BY v", {"case_id": case_id})]
    locations = [r["v"] for r in db.query(
        "MATCH (n:Location {case_id: $case_id}) RETURN n.name AS v ORDER BY v", {"case_id": case_id})]
    vehicles = [r["v"] for r in db.query(
        "MATCH (n:Vehicle {case_id: $case_id}) RETURN n.plate AS v ORDER BY v", {"case_id": case_id})]
    phones = [r["v"] for r in db.query(
        "MATCH (n:Phone {case_id: $case_id}) RETURN n.number AS v ORDER BY v", {"case_id": case_id})]
    orgs = [r["v"] for r in db.query(
        "MATCH (n:Organization {case_id: $case_id}) RETURN n.name AS v ORDER BY v", {"case_id": case_id})]
    return {
        "people": people,
        "locations": locations,
        "vehicles": vehicles,
        "phones": phones,
        "organizations": orgs,
        "is_processed": bool(people or locations or vehicles or phones or orgs),
    }


def get_all_entities():
    """Every case's entities, returning a flat list across all cases for the
    'All cases' toggle on the Entities tab. Features cross-case link detection."""
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
    """Node's own data plus every relationship touching it, either direction.
    Read-only — this is all the node-click popup on the graph shows.
    Enhanced: includes all node properties, case info, and cross-case links."""
    prop = _check_label(label)

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
        "MATCH (a:AuditLog {case_id: $case_id}) "
        "WHERE a.details.type = $type AND a.details.id = $id "
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


def add_entity(case_id, label, value):
    prop = _check_label(label)
    value = value.strip()
    if not value:
        raise ValueError("Entity value is required.")
    db.query(
        f"MERGE (n:{label} {{id: $v, case_id: $case_id}}) SET n.{prop} = $v",
        {"v": value, "case_id": case_id},
    )
    audit.log(case_id, "ADD_ENTITY", {"type": label, "id": value, "source": "manual"})
    return {"type": label, "id": value}


def rename_entity(case_id, label, old_id, new_value):
    """Renames a node in place: new `id` + display prop, relationships
    carried over automatically since they're attached to the node itself."""
    prop = _check_label(label)
    new_value = new_value.strip()
    if not new_value:
        raise ValueError("New value is required.")
    existing = db.query(
        f"MATCH (n:{label} {{id: $old, case_id: $case_id}}) RETURN n.id AS id",
        {"old": old_id, "case_id": case_id},
    )
    if not existing:
        raise LookupError("Entity not found.")

    if new_value == old_id:
        return {"type": label, "id": new_value}

    # If a node with the new id already exists, merge into it instead of
    # creating a duplicate.
    clash = db.query(
        f"MATCH (n:{label} {{id: $new, case_id: $case_id}}) RETURN n.id AS id",
        {"new": new_value, "case_id": case_id},
    )
    if clash:
        merge_entities(case_id, label, keep_id=new_value, merge_id=old_id)
        return {"type": label, "id": new_value}

    db.query(
        f"MATCH (n:{label} {{id: $old, case_id: $case_id}}) SET n.id = $new, n.{prop} = $new",
        {"old": old_id, "new": new_value, "case_id": case_id},
    )
    audit.log(case_id, "RENAME_ENTITY", {"type": label, "from": old_id, "to": new_value})
    return {"type": label, "id": new_value}


def delete_entity(case_id, label, node_id):
    _check_label(label)
    existing = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}}) RETURN n.id AS id",
        {"id": node_id, "case_id": case_id},
    )
    if not existing:
        raise LookupError("Entity not found.")
    db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}}) DETACH DELETE n",
        {"id": node_id, "case_id": case_id},
    )
    audit.log(case_id, "DELETE_ENTITY", {"type": label, "id": node_id})


def merge_entities(case_id, label, keep_id, merge_id):
    """Redirects every relationship from `merge_id` onto `keep_id`, then
    deletes `merge_id`. Used for e.g. two aliases of the same suspect that
    resolution.py didn't catch."""
    prop = _check_label(label)
    if keep_id == merge_id:
        raise ValueError("Cannot merge an entity into itself.")

    rows = db.query(
        f"MATCH (a:{label} {{id: $keep, case_id: $case_id}}), "
        f"(b:{label} {{id: $merge, case_id: $case_id}}) "
        "RETURN a.id AS keep_id, b.id AS merge_id",
        {"keep": keep_id, "merge": merge_id, "case_id": case_id},
    )
    if not rows:
        raise LookupError("One or both entities not found.")

    # Neo4j relationship types can't be parameterized, so re-point each
    # concrete rel type that appears on the merge-away node individually.
    existing_out_types = {r["rel_type"] for r in db.query(
        f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})-[r]->() RETURN DISTINCT type(r) AS rel_type",
        {"merge": merge_id, "case_id": case_id},
    )}
    existing_in_types = {r["rel_type"] for r in db.query(
        f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})<-[r]-() RETURN DISTINCT type(r) AS rel_type",
        {"merge": merge_id, "case_id": case_id},
    )}

    for rel_type in existing_out_types:
        db.query(
            f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})-[r:{rel_type}]->(m {{case_id: $case_id}}) "
            f"MATCH (a:{label} {{id: $keep, case_id: $case_id}}) "
            f"WHERE m.id <> $keep "
            f"MERGE (a)-[r2:{rel_type}]->(m) "
            "SET r2.confidence = coalesce(r2.confidence, 0) + coalesce(r.confidence, 1)",
            {"keep": keep_id, "merge": merge_id, "case_id": case_id},
        )
    for rel_type in existing_in_types:
        db.query(
            f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})<-[r:{rel_type}]-(m {{case_id: $case_id}}) "
            f"MATCH (a:{label} {{id: $keep, case_id: $case_id}}) "
            f"WHERE m.id <> $keep "
            f"MERGE (a)<-[r2:{rel_type}]-(m) "
            "SET r2.confidence = coalesce(r2.confidence, 0) + coalesce(r.confidence, 1)",
            {"keep": keep_id, "merge": merge_id, "case_id": case_id},
        )

    db.query(
        f"MATCH (b:{label} {{id: $merge, case_id: $case_id}}) DETACH DELETE b",
        {"merge": merge_id, "case_id": case_id},
    )
    audit.log(case_id, "MERGE_ENTITY", {"type": label, "kept": keep_id, "merged_away": merge_id})


def add_relationship(source_case_id, source_type, source_id, target_case_id, target_type, target_id, rel_type):
    """
    Create a relationship between two entities.
    Supports cross-case relationships when source_case_id != target_case_id.
    """
    _check_label(source_type)
    _check_label(target_type)
    rel_type = sanitize_rel_type(rel_type)

    rows = db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case}}), "
        f"(b:{target_type} {{id: $t, case_id: $target_case}}) "
        f"MERGE (a)-[r:{rel_type}]->(b) "
        "SET r.confidence = coalesce(r.confidence, 0) + 1 "
        "RETURN a.id AS s, b.id AS t",
        {"s": source_id, "t": target_id, "source_case": source_case_id, "target_case": target_case_id},
    )
    if not rows:
        raise LookupError("Source or target entity not found.")

    # Log to the source case's audit trail
    is_cross_case = source_case_id != target_case_id
    audit.log(source_case_id, "ADD_RELATIONSHIP", {
        "type": rel_type,
        "from": source_id,
        "to": target_id,
        "source": "manual",
        "cross_case": is_cross_case,
        "target_case_id": target_case_id if is_cross_case else None
    })

    # Also log to target case if it's cross-case
    if is_cross_case:
        audit.log(target_case_id, "ADD_CROSS_CASE_RELATIONSHIP", {
            "type": rel_type,
            "from": source_id,
            "to": target_id,
            "source": "manual",
            "source_case_id": source_case_id
        })

    return {"type": rel_type, "cross_case": is_cross_case}


def rename_relationship(source_case_id, source_type, source_id, target_case_id, target_type, target_id,
                        old_rel_type, new_rel_type):
    """Neo4j relationship types are immutable, so a "rename" is implemented
    as delete-old + create-new, carrying the confidence value forward.
    Supports cross-case relationships when source_case_id != target_case_id."""
    _check_label(source_type)
    _check_label(target_type)
    old_rel_type = sanitize_rel_type(old_rel_type)
    new_rel_type = sanitize_rel_type(new_rel_type)
    if old_rel_type == new_rel_type:
        return {"type": new_rel_type}

    rows = db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{old_rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) "
        "RETURN coalesce(r.confidence, 1) AS confidence",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )
    if not rows:
        raise LookupError("Relationship not found.")
    confidence = rows[0]["confidence"]

    db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{old_rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) DELETE r",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )
    db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}}), "
        f"(b:{target_type} {{id: $t, case_id: $target_case_id}}) "
        f"MERGE (a)-[r:{new_rel_type}]->(b) SET r.confidence = $confidence",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id, "confidence": confidence},
    )

    is_cross_case = source_case_id != target_case_id
    audit.log(source_case_id, "RENAME_RELATIONSHIP", {
        "from_type": old_rel_type, "to_type": new_rel_type,
        "source": source_id, "target": target_id,
        "cross_case": is_cross_case,
    })
    return {"type": new_rel_type}


def delete_relationship(source_case_id, source_type, source_id, target_case_id, target_type, target_id, rel_type):
    """Delete a relationship. Supports cross-case relationships when
    source_case_id != target_case_id."""
    _check_label(source_type)
    _check_label(target_type)
    rel_type = sanitize_rel_type(rel_type)

    rows = db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) "
        "RETURN r",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )

    if not rows:
        raise LookupError("Relationship not found.")

    db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) DELETE r",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )

    is_cross_case = source_case_id != target_case_id
    audit.log(source_case_id, "DELETE_RELATIONSHIP", {
        "type": rel_type, "from": source_id, "to": target_id,
        "cross_case": is_cross_case,
    })


def change_entity_type(case_id, current_label, node_id, new_label):
    """
    Convert a node from one type to another while preserving all relationships.

    Steps:
    1. Validate both labels exist in PROP_MAP
    2. Get the current node's identifying property value (the node.id IS this value)
    3. Check if a node with the same id already exists in the new label
    4. Create new node with new label, preserving all properties
    5. Redirect all incoming/outgoing relationships to new node
    6. Delete old node
    7. Audit log
    """
    old_prop = _check_label(current_label)
    new_prop = _check_label(new_label)

    if current_label == new_label:
        raise ValueError("Node is already of that type.")

    # Get the current node with all its properties
    node_rows = db.query(
        f"MATCH (n:{current_label} {{id: $id, case_id: $case_id}}) RETURN n",
        {"id": node_id, "case_id": case_id},
    )
    if not node_rows:
        raise LookupError("Entity not found.")

    node = node_rows[0]["n"]
    # The node's id property IS the identifying value (name/plate/number)
    # We need to copy all properties except the old identifying property
    # The new node will have the same id value but with the new identifying property name

    # Check if a node with the same id already exists in the new label
    clash = db.query(
        f"MATCH (n:{new_label} {{id: $id, case_id: $case_id}}) RETURN n.id AS id",
        {"id": node_id, "case_id": case_id},
    )
    if clash:
        raise ValueError(f"A {new_label} with this identifier already exists.")

    # Get all properties from the old node
    # In Neo4j, we can get all properties using properties(n)
    props_rows = db.query(
        f"MATCH (n:{current_label} {{id: $id, case_id: $case_id}}) RETURN properties(n) AS props",
        {"id": node_id, "case_id": case_id},
    )
    if not props_rows:
        raise LookupError("Entity not found.")

    props = dict(props_rows[0]["props"])
    # Remove the old identifying property, we'll set the new one
    props.pop(old_prop, None)
    # Set the new identifying property to the same value as id
    props[new_prop] = node_id
    # Ensure id is set
    props["id"] = node_id
    props["case_id"] = case_id

    # Build SET clause for creating the new node with all properties
    set_clauses = []
    params = {"id": node_id, "case_id": case_id}
    for key, value in props.items():
        if key not in ("id", "case_id"):  # These are handled separately
            param_key = f"prop_{key}"
            set_clauses.append(f"n.{key} = ${param_key}")
            params[param_key] = value

    set_clause = ", ".join(set_clauses) if set_clauses else ""

    # Create the new node with the new label and all properties
    if set_clause:
        db.query(
            f"CREATE (n:{new_label} {{id: $id, case_id: $case_id}}) SET {set_clause}",
            params,
        )
    else:
        db.query(
            f"CREATE (n:{new_label} {{id: $id, case_id: $case_id}})",
            params,
        )

    # Redirect all outgoing relationships
    out_types = {r["rel_type"] for r in db.query(
        f"MATCH (a:{current_label} {{id: $id, case_id: $case_id}})-[r]->() RETURN DISTINCT type(r) AS rel_type",
        {"id": node_id, "case_id": case_id},
    )}
    for rel_type in out_types:
        db.query(
            f"MATCH (a:{current_label} {{id: $id, case_id: $case_id}})-[r:{rel_type}]->(m) "
            f"MATCH (b:{new_label} {{id: $id, case_id: $case_id}}) "
            f"WHERE m.id <> $id "
            f"MERGE (b)-[r2:{rel_type}]->(m) "
            "SET r2.confidence = coalesce(r2.confidence, 0) + coalesce(r.confidence, 1)",
            {"id": node_id, "case_id": case_id},
        )

    # Redirect all incoming relationships
    in_types = {r["rel_type"] for r in db.query(
        f"MATCH (a:{current_label} {{id: $id, case_id: $case_id}})<-[r]-() RETURN DISTINCT type(r) AS rel_type",
        {"id": node_id, "case_id": case_id},
    )}
    for rel_type in in_types:
        db.query(
            f"MATCH (a:{current_label} {{id: $id, case_id: $case_id}})<-[r:{rel_type}]-(m) "
            f"MATCH (b:{new_label} {{id: $id, case_id: $case_id}}) "
            f"WHERE m.id <> $id "
            f"MERGE (b)<-[r2:{rel_type}]-(m) "
            "SET r2.confidence = coalesce(r2.confidence, 0) + coalesce(r.confidence, 1)",
            {"id": node_id, "case_id": case_id},
        )

    # Delete the old node (and its relationships, which have been redirected)
    db.query(
        f"MATCH (n:{current_label} {{id: $id, case_id: $case_id}}) DETACH DELETE n",
        {"id": node_id, "case_id": case_id},
    )

    audit.log(case_id, "CHANGE_ENTITY_TYPE", {
        "from_type": current_label,
        "to_type": new_label,
        "id": node_id,
    })

    return {"type": new_label, "id": node_id}
