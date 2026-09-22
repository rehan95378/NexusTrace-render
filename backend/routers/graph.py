"""
Graph router - All read-only endpoints for retrieving graph data.

This router handles all GET operations for graphs (single case and all-cases).
Calls services/graph.py for all business logic.
"""
from fastapi import APIRouter

from services import graph as graph_service

router = APIRouter()


@router.get("/cases/{case_id}/graph")
def get_graph(case_id: str):
    """Get graph data for a single case"""
    return graph_service.get_graph(case_id)


@router.get("/graph/all")
def get_all_graph():
    """Combined graph across every case — backs the Evidence Graph Map's
    'All cases' toggle. Each node/edge carries its case_id/case_name so the
    frontend can render per-case show/hide checkboxes and style genuine
    cross-case link edges differently from ordinary in-case relationship edges."""
    return graph_service.get_all_graph()