"""Stage 3 - Entity Extraction.

Input : one unified record contract
        {source_type, raw_content, timestamp, source_doc_id}.
Output: list of 'entity' contracts
        {text, type, confidence, method, source_doc_id}.

Strategy
--------
* Deterministic, dependency-light path: gazetteer substring matching for
  Person / Location / Organization plus targeted regexes for Phone and Vehicle.
* Optional spacy NER is attempted inside a guarded block and silently falls
  back to the regex/gazetteer path when the model is unavailable (never a
  hard crash).
* Extraction is per-document: every emitted entity carries the record's
  ``source_doc_id`` so later stages can dedupe evidence per document.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

# Package-relative path to the gazetteer (resolves to <backend>/config).
# Overridable via env for testability.
_CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"
_GAZETTEER_PATH = os.environ.get(
    "GAZETTEER_PATH",
    str(_CONFIG_DIR / "gazetteer.json"),
)

# Inline mirror of config/gazetteer.json so extraction keeps working if the
# config file goes missing (used only on load failure).
_DEFAULT_GAZETTEER = {
    "Person": [
        "Ramesh Kumar", "Suresh Kumar", "Anil Verma", "Priya Sharma",
        "Vikram Singh", "Rajesh Gupta", "Meena Patel", "Sanjay Rao",
    ],
    "Location": [
        "Nashik", "Mumbai", "Pune", "Delhi", "Nagpur", "Aurangabad", "Thane",
    ],
    "Organization": [
        "NCRB", "State CID", "Nashik Police", "Central Bureau of Investigation",
        "Real Estate Group",
    ],
}

# Indian mobile / STD numbers: optional +91 prefix, digits possibly separated
# by spaces/hyphens. Captures the whole matched span verbatim.
_PHONE_RE = re.compile(
    r"(?:(?:\+?91|0)[\s-]?)?[6-9]\d[\s-]?\d{4}[\s-]?\d{4}"
)

# Indian vehicle registration plate, e.g. MH-12-AB-3456.
_VEHICLE_RE = re.compile(
    r"\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,2}[\s-]?\d{4}\b",
    re.IGNORECASE,
)

# Candidate for a short-form / first-name alias: a word-initial capitalized
# token (>=3 chars) bounded by whitespace or punctuation.
_CAP_TOKEN_RE = re.compile(r"(?:(?<=\s)|(?<=^))([A-Z][a-z]{2,})(?=[\s,.\-;:!?\)])")

# Leading honorifics — strip from a raw span before matching a gazetteer name.
_HONORIFICS_RE = re.compile(r"^\s*(?:Shri|Smt|Mr|Mrs|Ms|Dr|Prof|Insp|Min)\.?\s+", re.IGNORECASE)


def _load_gazetteer() -> dict:
    """Load the gazetteer keyed by canonical entity type (or a static mirror)."""
    try:
        with open(_GAZETTEER_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
            return _DEFAULT_GAZETTEER
    except (OSError, ValueError):  # pragma: no cover - env dependent
        return json.loads(json.dumps(_DEFAULT_GAZETTEER))


def _collapse_phone(text: str) -> str:
    """Normalise a phone number to digits for stable cross-doc identity."""
    return re.sub(r"\D", "", text)


def _gazetteer_entities(raw: str, gaz: dict, source_doc_id: str) -> list[dict]:
    """Match gazetteer names literally against the raw text (case-insensitive).
    For Person/Organization, also emit first-name aliases from the match.
    """
    out = []
    low = raw.lower()
    # First pass: literal gazetteer hits
    for etype, names in (gaz or {}).items():
        for name in names or ():
            if not name:
                continue
            if name.lower() in low:
                ent = {
                    "text": name,
                    "type": etype,
                    "confidence": 0.8,
                    "method": "gazetteer",
                    "source_doc_id": source_doc_id,
                }
                # Expand first-name / short aliases for Person & Organization
                if etype in ("Person", "Organization"):
                    tokens = name.split()
                    if tokens:
                        first = tokens[0]
                        if len(first) >= 3:
                            ent["mentions"] = [first.lower()]
                out.append(ent)
    return out


def _regex_entities(raw: str, source_doc_id: str) -> list[dict]:
    """Pull Phone and Vehicle entities via targeted regexes."""
    out = []

    seen_phones = set()
    for m in _PHONE_RE.finditer(raw):
        span = m.group(0).strip()
        digits = _collapse_phone(span)
        # require a plausible length and a valid lead digit
        if len(digits) < 10 or digits[0] not in "6789":
            continue
        if digits in seen_phones:
            continue
        seen_phones.add(digits)
        out.append(
            {
                "text": span,
                "type": "Phone",
                "confidence": 0.85,
                "method": "regex",
                "source_doc_id": source_doc_id,
                "phone": digits,
            }
        )

    seen_vehicles = set()
    for m in _VEHICLE_RE.finditer(raw):
        span = m.group(0).strip()
        key = span.upper()
        if key in seen_vehicles:
            continue
        seen_vehicles.add(key)
        out.append(
            {
                "text": span,
                "type": "Vehicle",
                "confidence": 0.85,
                "method": "regex",
                "source_doc_id": source_doc_id,
                "vehicle": span,
            }
        )
    return out


def _csv_phones(record: dict, source_doc_id: str) -> list[dict]:
    """Pull caller/callee numbers from a serialized CDR row."""
    out = []
    raw = record.get("raw_content") or ""
    try:
        row = json.loads(raw)
    except (ValueError, TypeError):
        row = {}
    for key in ("caller", "callee"):
        val = str(row.get(key) or "").strip()
        if not val:
            continue
        digits = _collapse_phone(val)
        if len(digits) < 10:
            continue
        out.append(
            {
                "text": val,
                "type": "Phone",
                "confidence": 0.95,
                "method": "cdr_field",
                "source_doc_id": source_doc_id,
                "phone": digits,
            }
        )
    return out


def _spacy_entities(record: dict, source_doc_id: str) -> list[dict]:
    """OPTIONAL spacy NER enrichment. Runs only when spacy + a model are
    available; any failure falls back silently to emitting nothing."""
    try:  # pragma: no cover - depends on optional model download
        import spacy  # type: ignore

        nlp = spacy.load("en_core_web_sm")  # heavy model; may be absent
        doc = nlp(record.get("raw_content") or "")
        out = []
        for ent in doc.ents:
            ent_type = ent.label_
            if ent_type == "PERSON":
                t = "Person"
            elif ent_type in ("GPE", "LOC"):
                t = "Location"
            elif ent_type == "ORG":
                t = "Organization"
            else:
                continue
            out.append(
                {
                    "text": ent.text.strip(),
                    "type": t,
                    "confidence": 0.75,
                    "method": "spacy",
                    "source_doc_id": source_doc_id,
                }
            )
        return out
    except Exception:  # pragma: no cover - optional dependency
        return []


def extract_entities(record: dict) -> list[dict]:
    """Extract entity contracts from a single unified record.

    ``record`` must include ``source_doc_id`` and ``raw_content``. Returns a
    list of dicts each with at least {text, type, confidence, method,
    source_doc_id}.
    """
    if not record or not isinstance(record, dict):
        return []
    raw = str(record.get("raw_content") or "")
    source_doc_id = record.get("source_doc_id")

    gaz = _load_gazetteer()

    entities = []

    # CDR rows carry phone numbers in structured fields - handle first.
    if record.get("source_type") == "cdr":
        entities.extend(_csv_phones(record, source_doc_id))

    entities.extend(_gazetteer_entities(raw, gaz, source_doc_id))
    entities.extend(_regex_entities(raw, source_doc_id))
    entities.extend(_spacy_entities(record, source_doc_id))

    # Drop entities with no usable text/type; de-duplicate exact (text,type).
    seen = set()
    out = []
    for ent in entities:
        text = str(ent.get("text") or "").strip()
        etype = str(ent.get("type") or "").strip()
        if not text or not etype:
            continue
        key = (text.lower(), etype.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(ent)
    return out