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


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
