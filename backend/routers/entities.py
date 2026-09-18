from fastapi import APIRouter

from utils import neo4j_driver as db

router = APIRouter()


@router.get("/entities")
def get_entities():
    people = [r["v"] for r in db.query("MATCH (n:Person) RETURN n.name AS v ORDER BY v")]
    locations = [r["v"] for r in db.query("MATCH (n:Location) RETURN n.name AS v ORDER BY v")]
    vehicles = [r["v"] for r in db.query("MATCH (n:Vehicle) RETURN n.plate AS v ORDER BY v")]
    phones = [r["v"] for r in db.query("MATCH (n:Phone) RETURN n.number AS v ORDER BY v")]
    orgs = [r["v"] for r in db.query("MATCH (n:Organization) RETURN n.name AS v ORDER BY v")]
    return {
        "people": people,
        "locations": locations,
        "vehicles": vehicles,
        "phones": phones,
        "organizations": orgs,
        "is_processed": bool(people or locations or vehicles or phones or orgs),
    }
