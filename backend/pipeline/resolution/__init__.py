"""Entity resolution stage: dedupe near-duplicate entities into canonical forms."""

from .resolver import resolve_entities

__all__ = ["resolve_entities"]