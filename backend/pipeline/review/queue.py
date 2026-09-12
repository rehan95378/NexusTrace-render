"""Stage 8 - Review Queue store + splitter.

The review queue is a file-backed JSON store (no Neo4j dependency, so the
whole flow works during development). It holds two kinds of items:

  * low-confidence ENTITIES  (confidence <  review_entity_threshold)
  * low-confidence RELATIONSHIPS (type == ASSOCIATION, or confidence <
    confidence_relationship_high)

Splitting happens in :func:`split` — ``graph_items`` go to Neo4j as verified,
``review_items`` land in the queue with a stable ``item_id`` and ``status``
(``pending`` | ``approved`` | ``rejected``). An analyst can approve or reject
each one via the API.

Data contract (serialised item):
    {item_id, kind, status, type, text, confidence, source_doc_id, reason}
  where for relationships ``type`` is the relationship category (FINANCIAL /
  COMMUNICATION / FAMILY / ASSOCIATION) and ``text`` is "source -> target".
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = _ROOT / "data"
DEFAULT_QUEUE_PATH = DATA_DIR / "review_queue.json"

_QUEUE_PATH = os.environ.get("REVIEW_QUEUE_PATH", str(DEFAULT_QUEUE_PATH))

_lock = threading.Lock()

# Confident relationship categories that go straight to the main graph.
_CONFIDENT_REL_TYPES = ("FINANCIAL", "COMMUNICATION", "FAMILY")


def _defaults() -> dict:
    """Confidence thresholds. Prefer config if present, else sane defaults."""
    try:
        from api.config import config

        conf = config.get("conf", {})
        return {
            "review_entity_threshold": float(conf.get("review_entity_threshold", 0.5)),
            "confidence_relationship_high": float(conf.get("confidence_relationship_high", 0.7)),
        }
    except Exception:  # pragma: no cover - falls back when config unavailable
        return {
            "review_entity_threshold": 0.5,
            "confidence_relationship_high": 0.7,
        }


def set_queue_path(path: str | os.PathLike) -> None:
    """Override the queue file location (used mainly by tests)."""
    global _QUEUE_PATH
    _QUEUE_PATH = str(path)


def load() -> list[dict]:
    """Return all items currently in the queue (empty list if none/fresh)."""
    if not os.path.exists(_QUEUE_PATH):
        return []
    try:
        with open(_QUEUE_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save(items: list[dict]) -> None:
    Path(_QUEUE_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(_QUEUE_PATH, "w", encoding="utf-8") as fh:
        json.dump(items, fh, indent=2)


def _next_id(items: list[dict]) -> int:
    ids = [int(i.get("item_id", 0)) for i in items if str(i.get("item_id", "")).isdigit()]
    return (max(ids) if ids else 0) + 1


def _entity_is_low_conf(entity: dict, thresholds: dict) -> bool:
    """An entity needs review when below the entity threshold."""
    try:
        return float(entity.get("confidence") or 0.0) < thresholds["review_entity_threshold"]
    except (TypeError, ValueError):
        return True


def _relationship_is_low_conf(rel: dict, thresholds: dict) -> bool:
    """A relationship needs review when it is a loose ASSOCIATION / below the
    high-confidence gate (0.7). Confident typed links (0.85) are not reviewed."""
    rtype = rel.get("type", rel.get("source_type", ""))
    conf = rel.get("confidence")
    if rtype == "ASSOCIATION":
        return True
    try:
        return float(conf or 0.0) < thresholds["confidence_relationship_high"]
    except (TypeError, ValueError):
        return True


def _as_entity_item(e: dict, thresholds: dict) -> dict:
    return {
        "item_id": None,  # assigned on insertion
        "kind": "entity",
        "status": "pending",
        "type": e.get("type"),
        "text": e.get("text"),
        "confidence": round(float(e.get("confidence") or 0.0), 4),
        "source_doc_id": e.get("source_doc_id"),
        "reason": f"entity confidence below {thresholds['review_entity_threshold']}",
    }


def _as_relationship_item(r: dict, thresholds: dict) -> dict:
    rtype = r.get("type", r.get("source_type", ""))
    return {
        "item_id": None,
        "kind": "relationship",
        "status": "pending",
        "type": rtype,
        "text": f"{r.get('source')} -> {r.get('target')}",
        "confidence": round(float(r.get("confidence") or 0.0), 4),
        "weight": int(r.get("weight") or 1),
        "source_doc_id": r.get("source_doc_id"),
        "reason": (
            "loose co-occurrence (ASSOCIATION), unconfirmed"
            if rtype == "ASSOCIATION"
            else f"confidence below {thresholds['confidence_relationship_high']}"
        ),
    }


def split(entities: list[dict], relationships: list[dict]) -> dict:
    """Split resolved entities + relationships into graph-versus-review.

    Returns {"graph_entities": [...], "graph_relationships": [...],
             "review_items": [...]}. The graph lists only hold verified items;
    the review list is appended to the persistent queue.
    """
    thresholds = _defaults()

    graph_entities = [
        e for e in (entities or []) if not _entity_is_low_conf(e, thresholds)
    ]
    review_entities = [e for e in (entities or []) if _entity_is_low_conf(e, thresholds)]

    graph_relationships = []
    review_relationships = []
    for r in (relationships or []):
        if _relationship_is_low_conf(r, thresholds):
            review_relationships.append(r)
        else:
            graph_relationships.append(r)

    new_items = (
        [_as_entity_item(e, thresholds) for e in review_entities]
        + [_as_relationship_item(r, thresholds) for r in review_relationships]
    )
    review_items = enqueue(new_items)

    return {
        "graph_entities": graph_entities,
        "graph_relationships": graph_relationships,
        "review_items": review_items,
    }


def enqueue(items: list[dict]) -> list[dict]:
    """Persist a list of (id-less) items and return them WITH ids assigned."""
    if not items:
        return []
    with _lock:
        stored = load()
        for it in items:
            it["item_id"] = _next_id(stored + [it])
            stored.append(it)
        _save(stored)
    return items


def list_items(kind: str | None = None, status: str | None = None) -> list[dict]:
    """Return queue items, optionally filtered by kind/status."""
    items = load()
    if kind:
        items = [i for i in items if i.get("kind") == kind]
    if status:
        items = [i for i in items if i.get("status") == status]
    return items


def resolve(item_id, action: str) -> dict | None:
    """Transition one item's status: action in {'approve', 'reject'}.

    Returns the updated item, or None if the id is unknown. 'approve' records
    that an analyst confirmed the item (it may later be promoted to the graph);
    'reject' marks it as a false positive so the pipeline learns to drop it.
    """
    if action not in ("approve", "reject"):
        raise ValueError("action must be 'approve' or 'reject'")
    with _lock:
        items = load()
        for it in items:
            if str(it.get("item_id")) == str(item_id):
                it["status"] = f"{action}d" if action == "approve" else "rejected"
                _save(items)
                return it
    return None


def clear(status: str | None = None) -> int:
    """Remove all items (or only those matching ``status``). Returns removed count."""
    with _lock:
        items = load()
        kept = items if status is None else [i for i in items if i.get("status") != status]
        _save(kept)
        return len(items) - len(kept)