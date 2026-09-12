from fastapi import APIRouter, Depends, HTTPException
from ..auth import get_user_from_token
from pipeline.review.queue import load, list_items, resolve

router = APIRouter(prefix="/review", tags=["review"])


@router.get("")
def get_review(kind: str | None = None, status: str | None = None, _user=Depends(get_user_from_token)):
    """List items waiting in the review queue: low-confidence entities and
    relationships that never entered the main graph as verified fact."""
    return {
        "success": True,
        "items": list_items(kind=kind, status=status),
    }


@router.post("/{item_id}/approve")
def approve(item_id: int, _user=Depends(get_user_from_token)):
    """Analyst confirms an item — record that it was validated."""
    item = resolve(item_id, "approve")
    if item is None:
        raise HTTPException(404, f"No review item with id {item_id}")
    return {"success": True, "item": item}


@router.post("/{item_id}/reject")
def reject(item_id: int, _user=Depends(get_user_from_token)):
    """Analyst rejects an item as a false positive."""
    item = resolve(item_id, "reject")
    if item is None:
        raise HTTPException(404, f"No review item with id {item_id}")
    return {"success": True, "item": item}