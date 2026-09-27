"""
Generic CSV/Tabular parser for both CDR and Financial data.

Provides shared logic for:
- Detecting tabular format
- Parsing rows with headers
- Column index mapping by header names
- Delimiter auto-detection
"""
import csv
import io
from typing import Dict, List, Any, Optional, Tuple


class CSVParser:
    """Generic tabular/CSV parser for CDR and financial data"""

    # Column name mappings for different data types
    CDR_COLUMNS = {
        "caller": ["caller", "from", "a_number", "number", "source", "phone_a"],
        "called": ["called", "to", "b_number", "destination", "phone_b"],
        "timestamp": ["timestamp", "date", "time", "datetime", "call_time"],
        "duration": ["duration", "call_duration", "length", "time_sec"]
    }

    FINANCIAL_COLUMNS = {
        "amount": ["amount", "value", "sum", "total", "transaction_value", "credit", "debit"],
        "from_account": ["from_account", "from_acc", "source", "sender", "source_account", "account_from"],
        "to_account": ["to_account", "to_acc", "destination", "recipient", "target_account", "account_to"],
        "currency": ["currency", "currency_code"],
        "date": ["date", "timestamp", "transaction_date", "posted_date"],
        "description": ["description", "narrative", "memo", "details", "transaction_type", "type"]
    }

    def is_tabular(self, text: str, min_rows: int = 2) -> Tuple[bool, Optional[str]]:
        """
        Detect if text is tabular data.

        Returns:
            Tuple of (is_tabular, delimiter)
        """
        lines = [l for l in text.strip().splitlines() if l.strip()]
        if len(lines) < min_rows:
            return False, None

        for delim in [",", ";", "\t", "|"]:
            counts = [line.count(delim) for line in lines[:5]]
            if counts[0] > 0 and len(set(counts)) == 1:
                return True, delim

        return False, None

    def parse_rows(self, text: str, delimiter: str = None) -> List[Dict[str, str]]:
        """
        Parse tabular text into list of row dicts.

        Args:
            text: Tabular text content
            delimiter: Optional delimiter (auto-detected if None)

        Returns:
            List of dicts with header name -> value mappings
        """
        if delimiter is None:
            is_tab, delimiter = self.is_tabular(text)
            if not is_tab:
                return []

        reader = csv.DictReader(io.StringIO(text.strip()), delimiter=delimiter)
        rows = [dict(row) for row in reader if any(v.strip() for v in row.values())]

        return rows

    def parse_simple(self, text: str, delimiter: str = ",") -> List[List[str]]:
        """
        Parse tabular text into simple list of lists (no header mapping).

        Args:
            text: Tabular text content
            delimiter: Delimiter to use

        Returns:
            List of rows, each row is list of cell strings
        """
        reader = csv.reader(io.StringIO(text.strip()), delimiter=delimiter)
        rows = [[cell.strip() for cell in row] for row in reader]
        return [r for r in rows if any(cell for cell in r)]

    def detect_format(self, rows: List[Dict[str, str]]) -> str:
        """
        Auto-detect if rows are CDR or Financial format.

        Returns:
            "cdr", "financial", or "unknown"
        """
        if not rows:
            return "unknown"

        first_row = rows[0]
        first_row_lower = {k.lower(): v for k, v in first_row.items()}

        # Check for CDR columns
        cdr_keys = self.CDR_COLUMNS.keys()
        cdr_matches = sum(1 for k in cdr_keys if k in first_row_lower)

        # Check for financial columns
        fin_keys = self.FINANCIAL_COLUMNS.keys()
        fin_matches = sum(1 for k in fin_keys if k in first_row_lower)

        if cdr_matches >= 2:
            return "cdr"
        elif fin_matches >= 2:
            return "financial"
        elif any(k in first_row_lower for k in ["caller", "called", "from", "to"]):
            return "cdr"
        elif any(k in first_row_lower for k in ["amount", "account", "credit", "debit"]):
            return "financial"

        return "unknown"

    def map_to_cdr(self, rows: List[Dict[str, str]]) -> List[Dict[str, Optional[str]]]:
        """
        Map row dicts to CDR format with standard keys.

        Args:
            rows: List of raw row dicts

        Returns:
            List of CDR dicts with keys: caller, called, timestamp, duration
        """
        cdr_rows = []
        for row in rows:
            cdr_rows.append({
                "caller": self._get_first_match(row, self.CDR_COLUMNS["caller"]),
                "called": self._get_first_match(row, self.CDR_COLUMNS["called"]),
                "timestamp": self._get_first_match(row, self.CDR_COLUMNS["timestamp"]),
                "duration": self._get_first_match(row, self.CDR_COLUMNS["duration"])
            })
        return cdr_rows

    def map_to_financial(self, rows: List[Dict[str, str]]) -> List[Dict[str, Optional[str]]]:
        """
        Map row dicts to Financial format with standard keys.

        Args:
            rows: List of raw row dicts

        Returns:
            List of Financial dicts with keys: amount, from_account, to_account, currency, date, description
        """
        fin_rows = []
        for row in rows:
            fin_rows.append({
                "amount": self._get_first_match(row, self.FINANCIAL_COLUMNS["amount"]),
                "from_account": self._get_first_match(row, self.FINANCIAL_COLUMNS["from_account"]),
                "to_account": self._get_first_match(row, self.FINANCIAL_COLUMNS["to_account"]),
                "currency": self._get_first_match(row, self.FINANCIAL_COLUMNS["currency"]) or "USD",
                "date": self._get_first_match(row, self.FINANCIAL_COLUMNS["date"]),
                "description": self._get_first_match(row, self.FINANCIAL_COLUMNS["description"])
            })
        return fin_rows

    # Confidence / validation helpers for LLM + pretrained
    def get_row_confidence(self, row: Dict[str, str], required_keys: List[str]) -> float:
        """Score how complete a row is (0.0-1.0)"""
        found = sum(1 for k in required_keys if row.get(k, "").strip())
        return found / len(required_keys) if required_keys else 1.0

    def validate_format(self, rows: List[Dict[str, str]], expected: str = "cdr") -> Tuple[bool, List[str]]:
        """Validate rows match expected format; return (ok, errors)"""
        errors = []
        if not rows:
            errors.append("No rows")
            return False, errors
        format_type = self.detect_format(rows)
        if format_type != expected and expected != "unknown":
            errors.append(f"Expected {expected}, got {format_type}")
        required = list(self.CDR_COLUMNS.keys()) if expected == "cdr" else list(self.FINANCIAL_COLUMNS.keys())
        for i, row in enumerate(rows[:5]):
            missing = [k for k in required if not row.get(k, "").strip() and not any(
                v.strip() for v in row.values() if v)]
        return len(errors) == 0, errors

    def infer_schema(self, rows: List[Dict[str, str]]) -> Dict[str, str]:
        """Infer data types per column for LLM context"""
        if not rows:
            return {}
        schema = {}
        for key in rows[0].keys():
            values = [str(row.get(key, "")).strip() for row in rows[:10]]
            values = [v for v in values if v]
            if not values:
                schema[key] = "unknown"
                continue
            # Try number
            try:
                float(values[0])
                all_float = all(float(v.replace(",", ".")) for v in values if v.replace(",", ".").replace("-", "").isdigit() or v.replace(",", ".").replace("-", "").count(".") <= 1)
                if all_float or sum(1 for v in values if v.replace(",", ".").replace("-", "").isdigit() or "." in v) / len(values) > 0.7:
                    schema[key] = "number"
                    continue
            except:
                pass
            # Try date
            if any("/" in v or "-" in v for v in values[:3]):
                schema[key] = "date"
                continue
            schema[key] = "string"
        return schema

    def _get_first_match(self, row: Dict[str, str], aliases: List[str]) -> Optional[str]:
        """Get value from row matching any of the alias column names"""
        row_lower = {k.lower(): v for k, v in row.items()}
        for alias in aliases:
            for key, val in row_lower.items():
                if alias in key and val.strip():
                    return val.strip()
        return None

    # Common extraction methods shared by both CDR and financial
    def extract_accounts_from_text(self, text: str) -> List[str]:
        import re
        accounts = set()
        for pattern in [r'\b\d{8,20}\b', r'\b[A-Z]{2}\d{6,12}\b']:
            accounts.update(re.findall(pattern, text, re.IGNORECASE))
        return [a.strip() for a in accounts if len(a.strip()) >= 4]

    def find_column_index(self, header: List[str], names: List[str]) -> int:
        for name in names:
            for i, h in enumerate(header):
                if name in h.lower():
                    return i
        return -1