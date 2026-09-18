from fastapi import APIRouter

from services import audit

router = APIRouter()


@router.get("/cases/{case_id}/audit")
def get_audit(case_id: str, limit: int = 200):
    valid, broken_entry = audit.verify_chain(case_id)
    return {
        "valid": valid,
        "broken_entry": broken_entry,
        "entries": audit.list_entries(case_id, limit=limit),
    }
