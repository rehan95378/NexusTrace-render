import os
from neo4j import GraphDatabase

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        uri = os.environ["NEO4J_URI"]
        username = os.environ["NEO4J_USERNAME"]
        password = os.environ["NEO4J_PASSWORD"]
        _driver = GraphDatabase.driver(uri, auth=(username, password))
    return _driver


def verify_connectivity():
    """Returns True if we can actually reach and authenticate against Neo4j."""
    try:
        get_driver().verify_connectivity()
        return True
    except Exception:
        return False


def query(cypher_query, parameters=None):
    """Run a cypher query and return a list of records (dict-like)."""
    driver = get_driver()
    database = os.environ.get("NEO4J_DATABASE")
    with driver.session(database=database) if database else driver.session() as session:
        result = session.run(cypher_query, parameters or {})
        return [record.data() for record in result]


def clear_database():
    """Full nuke — every case, every entity, every audit entry. Not exposed
    via any API route; kept only for local dev/reset scripts."""
    query("MATCH (n) DETACH DELETE n")


def clear_case(case_id):
    """Delete all entities and relationships belonging to one case (but not
    the :Case node itself, and not other cases' data)."""
    query(
        "MATCH (n {case_id: $case_id}) WHERE NOT n:Case DETACH DELETE n",
        {"case_id": case_id},
    )


def delete_case(case_id):
    """Delete a case entirely: its entities, its audit log, and the :Case
    node itself."""
    query("MATCH (n {case_id: $case_id}) DETACH DELETE n", {"case_id": case_id})
    query("MATCH (c:Case {id: $case_id}) DETACH DELETE c", {"case_id": case_id})


def fetch_graph_edges(case_id):
    """All relationships within one case, as (src, tgt, rel, labels) tuples,
    used by analysis + graph views."""
    return query(
        "MATCH (n {case_id: $case_id})-[r]->(m {case_id: $case_id}) "
        "RETURN n.id AS src, m.id AS tgt, type(r) AS rel, "
        "labels(n) AS src_labels, labels(m) AS tgt_labels, "
        "coalesce(r.confidence, 1) AS confidence",
        {"case_id": case_id},
    )


def fetch_all_graph_edges():
    """All relationships across every case, plus cross-case links.
    Returns edges in the same format as fetch_graph_edges but includes
    case_id for each node so analysis can build the combined graph.
    Used by all-cases Key Players and Anomaly Detection."""
    from services import cross_case

    # Within-case edges across all cases
    # IMPORTANT: Node identifiers must be case_id:node_id format to keep
    # same-named entities in different cases distinct
    edges = []
    raw_edges = query(
        "MATCH (n)-[r]->(m) WHERE n.case_id = m.case_id "
        "RETURN n.id AS src, n.case_id AS src_case, m.id AS tgt, "
        "m.case_id AS tgt_case, type(r) AS rel, "
        "labels(n) AS src_labels, labels(m) AS tgt_labels, "
        "coalesce(r.confidence, 1) AS confidence"
    )

    for edge in raw_edges:
        edges.append({
            "src": f"{edge['src_case']}:{edge['src']}",
            "src_case": edge["src_case"],
            "tgt": f"{edge['tgt_case']}:{edge['tgt']}",
            "tgt_case": edge["tgt_case"],
            "rel": edge["rel"],
            "src_labels": edge["src_labels"],
            "tgt_labels": edge["tgt_labels"],
            "confidence": edge["confidence"]
        })

    # Cross-case link edges (Phone/Vehicle/Organization exact match + Person fuzzy)
    # These are virtual edges computed on-demand, not stored in Neo4j
    for link in cross_case.find_cross_case_links():
        # Format: same as within-case edges but with cross-case node identifiers
        label = "SAME_PERSON_LIKELY" if link["match_kind"] == "fuzzy" else f"SAME_{link['type'].upper()}"
        edges.append({
            "src": f"{link['case_a']}:{link['id_a']}",
            "src_case": link["case_a"],
            "tgt": f"{link['case_b']}:{link['id_b']}",
            "tgt_case": link["case_b"],
            "rel": label,
            "src_labels": [link["type"]],
            "tgt_labels": [link["type"]],
            "confidence": link.get("score", 100) / 100.0  # normalize to 0-1
        })

    return edges


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
