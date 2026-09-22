"""
Configuration: patterns, triggers, thresholds for pretrained extraction.
"""
import re

# Vehicle number plate patterns (Indian)
VEHICLE_PATTERNS = [
    r'\b[A-Z]{2}-\d{2}-[A-Z]{1,2}-\d{4}\b',     # KA-05-MH-1234
    r'\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b',        # KA05MH1234 (no dashes)
    r'\b[A-Z]{2}\s\d{2}\s[A-Z]{1,2}\s\d{4}\b',  # KA 05 MH 1234 (spaced)
    r'\b\d{2}\s?BH\s?\d{4}\s?[A-Z]{1,2}\b',     # 22 BH 1234 AB (Bharat series)
]

# Phone number patterns (Indian)
PHONE_PATTERNS = [
    r'\+91[-\s]?\d{10}\b',
    r'\+91[-\s]?\d{5}[-\s]?\d{5}\b',
    r'\b0\d{2,4}[-\s]?\d{6,8}\b',   # landline with STD code
    r'\b\d{10}\b',
    r'\b\d{2}-\d{10}\b',
]

# Known organizations watchlist
KNOWN_ORGS = [
    "Bhagat Transport Services",
    "Shree Ganesh Hawala Network",
    "Om Sai Finance Corp",
    "Nova Digital Solutions",
    "Malabar Traders",
    "Sunrise Sports Consultancy",
]

# Relationship trigger keywords
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

# Stop words - filter out these from entity extraction
STOP_WORDS = {"Smt", "Shri", "Mr", "Mrs", "The", "Call", "ANPR", "Toll", "Hawala", "Hawala Operator", "Police", "FIR"}

# Location noise - filter these out from location entities
LOCATION_NOISE = {"Tower", "State Bank Plaza", "Call", "ANPR", "CDR", "FIR"}

# Date patterns - filter out dates misidentified as entities
_MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december"

DATE_PATTERNS = [
    re.compile(r'^\d{1,2}(st|nd|rd|th)\s+(' + _MONTHS + r')?$', re.IGNORECASE),
    re.compile(r'^(' + _MONTHS + r')\s+\d{1,2}(st|nd|rd|th)?$', re.IGNORECASE),
    re.compile(r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$'),
    re.compile(r'^\d{4}-\d{2}-\d{2}$'),
    re.compile(r'^\d{1,2}(st|nd|rd|th)$', re.IGNORECASE),
]

# Fuzzy matching thresholds
FUZZY_MATCH_THRESHOLD = 85  # Within-case person name matching
CROSS_CASE_FUZZY_THRESHOLD = 93  # Cross-case person matching (stricter)
