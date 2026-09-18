from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import pipeline, audit, cases as case_service
from utils import neo4j_driver as db

router = APIRouter()


class IngestRequest(BaseModel):
    fir_text: str = ""
    cdr_text: str = ""
    append_mode: bool = False


def _require_case(case_id):
    if not case_service.get_case(case_id):
        raise HTTPException(404, "Case not found.")


@router.post("/cases/{case_id}/ingest")
def ingest(case_id: str, payload: IngestRequest):
    _require_case(case_id)
    if not payload.fir_text.strip() and not payload.cdr_text.strip():
        return {"ok": False, "error": "Paste at least one of the FIR or CDR text blocks."}
    result = pipeline.run_ingestion(payload.fir_text, payload.cdr_text, payload.append_mode, case_id)
    return {"ok": True, **result}


@router.post("/cases/{case_id}/clear")
def clear_case(case_id: str):
    """Wipe this case's entities/graph/audit trail — the case itself stays,
    ready for a fresh ingestion. To remove the case entirely, use
    DELETE /cases/{case_id} instead."""
    _require_case(case_id)
    db.clear_case(case_id)
    audit.clear(case_id)
    return {"ok": True}
