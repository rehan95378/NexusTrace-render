from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils import neo4j_driver as db
from services import entities as entity_service

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


# --- Manual node CRUD (powers the graph click-for-details panel) ---

class AddEntityRequest(BaseModel):
    type: str
    value: str


class RenameEntityRequest(BaseModel):
    value: str


class MergeEntityRequest(BaseModel):
    merge_with: str


@router.get("/cases/{case_id}/entities/{node_type}/{node_id}")
def get_entity_detail(case_id: str, node_type: str, node_id: str):
    try:
        detail = entity_service.get_entity_detail(case_id, node_type, node_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not detail:
        raise HTTPException(404, "Entity not found.")
    return detail


@router.post("/cases/{case_id}/entities/manual")
def add_entity(case_id: str, payload: AddEntityRequest):
    try:
        return entity_service.add_entity(case_id, payload.type, payload.value)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.patch("/cases/{case_id}/entities/{node_type}/{node_id}")
def rename_entity(case_id: str, node_type: str, node_id: str, payload: RenameEntityRequest):
    try:
        return entity_service.rename_entity(case_id, node_type, node_id, payload.value)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/cases/{case_id}/entities/{node_type}/{node_id}")
def delete_entity(case_id: str, node_type: str, node_id: str):
    try:
        entity_service.delete_entity(case_id, node_type, node_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/cases/{case_id}/entities/{node_type}/{node_id}/merge")
def merge_entity(case_id: str, node_type: str, node_id: str, payload: MergeEntityRequest):
    try:
        entity_service.merge_entities(case_id, node_type, keep_id=node_id, merge_id=payload.merge_with)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


# --- Manual relationship CRUD ---

class RelationshipRequest(BaseModel):
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    rel_type: str


@router.post("/cases/{case_id}/relationships")
def add_relationship(case_id: str, payload: RelationshipRequest):
    try:
        entity_service.add_relationship(
            case_id, payload.source_type, payload.source_id,
            payload.target_type, payload.target_id, payload.rel_type,
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.delete("/cases/{case_id}/relationships")
def delete_relationship(case_id: str, payload: RelationshipRequest):
    try:
        entity_service.delete_relationship(
            case_id, payload.source_type, payload.source_id,
            payload.target_type, payload.target_id, payload.rel_type,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}
