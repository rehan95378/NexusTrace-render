"""
Pydantic schemas for NexusTrace pipeline data contracts.

These define the data structures used throughout the three-phase extraction pipeline,
ensuring type safety and data consistency across both pretrained and LLM extraction approaches.
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, field_validator
from datetime import datetime
class RawExtraction(BaseModel):
    """Phase 1 output: Raw entity extraction before resolution"""
    entities: Dict[str, List[str]]
    cdr_calls: List["CDRCall"] = []
    transactions: List["Transaction"] = []
    source_metadata: Dict[str, Any] = {"type": "unknown"}

    @field_validator("cdr_calls", "transactions", mode="before")
    def convert_dicts_to_objects(cls, v, info):
        """Convert dicts to appropriate objects for Pydantic V2"""
        if info.field_name == "cdr_calls":
            from .schemas import CDRCall
            if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                return [CDRCall(**item) for item in v]
        elif info.field_name == "transactions":
            from .schemas import Transaction
            if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                return [Transaction(**item) for item in v]
        return v
class ResolvedEntities(BaseModel):
    """Phase 2 output: Resolved canonical entities with mappings"""
    people: List[str]
    locations: List[str]
    organizations: List[str]
    vehicles: List[str]
    phones: List[str]
    bank_accounts: List[str] = []

    @property
    def all_entities(self) -> Dict[str, List[str]]:
        """Get all resolved entities as a single dict"""
        return {
            "people": self.people,
            "locations": self.locations,
            "organizations": self.organizations,
            "vehicles": self.vehicles,
            "phones": self.phones,
            "bank_accounts": self.bank_accounts
        }
class Relationship(BaseModel):
    """Relationship between entities"""
    id: Optional[str] = None
    source: str
    target: str
    relationship_type: str
    source_type: Optional[str] = "Person"
    target_type: Optional[str] = "Person"
    confidence: Optional[float] = None
    source_sentence: Optional[str] = None
    timestamp: Optional[datetime] = None
    properties: Dict[str, Any] = {}

    @field_validator("source_sentence", mode="before")
    def map_sentence_to_source_sentence(cls, v, info):
        """Map 'sentence' to 'source_sentence' for compatibility"""
        if info.field_name == "source_sentence" and v is None:
            return None
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Neo4j import"""
        return self.model_dump()
class CDRCall(BaseModel):
    """Call Detail Record"""
    id: Optional[str] = None
    caller: str
    called: str
    timestamp: Optional[datetime] = None
    duration: Optional[int] = None
    source_sentence: Optional[str] = None
    call_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Neo4j import"""
        return self.model_dump()
class Transaction(BaseModel):
    """Financial transaction"""
    id: Optional[str] = None
    amount: float
    currency: str = "USD"
    timestamp: Optional[datetime] = None
    description: Optional[str] = None
    from_account: Optional[str] = None
    to_account: Optional[str] = None
    source_sentence: Optional[str] = None
    transaction_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Neo4j import"""
        return self.model_dump()
class EntityResolution(BaseModel):
    """Entity resolution mapping"""
    raw_name: str
    canonical_name: str
    confidence: Optional[float] = None
    resolution_type: str = "fuzzy_match"  # "exact_match", "fuzzy_match", "new_entity"