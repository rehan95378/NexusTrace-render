from fastapi import APIRouter

from services import analysis

router = APIRouter()


@router.get("/cases/{case_id}/analysis/key-players")
def get_key_players(case_id: str):
    return analysis.key_players(case_id)


@router.get("/cases/{case_id}/analysis/anomalies")
def get_anomalies(case_id: str):
    return analysis.anomalies(case_id)
