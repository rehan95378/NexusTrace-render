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


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None