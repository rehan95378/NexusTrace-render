from fastapi import APIRouter

from services import analysis

router = APIRouter()


@router.get("/cases/{case_id}/analysis/key-players")
def get_key_players(case_id: str):
    return analysis.key_players(case_id)


@router.get("/cases/{case_id}/analysis/anomalies")
def get_anomalies(case_id: str):
    return analysis.anomalies(case_id)


@router.get("/analysis/key-players/all")
def get_key_players_all():
    """Key Players analysis across all cases, including cross-case links."""
    return analysis.key_players_all_cases()


@router.get("/analysis/anomalies/all")
def get_anomalies_all():
    """Anomaly detection across all cases, including cross-case links."""
    return analysis.anomalies_all_cases()
