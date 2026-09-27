"""
TXT file loader for pretrained extraction.
Simple text file loader.
"""
from typing import Dict, Any
class TXTFileLoader:
    """Load and extract text from TXT files"""

    def load(self, file_path: str) -> Dict[str, Any]:
        """Load TXT file and extract text

        Args:
            file_path: Path to TXT file

        Returns:
            Dict with keys:
            - "text": Extracted text content
            - "metadata": File metadata
            - "file_type": "txt"
        """
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()

        return {
            "text": text,
            "metadata": {
                "file_type": "txt",
                "line_count": len(text.splitlines()),
                "source": file_path
            },
            "file_type": "txt"
        }

    def load_from_bytes(self, file_bytes: bytes) -> Dict[str, Any]:
        """Load TXT from bytes (memory)"""

        text = file_bytes.decode("utf-8")

        return {
            "text": text,
            "metadata": {
                "file_type": "txt",
                "line_count": len(text.splitlines()),
                "source": "bytes"
            },
            "file_type": "txt"
        }