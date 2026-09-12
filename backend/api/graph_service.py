"""Graph service: writes/reads the network.

When Neo4j is reachable it is the source of truth. Until you spin up a local
Neo4j instance, GRAPH_MODE=seed returns a small in-memory graph so the API and
frontend work end-to-end during development.
"""

import os

from .config import config

SEED = {
    "nodes": [
        {"id": "p1", "label": "Ramesh Kumar", "type": "Person", "centrality": 0.9, "anomaly_flags": ["cross_case_phone"]},
        {"id": "p2", "label": "Suresh Kumar", "type": "Person", "centrality": 0.55, "anomaly_flags": []},
        {"id": "p3", "label": "Anil Verma", "type": "Person", "centrality": 0.4, "anomaly_flags": []},
        {"id": "v1", "label": "MH-12-AB-3456", "type": "Vehicle", "centrality": 0.3, "anomaly_flags": []},
        {"id": "ph1", "label": "+91-9876543210", "type": "Phone", "centrality": 0.7, "anomaly_flags": ["cross_case_phone"]},
        {"id": "l1", "label": "Nashik", "type": "Location", "centrality": 0.2, "anomaly_flags": []},
    ],
    "edges": [
        {"source": "p1", "target": "p2", "label": "called", "type": "COMMUNICATION", "weight": 4, "confidence": 0.9},
        {"source": "p1", "target": "p3", "label": "transferred funds to", "type": "FINANCIAL", "weight": 2, "confidence": 0.6},
        {"source": "p2", "target": "ph1", "label": "owns", "type": "OWNS", "weight": 1, "confidence": 0.8},
        {"source": "p1", "target": "v1", "label": "owns", "type": "OWNS", "weight": 1, "confidence": 0.7},
        {"source": "p1", "target": "l1", "label": "based_in", "type": "LOCATION", "weight": 1, "confidence": 0.5},
    ],
}


def _seed_mode():
    return os.getenv("GRAPH_MODE", "seed") == "seed"


def _driver():
    from neo4j import GraphDatabase

    return GraphDatabase.driver(
        config["neo4j"]["uri"],
        auth=(config["neo4j"]["user"], config["neo4j"]["password"]),
    )


def get_graph():
    """Return {'nodes': [...], 'edges': [...]} for the frontend."""
    if _seed_mode():
        return SEED
    with _driver().session() as s:
        # Query nodes with their properties
        nodes_res = s.run(
            """MATCH (n) RETURN n.id AS id, n.label AS label, n.type AS type,
               n.centrality AS centrality, n.pagerank AS pagerank,
               n.anomaly_flags AS anomaly_flags"""
        )
        nodes = [
            {
                "id": r["id"],
                "label": r["label"],
                "type": r["type"],
                "centrality": r["centrality"] or 0.0,
                "pagerank": r["pagerank"] or 0.0,
                "anomaly_flags": r["anomaly_flags"] or [],
            }
            for r in nodes_res
        ]

        # Query edges with their properties
        edges_res = s.run(
            """MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target,
               r.label AS label, r.type AS type, r.weight AS weight,
               r.confidence AS confidence"""
        )
        edges = [
            {
                "source": r["source"],
                "target": r["target"],
                "label": r["label"],
                "type": r["type"],
                "weight": r["weight"] or 1,
                "confidence": r["confidence"] or 0.0,
            }
            for r in edges_res
        ]

        return {"nodes": nodes, "edges": edges}


def get_alerts():
    """Return nodes flagged with anomaly_flags (Stage 7 output → real data)."""
    if _seed_mode():
        return [
            {
                "node_id": n["id"],
                "label": n["label"],
                "type": n["type"],
                "flags": n.get("anomaly_flags", []),
                "reason": "appears across unrelated case files",
            }
            for n in SEED["nodes"]
            if n.get("anomaly_flags")
        ]
    with _driver().session() as s:
        res = s.run(
            """MATCH (n) WHERE size(n.anomaly_flags) > 0
               RETURN n.id AS node_id, n.label AS label, n.type AS type,
               n.anomaly_flags AS flags"""
        ).data()
        return [
            {**r, "reason": "flagged by Stage 7 anomaly rules"} for r in res
        ]


def merge_ingested(entities: list[dict], relationships: list[dict]) -> None:
    """In seed mode, reflect a just-ingested report in the in-memory graph so
    the demo graph grows as reports are uploaded (Neo4j optional). Idempotent:
    entities merge on canonical label; edges merge on (source,target,type)."""
    if not _seed_mode():
        return

    # Merge nodes by label (canonical text).
    for ent in entities or ():
        label = str(ent.get("text") or "").strip()
        if not label:
            continue
        etype = ent.get("type")
        cid = ent.get("canonical_id") or f"ent_{label}"
        existing = next((n for n in SEED["nodes"] if n["label"] == label), None)
        if existing is not None:
            existing.setdefault("type", etype)
        else:
            SEED["nodes"].append(
                {
                    "id": cid,
                    "label": label,
                    "type": etype,
                    "centrality": 0.5,
                    "anomaly_flags": [],
                }
            )

    # Merge edges by (source, target, type) using label as the node key.
    for rel in relationships or ():
        src_label = rel.get("source")
        tgt_label = rel.get("target")
        rtype = rel.get("type") or rel.get("source_type")
        if not src_label or not tgt_label or not rtype:
            continue
        def _id_for(label):
            node = next((n for n in SEED["nodes"] if n["label"] == label), None)
            return node["id"] if node else label
        src_id, tgt_id = _id_for(src_label), _id_for(tgt_label)
        existing = next(
            (
                e for e in SEED["edges"]
                if e["source"] == src_id and e["target"] == tgt_id and e["type"] == rtype
            ),
            None,
        )
        if existing is not None:
            existing["weight"] = existing.get("weight", 0) + int(rel.get("weight") or 1)
            existing["confidence"] = max(existing.get("confidence", 0.0), float(rel.get("confidence") or 0.0))
        else:
            SEED["edges"].append(
                {
                    "source": src_id,
                    "target": tgt_id,
                    "label": str(rtype).title(),
                    "type": rtype,
                    "weight": int(rel.get("weight") or 1),
                    "confidence": float(rel.get("confidence") or 0.0),
                }
            )