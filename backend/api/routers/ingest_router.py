from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import tempfile
from pathlib import Path
from ..auth import get_user_from_token

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/upload")
async def upload_report(file: UploadFile = File(...), _user=Depends(get_user_from_token)):
    """Accept a report file (CSV/JSON/PDF), ingest it, run the extraction
    pipeline, and write results to Neo4j.

    Returns a summary of what was extracted.
    """
    if not file.filename:
        raise HTTPException(400, "No filename")

    try:
        # Save uploaded file to a temp directory
        from pipeline.ingestion.loader import load_file
        from pipeline.preprocessing.cleaner import split_sentences
        from pipeline.extraction.extractor import extract_entities
        from pipeline.resolution.resolver import resolve_entities
        from pipeline.relationships.builder import build_relationships
        from pipeline.graph.writer import get_driver, write_entities, write_relationships
        from pipeline.analytics.analyzer import compute_analytics

        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name

        # Ingest the single file
        records = load_file(tmp_path)

        # Extract + resolve + build relationships (same as run_pipeline)
        all_sentences = []
        all_entities = []
        for rec in records:
            doc_id = rec.get("source_doc_id")
            text = str(rec.get("raw_content") or "")
            sentences = split_sentences(text)
            for s in sentences:
                all_sentences.append((s, doc_id))
            all_entities.extend(extract_entities(rec))

        resolved = resolve_entities(all_entities)

        relationships = []
        for sentence, doc_id in all_sentences:
            relationships.extend(build_relationships([sentence], resolved, doc_id))
        deduped = {}
        for rel in relationships:
            key = (rel["source"], rel["target"], rel["type"])
            if key not in deduped:
                deduped[key] = dict(rel)
            elif rel["confidence"] > deduped[key]["confidence"]:
                deduped[key]["confidence"] = rel["confidence"]
        final_rels = list(deduped.values())

        # Stage 8: route low-confidence items to the review queue; only
        # verified entities/relationships enter the main graph.
        from pipeline.review.queue import split

        routed = split(resolved, final_rels)
        graph_entities = routed["graph_entities"]
        graph_rels = routed["graph_relationships"]
        review_items = routed["review_items"]

        # Write verified items to the graph. In seed mode (no Neo4j) this is
        # reflected in the in-memory graph instead, so the demo still works.
        written_to = "neo4j"
        try:
            driver = get_driver()
            write_entities(graph_entities, driver)
            write_relationships(graph_rels, driver)
            compute_analytics(driver)
        except Exception:
            from api.graph_service import merge_ingested
            merge_ingested(graph_entities, graph_rels)
            written_to = "in-memory"

        Path(tmp_path).unlink()  # cleanup

        return {
            "success": True,
            "entities": len(graph_entities),
            "relationships": len(graph_rels),
            "review_queue": len(review_items),
            "written_to": written_to,
            "message": (
                f"Extracted {len(graph_entities)} entities and "
                f"{len(graph_rels)} relationships; "
                f"{len(review_items)} low-confidence item(s) routed to review"
            ),
        }

    except Exception as e:
        raise HTTPException(500, f"Ingestion failed: {str(e)}")