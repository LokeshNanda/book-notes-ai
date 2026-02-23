# ReadBrain

An AI-powered personal reading knowledge base. Write book notes in Obsidian (plain markdown), push to GitHub, and the app transforms them into an interactive mindmap enriched by OpenAI.

## Stack

- **Backend**: Python 3.12 + FastAPI + uvicorn
- **Frontend**: Vanilla JS + D3.js v7 + marked.js + Fuse.js (no build step, no Node.js)
- **AI**: OpenAI gpt-4o-mini for enrichment
- **Deployment**: Single Docker container or GitHub Pages (static)

## Quick Start

### Docker

```bash
cp .env.example .env   # add OPENAI_API_KEY
docker-compose up
# → http://localhost:8000
```

### Local

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY
python scripts/enrich.py      # optional: enrich notes with AI
python scripts/build_graph.py
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

### First-time setup

```bash
bash scripts/bootstrap.sh
```

## Adding Notes

**Jumpstart with scaffold** (CLI): Run `python scripts/scaffold.py "Atomic Habits"` to create a book folder with `meta.yaml` and chapter files. Edit the markdown as needed.

Or manually:

1. Create a book folder in `books/` (e.g. `books/atomic-habits/`)
2. Add `meta.yaml` with `title`, `author`, and optional `color`, `tags`, etc.
3. Add chapter markdown files: `ch1-title.md`, `ch2-title.md` with YAML frontmatter:

```yaml
---
chapter: 1
title: "Chapter Title"
dateNoted: "2024-01-15"
keyThemes: [theme1, theme2]
---
```

4. Run `python scripts/enrich.py` to add AI insights (requires OPENAI_API_KEY)
5. Run `python scripts/build_graph.py` to rebuild the graph

The example book in `books/example/` can be deleted when you add your own.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/graph` | Full graph data JSON |
| POST | `/api/enrich` | Trigger AI enrichment for new chapters |
| POST | `/api/enrich?force=true` | Force re-enrich all chapters |
| POST | `/api/rebuild` | Rebuild graph without re-enriching |

## Fork & Deploy

1. Fork this repo
2. Add `OPENAI_API_KEY` to GitHub Secrets
3. Add your books to `books/`.
4. Push — the GitHub Action enriches and deploys to GitHub Page.