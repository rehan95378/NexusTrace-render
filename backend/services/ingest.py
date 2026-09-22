"""
Ingestion service - handles FIR/CDR text ingestion and case clearing.
"""
from services.pretrained.pipeline import PretrainedPipeline
from services import audit
from utils import neo4j_driver as db

# Initialize pretrained pipeline
_pipeline = PretrainedPipeline()


def run_ingestion(case_id, fir_text, cdr_text, append_mode):
    """Run the ingestion pipeline on FIR and CDR text"""
    if not fir_text.strip() and not cdr_text.strip():
        return {"ok": False, "error": "Paste at least one of the FIR or CDR text blocks."}

    result = _pipeline.run_ingestion(fir_text, cdr_text, append_mode, case_id)
    return {"ok": True, **result}


def clear_case_data(case_id):
    """Wipe this case's entities/graph/audit trail — the case itself stays"""
    db.clear_case(case_id)
    audit.clear(case_id)
    return {"ok": True}
