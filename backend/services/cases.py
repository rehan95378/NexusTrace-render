"""
Case management: each case is an independent graph + audit log. Creating a
case just creates a :Case node; entities and audit entries belonging to it
carry its id as a case_id property (see neo4j_driver.py, pipeline.py,
audit.py). Deleting a case removes everything tagged with its id.
"""
import uuid
from datetime import datetime, timezone

from utils import neo4j_driver as db


def create_case(name):
    case_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    db.query(
        "CREATE (c:Case {id: $id, name: $name, created_at: $created_at})",
        {"id": case_id, "name": name, "created_at": created_at},
    )
    return {"id": case_id, "name": name, "created_at": created_at, "entity_count": 0}


def list_cases():
    """All cases, newest first, each with a quick entity count so the case
    switcher can show 'Case 01 — 34 entities' without a second round-trip."""
    return db.query(
        "MATCH (c:Case) "
        "OPTIONAL MATCH (n) WHERE n.case_id = c.id AND NOT n:Case AND NOT n:AuditEntry "
        "RETURN c.id AS id, c.name AS name, c.created_at AS created_at, "
        "count(n) AS entity_count "
        "ORDER BY c.created_at DESC"
    )


def get_case(case_id):
    rows = db.query(
        "MATCH (c:Case {id: $id}) RETURN c.id AS id, c.name AS name, c.created_at AS created_at",
        {"id": case_id},
    )
    return rows[0] if rows else None


def rename_case(case_id, name):
    db.query("MATCH (c:Case {id: $id}) SET c.name = $name", {"id": case_id, "name": name})


def delete_case(case_id):
    db.delete_case(case_id)


def validate_case_name(name):
    """Validate case name - return stripped name or raise ValueError"""
    name = name.strip()
    if not name:
        raise ValueError("Case name is required.")
    return name


def require_case(case_id):
    """Check if case exists, return it or raise ValueError"""
    case = get_case(case_id)
    if not case:
        raise ValueError("Case not found.")
    return case
