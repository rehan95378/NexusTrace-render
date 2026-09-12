"""Stage 2 - Text Preprocessing.

Cleaning and sentence-splitting helpers that normalise raw report text into
clean sentence strings for downstream extraction.
"""
import re

# Irregular whitespace: any run of spaces/tabs/NBSP/other whitespace incl. newlines.
_WS_RE = re.compile(r"\s+")

# Sentence-ending punctuation (capturing group for re.split reassembly).
_SENT_END_RE = re.compile(r"([.!?])")

# NUL sentinel used to mask abbreviation periods so the sentence splitter
# does not treat them as boundaries.
_MASK = "\x00"

# Common abbreviations that must NOT trigger a sentence split.
_ABBREV_SET = {
    "mr", "mrs", "ms", "dr", "prof", "smt", "shri", "shrimati",
    "no", "nos", "st", "rd", "jr", "sr", "vs", "etc", "inc", "ltd",
    "co", "gen", "col", "capt", "sgt", "dept", "ave", "blvd", "hon",
    "rs", "usd", "inr", "gbp", "eur", "ca", "usa", "uk",
}

# Matches "<abbr>." followed by whitespace - this period belongs to the
# abbreviation, not a sentence boundary (more permissive: allows digits/lowercase after).
_ABBREV_PAT = re.compile(
    r"\b(?:" + "|".join(_ABBREV_SET) + r")\.(?=\s)",
    re.IGNORECASE,
)


def collapse_whitespace(text: str) -> str:
    """Collapse runs of whitespace to single spaces, strip stray non-word OCR
    junk, and trim leading/trailing space."""
    if not text:
        return text
    collapsed = _WS_RE.sub(" ", text)
    # Remove stray punctuation/artefact characters while keeping legitimate
    # intra-token punctuation and end-of-sentence markers.
    cleaned = re.sub(r"[^\w\s.&'(),:/+%!?-]", " ", collapsed)
    cleaned = _WS_RE.sub(" ", cleaned).strip()
    return cleaned


def _mask_abbreviations(text: str) -> str:
    """Replace abbreviation periods with a sentinel so they survive splitting."""
    return _ABBREV_PAT.sub(lambda m: m.group(0)[:-1] + _MASK, text)


def split_sentences(text: str) -> list[str]:
    """Split text on sentence-ending punctuation (. ! ?) while respecting common
    abbreviations (Mr., Dr., Smt., Shri., No., etc.) so they don't split
    mid-abbreviation. Strips empty strings and normalises to single spaces."""
    if not text:
        return []

    text = collapse_whitespace(text)
    masked = _mask_abbreviations(text)

    sentences: list[str] = []
    buf = ""
    for token in _SENT_END_RE.split(masked):
        if token and token in (".", "!", "?"):
            buf += token
            sentences.append(buf.strip().replace(_MASK, "."))
            buf = ""
        elif token:
            buf += (" " if buf and not buf.endswith(" ") else "") + token

    final = buf.strip().replace(_MASK, ".")
    if final:
        sentences.append(final)

    return sentences