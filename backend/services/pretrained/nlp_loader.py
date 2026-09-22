"""
spaCy NLP model loader - lazy loading with auto-download.
"""
import spacy
import os

_nlp = None


def get_nlp():
    """
    Lazy-load the spaCy model once per process.
    Auto-downloads if not present.
    """
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Auto-download if missing
            os.system("python -m spacy download en_core_web_sm --break-system-packages")
            _nlp = spacy.load("en_core_web_sm")
    return _nlp


def process_text(text: str):
    """Process text and return spaCy Doc object."""
    nlp = get_nlp()
    return nlp(text)
