"""
CDR Parser - Parse tabular call detail records.

Uses common.csv_parser for shared tabular parsing logic.
"""
from services.common.csv_parser import CSVParser


class CDRParser:
    """Parse tabular call detail records"""

    def __init__(self):
        self._parser = CSVParser()

    def is_tabular(self, text: str, min_rows: int = 2) -> tuple[bool, str | None]:
        """Check if text looks like tabular data"""
        return self._parser.is_tabular(text, min_rows)

    def parse_rows(self, text: str, delimiter: str = None) -> list[dict]:
        """Parse CDR rows from tabular text, mapped to standard format"""
        rows = self._parser.parse_rows(text, delimiter)
        return self._parser.map_to_cdr(rows)

    def parse_simple(self, text: str, delimiter: str = None) -> list[list[str]]:
        """Parse rows without header mapping (fallback)"""
        return self._parser.parse_simple(text, delimiter)