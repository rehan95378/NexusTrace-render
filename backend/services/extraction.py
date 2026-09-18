"""
Entity extraction from free-text intelligence reports (FIRs) and CDR/ledger
text. This is the former Streamlit script's extraction logic, unchanged in
behavior, just moved into the FastAPI service layer.
"""
import re
import csv
import io

import spacy

_nlp = None


def get_nlp():
    """Lazy-load the spaCy model once per process."""
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            import os
            os.system("python -m spacy download en_core_web_sm --break-system-packages")
            _nlp = spacy.load("en_core_web_sm")
    return _nlp


VEHICLE_PATTERNS = [
    r'\b[A-Z]{2}-\d{2}-[A-Z]{1,2}-\d{4}\b',     # KA-05-MH-1234
    r'\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b',        # KA05MH1234 (no dashes)
    r'\b[A-Z]{2}\s\d{2}\s[A-Z]{1,2}\s\d{4}\b',  # KA 05 MH 1234 (spaced)
    r'\b\d{2}\s?BH\s?\d{4}\s?[A-Z]{1,2}\b',     # 22 BH 1234 AB (Bharat series)
]

PHONE_PATTERNS = [
    r'\+91[-\s]?\d{10}\b',
    r'\+91[-\s]?\d{5}[-\s]?\d{5}\b',
    r'\b0\d{2,4}[-\s]?\d{6,8}\b',   # landline w/ STD code
    r'\b\d{10}\b',
    r'\b\d{2}-\d{10}\b',
]

KNOWN_ORGS = [
    "Bhagat Transport Services",
    "Shree Ganesh Hawala Network",
    "Om Sai Finance Corp",
    "Nova Digital Solutions",
    "Malabar Traders",
    "Sunrise Sports Consultancy",
]

TRIGGERS = {
    "ASSOCIATE_OF": ["associate", "seen with", "husband", "wife", "spouse", "last seen",
                     "known accomplice", "close aide", "partner", "linked to", "affiliated with"],
    "FINANCIAL_TRAIL": ["transferred", "withdrew", "hawala", "rs.", "transfer", "paid",
                         "deposited", "remitted", "wired", "laundered", "invested", "credited", "debited"],
    "CDR_LINK": ["contacted", "called", "cdr", "records show", "phone call", "spoke to",
                 "conversation with", "dialed", "rang"],
    "SPOTTED_AT": ["seen at", "spotted", "located at", "present at", "visited", "was at", "arrived at"],
    "OWNS_VEHICLE": ["registered to", "owns", "drives", "registered", "belongs to", "vehicle of"],
    "USES_DEVICE": ["registered", "holds", "uses", "phone", "number", "sim", "subscriber"],
    "INTERCEPTED_CALL": ["called", "ping", "comms", "sms", "contacted", "tower location", "cell tower"],
}

STOP_WORDS = {"Smt", "Shri", "Mr", "Mrs", "The", "Call", "ANPR", "Toll", "Hawala", "Hawala Operator", "Police", "FIR"}
LOCATION_NOISE = {"Tower", "State Bank Plaza", "Call", "ANPR", "CDR", "FIR"}

_MONTHS = (
    "january|february|march|april|may|june|july|august|september|october|november|december"
)

_DATE_PATTERNS = [
    re.compile(r'^\d{1,2}(st|nd|rd|th)\s+(' + _MONTHS + r')?$', re.IGNORECASE),
    re.compile(r'^(' + _MONTHS + r')\s+\d{1,2}(st|nd|rd|th)?$', re.IGNORECASE),
    re.compile(r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$'),
    re.compile(r'^\d{4}-\d{2}-\d{2}$'),
    re.compile(r'^\d{1,2}(st|nd|rd|th)$', re.IGNORECASE),
]


def is_probable_date(text):
    """
    spaCy's small model regularly mis-tags bare date phrases like
    '5th September' or '3rd August' as PERSON or GPE/LOC entities on
    short, list-like intelligence sentences. This heuristic catches the
    common patterns and filters them out before they become bogus nodes.
    """
    t = text.strip()
    return any(p.match(t) for p in _DATE_PATTERNS)


def extract_vehicles(text):
    found = []
    for pattern in VEHICLE_PATTERNS:
        found.extend(re.findall(pattern, text))
    return list(set(v.strip() for v in found))


def extract_phones(text):
    found = []
    for pattern in PHONE_PATTERNS:
        found.extend(re.findall(pattern, text))
    cleaned = [p.strip() for p in found if len(re.sub(r'\D', '', p)) >= 10]
    return list(set(cleaned))


def extract_orgs(text):
    """Known-organization substring match against a fixed watchlist."""
    return list({org for org in KNOWN_ORGS if org in text})


def looks_tabular(text, min_rows=2):
    lines = [l for l in text.strip().splitlines() if l.strip()]
    if len(lines) < min_rows:
        return False, None

    for delim in [",", "\t", "|", ";"]:
        counts = [line.count(delim) for line in lines]
        if counts[0] > 0 and len(set(counts)) == 1:
            return True, delim
    return False, None


def parse_cdr_rows(text, delim):
    reader = csv.reader(io.StringIO(text.strip()), delimiter=delim)
    rows = [r for r in reader if any(cell.strip() for cell in r)]
    if not rows:
        return []

    header_candidates = {"caller", "called", "from", "to", "a_number", "b_number",
                          "number", "timestamp", "date", "duration", "time"}
    first_row_lower = [c.strip().lower() for c in rows[0]]
    has_header = any(cell in header_candidates for cell in first_row_lower)

    if has_header:
        col_index = {name: i for i, name in enumerate(first_row_lower)}
        caller_idx = col_index.get("caller", col_index.get("from", col_index.get("a_number", 0)))
        called_idx = col_index.get("called", col_index.get("to", col_index.get("b_number", 1)))
        ts_idx = col_index.get("timestamp", col_index.get("date", col_index.get("time")))
        dur_idx = col_index.get("duration")
        data_rows = rows[1:]
    else:
        caller_idx, called_idx, ts_idx, dur_idx = 0, 1, 2, 3
        data_rows = rows

    parsed = []
    for row in data_rows:
        if len(row) <= max(caller_idx, called_idx):
            continue
        caller = row[caller_idx].strip()
        called = row[called_idx].strip()
        if not caller or not called:
            continue
        timestamp = row[ts_idx].strip() if ts_idx is not None and ts_idx < len(row) else None
        duration = row[dur_idx].strip() if dur_idx is not None and dur_idx < len(row) else None
        parsed.append({"caller": caller, "called": called, "timestamp": timestamp, "duration": duration})
    return parsed
