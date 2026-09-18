from utils.neo4j_driver import fetch_graph_edges


def get_graph() -> dict:
    """Nodes/edges for the frontend's evidence graph view."""
    records = fetch_graph_edges()
    nodes, edges, seen = [], [], set()

    for rec in records:
        src_label = rec["src_labels"][0] if rec["src_labels"] else "Unknown"
        tgt_label = rec["tgt_labels"][0] if rec["tgt_labels"] else "Unknown"
        src_key = f"{src_label}:{rec['src']}"
        tgt_key = f"{tgt_label}:{rec['tgt']}"

        if src_key not in seen:
            nodes.append({"id": src_key, "label": f"{src_label}: {rec['src']}", "type": src_label})
            seen.add(src_key)
        if tgt_key not in seen:
            nodes.append({"id": tgt_key, "label": f"{tgt_label}: {rec['tgt']}", "type": tgt_label})
            seen.add(tgt_key)

        edges.append({
            "source": src_key,
            "target": tgt_key,
            "type": rec["rel"],
            "confidence": rec["confidence"],
        })

    return {"nodes": nodes, "edges": edges}