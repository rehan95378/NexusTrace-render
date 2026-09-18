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
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Case name is required.")
    return case_service.create_case(name)


@router.get("/cases")
def list_cases():
    return case_service.list_cases()


@router.get("/cases/{case_id}")
def get_case(case_id: str):
    case = case_service.get_case(case_id)
    if not case:
        raise HTTPException(404, "Case not found.")
    return case


@router.patch("/cases/{case_id}")
def rename_case(case_id: str, payload: RenameCaseRequest):
    if not case_service.get_case(case_id):
        raise HTTPException(404, "Case not found.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Case name is required.")
    case_service.rename_case(case_id, name)
    return case_service.get_case(case_id)


@router.delete("/cases/{case_id}")
def delete_case(case_id: str):
    if not case_service.get_case(case_id):
        raise HTTPException(404, "Case not found.")
    case_service.delete_case(case_id)
    return {"ok": True}
