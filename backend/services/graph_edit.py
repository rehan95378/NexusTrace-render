"""
Graph editing operations - All CREATE, UPDATE, DELETE operations for entities and relationships.

This module handles all graph modifications (add, rename, delete, merge entities and relationships).
It is completely independent from entities.py (which only reads data).
"""
import re

from utils import neo4j_driver as db
from services import audit

# Entity type mapping - only these five labels exist in the schema
PROP_MAP = {
    "Person": "name",
    "Location": "name",
    "Vehicle": "plate",
    "Phone": "number",
    "Organization": "name",
}

# Relationship type suggestions for frontend
REL_TYPE_SUGGESTIONS = sorted({
    "ASSOCIATE_OF", "FINANCIAL_TRAIL", "CDR_LINK", "SPOTTED_AT",
    "OWNS_VEHICLE", "USES_DEVICE", "INTERCEPTED_CALL", "ASSOCIATED_WITH",
    "CAMERA_LOG",
})


def _check_label(label):
    """Validate entity label and return its property name"""
    if label not in PROP_MAP:
        raise ValueError(f"Unknown entity type: {label}")
    return PROP_MAP[label]


def sanitize_rel_type(raw):
    """
    Turn a free-text relationship name into a safe Neo4j relationship type.
    Upper-cased, non-alphanumeric runs collapsed to single underscore.
    """
    cleaned = re.sub(r'[^A-Za-z0-9]+', '_', (raw or '').strip()).strip('_').upper()
    if not cleaned:
        raise ValueError("Relationship name is required.")
    if not cleaned[0].isalpha():
        cleaned = f"REL_{cleaned}"
    return cleaned[:60]


def add_entity(case_id, label, value):
    """Add a new entity to the graph"""
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
    """
    Rename an entity - updates both id and display property.
    Relationships are preserved automatically.
    """
    prop = _check_label(label)
    new_value = new_value.strip()
    if not new_value:
        raise ValueError("New value is required.")

    # Check if entity exists
    existing = db.query(
        f"MATCH (n:{label} {{id: $old, case_id: $case_id}}) RETURN n.id AS id",
        {"old": old_id, "case_id": case_id},
    )
    if not existing:
        raise LookupError("Entity not found.")

    if new_value == old_id:
        return {"type": label, "id": new_value}

    # If new id already exists, merge instead of rename
    clash = db.query(
        f"MATCH (n:{label} {{id: $new, case_id: $case_id}}) RETURN n.id AS id",
        {"new": new_value, "case_id": case_id},
    )
    if clash:
        merge_entities(case_id, label, keep_id=new_value, merge_id=old_id)
        return {"type": label, "id": new_value}

    # Rename the entity
    db.query(
        f"MATCH (n:{label} {{id: $old, case_id: $case_id}}) SET n.id = $new, n.{prop} = $new",
        {"old": old_id, "new": new_value, "case_id": case_id},
    )
    audit.log(case_id, "RENAME_ENTITY", {"type": label, "from": old_id, "to": new_value})
    return {"type": label, "id": new_value}


def delete_entity(case_id, label, node_id):
    """Delete an entity from the graph (removes all relationships too)"""
    _check_label(label)

    # Check if entity exists
    existing = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}}) RETURN n.id AS id",
        {"id": node_id, "case_id": case_id},
    )
    if not existing:
        raise LookupError("Entity not found.")

    # Delete entity and all its relationships
    db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}}) DETACH DELETE n",
        {"id": node_id, "case_id": case_id},
    )
    audit.log(case_id, "DELETE_ENTITY", {"type": label, "id": node_id})


def merge_entities(case_id, label, keep_id, merge_id):
    """
    Merge two entities - redirect all relationships from merge_id to keep_id,
    then delete merge_id. Used for combining aliases.
    """
    prop = _check_label(label)

    if keep_id == merge_id:
        raise ValueError("Cannot merge an entity into itself.")

    # Check both entities exist
    rows = db.query(
        f"MATCH (a:{label} {{id: $keep, case_id: $case_id}}), "
        f"(b:{label} {{id: $merge, case_id: $case_id}}) "
        "RETURN a.id AS keep_id, b.id AS merge_id",
        {"keep": keep_id, "merge": merge_id, "case_id": case_id},
    )
    if not rows:
        raise LookupError("One or both entities not found.")

    # Get all relationship types on the merge-away node
    existing_out_types = {r["rel_type"] for r in db.query(
        f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})-[r]->() RETURN DISTINCT type(r) AS rel_type",
        {"merge": merge_id, "case_id": case_id},
    )}
    existing_in_types = {r["rel_type"] for r in db.query(
        f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})<-[r]-() RETURN DISTINCT type(r) AS rel_type",
        {"merge": merge_id, "case_id": case_id},
    )}

    # Redirect outgoing relationships
    for rel_type in existing_out_types:
        db.query(
            f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})-[r:{rel_type}]->(m {{case_id: $case_id}}) "
            f"MATCH (a:{label} {{id: $keep, case_id: $case_id}}) "
            f"WHERE m.id <> $keep "
            f"MERGE (a)-[r2:{rel_type}]->(m) "
            "SET r2.confidence = coalesce(r2.confidence, 0) + coalesce(r.confidence, 1)",
            {"keep": keep_id, "merge": merge_id, "case_id": case_id},
        )

    # Redirect incoming relationships
    for rel_type in existing_in_types:
        db.query(
            f"MATCH (b:{label} {{id: $merge, case_id: $case_id}})<-[r:{rel_type}]-(m {{case_id: $case_id}}) "
            f"MATCH (a:{label} {{id: $keep, case_id: $case_id}}) "
            f"WHERE m.id <> $keep "
            f"MERGE (a)<-[r2:{rel_type}]-(m) "
            "SET r2.confidence = coalesce(r2.confidence, 0) + coalesce(r.confidence, 1)",
            {"keep": keep_id, "merge": merge_id, "case_id": case_id},
        )

    # Delete the merged-away entity
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

    # Create the relationship
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

    # Log to audit trail
    is_cross_case = source_case_id != target_case_id
    audit.log(source_case_id, "ADD_RELATIONSHIP", {
        "type": rel_type,
        "from": source_id,
        "to": target_id,
        "source": "manual",
        "cross_case": is_cross_case,
        "target_case_id": target_case_id if is_cross_case else None
    })

    # Also log to target case if cross-case
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
    """
    Rename a relationship type.
    Neo4j relationship types are immutable, so this is delete + create.
    """
    _check_label(source_type)
    _check_label(target_type)
    old_rel_type = sanitize_rel_type(old_rel_type)
    new_rel_type = sanitize_rel_type(new_rel_type)

    if old_rel_type == new_rel_type:
        return {"type": new_rel_type}

    # Get existing relationship's confidence
    rows = db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{old_rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) "
        "RETURN coalesce(r.confidence, 1) AS confidence",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )
    if not rows:
        raise LookupError("Relationship not found.")
    confidence = rows[0]["confidence"]

    # Delete old relationship
    db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{old_rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) DELETE r",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )

    # Create new relationship with same confidence
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
    """Delete a relationship between two entities"""
    _check_label(source_type)
    _check_label(target_type)
    rel_type = sanitize_rel_type(rel_type)

    # Check if relationship exists
    rows = db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $source_case_id}})"
        f"-[r:{rel_type}]->(b:{target_type} {{id: $t, case_id: $target_case_id}}) "
        "RETURN r",
        {"s": source_id, "t": target_id, "source_case_id": source_case_id, "target_case_id": target_case_id},
    )
    if not rows:
        raise LookupError("Relationship not found.")

    # Delete the relationship
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
    Convert an entity from one type to another while preserving all relationships.
    Creates new node with new label, redirects relationships, deletes old node.
    """
    old_prop = _check_label(current_label)
    new_prop = _check_label(new_label)

    if current_label == new_label:
        raise ValueError("Node is already of that type.")

    # Check if entity exists
    node_rows = db.query(
        f"MATCH (n:{current_label} {{id: $id, case_id: $case_id}}) RETURN n",
        {"id": node_id, "case_id": case_id},
    )
    if not node_rows:
        raise LookupError("Entity not found.")

    # Check if new type with same id already exists
    clash = db.query(
        f"MATCH (n:{new_label} {{id: $id, case_id: $case_id}}) RETURN n.id AS id",
        {"id": node_id, "case_id": case_id},
    )
    if clash:
        raise ValueError(f"A {new_label} with this identifier already exists.")

    # Get all properties from old node
    props_rows = db.query(
        f"MATCH (n:{current_label} {{id: $id, case_id: $case_id}}) RETURN properties(n) AS props",
        {"id": node_id, "case_id": case_id},
    )
    if not props_rows:
        raise LookupError("Entity not found.")

    props = dict(props_rows[0]["props"])
    props.pop(old_prop, None)  # Remove old property
    props[new_prop] = node_id   # Set new property
    props["id"] = node_id
    props["case_id"] = case_id

    # Build SET clause for new node
    set_clauses = []
    params = {"id": node_id, "case_id": case_id}
    for key, value in props.items():
        if key not in ("id", "case_id"):
            param_key = f"prop_{key}"
            set_clauses.append(f"n.{key} = ${param_key}")
            params[param_key] = value

    set_clause = ", ".join(set_clauses) if set_clauses else ""

    # Create new node with new label
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

    # Delete old node
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
