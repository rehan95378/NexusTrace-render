"""
Entity resolver - Resolve entity aliases using fuzzy matching.
"""
from difflib import SequenceMatcher
from .config import FUZZY_MATCH_THRESHOLD


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

        return best_match if best_match else name

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
