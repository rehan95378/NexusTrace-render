"""
Cases router - All endpoints for case management.

This router handles all case CRUD operations.
Calls services/cases.py for all business logic.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import cases as case_service

router = APIRouter()


class CreateCaseRequest(BaseModel):
    name: str


class RenameCaseRequest(BaseModel):
    name: str


@router.post("/cases")
def create_case(payload: CreateCaseRequest):
    """Create a new case"""
    try:
        name = case_service.validate_case_name(payload.name)
        return case_service.create_case(name)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/cases")
def list_cases():
    """List all cases"""
    return case_service.list_cases()


@router.get("/cases/{case_id}")
def get_case(case_id: str):
    """Get a specific case"""
    case = case_service.get_case(case_id)
    if not case:
        raise HTTPException(404, "Case not found.")
    return case


@router.patch("/cases/{case_id}")
def rename_case(case_id: str, payload: RenameCaseRequest):
    """Rename a case"""
    try:
        case_service.require_case(case_id)
        name = case_service.validate_case_name(payload.name)
        case_service.rename_case(case_id, name)
        return case_service.get_case(case_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/cases/{case_id}")
def delete_case(case_id: str):
    """Delete a case"""
    try:
        case_service.require_case(case_id)
        case_service.delete_case(case_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(404, str(e))
