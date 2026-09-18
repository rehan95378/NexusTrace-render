from fastapi import APIRouter

from services import audit

router = APIRouter()


@router.get("/audit")
def get_audit(limit: int = 200):
    valid, broken_entry = audit.verify_chain()
    return {
        "valid": valid,
        "broken_entry": broken_entry,
        "entries": audit.list_entries(limit=limit),
    }
