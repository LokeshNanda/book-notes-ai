"""Enrichment API routes."""
from fastapi import APIRouter, Query
from app.services.enrich import enrich_new_chapters
from app.services.build_graph import build_graph

router = APIRouter()


@router.post("/enrich")
async def trigger_enrichment(force: bool = Query(default=False)):
    results = await enrich_new_chapters(force=force)
    await build_graph()
    return {"message": "Enrichment complete", "results": results}
