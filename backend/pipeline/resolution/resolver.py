"""Stage 4: Entity Resolution (dedupe).

Input : list of 'entity' contracts (dicts with keys text, type, confidence,
        method, source_doc_id), possibly containing near-duplicates.
Output : list of deduped canonical entities, each with:
        {canonical_id, text, type, confidence, aliases, source_ids}

Notes
-----
* Aggregates identical/canonical text first, dedupes *across* different text
  forms via fuzzy (RapidFuzz WRatio) or normalized exact match.
* NEVER merges entities of different ``type``.
* A shared structured attribute (exact same Phone/Vehicle/Organization text)
  is stronger evidence: if two similar-name entities ALSO share one, force
  merge even when name similarity is lower (>= 60).
* The highest-confidence source text is kept as the canonical ``text``.
* An entity observed across 2+ distinct ``source_doc_id`` values gets its
  confidence bumped to ``max(conf, 0.9)``.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Optional

try:  # pytest
    from rapidfuzz import fuzz  # type: ignore

    _RAPIDFUZZ = True
except Exception:  # pragma: no cover - depends on environment
    fuzz = None
    _RAPIDFUZZ = False

# Canonical entity types (the shared data contract for stage 4).
_ENTITY_TYPES = {"Person", "Location", "Organization", "Phone", "Vehicle"}

# Leading honorifics/titles that dominate a full name. Only stripped from the
# *leading* position. Common surnames such as Patel/Kumar/Singh are deliberately
# NOT included — they are meaningful identity tokens in this domain.
_LEADING_HONORIFICS = {
    "shri", "shree", "shrimati", "smt", "dr", "mr", "mrs", "ms",
    "miss", "prof", "professor", "ks", "sri",
}

_TYPE_ALIASES = {
    "phone": "Phone",
    "tel": "Phone",
    "mobile": "Phone",
    "vehicle": "Vehicle",
    "org": "Organization",
    "organization": "Organization",
    "orgn": "Organization",
    "person": "Person",
    "per": "Person",
    "location": "Location",
    "loc": "Location",
}

_PUNCT_RE = re.compile(r"[^\w\s]")


def _normalize(text: str) -> str:
    """Canonical normalisation used when RapidFuzz is unavailable/too weak.

    Lowercases, strips leading honorifics and punctuation, collapses whitespace.
    """
    if not text:
        return ""
    lower = text.strip().lower()
    tokens = []
    for tok in re.split(r"\s+", lower):
        tok = tok.strip(".,()'\"").strip()
        core = tok.split("/")[0].split("\\")[0]
        core = core.replace("_", " ")
        core = re.sub(r"\b\d{6,}\b", "", core)  # drop long digit runs (ids)
        core = core.strip(".,;:!?()[]{}'\"").strip("-_").strip()
        if not core:
            continue
        # strip honorifics only from the leading position, never from names
        if not tokens and core in _LEADING_HONORIFICS:
            continue
        tokens.append(core)
    return " ".join(tokens)


def _normalize_type(raw: Optional[str]) -> Optional[str]:
    """Map AD-hoc/misspelt type strings back to one canonical type."""
    if not raw:
        return None
    key = raw.strip().lower()
    if key in _ENTITY_TYPES:
        return raw.strip()
    return _TYPE_ALIASES.get(key)


def _same_exact(a: str, b: str) -> bool:
    """Exact structural/attribute match used to strengthen similarity."""
    return bool(a) and a == b


def _norm_name(text: str) -> str:
    """For fuzzy path, normalise both sides identically first."""
    return _normalize(text)


def _similarity(a: str, b: str) -> float:
    """Return a similarity in [0,100] between two texts (0 = different)."""
    na, nb = _norm_name(a), _norm_name(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 100.0
    if _RAPIDFUZZ:
        # case-insensitivity is handled by normalisation before WRatio.
        return float(fuzz.WRatio(na, nb))
    # Fallback: normalized exact match plus token-level abbreviation matching.
    # Each token of the shorter name must equal or prefix a distinct token of
    # the longer name (e.g. 'ramesh k.' ~ 'ramesh kumar', 'r k' cuts to 'ramesh
    # kumar' after honour-stripping). This keeps the fallback deterministic
    # while still folding the mandated near-duplicates.
    atoks, btoks = na.split(), nb.split()
    if len(atoks) > len(btoks):
        short, long = btoks, atoks
    else:
        short, long = atoks, btoks
    if len(short) == 0:
        return 0.0
    used = [False] * len(long)
    for st in short:
        for idx, lt in enumerate(long):
            if not used[idx] and (lt == st or lt.startswith(st) or st.startswith(lt)):
                used[idx] = True
                break
    if all(used):
        # every token matched: abbreviated / subset match
        return 100.0 if len(short) == len(long) else 90.0
    # partial coverage -> proportional similarity
    covered = sum(1 for u in used if u)
    return covered / max(len(short), len(long)) * 100.0


class _Bucket:
    """Bookkeeping for one canonical entity while it accumulates sources."""

    __slots__ = ("canonical_text", "type", "confidence", "aliases", "source_ids", "attrs", "mentions")

    def __init__(self, text: str, etype: str, confidence: float, attrs: list, mentions: list = None):
        self.canonical_text = text
        self.type = etype
        self.confidence = confidence
        self.aliases = []
        self.source_ids = []
        self.attrs = _phonelist(attrs)
        self.mentions = list(set(mentions or []))  # dedupe

    def add_alias(self, text: str) -> None:
        if text != self.canonical_text and text not in self.aliases:
            self.aliases.append(text)

    def add_sources(self, source_doc_id: Optional[str]) -> None:
        if not source_doc_id:
            return
        for s in self.source_ids:
            if s == source_doc_id:
                return
        self.source_ids.append(source_doc_id)

    def add_mentions(self, mentions: list) -> None:
        for m in mentions or []:
            if m and m not in self.mentions:
                self.mentions.append(m)


def _phonelist(attrs: list) -> list:
    """Normalise structured attribute values (strip whitespace / fullwidth)."""
    out = set()
    for a in attrs or ():
        v = str(a).strip()
        if v:
            out.add(v)
    return sorted(out)


def _attrs_shared(bucket: "_Bucket", attrs: list) -> Optional[str]:
    """Return the shared structured attribute text if exactly one bucket attr
    matches one of the candidate's attrs; None if none/ambiguous."""
    cand = set(_phonelist(attrs))
    shared = [a for a in bucket.attrs if a in cand]
    if len(shared) == 1:
        return shared[0]
    return None


def resolve_entities(entities: list[dict]) -> list[dict]:
    """Dedupe a list of entity contracts into canonical entities.

    Returns a list of dicts with keys: canonical_id, text, type, confidence,
    aliases, source_ids.
    """
    if not entities:
        return []

    out: list[dict] = []

    # ---------------------------- pass 1: group on canonical type -------------
    # Merge only among like-typed entities; differencing across types is
    # forbidden by the spec, so partition by normalised type first.
    by_type: dict[str, list[dict]] = defaultdict(list)
    for ent in entities:
        t = _normalize_type(ent.get("type"))
        if t is None:
            continue  # unknown type: skip rather than risk wrong merge
        by_type[t].append(ent)

    for etype, ents in by_type.items():
        buckets: list[_Bucket] = []
        for ent in ents:
            text = str(ent.get("text") or "").strip()
            if not text:
                continue
            conf = float(ent.get("confidence") or 0.0)
            doc_id = ent.get("source_doc_id")
            attrs = _gather_structured_attrs(ent)
            # fast exact canonical match first
            matched = None
            norm_text = _norm_name(text)
            for b in buckets:
                if b.type != etype:
                    continue
                nb = _norm_name(b.canonical_text)
                if nb == norm_text:
                    matched = b
                    break
            if matched is None:
                mentions = ent.get("mentions", [])
                bucket = _Bucket(text, etype, conf, attrs, mentions)
                bucket.add_sources(doc_id)
                buckets.append(bucket)
                continue
            # same canonical text — fold into existing bucket
            matched.add_alias(text)
            matched.add_sources(doc_id)
            if conf > matched.confidence:
                matched.confidence = conf
                matched.canonical_text = text
            matched.attrs.extend(_phonelist(attrs))

        # --------------------- pass 2: cross-bucket similarity merges ----------
        # Compare every bucket against every other bucket of the SAME type.
        changed = True
        while changed:
            changed = False
            i = 0
            while i < len(buckets):
                j = i + 1
                merged_into_i = False
                while j < len(buckets):
                    a, b = buckets[i], buckets[j]
                    sim = _similarity(a.canonical_text, b.canonical_text)
                    shared_attr = _attrs_shared(a, b.attrs) or _attrs_shared(b, a.attrs)
                    force = False
                    if shared_attr:
                        # shared structured attribute is STRONGER evidence
                        if sim >= 60.0:
                            force = True
                    if sim >= 85.0 or force:
                        # merge b -> a
                        _merge_bucket(a, b)
                        buckets.pop(j)
                        merged_into_i = True
                        changed = True
                        continue
                    j += 1
                i += 1

        # ----------------------- finalise buckets ----------------------------
        for b in buckets:
            # backfill: same real-world identity across distinct docs ==> bump
            distinct_docs = len(b.source_ids)
            if distinct_docs >= 2:
                b.confidence = max(b.confidence, 0.9)
            out.append(
                {
                    "canonical_id": _canonical_id(b.type, b.canonical_text),
                    "text": b.canonical_text,
                    "type": b.type,
                    "confidence": round(min(b.confidence, 1.0), 4),
                    "aliases": list(b.aliases),
                    "source_ids": list(b.source_ids),
                    "mentions": list(b.mentions),
                }
            )

    out.sort(key=lambda r: (r["source_ids"], r["type"], r["text"]))
    return out


def _merge_bucket(target: "_Bucket", other: "_Bucket") -> None:
    """Fold ``other`` bucket's aliases/sources into ``target``'s and keep the
    highest-confidence canonical text."""
    # pick canonical text with best confidence
    if other.confidence > target.confidence:
        # keep previous canonical as alias before switching
        if target.canonical_text not in other.aliases and target.canonical_text != other.canonical_text:
            other.aliases.append(target.canonical_text)
        target.confidence = other.confidence
        target.canonical_text = other.canonical_text
        for a in target.aliases:
            other.aliases.append(a) if a != other.canonical_text else None
        target.aliases = other.aliases
    else:
        target.add_alias(other.canonical_text)
        for a in other.aliases:
            target.add_alias(a)
    for s in (other.source_ids or []):
        target.add_sources(s)
    # merge structured attrs
    combined = dict.fromkeys(target.attrs)
    for a in other.attrs:
        combined[a] = a
    target.attrs = sorted(combined.keys())
    # merge mentions
    target.add_mentions(other.mentions)
    # override confidence if backfilled already
    target.confidence = max(target.confidence, other.confidence)


def _gather_structured_attrs(ent: dict) -> list:
    """Collect shared/structured attribute values for this entity."""
    keys = ("phone", "phones", "tel", "vehicle", "vehicles", "organization",
            "organization_text", "org", "org_text", "attrib")
    attrs = []
    for k in keys:
        v = ent.get(k)
        if v is None:
            continue
        if isinstance(v, (list, tuple)):
            attrs.extend(str(x) for x in v if x)
        else:
            attrs.append(str(v))
    return attrs


def _canonical_id(etype: str, text: str) -> str:
    """Stable, deterministic canonical_id for an entity of a given type."""
    key = f"{etype.lower()}:{re.sub(r'\\s+', '', (text or '').lower())}"
    import hashlib
    return "ent_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]