"""
Cross-case entity linking for the Evidence Graph Map.

Implements BUILD.md section 3.4's locked linking rules:
- Phone: exact match on number
- Vehicle: exact match on plate
- Organization: exact match on name
- Person: fuzzy match via resolution.py's logic, higher threshold (92-93 vs 85)
- Location: deliberately not linked (too noisy)

Returns cross-case link pairs as {type, case_a, id_a, case_b, id_b, match_kind}
for consumption by routers/graph.py's GET /graph/all endpoint.
"""

from utils import neo4j_driver as db
from services.resolution import compute_person_match_score


def find_cross_case_links(case_ids=None):
    """
    Finds cross-case entity links using the rules in BUILD.md section 3.4.

    Args:
        case_ids: Optional list of case IDs to limit the search. If None, searches
                  across all cases.

    Returns:
        List of dicts: [
            {
                "type": "Phone" | "Vehicle" | "Organization" | "Person",
                "case_a": case_id,
                "id_a": entity_id in case A,
                "case_b": case_id,
                "id_b": entity_id in case B,
                "match_kind": "exact" | "fuzzy",
                "score": float (only present for fuzzy matches)
            },
            ...
        ]
    """
    links = []

    # Build case filter clause if case_ids provided
    case_filter = ""
    params = {}
    if case_ids:
        case_filter = "WHERE n.case_id IN $case_ids"
        params["case_ids"] = case_ids

    # Exact match types: Phone, Vehicle, Organization
    exact_match_types = [
        ("Phone", "phone"),
        ("Vehicle", "plate"),
        ("Organization", "org_name")
    ]

    for label, _ in exact_match_types:
        # Get all entities of this type across cases
        query = f"""
        MATCH (n:{label})
        {case_filter}
        RETURN n.case_id AS case_id, n.id AS id
        ORDER BY n.case_id, n.id
        """
        entities = db.query(query, params)

        # Group by id for pairwise comparison across different cases
        id_to_cases = {}
        for entity in entities:
            entity_id = entity["id"]
            case_id = entity["case_id"]
            if entity_id not in id_to_cases:
                id_to_cases[entity_id] = []
            id_to_cases[entity_id].append(case_id)

        # For each id that appears in multiple cases, create cross-case links
        for entity_id, cases in id_to_cases.items():
            if len(cases) > 1:
                # Create links between all pairs of cases with this entity
                for i in range(len(cases)):
                    for j in range(i + 1, len(cases)):
                        links.append({
                            "type": label,
                            "case_a": cases[i],
                            "id_a": entity_id,
                            "case_b": cases[j],
                            "id_b": entity_id,
                            "match_kind": "exact"
                        })

    # Fuzzy match for Person (BUILD.md step 3)
    # Higher threshold (93) than within-case (85) to avoid false positives
    person_links = _fuzzy_match_persons(case_filter, params, threshold=93)
    links.extend(person_links)

    return links


def _fuzzy_match_persons(case_filter, params, threshold=93):
    """
    Person fuzzy matching using resolution.py's logic at a higher threshold.

    Threshold: 93 (vs 85 for within-case matching) to avoid false positives
    like two unrelated "Suresh Patil"s in different cases.

    Args:
        case_filter: WHERE clause string for case filtering
        params: Query parameters dict
        threshold: Minimum match score (0-100) to consider a link

    Returns:
        List of person link dicts with match_kind="fuzzy" and score field
    """
    person_links = []

    # Get all Person nodes across cases
    query = f"""
    MATCH (n:Person)
    {case_filter}
    RETURN n.case_id AS case_id, n.id AS id
    ORDER BY n.case_id, n.id
    """
    persons = db.query(query, params)

    # Pairwise compare persons from different cases
    # O(n²) within Person entities — acceptable for hackathon scale,
    # optimize later if needed
    for i in range(len(persons)):
        for j in range(i + 1, len(persons)):
            person_a = persons[i]
            person_b = persons[j]

            # Only link across different cases
            if person_a["case_id"] == person_b["case_id"]:
                continue

            score = compute_person_match_score(person_a["id"], person_b["id"])

            if score >= threshold:
                person_links.append({
                    "type": "Person",
                    "case_a": person_a["case_id"],
                    "id_a": person_a["id"],
                    "case_b": person_b["case_id"],
                    "id_b": person_b["id"],
                    "match_kind": "fuzzy",
                    "score": score
                })

    return person_links
