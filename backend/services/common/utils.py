"""
Common utility functions used by both pretrained and LLM extraction.

These utilities include phone/vehicle normalization, entity extraction,
and data structure builders for the three-phase pipeline.
"""
import re
from typing import Dict, List, Tuple, Any, Optional,Optional
import os
def normalize_text(text: str) -> str:
    """Normalize text for comparison"""
    return text.strip().lower()
def normalize_phone_number(phone: str) -> str:
    """
    Normalize phone number to standard format.

    Args:
        phone: Phone number to normalize

    Returns:
        Normalized phone number
    """
    # Remove all non-digit characters except leading +
    normalized = re.sub(r'^(\+|)?\d*', '', phone)

    # If starts with +, preserve it
    if phone.startswith('+'):
        normalized = '+' + normalized

    return normalized
def normalize_vehicle_plate(plate: str) -> str:
    """
    Normalize vehicle plate to standard format.

    Args:
        plate: Vehicle plate to normalize

    Returns:
        Normalized plate (uppercase, no spaces)
    """
    # Remove spaces and convert to uppercase
    return re.sub(r'\s', '', plate).upper()
def extract_phone_numbers(text: str) -> List[str]:
    """Extract phone numbers from text using common patterns"""
    patterns = [
        r'\+91[-\s]?\d{10}\b',
        r'\+91[-\s]?\d{5}[-\s]?\d{5}\b',
        r'\b0\d{2,4}[-\s]?\d{6,8}\b',
        r'\b\d{10}\b',
        r'\b\d{2}-\d{10}\b',
        r'\b\d{3}-\d{3}-\d{4}\b',
        r'\b\(\d{3}\)\s?\d{3}-\d{4}\b',
        r'\b\d{10}\b',
        r'\+\d{1,3}\s?\d{1,10}',
    ]

    phones = []
    for pattern in patterns:
        phones.extend(re.findall(pattern, text))

    # Filter: must have at least 10 digits
    cleaned = [p.strip() for p in phones if len(re.sub(r'\D', '', p)) >= 10]
    return list(set(cleaned))
def extract_vehicle_plates(text: str) -> List[str]:
    """Extract vehicle plates from text using common patterns"""
    patterns = [
        r'\b[A-Z]{2}-\d{2}-[A-Z]{1,2}-\d{4}\b',
        r'\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b',
        r'\b[A-Z]{2}\s\d{2}\s[A-Z]{1,2}\s\d{4}\b',
        r'\b\d{2}\s?BH\s?\d{4}\s?[A-Z]{1,2}\b',
        r'\b[A-Z]{2}\s?\d{4,6}\b',
        r'\b[A-Z]{3}\s?\d{3}\b',
        r'\b\d{3}\s?[A-Z]{3}\b',
        r'\b[A-Z]{1,2}\s?\d{1,5}\s?[A-Z]{1,2}\b',
    ]

    vehicles = []
    for pattern in patterns:
        vehicles.extend(re.findall(pattern, text, re.IGNORECASE))

    return list(set(v.strip().upper() for v in vehicles))
def build_cdr_calls_from_tabular_data(rows: List[Dict]) -> List[Dict]:
    """Build CDR calls from tabular data (existing logic from pipeline.py)"""
    cdr_calls = []
    for row in rows:
        cdr_calls.append({
            "caller": row["caller"],
            "called": row["called"],
            "timestamp": row["timestamp"],
            "duration": row["duration"],
            "source_sentence": None
        })
    return cdr_calls
def build_transactions_from_financial_data(rows: List[Dict]) -> List[Dict]:
    """Build transactions from financial data (new logic for BankAccount)"""
    transactions = []
    for row in rows:
        transactions.append({
            "from_account": row["from_account"],
            "to_account": row["to_account"],
            "amount": row["amount"],
            "date": row["date"],
            "currency": row["currency"],
            "source_sentence": None
        })
    return transactions
def extract_basic_entities(text: str) -> Dict[str, List[str]]:
    """
    Basic entity extraction for text processing.

    Args:
        text: Text to extract entities from

    Returns:
        Dict with basic entity types and lists
    """
    entities = {
        "people": [],
        "locations": [],
        "organizations": [],
        "vehicles": [],
        "phones": [],
        "bank_accounts": []
    }

    # Extract phone numbers and vehicles using utility functions
    entities["phones"] = extract_phone_numbers(text)
    entities["vehicles"] = extract_vehicle_plates(text)

    # For now, return empty lists for NLP-extracted entities
    # These would be filled by actual NLP extraction

    return entities
def is_tabular_cdr_format(text: str) -> Tuple[bool, Optional[str]]:
    """
    Check if text is in tabular CDR format.

    Args:
        text: Text to check

    Returns:
        Tuple of (is_tabular, delimiter)
    """
    # Common delimiters for CDR data
    delimiters = [';', ',', '\t']

    lines = text.strip().split('\n')
    if len(lines) < 2:
        return False, None

    # Check if first few lines have consistent delimiters
    for delimiter in delimiters:
        if all(delimiter in line for line in lines[:5]):
            return True, delimiter

    return False, None
def parse_tabular_cdr(text: str, delimiter: str) -> List[Dict]:
    """
    Parse tabular CDR data into structured format.

    Args:
        text: Tabular CDR text
        delimiter: Delimiter used in the text

    Returns:
        List of parsed CDR rows
    """
    lines = text.strip().split('\n')
    rows = []

    for line in lines:
        if not line.strip():
            continue

        # Handle CSV with quotes
        if delimiter == ',' and '"' in line:
            # Simple CSV parsing (doesn't handle quoted fields with delimiters)
            import csv
            from io import StringIO

            f = StringIO(line)
            reader = csv.reader(f)
            row = next(reader)
        else:
            # Simple split by delimiter
            row = [cell.strip() for cell in line.split(delimiter)]

        if len(row) >= 2:
            rows.append({
                "caller": row[0],
                "called": row[1] if len(row) > 1 else None,
                "timestamp": row[2] if len(row) > 2 else None,
                "duration": row[3] if len(row) > 3 else None,
                "source_sentence": line
            })

    return rows