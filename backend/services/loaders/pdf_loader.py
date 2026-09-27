"""
PDF file loader for pretrained extraction.
Uses pdfplumber for text extraction from PDFs.
"""
import io
from typing import Dict, Any
class PDFFileLoader:
    """Load and extract text from PDF files"""

    def __init__(self, pdfplumber_available: bool = True):
        self.pdfplumber_available = pdfplumber_available
        self.pdfplumber = None
        if pdfplumber_available:
            try:
                import pdfplumber
                self.pdfplumber = pdfplumber
            except ImportError:
                self.pdfplumber_available = False

    def load(self, file_path: str) -> Dict[str, Any]:
        """Load PDF file and extract text

        Args:
            file_path: Path to PDF file

        Returns:
            Dict with keys:
            - "text": Extracted text content
            - "metadata": File metadata
            - "file_type": "pdf"
        """
        if not self.pdfplumber_available:
            raise ImportError(
                "pdfplumber is required for PDF loading. "
                "Install with: pip install pdfplumber"
            )

        with self.pdfplumber.open(file_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""

        return {
            "text": text,
            "metadata": {
                "file_type": "pdf",
                "page_count": len(pdf.pages),
                "source": file_path
            },
            "file_type": "pdf"
        }

    def load_from_bytes(self, file_bytes: bytes) -> Dict[str, Any]:
        """Load PDF from bytes (memory)"""

        if not self.pdfplumber_available:
            raise ImportError(
                "pdfplumber is required for PDF loading. "
                "Install with: pip install pdfplumber"
            )

        from pdfplumber import PDF
        pdf = PDF(io.BytesIO(file_bytes))

        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""

        return {
            "text": text,
            "metadata": {
                "file_type": "pdf",
                "page_count": len(pdf.pages),
                "source": "bytes"
            },
            "file_type": "pdf"
        }