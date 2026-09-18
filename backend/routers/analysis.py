from fastapi import APIRouter

from services import analysis

router = APIRouter()


@router.get("/analysis/key-players")
def get_key_players():
    return analysis.key_players()


@router.get("/analysis/anomalies")
def get_anomalies():
    return analysis.anomalies()
