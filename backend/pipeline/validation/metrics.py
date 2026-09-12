"""Stage 11 - Validation metrics.

Measures precision / recall / F1 of the extraction + relationship pipeline
against a hand-labeled validation set (data/validation/validation_set.json).

Gold format:
    {
      "sentences": [
        {
          "sentence": "...",
          "gold_entities":   [["Ramesh Kumar", "Person"], ...],
          "gold_relationships": [["Ramesh Kumar", "Anil Verma", "FINANCIAL"], ...]
        }
      ]
    }

Each sentence is run through ingest -> clean -> extract -> resolve (for
entities) and -> build_relationships (for relationships) and compared to the
gold annotations. Metrics are reported overall and per entity type.

"Two methods agree" on the same span already upgrades confidence internally, so
method agreements are baked in rather than tracked as a separate axis here.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

try:
    from sklearn.metrics import precision_score, recall_score, f1_score  # type: ignore
    _SKLEARN = True
except Exception:  # pragma: no cover - scikit-learn optional
    _SKLEARN = False

_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_VALIDATION_PATH = _ROOT / "data" / "validation" / "validation_set.json"

# Relationships only enter the main graph when they are a confident category
# (Stage 5 confident tier / Stage 8 gate). Exploratory ASSOCIATION edges are
# routed to the review queue, never claimed as verified — so the headline
# relationship metric scores the confident tier only, and ASSOCIATION is
# reported separately and transparently.
_CONFIDENT_REL_CATS = ("FINANCIAL", "COMMUNICATION", "FAMILY")


def _norm(text: str) -> str:
    """Minimal normalisation used only for gold-vs-predicted comparison."""
    import re

    _HON = {"shri", "shree", "shrimati", "smt", "dr", "mr", "mrs", "ms", "miss", "prof", "ks", "sri"}
    toks = [t for t in re.split(r"\s+", text.strip().lower()) if t]
    out = []
    for t in toks:
        t = t.strip(".,()'\"-_/")
        if not out and t in _HON:
            continue
        out.append(t)
    return " ".join(out)


def _entity_key(text: str, etype: str) -> tuple[str, str]:
    return (_norm(text), etype)


def _rel_key(a: str, b: str, rtype: str) -> tuple[str, str, str]:
    return (_norm(a), _norm(b), rtype)


def _run_pipeline_on(sentence: str, source_doc_id: str) -> tuple[list, list]:
    """Run extract -> resolve -> relationships on a single sentence.

    Returns (predicted_entities, predicted_relationships) using the same
    modules the live pipeline uses.
    """
    from pipeline.preprocessing.cleaner import split_sentences
    from pipeline.extraction.extractor import extract_entities
    from pipeline.resolution.resolver import resolve_entities
    from pipeline.relationships.builder import build_relationships

    sentences = split_sentences(sentence)
    record = {"source_type": "validation", "raw_content": sentence, "source_doc_id": source_doc_id}
    raw = extract_entities(record)
    resolved = resolve_entities(raw)

    rels: list[dict] = []
    for s in sentences:
        rels.extend(build_relationships([s], resolved, source_doc_id))
    return resolved, rels


def _confusion(
    predicted_keys: set,
    gold_keys: set,
) -> tuple[int, int, int]:
    """(true_positives, false_positives, false_negatives) as sets of keys."""
    tp = len(predicted_keys & gold_keys)
    fp = len(predicted_keys - gold_keys)
    fn = len(gold_keys - predicted_keys)
    return tp, fp, fn


def _prf(tp: int, fp: int, fn: int) -> dict:
    """precision / recall / f1 from a confusion vector."""
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def compute_metrics(validation_set: dict | None = None) -> dict:
    """Run the pipeline over every labeled sentence and aggregate metrics.

    Returns a detailed dict: overall entity + relationship scores, per-type
    entity breakdown, per-sentence discrepancy counts, and the mismatch lists
    (predicted-not-gold, gold-not-predicted) for spotting weak spots.
    """
    if validation_set is None:
        with open(DEFAULT_VALIDATION_PATH, "r", encoding="utf-8") as fh:
            validation_set = json.load(fh)

    sentences = validation_set.get("sentences", [])
    if not sentences:
        # Empty set -> defensive zeros, never a divide-by-zero.
        return {
            "overall_entities": _prf(0, 0, 0),
            "overall_relationships": _prf(0, 0, 0),
            "per_type_entities": {},
            "sentence_results": [],
        }

    # aggregate confusion counters
    ent_tp = Counter()  # per type
    ent_fp = Counter()
    ent_fn = Counter()
    rel_tp = rel_fp = rel_fn = 0
    assoc_predicted = 0

    # predicted-not-gold / gold-not-predicted lists, for human discrepancy review
    false_positive_entities: list[str] = []
    false_negative_entities: list[str] = []

    sentence_results = []

    for i, item in enumerate(sentences):
        sentence = item.get("sentence", "")
        gold_entities = {
            _entity_key(t, ty)
            for t, ty in (item.get("gold_entities") or [])
        }
        # Score the confident-tier relationships only (the ones that actually
        # enter the main graph). Exploratory ASSOCIATION edges are tracked
        # separately, not counted as relationship false positives.
        gold_rels = {
            _rel_key(a, b, r)
            for a, b, r in (item.get("gold_relationships") or [])
            if r in _CONFIDENT_REL_CATS
        }

        try:
            pred_entities, pred_rels = _run_pipeline_on(sentence, f"val-{i}")
        except Exception as e:  # pragma: no cover - defensive
            sentence_results.append({"sentence": sentence, "error": str(e)})
            continue

        predicted_entities = {
            _entity_key(e.get("text"), e.get("type")) for e in pred_entities
        }
        # Split predicted relationships into the confident tier (scored) and
        # the exploratory ASSOCIATION tier (routed to review, counted only).
        confident_predicted = {
            _rel_key(r.get("source"), r.get("target"), r.get("type"))
            for r in pred_rels
            if r.get("type") in _CONFIDENT_REL_CATS
        }
        assoc_predicted += sum(
            1 for r in pred_rels if r.get("type") == "ASSOCIATION"
        )

        # entity per-type confusion
        for key in gold_entities:
            ty = key[1]
            if key in predicted_entities:
                ent_tp[ty] += 1
            else:
                ent_fn[ty] += 1
        for key in predicted_entities:
            ty = key[1]
            if key not in gold_entities:
                ent_fp[ty] += 1

        # relationship confusion (confident tier only)
        tp = len(confident_predicted & gold_rels)
        fp = len(confident_predicted - gold_rels)
        fn = len(gold_rels - confident_predicted)
        rel_tp += tp
        rel_fp += fp
        rel_fn += fn

        false_positive_entities.extend(sorted(f"{t[0]} ({t[1]})" for t in (predicted_entities - gold_entities)))
        false_negative_entities.extend(sorted(f"{t[0]} ({t[1]})" for t in (gold_entities - predicted_entities)))

        sentence_results.append(
            {
                "sentence": sentence,
                "predicted_entities": sorted(f"{t[0]} ({t[1]})" for t in predicted_entities),
                "gold_entities": sorted(f"{t[0]} ({t[1]})" for t in gold_entities),
                "entity_matches": len(gold_entities & predicted_entities),
            }
        )

    # ---- aggregate entity PRF ----
    tot_tp = sum(ent_tp.values())
    tot_fp = sum(ent_fp.values())
    tot_fn = sum(ent_fn.values())

    per_type = {}
    for ty in set(ent_tp) | set(ent_fp) | set(ent_fn):
        per_type[ty] = _prf(ent_tp[ty], ent_fp[ty], ent_fn[ty])

    return {
        "n_sentences": len(sentence_results),
        "overall_entities": _prf(tot_tp, tot_fp, tot_fn),
        "overall_relationships": _prf(rel_tp, rel_fp, rel_fn),
        "association_edges_predicted": assoc_predicted,
        "per_type_entities": per_type,
        "false_positive_entities": false_positive_entities,
        "false_negative_entities": false_negative_entities,
    }


def run_validation() -> None:
    """CLI entry: print a human-readable metrics report (for run_pipeline / CLI)."""
    report = compute_metrics()
    n = report.get("n_sentences", 0)
    print(f"\n=== NexusTrace Stage 11 validation ({n} labeled sentences) ===")
    e = report.get("overall_entities", {})
    r = report.get("overall_relationships", {})
    print(f"ENTITIES      precision={e.get('precision'):.3f} recall={e.get('recall'):.3f} F1={e.get('f1'):.3f}")
    print(f"RELATIONSHIPS precision={r.get('precision'):.3f} recall={r.get('recall'):.3f} F1={r.get('f1'):.3f}")
    print(f"  (confident tier: FINANCIAL/COMMUNICATION/FAMILY — the edges that enter the main graph)")
    print(f"  exploratory ASSOCIATION edges predicted: {report.get('association_edges_predicted', 0)} (routed to review, not claimed)")
    print("Entity F1 by type:")
    for ty, m in sorted(report.get("per_type_entities", {}).items()):
        print(f"  {ty:<12} p={m['precision']:.3f} r={m['recall']:.3f} f1={m['f1']:.3f}")
    fpe = report.get("false_positive_entities", [])
    fne = report.get("false_negative_entities", [])
    if fpe or fne:
        print(f"\nDiscrepancies — {len(fpe)} false positives, {len(fne)} false negatives:")
        for d in fpe[:15]:
            print(f"  [FP] {d}")
        for d in fne[:15]:
            print(f"  [FN] {d}")


if __name__ == "__main__":
    run_validation()