from rapidfuzz import fuzz


def compute_person_match_score(name_a, name_b):
    """
    Computes a match score between two person names using the same heuristics
    as resolve_person, but returns the score instead of just true/false.

    Used for cross-case person linking where we need to apply a stricter
    threshold (92-93) than within-case matching (85).

    Returns:
        float: Match score 0-100. Higher = more similar.
               100 = exact or highly confident match (surname + initial match)
               85-99 = fuzzy token match
               0 = no match
    """
    name_a_clean = name_a.strip()
    name_b_clean = name_b.strip()

    # Fuzzy token-based score
    score = fuzz.token_sort_ratio(name_a_clean, name_b_clean)

    parts_a = name_a_clean.replace(".", "").split()
    parts_b = name_b_clean.replace(".", "").split()

    # Initials + surname heuristic (e.g. "V. Gowda" vs "Vikram Gowda")
    if len(parts_a) >= 2 and len(parts_b) >= 2:
        if parts_a[-1].lower() == parts_b[-1].lower():
            first_a, first_b = parts_a[0].lower(), parts_b[0].lower()
            if first_a[0] == first_b[0] and (len(first_a) == 1 or len(first_b) == 1):
                return 100  # High confidence — surname + initial match

    # Bare surname match (e.g. "Kumar" vs "Anil Kumar")
    if len(parts_a) == 1 and len(parts_b) >= 2:
        if parts_a[0].lower() == parts_b[-1].lower():
            return 100
    if len(parts_b) == 1 and len(parts_a) >= 2:
        if parts_b[0].lower() == parts_a[-1].lower():
            return 100

    return score


def resolve_person(name, known_people, threshold=85):
    """
    Checks a newly extracted name against already-known people.
    Handles cases like 'V. Gowda' vs 'Vikram Gowda' by fuzzy token matching,
    a direct initials-vs-full-name check, and a bare-surname check —
    e.g. a lone 'Kumar' mention resolving to an existing 'Anil Kumar'.
    Returns the canonical name to use (existing match, or the new name itself).
    """
    name_clean = name.strip()
    for existing in known_people:
        score = compute_person_match_score(name_clean, existing)
        if score >= threshold:
            return existing
    return name_clean
