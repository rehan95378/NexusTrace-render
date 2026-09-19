from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import entities as entity_service

router = APIRouter()


@router.get("/cases/{case_id}/entities")
def get_entities(case_id: str):
    return entity_service.get_entities_for_case(case_id)


@router.get("/entities/all")
def get_all_entities():
    """Every case's entities, grouped by case — backs the Entities tab's
    'All cases' toggle."""
    return entity_service.get_all_entities()


@router.get("/relationship-type-suggestions")
def get_relationship_type_suggestions():
    """Common relationship names to prefill the 'Create relationship' form
    with — manual relationships are not restricted to this list."""
    return {"suggestions": entity_service.REL_TYPE_SUGGESTIONS}


# --- Manual node CRUD (powers the graph's Edit panel) ---

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
    target_case_id: str = None  # Optional: for cross-case relationships


class RenameRelationshipRequest(BaseModel):
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    target_case_id: str = None  # Optional: for cross-case relationships
    old_rel_type: str
    new_rel_type: str


@router.post("/cases/{case_id}/relationships")
def add_relationship(case_id: str, payload: RelationshipRequest):
    try:
        # Support cross-case relationships: target_case_id overrides case_id for target node
        target_case = payload.target_case_id if payload.target_case_id else case_id
        result = entity_service.add_relationship(
            case_id, payload.source_type, payload.source_id,
            target_case, payload.target_type, payload.target_id, payload.rel_type,
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, **result}


@router.patch("/cases/{case_id}/relationships")
def rename_relationship(case_id: str, payload: RenameRelationshipRequest):
    try:
        target_case = payload.target_case_id if payload.target_case_id else case_id
        result = entity_service.rename_relationship(
            case_id, payload.source_type, payload.source_id,
            target_case, payload.target_type, payload.target_id,
            payload.old_rel_type, payload.new_rel_type,
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, **result}


@router.delete("/cases/{case_id}/relationships")
def delete_relationship(case_id: str, payload: RelationshipRequest):
    try:
        target_case = payload.target_case_id if payload.target_case_id else case_id
        entity_service.delete_relationship(
            case_id, payload.source_type, payload.source_id,
            target_case, payload.target_type, payload.target_id, payload.rel_type,
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}
