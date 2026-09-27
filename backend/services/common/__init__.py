# Common services for both pretrained and LLM extraction
# This package contains shared core logic that both extraction approaches use

from .base_extractor import BaseExtractor
from .schemas import RawExtraction, ResolvedEntities, Relationship, CDRCall, Transaction
from .entity_resolver import EntityResolver

from .utils import normalize_phone_number, normalize_vehicle_plate

__all__ = [
    "BaseExtractor",
    "RawExtraction",
    "ResolvedEntities",
    "Relationship",
    "CDRCall",
    "Transaction",
    "EntityResolver",
    "ExtractionConfig",
    "PhonePatterns",
    "VehiclePatterns",
    "RelationshipsConfig",
    "normalize_phone_number",
    "normalize_vehicle_plate"
]