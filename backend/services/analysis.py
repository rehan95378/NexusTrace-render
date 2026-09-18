import networkx as nx

from utils import neo4j_driver as db


def _build_graph(edge_records):
    G = nx.DiGraph()
    financial_G = nx.DiGraph()
    for rec in edge_records:
        G.add_edge(rec["src"], rec["tgt"], rel=rec["rel"])
        if rec["rel"] == "FINANCIAL_TRAIL":
            financial_G.add_edge(rec["src"], rec["tgt"])
    return G, financial_G


def key_players(top_n=10):
    edge_records = db.fetch_graph_edges()
    if not edge_records:
        return {"ranked": [], "message": "No graph data yet. Run ingestion first."}

    G, _ = _build_graph(edge_records)
    person_ids = {r["v"] for r in db.query("MATCH (p:Person) RETURN p.id AS v")}

    pagerank_scores = nx.pagerank(G) if G.number_of_nodes() > 0 else {}
    try:
        betweenness_scores = nx.betweenness_centrality(G)
    except Exception:
        betweenness_scores = {}

    ranked = sorted(
        [
            {"name": node, "pagerank": pagerank_scores.get(node, 0), "betweenness": betweenness_scores.get(node, 0)}
            for node in G.nodes() if node in person_ids
        ],
        key=lambda x: x["pagerank"], reverse=True,
    )
    if not ranked:
        return {"ranked": [], "message": "No person nodes with connections found yet."}
    return {"ranked": ranked[:top_n], "message": None}


def anomalies():
    edge_records = db.fetch_graph_edges()
    if not edge_records:
        return {"message": "No graph data yet. Run ingestion first.", "cycles": [], "high_connectivity": [], "clusters": None, "bridges": []}

    G, financial_G = _build_graph(edge_records)
    person_ids = {r["v"] for r in db.query("MATCH (p:Person) RETURN p.id AS v")}

    try:
        cycles = [cycle + [cycle[0]] for cycle in nx.simple_cycles(financial_G)]
    except Exception:
        cycles = []

    degrees = {n: G.degree(n) for n in G.nodes() if n in person_ids}
    high_connectivity = []
    if degrees:
        avg_degree = sum(degrees.values()) / len(degrees)
        threshold = avg_degree * 2
        flagged = {n: d for n, d in degrees.items() if d > threshold and d > 2}
        high_connectivity = [
            {"name": n, "degree": d, "network_average": round(avg_degree, 1)}
            for n, d in sorted(flagged.items(), key=lambda x: x[1], reverse=True)
        ]

    undirected = G.to_undirected()
    try:
        components = list(nx.connected_components(undirected))
    except Exception:
        components = []

    bridges = []
    cluster_count = len(components)
    if cluster_count <= 1:
        cut_vertices = list(nx.articulation_points(undirected)) if undirected.number_of_nodes() > 2 else []
        bridges = [n for n in cut_vertices if n in person_ids]

    return {
        "message": None,
        "cycles": cycles,
        "high_connectivity": high_connectivity,
        "cluster_count": cluster_count,
        "bridges": bridges,
    }
