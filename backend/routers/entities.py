from fastapi import APIRouter

from utils import neo4j_driver as db

router = APIRouter()


@router.get("/cases/{case_id}/entities")
def get_entities(case_id: str):
    people = [r["v"] for r in db.query(
        "MATCH (n:Person {case_id: $case_id}) RETURN n.name AS v ORDER BY v", {"case_id": case_id})]
    locations = [r["v"] for r in db.query(
        "MATCH (n:Location {case_id: $case_id}) RETURN n.name AS v ORDER BY v", {"case_id": case_id})]
    vehicles = [r["v"] for r in db.query(
        "MATCH (n:Vehicle {case_id: $case_id}) RETURN n.plate AS v ORDER BY v", {"case_id": case_id})]
    phones = [r["v"] for r in db.query(
        "MATCH (n:Phone {case_id: $case_id}) RETURN n.number AS v ORDER BY v", {"case_id": case_id})]
    orgs = [r["v"] for r in db.query(
        "MATCH (n:Organization {case_id: $case_id}) RETURN n.name AS v ORDER BY v", {"case_id": case_id})]
    return {
        "people": people,
        "locations": locations,
        "vehicles": vehicles,
        "phones": phones,
        "organizations": orgs,
        "is_processed": bool(people or locations or vehicles or phones or orgs),
    }
