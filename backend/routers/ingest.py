"""
Ingest router - All endpoints for ingesting FIR/CDR text and clearing cases.

This router handles ingestion operations.
Calls services/ingest.py for all business logic.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import ingest as ingest_service
from services import cases as case_service

router = APIRouter()


class IngestRequest(BaseModel):
    fir_text: str = ""
    cdr_text: str = ""
    append_mode: bool = False


@router.post("/cases/{case_id}/ingest")
def ingest(case_id: str, payload: IngestRequest):
    """Ingest FIR and/or CDR text for a case"""
    try:
        case_service.require_case(case_id)
        return ingest_service.run_ingestion(case_id, payload.fir_text, payload.cdr_text, payload.append_mode)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/cases/{case_id}/clear")
def clear_case(case_id: str):
    """Wipe this case's entities/graph/audit trail — the case itself stays,
    ready for a fresh ingestion. To remove the case entirely, use
    DELETE /cases/{case_id} instead."""
    try:
        case_service.require_case(case_id)
        return ingest_service.clear_case_data(case_id)
    except ValueError as e:
        raise HTTPException(404, str(e))