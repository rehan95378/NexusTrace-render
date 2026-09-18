from fastapi import APIRouter
from pydantic import BaseModel

from services import pipeline, audit
from utils import neo4j_driver as db

router = APIRouter()


class IngestRequest(BaseModel):
    fir_text: str = ""
    cdr_text: str = ""
    append_mode: bool = False


@router.post("/ingest")
def ingest(payload: IngestRequest):
    if not payload.fir_text.strip() and not payload.cdr_text.strip():
        return {"ok": False, "error": "Paste at least one of the FIR or CDR text blocks."}
    result = pipeline.run_ingestion(payload.fir_text, payload.cdr_text, payload.append_mode)
    return {"ok": True, **result}


@router.post("/clear")
def clear_all():
    db.clear_database()
    audit.clear()
    return {"ok": True}
