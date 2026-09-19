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


@router.get("/audit/all")
def get_audit_all(limit: int = 500):
    """
    Global audit log across all cases, sorted by timestamp.

    Each entry is tagged with its case_id. Per-case hash chain verification
    is provided separately (one verification status per case, not one combined
    chain across cases).
    """
    return {
        "verification": audit.verify_all_chains(),
        "entries": audit.list_all_entries(limit=limit),
    }
