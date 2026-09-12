from fastapi import APIRouter, Depends
from ..auth import get_user_from_token
from ..graph_service import get_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def alerts(_user=Depends(get_user_from_token)):
    """Structured list of anomaly-flagged nodes (reads Stage 7 output)."""
    return {"success": True, "alerts": get_alerts()}