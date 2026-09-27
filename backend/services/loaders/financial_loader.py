"""
Financial data loader for pretrained extraction.
Supports CSV, XLSX, and narrative financial records.
"""
from typing import Dict, Any
class FinancialFileLoader:
    """Load and parse financial data files"""

    def __init__(self):
        self.pandas_available = True
        try:
            import pandas as pd
            self.pandas = pd
        except ImportError:
            self.pandas_available = False

    def load(self, file_path: str) -> Dict[str, Any]:
        """Load financial file

        Args:
            file_path: Path to financial file (CSV, XLSX)

        Returns:
            Dict with keys:
            - "data": Parsed financial data (rows)
            - "metadata": File metadata
            - "file_type": "financial"
        """
        if not self.pandas_available:
            raise ImportError(
                "pandas is required for financial loading. "
                "Install with: pip install pandas openpyxl"
            )

        file_ext = file_path.lower().split(".")[-1]

        if file_ext == "csv":
            data = self.pandas.read_csv(file_path)
        elif file_ext in ["xlsx", "xls"]:
            data = self.pandas.read_excel(file_path, engine="openpyxl")
        else:
            raise ValueError(f"Unsupported financial file format: {file_ext}")

        return {
            "data": data.to_dict("records"),
            "metadata": {
                "file_type": "financial",
                "format": file_ext,
                "row_count": len(data),
                "column_count": len(data.columns),
                "source": file_path
            },
            "file_type": "financial",
            "columns": list(data.columns)
        }

    def load_from_bytes(self, file_bytes: bytes) -> Dict[str, Any]:
        """Load financial data from bytes (memory)"""
        if not self.pandas_available:
            raise ImportError(
                "pandas is required for financial loading. "
                "Install with: pip install pandas openpyxl"
            )

        # First try to read as Excel (binary format)
        # This handles .xlsx and .xls files directly from bytes
        try:
            import io
            # Try openpyxl for .xlsx first
            df = self.pandas.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
            return {
                "data": df.to_dict("records"),
                "metadata": {
                    "file_type": "financial",
                    "format": "xlsx",
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "source": "bytes"
                },
                "file_type": "financial",
                "columns": list(df.columns)
            }
        except Exception:
            # If Excel fails, try as CSV or narrative text
            try:
                content = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                # If not UTF-8, try latin-1 (covers more byte ranges)
                try:
                    content = file_bytes.decode("latin-1")
                except Exception:
                    raise ValueError("Cannot decode file content")

            # Check if it's CSV (has commas or tabs with newlines)
            if "," in content and "\n" in content:
                from io import StringIO
                data = self.pandas.read_csv(StringIO(content))
                return {
                    "data": data.to_dict("records"),
                    "metadata": {
                        "file_type": "financial",
                        "format": "csv",
                        "row_count": len(data),
                        "column_count": len(data.columns),
                        "source": "bytes"
                    },
                    "file_type": "financial",
                    "columns": list(data.columns)
                }
            else:
                # Narrative text
                return {
                    "data": content,
                    "metadata": {
                        "file_type": "financial",
                        "format": "narrative",
                        "source": "bytes"
                    },
                    "file_type": "financial",
                    "text": content
                }