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
    query("MATCH (n) DETACH DELETE n")


def fetch_graph_edges():
    """All relationships as (src, tgt, rel, labels) tuples, used by analysis + graph views."""
    return query(
        "MATCH (n)-[r]->(m) RETURN n.id AS src, m.id AS tgt, type(r) AS rel, "
        "labels(n) AS src_labels, labels(m) AS tgt_labels, "
        "coalesce(r.confidence, 1) AS confidence"
    )


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
