from fastapi import APIRouter

from utils import neo4j_driver as db

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