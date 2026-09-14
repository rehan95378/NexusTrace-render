from fastapi import FastAPI
import os

app = FastAPI(title="SIH26189 AI/ML Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-ml"}


@app.get("/")
def root():
    return {"message": "SIH26189 AI/ML service is running"}


# Real endpoints to add next: POST /extract, POST /analyze


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("api:app", host="0.0.0.0", port=port)
