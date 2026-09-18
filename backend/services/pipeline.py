"""
The core ingestion pipeline: takes raw FIR text and/or CDR/ledger text,
extracts entities, resolves aliases, writes them (and the relationships
between them) to Neo4j — scoped to one case — and logs every write to that
case's audit trail.

Node identity is now (case_id, id) rather than a globally unique id, so the
same name/plate/number can exist as separate real-world entities in
separate cases. "Already known" entities are read from Neo4j at the start
of each request, filtered to the current case.
"""
import re
from itertools import combinations

from utils import neo4j_driver as db
from services import extraction as ext
from services import resolution as res
from services import audit


def _clean_person_name(text):
    """Strip honorifics and a trailing possessive 's/'s that spaCy's NER
    sometimes folds into the PERSON span (e.g. "Vijay Singh's" -> "Vijay Singh")."""
    name = re.sub(r'^(Smt\.|Shri\.|Mr\.|Mrs\.)\s*', '', text).strip()
    name = re.sub(r"[’\']s$", '', name).strip()
    return name


def _known(case_id, label, prop="name"):
    rows = db.query(
        f"MATCH (n:{label} {{case_id: $case_id}}) RETURN n.{prop} AS v",
        {"case_id": case_id},
    )
    return [r["v"] for r in rows if r["v"] is not None]


def ingest_tabular_cdr(text, case_id):
    """Detects caller/called CDR tables and bypasses the NLP + keyword pipeline entirely."""
    is_tabular, delim = ext.looks_tabular(text)
    if not is_tabular:
        return None

    rows = ext.parse_cdr_rows(text, delim)
    seen_numbers = set()

    for row in rows:
        caller, called = row["caller"], row["called"]

        for num in (caller, called):
            if num not in seen_numbers:
                db.query(
                    "MERGE (n:Phone {id: $num, case_id: $case_id}) SET n.number = $num",
                    {"num": num, "case_id": case_id},
                )
                audit.log(case_id, "ADD_ENTITY", {"type": "Phone", "id": num, "source": "tabular_cdr"})
                seen_numbers.add(num)

        params = {"caller": caller, "called": called, "case_id": case_id}
        details = {"type": "INTERCEPTED_CALL", "from": caller, "to": called, "source": "tabular_cdr"}
        if row["timestamp"]:
            params["timestamp"] = row["timestamp"]
            details["timestamp"] = row["timestamp"]
        if row["duration"]:
            params["duration"] = row["duration"]
            details["duration"] = row["duration"]

        set_clauses = ["r.confidence = coalesce(r.confidence, 0) + 1"]
        if row["timestamp"]:
            set_clauses.append("r.last_timestamp = $timestamp")
        if row["duration"]:
            set_clauses.append("r.last_duration = $duration")

        cypher = (
            "MATCH (a:Phone {id: $caller, case_id: $case_id}), (b:Phone {id: $called, case_id: $case_id}) "
            f"MERGE (a)-[r:INTERCEPTED_CALL]->(b) SET {', '.join(set_clauses)}"
        )
        db.query(cypher, params)
        audit.log(case_id, "ADD_RELATIONSHIP", details)

    return list(seen_numbers)


def run_ingestion(fir_text: str, cdr_text: str, append_mode: bool, case_id: str):
    fir_text = fir_text or ""
    cdr_text = cdr_text or ""

    if not append_mode:
        db.clear_case(case_id)
        audit.clear(case_id)

    tabular_numbers = ingest_tabular_cdr(cdr_text, case_id)
    cdr_text_for_nlp = "" if tabular_numbers is not None else cdr_text

    combined_text = f"{fir_text} \n {cdr_text_for_nlp}"
    nlp = ext.get_nlp()
    doc = nlp(combined_text)

    # --- PEOPLE (NER + entity resolution) ---
    raw_people = []
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            clean_name = _clean_person_name(ent.text)
            if (len(clean_name.split()) >= 1 and clean_name not in ext.STOP_WORDS
                    and not ext.is_probable_date(clean_name)):
                raw_people.append(clean_name)

    known_people = _known(case_id, "Person")
    resolved_people = []
    # Process longer (fuller) names first so the canonical form that survives
    # is the full name rather than an initials variant encountered first.
    for name in sorted(set(raw_people), key=lambda n: -len(n.split())):
        canonical = res.resolve_person(name, known_people)
        resolved_people.append(canonical)
        if canonical not in known_people:
            known_people.append(canonical)
            db.query(
                "MERGE (n:Person {id: $name, case_id: $case_id}) SET n.name = $name",
                {"name": canonical, "case_id": case_id},
            )
            audit.log(case_id, "ADD_ENTITY", {"type": "Person", "id": canonical})

    people = known_people

    # --- LOCATIONS ---
    known_locations = _known(case_id, "Location")
    raw_locations = []
    for ent in doc.ents:
        if ent.label_ in ["GPE", "LOC", "FAC"]:
            loc_cleaned = ent.text.strip()
            if (loc_cleaned not in people and loc_cleaned not in ext.LOCATION_NOISE
                    and not ext.is_probable_date(loc_cleaned) and len(loc_cleaned) > 2):
                raw_locations.append(loc_cleaned)

    new_locations = [l for l in set(raw_locations) if l not in known_locations]
    locations = list(set(known_locations + raw_locations))
    for l in new_locations:
        db.query(
            "MERGE (n:Location {id: $loc, case_id: $case_id}) SET n.name = $loc",
            {"loc": l, "case_id": case_id},
        )
        audit.log(case_id, "ADD_ENTITY", {"type": "Location", "id": l})

    # --- ORGANIZATIONS (known watchlist substring match) ---
    known_orgs = _known(case_id, "Organization")
    raw_orgs = ext.extract_orgs(combined_text)
    new_orgs = [o for o in raw_orgs if o not in known_orgs]
    orgs = list(set(known_orgs + raw_orgs))
    for o in new_orgs:
        db.query(
            "MERGE (n:Organization {id: $o, case_id: $case_id}) SET n.name = $o",
            {"o": o, "case_id": case_id},
        )
        audit.log(case_id, "ADD_ENTITY", {"type": "Organization", "id": o})

    # --- VEHICLES ---
    known_vehicles = _known(case_id, "Vehicle", prop="plate")
    raw_vehicles = ext.extract_vehicles(combined_text)
    new_vehicles = [v for v in raw_vehicles if v not in known_vehicles]
    vehicles = list(set(known_vehicles + raw_vehicles))
    for v in new_vehicles:
        db.query(
            "MERGE (n:Vehicle {id: $v, case_id: $case_id}) SET n.plate = $v",
            {"v": v, "case_id": case_id},
        )
        audit.log(case_id, "ADD_ENTITY", {"type": "Vehicle", "id": v})

    # --- PHONES (narrative text only — tabular numbers already merged) ---
    known_phones = _known(case_id, "Phone", prop="number")
    raw_phones = ext.extract_phones(combined_text)
    new_phones = [p for p in raw_phones if p not in known_phones]
    phones = list(set(known_phones + raw_phones))
    for ph in new_phones:
        db.query(
            "MERGE (n:Phone {id: $ph, case_id: $case_id}) SET n.number = $ph",
            {"ph": ph, "case_id": case_id},
        )
        audit.log(case_id, "ADD_ENTITY", {"type": "Phone", "id": ph})

    # --- RELATIONSHIP MAPPING ---
    known_locations_set = set(locations)
    for sent in doc.sents:
        s_low = sent.text.lower()

        present_people_set = set()
        for ent in sent.ents:
            if ent.label_ == "PERSON":
                clean_name = _clean_person_name(ent.text)
                if clean_name in ext.STOP_WORDS or ext.is_probable_date(clean_name):
                    continue
                canonical = res.resolve_person(clean_name, people)
                if canonical in people:
                    present_people_set.add(canonical)
        present_people = list(present_people_set)

        present_locs = [l for l in known_locations_set if l in {
            e.text.strip() for e in sent.ents if e.label_ in ["GPE", "LOC", "FAC"]
        }]
        present_orgs = [o for o in orgs if o in sent.text]
        present_vhs = [v for v in vehicles if v in sent.text]
        present_phs = [ph for ph in phones if ph in sent.text]

        if len(present_people) >= 2:
            # Unordered pairs only: combinations() yields each pair once, so a
            # sentence mentioning A and B creates a single directed edge
            # instead of both A->B and B->A.
            for p1, p2 in combinations(present_people, 2):
                for rel_type in ["ASSOCIATE_OF", "FINANCIAL_TRAIL", "CDR_LINK"]:
                    if any(k in s_low for k in ext.TRIGGERS[rel_type]):
                        db.query(
                            f"MATCH (a:Person {{id: $p1, case_id: $case_id}}), "
                            f"(b:Person {{id: $p2, case_id: $case_id}}) "
                            f"MERGE (a)-[r:{rel_type}]->(b) SET r.confidence = coalesce(r.confidence, 0) + 1, "
                            f"r.source_sentence = $sent",
                            {"p1": p1, "p2": p2, "sent": sent.text.strip(), "case_id": case_id},
                        )
                        audit.log(case_id, "ADD_RELATIONSHIP", {"type": rel_type, "from": p1, "to": p2})

        for l in present_locs:
            for p in present_people:
                db.query(
                    "MATCH (a:Person {id: $p, case_id: $case_id}), (b:Location {id: $l, case_id: $case_id}) "
                    "MERGE (a)-[r:SPOTTED_AT]->(b) SET r.confidence = coalesce(r.confidence, 0) + 1",
                    {"p": p, "l": l, "case_id": case_id},
                )
                audit.log(case_id, "ADD_RELATIONSHIP", {"type": "SPOTTED_AT", "from": p, "to": l})
            for v in present_vhs:
                db.query(
                    "MATCH (a:Vehicle {id: $v, case_id: $case_id}), (b:Location {id: $l, case_id: $case_id}) "
                    "MERGE (a)-[:CAMERA_LOG]->(b)",
                    {"v": v, "l": l, "case_id": case_id},
                )
                audit.log(case_id, "ADD_RELATIONSHIP", {"type": "CAMERA_LOG", "from": v, "to": l})

        for o in present_orgs:
            for p in present_people:
                db.query(
                    "MATCH (a:Person {id: $p, case_id: $case_id}), (b:Organization {id: $o, case_id: $case_id}) "
                    "MERGE (a)-[r:ASSOCIATED_WITH]->(b) SET r.confidence = coalesce(r.confidence, 0) + 1",
                    {"p": p, "o": o, "case_id": case_id},
                )
                audit.log(case_id, "ADD_RELATIONSHIP", {"type": "ASSOCIATED_WITH", "from": p, "to": o})

        for ph in present_phs:
            for p in present_people:
                if any(k in s_low for k in ext.TRIGGERS["USES_DEVICE"]):
                    db.query(
                        "MATCH (a:Person {id: $p, case_id: $case_id}), (b:Phone {id: $ph, case_id: $case_id}) "
                        "MERGE (a)-[:USES_DEVICE]->(b)",
                        {"p": p, "ph": ph, "case_id": case_id},
                    )
                    audit.log(case_id, "ADD_RELATIONSHIP", {"type": "USES_DEVICE", "from": p, "to": ph})

        if len(present_phs) >= 2:
            for ph1, ph2 in combinations(present_phs, 2):
                if any(k in s_low for k in ext.TRIGGERS["INTERCEPTED_CALL"]):
                    db.query(
                        "MATCH (a:Phone {id: $ph1, case_id: $case_id}), (b:Phone {id: $ph2, case_id: $case_id}) "
                        "MERGE (a)-[r:INTERCEPTED_CALL]->(b) SET r.confidence = coalesce(r.confidence, 0) + 1",
                        {"ph1": ph1, "ph2": ph2, "case_id": case_id},
                    )
                    audit.log(case_id, "ADD_RELATIONSHIP", {"type": "INTERCEPTED_CALL", "from": ph1, "to": ph2})

        if present_people and present_vhs and any(k in s_low for k in ext.TRIGGERS["OWNS_VEHICLE"]):
            for p in present_people:
                for v in present_vhs:
                    db.query(
                        "MATCH (a:Person {id: $p, case_id: $case_id}), (b:Vehicle {id: $v, case_id: $case_id}) "
                        "MERGE (a)-[:OWNS_VEHICLE]->(b)",
                        {"p": p, "v": v, "case_id": case_id},
                    )
                    audit.log(case_id, "ADD_RELATIONSHIP", {"type": "OWNS_VEHICLE", "from": p, "to": v})

    return {
        "people": people,
        "locations": locations,
        "organizations": orgs,
        "vehicles": vehicles,
        "phones": phones,
        "tabular_cdr_detected": tabular_numbers is not None,
        "tabular_numbers_parsed": len(tabular_numbers) if tabular_numbers else 0,
    }
