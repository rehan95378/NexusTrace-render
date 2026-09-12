"""NexusTrace API entrypoint (SIH26189).

One FastAPI service serving the REST API + the full extraction/analytics
pipeline. The frontend lives in a separate static service and talks to this
API via VITE_API_URL.

Run:
    cd backend && uvicorn app:app --host 0.0.0.0 --port 8000

In GRAPH_MODE=seed (default) the graph/alerts/review all work from in-memory
data with no Neo4j, so the demo runs anywhere. Set GRAPH_MODE=neo4j + the
NEO4J_* env vars to read/write a live graph.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import (
    auth_router,
    graph_router,
    alerts_router,
    ingest_router,
    review_router,
)

app = FastAPI(title="NexusTrace API", version="0.1.0")

# SIH26: NCRB / Ministry of Home Affairs / Women Safety Division
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend origin before prod
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(graph_router.router)
app.include_router(alerts_router.router)
app.include_router(ingest_router.router)
app.include_router(review_router.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "nexustrace-backend"}


@app.get("/")
def root():
    return {"message": "NexusTrace API is running", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port)