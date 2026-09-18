"""
Manual entity/relationship CRUD, scoped to one case. Powers the node
click-for-details panel and its add/edit/merge/delete actions.

Node identity stays consistent with pipeline.py: for a given label, the
node's `id` property IS its identifying value (name/plate/number). So a
"rename" has to update `id` itself, not just the display property — every
relationship MATCH elsewhere in the app keys off `id`.
"""
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

VALID_REL_TYPES = {
    "ASSOCIATE_OF", "FINANCIAL_TRAIL", "CDR_LINK", "SPOTTED_AT",
    "OWNS_VEHICLE", "USES_DEVICE", "INTERCEPTED_CALL", "ASSOCIATED_WITH",
    "CAMERA_LOG",
}


def _check_label(label):
    if label not in PROP_MAP:
        raise ValueError(f"Unknown entity type: {label}")
    return PROP_MAP[label]


def _check_rel_type(rel_type):
    if rel_type not in VALID_REL_TYPES:
        raise ValueError(f"Unknown relationship type: {rel_type}")


def get_entity_detail(case_id, label, node_id):
    """Node's own data plus every relationship touching it, either direction."""
    prop = _check_label(label)
    rows = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}}) "
        f"RETURN n.id AS id, n.{prop} AS value",
        {"id": node_id, "case_id": case_id},
    )
    if not rows:
        return None

    outgoing = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}})-[r]->(m {{case_id: $case_id}}) "
        "RETURN type(r) AS rel_type, labels(m)[0] AS target_type, m.id AS target_id, "
        "coalesce(r.confidence, 1) AS confidence",
        {"id": node_id, "case_id": case_id},
    )
    incoming = db.query(
        f"MATCH (n:{label} {{id: $id, case_id: $case_id}})<-[r]-(m {{case_id: $case_id}}) "
        "RETURN type(r) AS rel_type, labels(m)[0] AS source_type, m.id AS source_id, "
        "coalesce(r.confidence, 1) AS confidence",
        {"id": node_id, "case_id": case_id},
    )
    return {
        "type": label,
        "id": rows[0]["id"],
        "value": rows[0]["value"],
        "outgoing": outgoing,
        "incoming": incoming,
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


def add_relationship(case_id, source_type, source_id, target_type, target_id, rel_type):
    _check_label(source_type)
    _check_label(target_type)
    _check_rel_type(rel_type)
    rows = db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $case_id}}), "
        f"(b:{target_type} {{id: $t, case_id: $case_id}}) "
        f"MERGE (a)-[r:{rel_type}]->(b) "
        "SET r.confidence = coalesce(r.confidence, 0) + 1 "
        "RETURN a.id AS s, b.id AS t",
        {"s": source_id, "t": target_id, "case_id": case_id},
    )
    if not rows:
        raise LookupError("Source or target entity not found.")
    audit.log(case_id, "ADD_RELATIONSHIP", {
        "type": rel_type, "from": source_id, "to": target_id, "source": "manual",
    })


def delete_relationship(case_id, source_type, source_id, target_type, target_id, rel_type):
    _check_label(source_type)
    _check_label(target_type)
    _check_rel_type(rel_type)
    db.query(
        f"MATCH (a:{source_type} {{id: $s, case_id: $case_id}})"
        f"-[r:{rel_type}]->(b:{target_type} {{id: $t, case_id: $case_id}}) DELETE r",
        {"s": source_id, "t": target_id, "case_id": case_id},
    )
    audit.log(case_id, "DELETE_RELATIONSHIP", {"type": rel_type, "from": source_id, "to": target_id})
