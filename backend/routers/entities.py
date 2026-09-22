"""
Entity router - Read-only endpoints for querying entities.

This router handles all read operations (GET only).
Calls services/entities.py for all operations.
"""
from fastapi import APIRouter, HTTPException

from services import entities

router = APIRouter()


@router.get("/cases/{case_id}/entities")
def get_entities(case_id: str):
    """Get all entities for a specific case, grouped by type"""
    return entities.get_entities_for_case(case_id)


@router.get("/entities/all")
def get_all_entities():
    """Get entities across all cases with case information"""
    return {"entities": entities.get_all_entities()}


@router.get("/cases/{case_id}/entities/{entity_type}/{entity_id}")
def get_entity_detail(case_id: str, entity_type: str, entity_id: str):
    """Get detailed information about a specific entity"""
    try:
        detail = entities.get_entity_detail(case_id, entity_type, entity_id)
        if detail is None:
            raise HTTPException(404, "Entity not found.")
        return detail
    except ValueError as e:
        raise HTTPException(400, str(e))
