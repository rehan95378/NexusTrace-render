"""
Base extractor interface for both pretrained and LLM extraction approaches.

This abstract base class defines the contract that all extractors must implement,
ensuring consistent interface across different extraction methods.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from .schemas import RawExtraction, Relationship, CDRCall, Transaction
class BaseExtractor(ABC):
    """Abstract base class for extractors implementing the extractor contract"""

    @abstractmethod
    def extract_entities(self, text: str, doc=None) -> Dict[str, List[str]]:
        """
        Extract entities from text.

        Args:
            text: Text to extract entities from
            doc: Optional NLP document for more efficient processing

        Returns:
            Dict with entity types as keys and lists of extracted entities as values
        """
        pass

    @abstractmethod
    def extract_relationships(self, text: str, doc=None, resolved_entities: Dict = None) -> List[Relationship]:
        """
        Extract relationships from text using resolved entity canonical names.

        Args:
            text: Text to extract relationships from
            doc: Optional NLP document for more efficient processing
            resolved_entities: Dict containing resolved entity mappings

        Returns:
            List of Relationship objects with resolved source/target IDs
        """
        pass

    @abstractmethod
    def extract_cdr_calls(self, cdr_data: str) -> List[CDRCall]:
        """
        Extract CDR call records from tabular CDR data.

        Args:
            cdr_data: CDR text data (CSV, XLSX, or narrative)

        Returns:
            List of CDRCall objects
        """
        pass

    @abstractmethod
    def extract_transactions(self, financial_data: str) -> List[Transaction]:
        """
        Extract transaction data from financial records.

        Args:
            financial_data: Financial data (CSV, XLSX, or narrative)

        Returns:
            List of Transaction objects
        """
        pass

    def extract_all(self, text: str, doc=None, cdr_data: str = None, financial_data: str = None) -> Dict[str, Any]:
        """
        Extract all entity types from mixed data (text, CDR, financial).

        Args:
            text: Text to extract entities from
            doc: Optional NLP document for more efficient processing
            cdr_data: Optional CDR data to extract calls from
            financial_data: Optional financial data to extract transactions from

        Returns:
            Dict with all extracted data including entities, relationships, CDR calls, and transactions
        """
        # Extract entities from text
        entities = self.extract_entities(text, doc)

        # Extract relationships
        relationships = self.extract_relationships(text, doc)

        # Extract CDR calls if CDR data provided
        cdr_calls = []
        if cdr_data:
            cdr_calls = self.extract_cdr_calls(cdr_data)

        # Extract transactions if financial data provided
        transactions = []
        if financial_data:
            transactions = self.extract_transactions(financial_data)

        return {
            "entities": entities,
            "relationships": relationships,
            "cdr_calls": cdr_calls,
            "transactions": transactions
        }