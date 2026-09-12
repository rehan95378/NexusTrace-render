"""Stage 1 — Data Ingestion.

Reads raw criminal-data sources (CDR/transaction CSVs, FIR JSON, scanned
reports PDF) and unifies every record into ONE contract:

    {"source_type", "raw_content", "timestamp", "source_doc_id"}

`source_doc_id` is load-bearing downstream: Stages 3 and 5 dedupe evidence
PER UNIQUE DOCUMENT, not per sentence. Keep it deterministic.
"""
import hashlib
import json
from pathlib import Path

import pandas as pd


class UnsupportedSourceError(NotImplementedError):
    pass


def _doc_id(source_type: str, raw: str) -> str:
    """Stable hash of content → same file always yields same doc id."""
    return hashlib.sha256(f"{source_type}:{raw}".encode()).hexdigest()[:16]


def _read_csv(path: Path) -> list[dict]:
    df = pd.read_csv(path)
    # One row per record, raw text is the serialized row (kept for provenance).
    for _, row in df.iterrows():
        yield {
            "source_type": "cdr",
            "raw_content": json.dumps(row.to_dict(), ensure_ascii=False),
            "timestamp": str(row.get("timestamp", "") or row.get("date", "") or ""),
            "source_doc_id": _doc_id("cdr", path.name + str(row.name)),
        }


def _read_json(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    docs = payload if isinstance(payload, list) else payload.get("reports", [payload])
    if not isinstance(docs, list):
        docs = [payload]
    for doc in docs:
        text = doc.get("text", "") if isinstance(doc, dict) else str(doc)
        yield {
            "source_type": doc.get("source_type", "fir") if isinstance(doc, dict) else "fir",
            "raw_content": text,
            "timestamp": str(doc.get("timestamp", "")) if isinstance(doc, dict) else "",
            "source_doc_id": _doc_id("fir", text),
        }


def _read_pdf(path: Path) -> list[dict]:
    import pdfplumber  # heavy-ish import; pull in only when needed

    text_parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
    text = "\n".join(text_parts)
    return [{
        "source_type": "report",
        "raw_content": text,
        "timestamp": "",
        "source_doc_id": _doc_id("report", text),
    }]


def load_file(path: Path) -> list[dict]:
    """Read ONE file and return unified records. Raises UnsupportedSourceError."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext == ".csv":
        return list(_read_csv(path))
    if ext == ".json":
        return list(_read_json(path))
    if ext == ".pdf":
        return list(_read_pdf(path))
    raise UnsupportedSourceError(f"Unsupported source type: {ext}")


def ingest_directory(directory) -> list[dict]:
    """Read every supported file in a directory; skip unknown files loudly."""
    records = []
    directory = Path(directory)
    for path in sorted(directory.iterdir()):
        if path.is_file():
            try:
                records.extend(load_file(path))
            except UnsupportedSourceError as e:
                print(f"[ingest] skipped {path.name}: {e}")
    return records