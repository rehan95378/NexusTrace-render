"""Stage 5 - Relationship Building.

Input : list of clean ``sentences`` (each one report sentence) and a list of
        resolved ``entity`` contracts ({text, type, confidence, method,
        source_doc_id}).
Output: list of ``relationship`` contracts:
        {source, target, source_type, type, weight, confidence, source_doc_id}
        ``source``/``target`` are entity ``.text`` values; ``source_type`` and
        ``type`` hold the relationship category (FINANCIAL | COMMUNICATION |
        FAMILY | ASSOCIATION); ``weight`` is an int.

Algorithm (confident tier + low-confidence review split)
---------------------------------------------------------
1. CONFIDENT tier: same-sentence proximity with a trigger phrase. Trigger
   phrases are loaded from config/trigger_phrases.json keyed by category
   (FINANCIAL / COMMUNICATION / FAMILY). For each entity pair co-occurring in
   a sentence, if a trigger phrase appears *between* the two mentions, emit a
   relationship of that category with confidence 0.85. The earlier mention is
   the directed ``source``, the later the ``target``.
2. LOW-CONFIDENCE tier (review queue): any two distinct entities co-occurring
   in the SAME sentence with NO trigger phrase between them become an
   'ASSOCIATION' relationship at confidence 0.4.
3. Dedupe by (source, target, type): weights are summed across sentences for
   the same pair/category; confidence is the highest seen.
Self-pairs (source == target) are always skipped.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

# Relationship categories and their confidence, from the shared data contract.
_CONFIDENT_CONFIDENCE = 0.85
_ASSOCIATION_CONFIDENCE = 0.4

# Categories considered "confident" when a trigger phrase fires.
_CATEGORIES = ("FINANCIAL", "COMMUNICATION", "FAMILY")

# Package-relative path to the trigger phrases. Overridable via env.
_CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"
_TRIGGER_PHRASES_PATH = os.environ.get(
    "TRIGGER_PHRASES_PATH",
    str(_CONFIG_DIR / "trigger_phrases.json"),
)

# Inline fallback mirror of config/trigger_phrases.json so the stage keeps
# working even if the config file is absent (used only on load failure).
_DEFAULT_TRIGGERS = {
    "FINANCIAL": [
        "transferred funds to", "transferred money to", "paid money to",
        "sent money to", "received money from",
    ],
    "COMMUNICATION": [
        "called", "phoned", "contacted", "messaged", "texted", "spoke with",
        "spoke to", "was called by",
    ],
    "FAMILY": [
        "is the brother of", "is the sister of", "is the son of",
        "is the father of", "is the cousin of", "is married to",
        "is the uncle of",
    ],
}


def _load_triggers() -> dict:
    """Load trigger phrases keyed by category from config/trigger_phrases.json."""
    try:
        with open(_TRIGGER_PHRASES_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):  # pragma: no cover - env dependent
        return json.loads(json.dumps(_DEFAULT_TRIGGERS))


def _mentions_in(sentence: str, resolved_entities: list[dict]):
    """Yield (entity_text, start, end) for entities literally present in the
    sentence (case-insensitive). Also checks aliases and mentions (first names).
    Returns [] when none found."""
    low = sentence.lower()
    mentions: list[tuple[str, int, int]] = []
    for ent in resolved_entities or ():
        canon = str((ent or {}).get("text") or "").strip()
        if not canon:
            continue
        # check canonical text
        idx = low.find(canon.lower())
        if idx != -1:
            mentions.append((canon, idx, idx + len(canon)))
            continue
        # check aliases
        for alias in (ent.get("aliases") or []):
            idx = low.find(alias.lower())
            if idx != -1:
                mentions.append((canon, idx, idx + len(canon)))  # return CANONICAL text
                break
        else:
            # check mentions (first-name forms like "ramesh" for "Ramesh Kumar")
            for mention in (ent.get("mentions") or []):
                idx = low.find(mention.lower())
                if idx != -1:
                    mentions.append((canon, idx, idx + len(canon)))  # return CANONICAL text
                    break
    return mentions


def build_relationships(
    sentences: list[str],
    resolved_entities: list[dict],
    source_doc_id: str,
) -> list[dict]:
    """Build confident + low-confidence relationships between entities.

    Returns a list of relationship contracts sorted by (source, target,
    source_type). See module docstring for the algorithm.
    """
    if not sentences or not resolved_entities:
        return []

    triggers = _load_triggers()

    # (source, target, category) -> {"weight": int, "conf": float}
    agg: dict[tuple[str, str, str], dict] = {}

    for sentence in sentences:
        if not sentence or not isinstance(sentence, str):
            continue
        mentions = _mentions_in(sentence, resolved_entities)
        if len(mentions) < 2:
            continue

        lower = sentence.lower()
        for i in range(len(mentions)):
            for j in range(i + 1, len(mentions)):
                a, b = mentions[i], mentions[j]
                # skip self-pairs
                if a[0] == b[0]:
                    continue
                # order mentions left->right; earlier mention is the source
                left, right = (a, b) if a[1] <= b[1] else (b, a)
                between = lower[left[2]:right[1]]

                # ---- CONFIDENT tier: trigger phrase between the mentions ----
                fired = None  # (category, matched_phrase)
                for cat in _CATEGORIES:
                    for phrase in triggers.get(cat, []) or ():
                        if phrase and phrase in between:
                            fired = (cat, phrase)
                            break
                    if fired is not None:
                        break

                if fired is not None:
                    # Precision guard: the trigger must lead directly into the
                    # target, with NO other entity mention intervening between
                    # the trigger and the target. Otherwise a trigger could
                    # span an intermediate entity and over-claim a link (e.g.
                    # "Vikram transferred to Rajesh Pillai through State CID"
                    # must NOT link Vikram->State CID).
                    cat, phrase = fired
                    trig_end = left[2] + between.find(phrase) + len(phrase)
                    intervenes = [
                        m for m in mentions
                        if m[1] >= trig_end and m[1] < right[1] and m[0] != right[0]
                    ]
                    if intervenes:
                        # Trigger passes through another entity -> don't over-claim.
                        # Fall through to the low-confidence tier instead.
                        cat, conf = "ASSOCIATION", _ASSOCIATION_CONFIDENCE
                        fired = None
                    else:
                        conf = _CONFIDENT_CONFIDENCE
                else:
                    # ---- LOW-CONFIDENCE tier: co-occurrence, no trigger ----
                    cat = "ASSOCIATION"
                    conf = _ASSOCIATION_CONFIDENCE

                key = (left[0], right[0], cat)
                bucket = agg.get(key)
                if bucket is None:
                    agg[key] = {"weight": 0, "conf": conf}
                else:
                    agg[key]["conf"] = max(bucket["conf"], conf)

                # occurrence across sentences => weight accumulates
                agg[key]["weight"] += 1

    out: list[dict] = []
    for (source, target, cat), info in agg.items():
        # skip any residual self-pair
        if source == target:
            continue
        out.append(
            {
                "source": source,
                "target": target,
                "source_type": cat,
                "type": cat,
                "weight": int(info["weight"]),
                "confidence": round(float(info["conf"]), 4),
                "source_doc_id": source_doc_id,
            }
        )

    out.sort(key=lambda r: (r["source"], r["target"], r["source_type"]))
    return out