"""
Entity extractor - Extract entities from text using spaCy NER and regex patterns.
"""
import re
from .config import (
    VEHICLE_PATTERNS, PHONE_PATTERNS, KNOWN_ORGS,
    STOP_WORDS, LOCATION_NOISE, DATE_PATTERNS
)
from .nlp_loader import process_text


class EntityExtractor:
    """Extract entities using pretrained NLP (spaCy + regex)"""

    def extract_people(self, doc) -> list[str]:
        """Extract person names using spaCy NER"""
        people = []
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                clean = self._clean_person_name(ent.text)
                if self._is_valid_person(clean):
                    people.append(clean)
        return list(set(people))

    def extract_locations(self, doc) -> list[str]:
        """Extract locations using spaCy NER"""
        locations = []
        for ent in doc.ents:
            if ent.label_ in ["GPE", "LOC", "FAC"]:
                clean = ent.text.strip()
                if self._is_valid_location(clean):
                    locations.append(clean)
        return list(set(locations))

    def extract_vehicles(self, text: str) -> list[str]:
        """Extract vehicle plates using regex patterns"""
        vehicles = []
        for pattern in VEHICLE_PATTERNS:
            vehicles.extend(re.findall(pattern, text))
        return list(set(v.strip() for v in vehicles))

    def extract_phones(self, text: str) -> list[str]:
        """Extract phone numbers using regex patterns"""
        phones = []
        for pattern in PHONE_PATTERNS:
            phones.extend(re.findall(pattern, text))
        # Filter: must have at least 10 digits
        cleaned = [p.strip() for p in phones if len(re.sub(r'\D', '', p)) >= 10]
        return list(set(cleaned))

    def extract_organizations(self, text: str) -> list[str]:
        """Extract organizations from known watchlist"""
        return list({org for org in KNOWN_ORGS if org in text})

    def extract_all(self, text: str, doc=None) -> dict:
        """Extract all entity types from text"""
        if doc is None:
            doc = process_text(text)
        return {
            "people": self.extract_people(doc),
            "locations": self.extract_locations(doc),
            "vehicles": self.extract_vehicles(text),
            "phones": self.extract_phones(text),
            "organizations": self.extract_organizations(text),
        }

    def _clean_person_name(self, text: str) -> str:
        """Remove honorifics and possessives"""
        name = re.sub(r'^(Smt\.|Shri\.|Mr\.|Mrs\.)\s*', '', text).strip()
        name = re.sub(r"['\u2019]s$", '', name).strip()
        return name

    def _is_valid_person(self, name: str) -> bool:
        """Check if extracted person name is valid"""
        return (
            len(name.split()) >= 1
            and name not in STOP_WORDS
            and not self._is_probable_date(name)
        )

    def _is_valid_location(self, loc: str) -> bool:
        """Check if extracted location is valid"""
        return (
            loc not in LOCATION_NOISE
            and not self._is_probable_date(loc)
            and len(loc) > 2
        )

    def _is_probable_date(self, text: str) -> bool:
        """Check if text looks like a date"""
        t = text.strip()
        return any(p.match(t) for p in DATE_PATTERNS)
