from fastapi import APIRouter, Depends
from ..auth import get_user_from_token
from ..graph_service import get_graph

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("")
def graph(_user=Depends(get_user_from_token)):
    """Nodes + edges shaped for the frontend graph library."""
    return get_graph()