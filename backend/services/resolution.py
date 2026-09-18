from rapidfuzz import fuzz


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
        score = fuzz.token_sort_ratio(name_clean, existing)
        if score >= threshold:
            return existing

        parts_new = name_clean.replace(".", "").split()
        parts_existing = existing.replace(".", "").split()

        if len(parts_new) >= 2 and len(parts_existing) >= 2:
            if parts_new[-1].lower() == parts_existing[-1].lower():
                first_new, first_existing = parts_new[0].lower(), parts_existing[0].lower()
                if first_new[0] == first_existing[0] and (len(first_new) == 1 or len(first_existing) == 1):
                    return existing

        if len(parts_new) == 1 and len(parts_existing) >= 2:
            if parts_new[0].lower() == parts_existing[-1].lower():
                return existing
        if len(parts_existing) == 1 and len(parts_new) >= 2:
            if parts_existing[0].lower() == parts_new[-1].lower():
                return existing
    return name_clean
