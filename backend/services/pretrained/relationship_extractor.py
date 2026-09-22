"""
Relationship extractor - Extract relationships between entities using keyword triggers.
"""
from .config import TRIGGERS
from .entity_resolver import EntityResolver
from itertools import combinations


class RelationshipExtractor:
    """Extract relationships using keyword triggers"""

    def __init__(self, resolver: EntityResolver | None = None):
        self.resolver = resolver or EntityResolver()

    def extract_person_relationships(self, sent, people: list) -> list[dict]:
        """Extract Person-Person relationships from sentence"""
        relationships = []
        sent_lower = sent.text.lower()

        # Find people mentioned in this sentence
        present_people = self._get_entities_in_sentence(sent, people, "PERSON")

        if len(present_people) >= 2:
            # Check each pair for relationship triggers
            for p1, p2 in combinations(present_people, 2):
                for rel_type in ["ASSOCIATE_OF", "FINANCIAL_TRAIL", "CDR_LINK"]:
                    if self._has_trigger(sent_lower, rel_type):
                        relationships.append({
                            "type": rel_type,
                            "source": p1,
                            "target": p2,
                            "source_type": "Person",
                            "target_type": "Person",
                            "sentence": sent.text.strip()
                        })

        return relationships

    def extract_person_location_relationships(self, sent, people: list, locations: list) -> list[dict]:
        """Extract Person-Location relationships"""
        relationships = []

        present_people = self._get_entities_in_sentence(sent, people, "PERSON")
        present_locations = self._get_entities_in_sentence(sent, locations, ["GPE", "LOC", "FAC"])

        for person in present_people:
            for location in present_locations:
                relationships.append({
                    "type": "SPOTTED_AT",
                    "source": person,
                    "target": location,
                    "source_type": "Person",
                    "target_type": "Location",
                })

        return relationships

    def extract_person_organization_relationships(self, sent, people: list, orgs: list) -> list[dict]:
        """Extract Person-Organization relationships"""
        relationships = []

        present_people = self._get_entities_in_sentence(sent, people, "PERSON")
        present_orgs = [o for o in orgs if o in sent.text]

        for person in present_people:
            for org in present_orgs:
                relationships.append({
                    "type": "ASSOCIATED_WITH",
                    "source": person,
                    "target": org,
                    "source_type": "Person",
                    "target_type": "Organization",
                })

        return relationships

    def extract_person_vehicle_relationships(self, sent, people: list, vehicles: list) -> list[dict]:
        """Extract Person-Vehicle ownership relationships"""
        relationships = []
        sent_lower = sent.text.lower()

        present_people = self._get_entities_in_sentence(sent, people, "PERSON")
        present_vehicles = [v for v in vehicles if v in sent.text]

        if self._has_trigger(sent_lower, "OWNS_VEHICLE"):
            for person in present_people:
                for vehicle in present_vehicles:
                    relationships.append({
                        "type": "OWNS_VEHICLE",
                        "source": person,
                        "target": vehicle,
                        "source_type": "Person",
                        "target_type": "Vehicle",
                    })

        return relationships

    def extract_person_phone_relationships(self, sent, people: list, phones: list) -> list[dict]:
        """Extract Person-Phone device usage relationships"""
        relationships = []
        sent_lower = sent.text.lower()

        present_people = self._get_entities_in_sentence(sent, people, "PERSON")
        present_phones = [ph for ph in phones if ph in sent.text]

        if self._has_trigger(sent_lower, "USES_DEVICE"):
            for person in present_people:
                for phone in present_phones:
                    relationships.append({
                        "type": "USES_DEVICE",
                        "source": person,
                        "target": phone,
                        "source_type": "Person",
                        "target_type": "Phone",
                    })

        return relationships

    def extract_phone_relationships(self, sent, phones: list) -> list[dict]:
        """Extract Phone-Phone call relationships"""
        relationships = []
        sent_lower = sent.text.lower()

        present_phones = [ph for ph in phones if ph in sent.text]

        if len(present_phones) >= 2 and self._has_trigger(sent_lower, "INTERCEPTED_CALL"):
            for ph1, ph2 in combinations(present_phones, 2):
                relationships.append({
                    "type": "INTERCEPTED_CALL",
                    "source": ph1,
                    "target": ph2,
                    "source_type": "Phone",
                    "target_type": "Phone",
                })

        return relationships

    def extract_vehicle_location_relationships(self, sent, vehicles: list, locations: list) -> list[dict]:
        """Extract Vehicle-Location camera log relationships"""
        relationships = []

        present_vehicles = [v for v in vehicles if v in sent.text]
        present_locations = self._get_entities_in_sentence(sent, locations, ["GPE", "LOC", "FAC"])

        for vehicle in present_vehicles:
            for location in present_locations:
                relationships.append({
                    "type": "CAMERA_LOG",
                    "source": vehicle,
                    "target": location,
                    "source_type": "Vehicle",
                    "target_type": "Location",
                })

        return relationships

    def extract_all_from_sentence(self, sent, entities: dict) -> list[dict]:
        """Extract all relationship types from a single sentence"""
        relationships = []

        relationships.extend(self.extract_person_relationships(sent, entities["people"]))
        relationships.extend(self.extract_person_location_relationships(sent, entities["people"], entities["locations"]))
        relationships.extend(self.extract_person_organization_relationships(sent, entities["people"], entities["organizations"]))
        relationships.extend(self.extract_person_vehicle_relationships(sent, entities["people"], entities["vehicles"]))
        relationships.extend(self.extract_person_phone_relationships(sent, entities["people"], entities["phones"]))
        relationships.extend(self.extract_phone_relationships(sent, entities["phones"]))
        relationships.extend(self.extract_vehicle_location_relationships(sent, entities["vehicles"], entities["locations"]))

        return relationships

    def _get_entities_in_sentence(self, sent, entity_list: list, labels) -> list:
        """Get entities from list that appear in sentence"""
        if isinstance(labels, str):
            labels = [labels]

        raw_mentions = {
            e.text.strip() for e in sent.ents if e.label_ in labels
        }

        if "PERSON" in labels:
            # Sentence mentions are often aliases ("R. Sharma"); resolve each
            # to its canonical form before checking membership.
            resolved = {self.resolver.resolve_person(raw, entity_list) for raw in raw_mentions}
            return [e for e in entity_list if e in resolved]

        return [e for e in entity_list if e in raw_mentions]

    def _has_trigger(self, sent_lower: str, rel_type: str) -> bool:
        """Check if sentence contains trigger keywords for relationship type"""
        return any(keyword in sent_lower for keyword in TRIGGERS.get(rel_type, []))
