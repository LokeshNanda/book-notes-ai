"""Graph API routes."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.services.build_graph import build_graph

router = APIRouter()


@router.get("/graph")
async def get_graph():
    data = await build_graph()
    return JSONResponse(content=data)


@router.post("/rebuild")
async def rebuild_graph():
    data = await build_graph()
    return {"message": "Graph rebuilt", "stats": data["stats"]}
