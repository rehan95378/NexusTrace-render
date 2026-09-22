"""
Graph editing router - All endpoints for modifying the graph (entities and relationships).

This router handles all write operations (POST, PATCH, DELETE).
Calls services/graph_edit.py for all operations.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import graph_edit

router = APIRouter()


# Request models
class AddEntityRequest(BaseModel):
    type: str
    value: str


class RenameEntityRequest(BaseModel):
    value: str


class MergeEntityRequest(BaseModel):
    merge_with: str


class ChangeEntityTypeRequest(BaseModel):
    new_type: str


class AddRelationshipRequest(BaseModel):
    pass  # Will accept any payload


class RenameRelationshipRequest(BaseModel):
    pass  # Will accept any payload


class DeleteRelationshipRequest(BaseModel):
    pass  # Will accept any payload


# Relationship type suggestions
@router.get("/relationship-type-suggestions")
def get_relationship_types():
    """Get suggested relationship types for frontend autocomplete"""
    return {"types": graph_edit.REL_TYPE_SUGGESTIONS}


# Entity operations
@router.post("/cases/{case_id}/entities/manual")
def add_entity(case_id: str, payload: AddEntityRequest):
    """Add a new entity to the graph (manual endpoint)"""
    try:
        return graph_edit.add_entity(case_id, payload.type, payload.value)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.patch("/cases/{case_id}/entities/{entity_type}/{entity_id}")
def rename_entity(case_id: str, entity_type: str, entity_id: str, payload: RenameEntityRequest):
    """Rename an entity"""
    try:
        return graph_edit.rename_entity(case_id, entity_type, entity_id, payload.value)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/cases/{case_id}/entities/{entity_type}/{entity_id}")
def delete_entity(case_id: str, entity_type: str, entity_id: str):
    """Delete an entity from the graph"""
    try:
        graph_edit.delete_entity(case_id, entity_type, entity_id)
        return {"ok": True}
    except LookupError as e:
        raise HTTPException(404, str(e))


@router.post("/cases/{case_id}/entities/{entity_type}/{entity_id}/merge")
def merge_entity(case_id: str, entity_type: str, entity_id: str, payload: MergeEntityRequest):
    """Merge two entities into one"""
    try:
        graph_edit.merge_entities(case_id, entity_type, keep_id=entity_id, merge_id=payload.merge_with)
        return {"ok": True}
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.patch("/cases/{case_id}/entities/{entity_type}/{entity_id}/type")
def change_entity_type(case_id: str, entity_type: str, entity_id: str, payload: ChangeEntityTypeRequest):
    """Change entity type (e.g., Person to Organization)"""
    try:
        return graph_edit.change_entity_type(case_id, entity_type, entity_id, payload.new_type)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


# Relationship operations
@router.post("/cases/{case_id}/relationships")
async def add_relationship(case_id: str, payload: dict):
    """Create a relationship between two entities"""
    try:
        return graph_edit.add_relationship(
            case_id,
            payload.get("source_type"),
            payload.get("source_id"),
            payload.get("target_case_id", case_id),
            payload.get("target_type"),
            payload.get("target_id"),
            payload.get("relationship_type")
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except TypeError as e:
        raise HTTPException(400, f"Missing required fields: {str(e)}")


@router.patch("/cases/{case_id}/relationships")
async def rename_relationship(case_id: str, payload: dict):
    """Rename a relationship type"""
    try:
        # Support both old_type/new_type and old_relationship_type/new_relationship_type
        old_rel_type = payload.get("old_relationship_type") or payload.get("old_type")
        new_rel_type = payload.get("new_relationship_type") or payload.get("new_type")
        return graph_edit.rename_relationship(
            case_id,
            payload.get("source_type"),
            payload.get("source_id"),
            payload.get("target_case_id", case_id),
            payload.get("target_type"),
            payload.get("target_id"),
            old_rel_type,
            new_rel_type
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except TypeError as e:
        raise HTTPException(400, f"Missing required fields: {str(e)}")


@router.delete("/cases/{case_id}/relationships")
async def delete_relationship(case_id: str, payload: dict):
    """Delete a relationship between two entities"""
    try:
        graph_edit.delete_relationship(
            case_id,
            payload.get("source_type"),
            payload.get("source_id"),
            payload.get("target_case_id", case_id),
            payload.get("target_type"),
            payload.get("target_id"),
            payload.get("relationship_type")
        )
        return {"ok": True}
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except TypeError as e:
        raise HTTPException(400, f"Missing required fields: {str(e)}")

