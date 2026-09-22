"""
Pretrained NLP-based extraction and relationship building module.

This module handles all entity extraction and relationship mapping using
pretrained models (spaCy) and regex patterns.
"""

from .pipeline import PretrainedPipeline

__all__ = ["PretrainedPipeline"]
