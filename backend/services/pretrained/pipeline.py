"""
Pretrained NLP Pipeline - Orchestrate the entire extraction workflow.
"""
from utils import neo4j_driver as db
from services import audit
from .entity_extractor import EntityExtractor
from .relationship_extractor import RelationshipExtractor
from .cdr_parser import CDRParser
from .entity_resolver import EntityResolver
from .nlp_loader import process_text


class PretrainedPipeline:
    """Orchestrate pretrained NLP extraction pipeline"""

    def __init__(self):
        self.entity_extractor = EntityExtractor()
        self.relationship_extractor = RelationshipExtractor()
        self.cdr_parser = CDRParser()
        self.entity_resolver = EntityResolver()

    def run_ingestion(self, fir_text: str, cdr_text: str, append_mode: bool, case_id: str) -> dict:
        """Main ingestion pipeline"""
        fir_text = fir_text or ""
        cdr_text = cdr_text or ""

        # Clear case if not appending
        if not append_mode:
            db.clear_case(case_id)
            audit.clear(case_id)

        # Parse tabular CDR first
        tabular_numbers = self._ingest_tabular_cdr(cdr_text, case_id)
        cdr_text_for_nlp = "" if tabular_numbers is not None else cdr_text

        # Extract entities from text
        combined_text = f"{fir_text} \n {cdr_text_for_nlp}"
        doc = process_text(combined_text)

        # Extract all entity types
        raw_entities = self.entity_extractor.extract_all(combined_text, doc=doc)

        # Resolve and merge entities
        entities = self._resolve_and_merge_entities(raw_entities, case_id)

        # Extract and save relationships
        self._extract_and_save_relationships(doc, entities, case_id)

        return {
            "people": entities["people"],
            "locations": entities["locations"],
            "organizations": entities["organizations"],
            "vehicles": entities["vehicles"],
            "phones": entities["phones"],
            "tabular_cdr_detected": tabular_numbers is not None,
            "tabular_numbers_parsed": len(tabular_numbers) if tabular_numbers else 0,
        }

    def _ingest_tabular_cdr(self, cdr_text: str, case_id: str):
        """Handle tabular CDR data"""
        is_tabular, delim = self.cdr_parser.is_tabular(cdr_text)
        if not is_tabular:
            return None

        rows = self.cdr_parser.parse_rows(cdr_text, delim)
        seen_numbers = set()

        # Save phone nodes
        for row in rows:
            for num in (row["caller"], row["called"]):
                if num not in seen_numbers:
                    db.query(
                        "MERGE (n:Phone {id: $num, case_id: $case_id}) SET n.number = $num",
                        {"num": num, "case_id": case_id}
                    )
                    audit.log(case_id, "ADD_ENTITY", {"type": "Phone", "id": num, "source": "tabular_cdr"})
                    seen_numbers.add(num)

            # Save call relationship
            self._save_cdr_relationship(row, case_id)

        return list(seen_numbers)

    def _resolve_and_merge_entities(self, raw_entities: dict, case_id: str) -> dict:
        """Resolve entities and merge with existing ones in the case"""
        # Get existing entities from Neo4j
        known_people = self._get_known_entities(case_id, "Person", "name")
        known_locations = self._get_known_entities(case_id, "Location", "name")
        known_orgs = self._get_known_entities(case_id, "Organization", "name")
        known_vehicles = self._get_known_entities(case_id, "Vehicle", "plate")
        known_phones = self._get_known_entities(case_id, "Phone", "number")

        # Resolve people (fuzzy matching)
        resolved_people = []
        for name in sorted(set(raw_entities["people"]), key=lambda n: -len(n.split())):
            canonical = self.entity_resolver.resolve_person(name, known_people)
            resolved_people.append(canonical)
            if canonical not in known_people:
                self._save_entity("Person", canonical, "name", case_id)
                known_people.append(canonical)

        # Save other entities (no resolution needed)
        for loc in set(raw_entities["locations"]):
            if loc not in known_locations:
                self._save_entity("Location", loc, "name", case_id)
                known_locations.append(loc)

        for org in set(raw_entities["organizations"]):
            if org not in known_orgs:
                self._save_entity("Organization", org, "name", case_id)
                known_orgs.append(org)

        for vehicle in set(raw_entities["vehicles"]):
            if vehicle not in known_vehicles:
                self._save_entity("Vehicle", vehicle, "plate", case_id)
                known_vehicles.append(vehicle)

        for phone in set(raw_entities["phones"]):
            if phone not in known_phones:
                self._save_entity("Phone", phone, "number", case_id)
                known_phones.append(phone)

        return {
            "people": known_people,
            "locations": known_locations,
            "organizations": known_orgs,
            "vehicles": known_vehicles,
            "phones": known_phones,
        }

    def _extract_and_save_relationships(self, doc, entities: dict, case_id: str):
        """Extract relationships from sentences and save to Neo4j"""
        for sent in doc.sents:
            relationships = self.relationship_extractor.extract_all_from_sentence(sent, entities)

            for rel in relationships:
                self._save_relationship(rel, case_id)

    def _get_known_entities(self, case_id: str, label: str, prop: str) -> list[str]:
        """Get existing entities from Neo4j"""
        rows = db.query(
            f"MATCH (n:{label} {{case_id: $case_id}}) RETURN n.{prop} AS v",
            {"case_id": case_id}
        )
        return [r["v"] for r in rows if r["v"] is not None]

    def _save_entity(self, label: str, value: str, prop: str, case_id: str):
        """Save entity to Neo4j"""
        db.query(
            f"MERGE (n:{label} {{id: $value, case_id: $case_id}}) SET n.{prop} = $value",
            {"value": value, "case_id": case_id}
        )
        audit.log(case_id, "ADD_ENTITY", {"type": label, "id": value})

    def _save_relationship(self, rel: dict, case_id: str):
        """Save relationship to Neo4j"""
        src_label = rel["source_type"]
        tgt_label = rel["target_type"]
        rel_type = rel["type"]

        params = {
            "source": rel["source"],
            "target": rel["target"],
            "case_id": case_id
        }

        cypher = (
            f"MATCH (a:{src_label} {{id: $source, case_id: $case_id}}), "
            f"(b:{tgt_label} {{id: $target, case_id: $case_id}}) "
            f"MERGE (a)-[r:{rel_type}]->(b) "
            f"SET r.confidence = coalesce(r.confidence, 0) + 1"
        )

        if "sentence" in rel:
            cypher += ", r.source_sentence = $sentence"
            params["sentence"] = rel["sentence"]

        db.query(cypher, params)

        audit.log(case_id, "ADD_RELATIONSHIP", {
            "type": rel_type,
            "from": rel["source"],
            "to": rel["target"]
        })

    def _save_cdr_relationship(self, row: dict, case_id: str):
        """Save CDR call relationship to Neo4j"""
        params = {
            "caller": row["caller"],
            "called": row["called"],
            "case_id": case_id
        }

        details = {
            "type": "INTERCEPTED_CALL",
            "from": row["caller"],
            "to": row["called"],
            "source": "tabular_cdr"
        }

        set_clauses = ["r.confidence = coalesce(r.confidence, 0) + 1"]

        if row["timestamp"]:
            params["timestamp"] = row["timestamp"]
            details["timestamp"] = row["timestamp"]
            set_clauses.append("r.last_timestamp = $timestamp")

        if row["duration"]:
            params["duration"] = row["duration"]
            details["duration"] = row["duration"]
            set_clauses.append("r.last_duration = $duration")

        cypher = (
            "MATCH (a:Phone {id: $caller, case_id: $case_id}), "
            "(b:Phone {id: $called, case_id: $case_id}) "
            f"MERGE (a)-[r:INTERCEPTED_CALL]->(b) SET {', '.join(set_clauses)}"
        )

        db.query(cypher, params)
        audit.log(case_id, "ADD_RELATIONSHIP", details)
