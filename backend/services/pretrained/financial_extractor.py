"""
Financial extractor - Extract bank account entities and transactions.
Uses common.csv_parser for shared parsing logic.
"""
from typing import List, Dict, Any
from services.common import schemas
from services.common.csv_parser import CSVParser
from services.common.base_extractor import BaseExtractor


class FinancialExtractor(BaseExtractor):
    """Extract bank accounts and transactions from financial data"""

    def __init__(self):
        self._parser = CSVParser()

    def extract_entities(self, text: str, doc=None) -> Dict[str, List[str]]:
        """Extract bank account entities from financial text/data"""
        entities = {"bank_accounts": []}
        entities["bank_accounts"] = self._parser.extract_accounts_from_text(text)
        return entities

    def extract_transactions(self, financial_data: str) -> List[schemas.Transaction]:
        """Extract transactions from financial data"""
        if not self._parser.is_tabular(financial_data)[0]:
            return []
        rows = self._parser.map_to_financial(self._parser.parse_rows(financial_data))
        return self._rows_to_transactions(rows)

    def extract_transactions_from_tabular(self, tabular_data: List[Dict]) -> List[schemas.Transaction]:
        """Extract transactions from tabular data (used by pipeline)"""
        return self._rows_to_transactions(tabular_data)

    def extract_relationships(self, text: str, doc=None, resolved_entities: Dict = None) -> List[schemas.Relationship]:
        """Extract relationships from financial data"""
        accounts = self.extract_entities(text)
        accounts_list = accounts.get("bank_accounts", [])
        relationships = []
        if len(accounts_list) >= 2 and any(word in text.lower() for word in ["transfer", "sent"]):
            relationships.append(schemas.Relationship(
                source=accounts_list[0],
                target=accounts_list[1],
                relationship_type="TRANSFERRED_TO",
                confidence=0.75
            ))
        return relationships

    def extract_cdr_calls(self, cdr_data: str) -> List[schemas.CDRCall]:
        """Financial extractor doesn't handle CDR calls"""
        return []

    def _rows_to_transactions(self, rows: List[Dict[str, Any]]) -> List[schemas.Transaction]:
        """Convert row dicts to Transaction objects"""
        transactions = []
        for row in rows:
            try:
                amount = row.get("amount", 0)
                if not amount:
                    continue
                amount_val = float(amount) if isinstance(amount, (int, float, str)) else 0
                transactions.append(schemas.Transaction(
                    amount=amount_val,
                    from_account=row.get("from_account"),
                    to_account=row.get("to_account"),
                    currency=row.get("currency", "USD"),
                    timestamp=row.get("date"),
                    transaction_type="transfer"
                ))
            except (ValueError, TypeError):
                continue
        return transactions