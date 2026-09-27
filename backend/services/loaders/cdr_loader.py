"""
CDR file loader for pretrained extraction.
Supports both tabular and narrative CDR data.
"""
from typing import Dict, Any, Tuple
from services.pretrained.cdr_extractor import CDRParser

class CDRFileLoader:
    """Load and parse CDR (Call Detail Record) files"""

    def __init__(self):
        self.parser = CDRParser()

    def load(self, file_path: str) -> Dict[str, Any]:
        """Load CDR file

        Args:
            file_path: Path to CDR file (CSV, XLSX, or text)

        Returns:
            Dict with keys:
            - "data": Parsed CDR data (rows or text)
            - "metadata": File metadata
            - "file_type": "cdr"
            - "is_tabular": Whether data is tabular
        """
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        return self._parse_content(content, file_path)

    def load_from_bytes(self, file_bytes: bytes) -> Dict[str, Any]:
        """Load CDR from bytes (memory)"""
        # Try to detect if it's Excel binary first
        try:
            import io
            import pandas as pd
            # Try openpyxl for .xlsx files
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
            content = df.to_string(index=False)
            return self._parse_content(content, "bytes")
        except Exception:
            # Not Excel — try UTF-8 text
            try:
                content = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    content = file_bytes.decode("latin-1")
                except Exception:
                    raise ValueError("Cannot decode CDR file content")
            return self._parse_content(content, "bytes")

    def _parse_content(self, content: str, source: str) -> Dict[str, Any]:
        """Parse CDR content (tabular or narrative)"""
        # Check if content is tabular
        is_tabular, delim = self.parser.is_tabular(content)

        if is_tabular:
            rows = self.parser.parse_rows(content, delim)
            return {
                "data": rows,
                "metadata": {
                    "file_type": "cdr",
                    "format": "tabular",
                    "delimiter": delim,
                    "row_count": len(rows),
                    "source": source
                },
                "file_type": "cdr",
                "is_tabular": True,
                "rows": rows
            }
        else:
            return {
                "data": content,
                "metadata": {
                    "file_type": "cdr",
                    "format": "narrative",
                    "source": source
                },
                "file_type": "cdr",
                "is_tabular": False,
                "text": content
            }