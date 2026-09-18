from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from utils.neo4j_driver import verify_connectivity
from routers import ingest, entities, graph, analysis, audit
from services.extraction import get_nlp

app = FastAPI(title="SIH26189 Backend")

# Allow the frontend (any origin for now — tighten before final submission)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(entities.router)
app.include_router(graph.router)
app.include_router(analysis.router)
app.include_router(audit.router)


@app.on_event("startup")
def warm_up():
    # Load the spaCy model once at startup rather than on the first request,
    # so the first /ingest call isn't slow (and to fail fast if it's missing).
    get_nlp()


@app.get("/health")
def health():
    db_ok = verify_connectivity()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "backend",
        "neo4j_connected": db_ok,
    }


@app.get("/")
def root():
    return {"message": "SIH26189 backend is running"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
