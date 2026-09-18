"""
Every write to the graph is logged with a SHA-256 hash chain: each entry's
hash depends on the previous entry's hash, so altering any past entry breaks
the chain from that point forward.

Each *case* now has its own independent chain, starting from GENESIS — a
tamper check on Case 1 says nothing about Case 2, which matches "each case
holds its own reports/entities/graph" being separate throughout the app.

PERFORMANCE NOTE: log() avoids re-querying Neo4j for the chain "tip" (next
seq, last hash) on every call — that used to cost 2 extra round-trips per
call on top of the CREATE itself. Instead the tip for each case_id is cached
in memory after its first use and updated in-process after every successful
write.

Caveat: this assumes a single backend process talking to this Neo4j
instance (true for the current single-service Render deployment). Scaling
to multiple worker processes would need the tip moved to a shared store
(e.g. Redis) or made atomic on the Neo4j side instead.
"""
import hashlib
import json
import threading
from datetime import datetime, timezone

from utils import neo4j_driver as db

GENESIS = "GENESIS"

_lock = threading.Lock()
_cache = {}  # case_id -> {"seq": int, "hash": str}


def _compute_hash(entry, prev_hash):
    payload = json.dumps(entry, sort_keys=True) + prev_hash
    return hashlib.sha256(payload.encode()).hexdigest()


def _get_case_cache(case_id):
    if case_id not in _cache:
        seq_rows = db.query(
            "MATCH (a:AuditEntry {case_id: $case_id}) RETURN coalesce(max(a.seq), -1) AS max_seq",
            {"case_id": case_id},
        )
        seq = (seq_rows[0]["max_seq"] if seq_rows else -1) + 1
        hash_rows = db.query(
            "MATCH (a:AuditEntry {case_id: $case_id}) RETURN a.hash AS hash ORDER BY a.seq DESC LIMIT 1",
            {"case_id": case_id},
        )
        last_hash = hash_rows[0]["hash"] if hash_rows else GENESIS
        _cache[case_id] = {"seq": seq, "hash": last_hash}
    return _cache[case_id]


def log(case_id, action, details):
    with _lock:
        cache = _get_case_cache(case_id)
        prev_hash = cache["hash"]
        seq = cache["seq"]

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "details": details,
        }
        entry_hash = _compute_hash(entry, prev_hash)

        db.query(
            "CREATE (a:AuditEntry {case_id: $case_id, seq: $seq, timestamp: $timestamp, "
            "action: $action, details: $details, prev_hash: $prev_hash, hash: $hash})",
            {
                "case_id": case_id,
                "seq": seq,
                "timestamp": entry["timestamp"],
                "action": action,
                "details": json.dumps(details, sort_keys=True),
                "prev_hash": prev_hash,
                "hash": entry_hash,
            },
        )

        # Only advance the cached tip after the write succeeds, so a failed
        # CREATE can't desync the cache from what's actually in Neo4j.
        cache["seq"] = seq + 1
        cache["hash"] = entry_hash

        return {**entry, "seq": seq, "prev_hash": prev_hash, "hash": entry_hash}


def list_entries(case_id, limit=200):
    rows = db.query(
        "MATCH (a:AuditEntry {case_id: $case_id}) RETURN a.seq AS seq, a.timestamp AS timestamp, "
        "a.action AS action, a.details AS details, a.prev_hash AS prev_hash, a.hash AS hash "
        "ORDER BY a.seq DESC LIMIT $limit",
        {"case_id": case_id, "limit": limit},
    )
    for r in rows:
        try:
            r["details"] = json.loads(r["details"])
        except (TypeError, ValueError):
            pass
    return rows


def verify_chain(case_id):
    """Recompute one case's full chain and confirm nothing was altered."""
    rows = db.query(
        "MATCH (a:AuditEntry {case_id: $case_id}) RETURN a.seq AS seq, a.timestamp AS timestamp, "
        "a.action AS action, a.details AS details, a.hash AS hash "
        "ORDER BY a.seq ASC",
        {"case_id": case_id},
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


def clear(case_id):
    db.query("MATCH (a:AuditEntry {case_id: $case_id}) DETACH DELETE a", {"case_id": case_id})
    with _lock:
        _cache.pop(case_id, None)
