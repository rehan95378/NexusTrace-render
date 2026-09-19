from fastapi import APIRouter

from utils import neo4j_driver as db
from services import cross_case

router = APIRouter()

COLOR_MAP = {
    "Person": "#E3A008",
    "Location": "#2FA8A0",
    "Vehicle": "#5B8DEF",
    "Phone": "#B076E0",
    "Organization": "#6FCF6F",
}

NODE_LABELS = list(COLOR_MAP.keys())


def node_key(label, id_):
    # Keying on (label, id) rather than just id makes every node's identity
    # unambiguous within a case, since ids are raw text and two different
    # entity types could otherwise coincidentally share the same id string.
    return f"{label}:{id_}"


def all_case_node_key(case_id, label, id_):
    # For the combined all-cases graph, node identity has to include case_id
    # too — otherwise "Rohan Sharma" in two different, unrelated cases would
    # collapse into a single node instead of staying two separate people who
    # just happen to share a name. (Cross-case *linking* — drawing an edge
    # between genuinely related cross-case entities — is a deliberate
    # separate step; see BUILD.md. This key just keeps unrelated cases from
    # accidentally merging by accident of same-text ids.)
    return f"{case_id}:{label}:{id_}"


@router.get("/cases/{case_id}/graph")
def get_graph(case_id: str):
    nodes, edges, seen = [], [], set()

    # Every entity node for this case, regardless of whether it has any
    # relationships yet — a freshly created node or one whose only
    # relationship was just deleted still needs to show up on the canvas.
    label_filter = " OR ".join(f"n:{label}" for label in NODE_LABELS)
    node_rows = db.query(
        f"MATCH (n {{case_id: $case_id}}) WHERE {label_filter} "
        "RETURN n.id AS id, labels(n) AS labels",
        {"case_id": case_id},
    )
    for record in node_rows:
        label = record["labels"][0] if record["labels"] else "Unknown"
        node_id = record["id"]
        key = node_key(label, node_id)
        if key not in seen:
            nodes.append({"id": key, "label": f"{label}: {node_id}", "type": label,
                          "color": COLOR_MAP.get(label, "#8A8A8A")})
            seen.add(key)

    results = db.query(
        "MATCH (n {case_id: $case_id})-[r]->(m {case_id: $case_id}) "
        "RETURN n.id AS n_id, labels(n) AS n_labels, "
        "m.id AS m_id, labels(m) AS m_labels, type(r) AS rel_type, "
        "coalesce(r.confidence, 1) AS confidence",
        {"case_id": case_id},
    )

    for record in results:
        n_label = record["n_labels"][0] if record["n_labels"] else "Unknown"
        m_label = record["m_labels"][0] if record["m_labels"] else "Unknown"
        n_id, m_id = record["n_id"], record["m_id"]
        n_key, m_key = node_key(n_label, n_id), node_key(m_label, m_id)

        # Defensive: in case either endpoint wasn't picked up by the node
        # query above for some reason, don't silently drop the edge.
        if n_key not in seen:
            nodes.append({"id": n_key, "label": f"{n_label}: {n_id}", "type": n_label,
                          "color": COLOR_MAP.get(n_label, "#8A8A8A")})
            seen.add(n_key)
        if m_key not in seen:
            nodes.append({"id": m_key, "label": f"{m_label}: {m_id}", "type": m_label,
                          "color": COLOR_MAP.get(m_label, "#8A8A8A")})
            seen.add(m_key)

        edges.append({
            "source": n_key,
            "target": m_key,
            "label": record["rel_type"],
            "confidence": record["confidence"],
        })

    return {"nodes": nodes, "edges": edges}


@router.get("/graph/all")
def get_all_graph():
    """Combined graph across every case — backs the Evidence Graph Map's
    'All cases' toggle. Each node/edge carries its case_id/case_name so the
    frontend can render per-case show/hide checkboxes and style genuine
    cross-case link edges differently from ordinary in-case relationship edges."""
    cases = db.query("MATCH (c:Case) RETURN c.id AS id, c.name AS name ORDER BY c.created_at DESC")
    case_names = {c["id"]: c["name"] for c in cases}

    label_filter_n = " OR ".join(f"n:{label}" for label in NODE_LABELS)
    label_filter_m = " OR ".join(f"m:{label}" for label in NODE_LABELS)

    nodes, edges, seen = [], [], set()

    node_rows = db.query(
        f"MATCH (n) WHERE ({label_filter_n}) AND n.case_id IS NOT NULL "
        "RETURN n.id AS id, labels(n) AS labels, n.case_id AS case_id"
    )
    for record in node_rows:
        label = record["labels"][0] if record["labels"] else "Unknown"
        case_id = record["case_id"]
        node_id = record["id"]
        key = all_case_node_key(case_id, label, node_id)
        if key not in seen:
            nodes.append({
                "id": key,
                "label": f"{label}: {node_id}",
                "type": label,
                "color": COLOR_MAP.get(label, "#8A8A8A"),
                "case_id": case_id,
                "case_name": case_names.get(case_id, case_id),
            })
            seen.add(key)

    # Within-case and manual cross-case edges
    results = db.query(
        f"MATCH (n)-[r]->(m) WHERE ({label_filter_n}) AND ({label_filter_m}) "
        "AND n.case_id IS NOT NULL AND m.case_id IS NOT NULL "
        "RETURN n.id AS n_id, labels(n) AS n_labels, n.case_id AS n_case_id, "
        "m.id AS m_id, labels(m) AS m_labels, m.case_id AS m_case_id, type(r) AS rel_type, "
        "coalesce(r.confidence, 1) AS confidence"
    )
    for record in results:
        n_label = record["n_labels"][0] if record["n_labels"] else "Unknown"
        m_label = record["m_labels"][0] if record["m_labels"] else "Unknown"
        n_case = record["n_case_id"]
        m_case = record["m_case_id"]
        n_key = all_case_node_key(n_case, n_label, record["n_id"])
        m_key = all_case_node_key(m_case, m_label, record["m_id"])

        edges.append({
            "source": n_key,
            "target": m_key,
            "label": record["rel_type"],
            "confidence": record["confidence"],
            "case_id": n_case,
            "link_type": "cross_case" if n_case != m_case else "in_case",
        })

    # Cross-case links: exact-match Phone/Vehicle/Organization + fuzzy-match Person
    for link in cross_case.find_cross_case_links():
        source_key = all_case_node_key(link["case_a"], link["type"], link["id_a"])
        target_key = all_case_node_key(link["case_b"], link["type"], link["id_b"])
        if source_key not in seen or target_key not in seen:
            continue  # defensive — both ends should always be in `nodes`
        label = "SAME PERSON (LIKELY)" if link["match_kind"] == "fuzzy" else "SAME " + link["type"].upper()
        edges.append({
            "source": source_key,
            "target": target_key,
            "label": label,
            "link_type": "cross_case",
            "match_kind": link["match_kind"],
            "score": link.get("score"),
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "cases": [{"id": c["id"], "name": c["name"]} for c in cases],
    }