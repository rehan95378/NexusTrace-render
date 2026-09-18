"""
Every write to the graph is logged with a SHA-256 hash chain: each entry's
hash depends on the previous entry's hash, so altering any past entry breaks
the chain from that point forward. The Streamlit prototype kept this in
st.session_state (lost on refresh); here it's persisted as :AuditEntry nodes
in Neo4j so it survives restarts and is shared across all clients.
"""
import hashlib
import json
from datetime import datetime, timezone

from utils import neo4j_driver as db

GENESIS = "GENESIS"


def _compute_hash(entry, prev_hash):
    payload = json.dumps(entry, sort_keys=True) + prev_hash
    return hashlib.sha256(payload.encode()).hexdigest()


def _next_seq():
    rows = db.query("MATCH (a:AuditEntry) RETURN coalesce(max(a.seq), -1) AS max_seq")
    return rows[0]["max_seq"] + 1 if rows else 0


def _last_hash():
    rows = db.query(
        "MATCH (a:AuditEntry) RETURN a.hash AS hash ORDER BY a.seq DESC LIMIT 1"
    )
    return rows[0]["hash"] if rows else GENESIS


def log(action, details):
    prev_hash = _last_hash()
    seq = _next_seq()
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "details": details,
    }
    entry_hash = _compute_hash(entry, prev_hash)
    db.query(
        "CREATE (a:AuditEntry {seq: $seq, timestamp: $timestamp, action: $action, "
        "details: $details, prev_hash: $prev_hash, hash: $hash})",
        {
            "seq": seq,
            "timestamp": entry["timestamp"],
            "action": action,
            "details": json.dumps(details, sort_keys=True),
            "prev_hash": prev_hash,
            "hash": entry_hash,
        },
    )
    return {**entry, "seq": seq, "prev_hash": prev_hash, "hash": entry_hash}


def list_entries(limit=200):
    rows = db.query(
        "MATCH (a:AuditEntry) RETURN a.seq AS seq, a.timestamp AS timestamp, "
        "a.action AS action, a.details AS details, a.prev_hash AS prev_hash, a.hash AS hash "
        "ORDER BY a.seq DESC LIMIT $limit",
        {"limit": limit},
    )
    for r in rows:
        try:
            r["details"] = json.loads(r["details"])
        except (TypeError, ValueError):
            pass
    return rows


def verify_chain():
    """Recompute the full chain and confirm nothing was altered after the fact."""
    rows = db.query(
        "MATCH (a:AuditEntry) RETURN a.seq AS seq, a.timestamp AS timestamp, "
        "a.action AS action, a.details AS details, a.hash AS hash "
        "ORDER BY a.seq ASC"
    )
    prev_hash = GENESIS
    for row in rows:
        try:
            details = json.loads(row["details"])
        except (TypeError, ValueError):
            details = row["details"]
        check_entry = {"timestamp": row["timestamp"], "action": row["action"], "details": details}
        expected_hash = _compute_hash(check_entry, prev_hash)
        if expected_hash != row["hash"]:
            return False, row
        prev_hash = row["hash"]
    return True, None


def clear():
    db.query("MATCH (a:AuditEntry) DETACH DELETE a")
