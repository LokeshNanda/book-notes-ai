"""ReadBrain FastAPI application."""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routes import graph, enrich as enrich_routes
from app.services.build_graph import build_graph

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: build graph from whatever is on disk
    await build_graph()
    yield


app = FastAPI(title="ReadBrain API", lifespan=lifespan)

app.include_router(graph.router, prefix="/api")
app.include_router(enrich_routes.router, prefix="/api")

# Serve static assets (CSS, JS)
site_src = PROJECT_ROOT / "site" / "src"
if site_src.exists():
    app.mount("/static", StaticFiles(directory=str(site_src)), name="static")

# Serve public assets (graph-data.json etc)
site_public = PROJECT_ROOT / "site" / "public"
site_public.mkdir(parents=True, exist_ok=True)
app.mount("/public", StaticFiles(directory=str(site_public)), name="public")

# SPA catch-all — must be last
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse(str(PROJECT_ROOT / "site" / "index.html"))
