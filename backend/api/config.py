import json
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_config():
    with open(ROOT / "config" / "config.json") as f:
        cfg = json.load(f)
    # allow env overrides (e.g. NEO4J_PASSWORD, JWT_SECRET)
    if os.getenv("NEO4J_PASSWORD"):
        cfg["neo4j"]["password"] = os.getenv("NEO4J_PASSWORD")
    if os.getenv("JWT_SECRET"):
        cfg["jwt"]["secret"] = os.getenv("JWT_SECRET")
    return cfg


config = load_config()