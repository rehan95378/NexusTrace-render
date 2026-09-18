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


def node_key(label, id_):
    # Keying on (label, id) rather than just id makes every node's identity
    # unambiguous, since ids are raw text and two different entity types
    # could otherwise coincidentally share the same id string.
    return f"{label}:{id_}"


@router.get("/graph")
def get_graph():
    results = db.query(
        "MATCH (n)-[r]->(m) RETURN n.id AS n_id, labels(n) AS n_labels, "
        "m.id AS m_id, labels(m) AS m_labels, type(r) AS rel_type, "
        "coalesce(r.confidence, 1) AS confidence"
    )
    nodes, edges, seen = [], [], set()

    for record in results:
        n_label = record["n_labels"][0] if record["n_labels"] else "Unknown"
        m_label = record["m_labels"][0] if record["m_labels"] else "Unknown"
        n_id, m_id = record["n_id"], record["m_id"]
        n_key, m_key = node_key(n_label, n_id), node_key(m_label, m_id)

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