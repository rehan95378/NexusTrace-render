"""
Entity resolver - Resolve entity aliases using fuzzy matching.
"""
from difflib import SequenceMatcher
from .settings import FUZZY_MATCH_THRESHOLD


class EntityResolver:
    """Resolve entity aliases using fuzzy matching"""

    def resolve_person(self, name: str, known_people: list[str]) -> str:
        """Resolve person name to canonical form"""
        name = name.strip()

        # Exact match
        if name in known_people:
            return name

        # Fuzzy match
        best_match = None
        best_score = 0

        for known_name in known_people:
            score = self.compute_person_match_score(name, known_name)
            if score >= FUZZY_MATCH_THRESHOLD and score > best_score:
                best_score = score
                best_match = known_name

        if best_match:
            return best_match

        # Fall back to structural matches the fuzzy blend misses,
        # e.g. "R. Sharma" -> "Rohan Sharma", "Kumar" -> "Anil Kumar"
        initials_match = self._match_initials(name, known_people)
        if initials_match:
            return initials_match

        return self._match_surname(name, known_people) or name

    def compute_person_match_score(self, name1: str, name2: str) -> float:
        """Compute fuzzy match score between two person names (0-100)"""
        n1_lower = name1.lower().strip()
        n2_lower = name2.lower().strip()

        # Exact match
        if n1_lower == n2_lower:
            return 100.0

        # Sequence matcher (overall similarity)
        base_score = SequenceMatcher(None, n1_lower, n2_lower).ratio() * 100

        # Token-based matching (handles word order variations)
        tokens1 = set(n1_lower.split())
        tokens2 = set(n2_lower.split())

        if not tokens1 or not tokens2:
            return base_score

        common_tokens = tokens1 & tokens2
        token_score = (len(common_tokens) / max(len(tokens1), len(tokens2))) * 100

        # Weighted average (favor token matching)
        final_score = (base_score * 0.4) + (token_score * 0.6)

        return final_score

    def _match_initials(self, name: str, known_people: list[str]) -> str | None:
        """Resolve 'R. Sharma' style mentions against a known full name.

        Only resolves when exactly one known person shares the surname
        and matching leading initials, to avoid merging distinct people.
        """
        tokens = [t for t in name.replace(".", " ").split() if t]
        if len(tokens) < 2:
            return None

        *initial_tokens, surname = tokens
        name_initials = [t[0].lower() for t in initial_tokens]

        candidates = []
        for known in known_people:
            known_tokens = known.split()
            if len(known_tokens) < 2 or known_tokens[-1].lower() != surname.lower():
                continue
            known_initials = [t[0].lower() for t in known_tokens[:-1]]
            if name_initials == known_initials[: len(name_initials)]:
                candidates.append(known)

        return candidates[0] if len(candidates) == 1 else None

    def _match_surname(self, name: str, known_people: list[str]) -> str | None:
        """Resolve a bare surname ('Kumar') to a known full name, if unambiguous."""
        tokens = name.split()
        if len(tokens) != 1:
            return None

        surname = tokens[0].lower()
        candidates = [k for k in known_people if k.split() and k.split()[-1].lower() == surname]
        return candidates[0] if len(candidates) == 1 else None
