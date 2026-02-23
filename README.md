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

### Local (CLI)

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env   # add OPENAI_API_KEY

readbrain enrich       # optional: enrich notes with AI
readbrain build        # build graph data
readbrain serve        # start server → http://localhost:8000
```

Or with plain pip:

```bash
pip install -r requirements.txt
cp .env.example .env

python -m app.cli enrich
python -m app.cli build
uvicorn app.main:app --reload --port 8000
```

### First-time setup

```bash
bash scripts/bootstrap.sh
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `readbrain enrich` | Enrich un-enriched chapters with AI |
| `readbrain enrich --force` | Re-enrich all chapters |
| `readbrain build` | Build graph-data.json from books |
| `readbrain serve` | Start web server (default port 8000) |
| `readbrain serve -p 3000` | Start server on custom port |
| `readbrain scaffold "Atomic Habits"` | Create a new book from search |
| `readbrain scaffold "Deep Work" "Cal Newport"` | Scaffold with author hint |

## Adding Notes

**Jumpstart with scaffold**:

```bash
readbrain scaffold "Atomic Habits"
# or: python -m app.cli scaffold "Atomic Habits"
```

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

4. Run `readbrain enrich` to add AI insights (requires OPENAI_API_KEY)
5. Run `readbrain build` to rebuild the graph

The example book in `books/example/` can be deleted when you add your own.

## Features

- **Interactive mindmap** — D3.js force-directed graph of books, chapters, and concepts
- **AI enrichment** — Summaries, key insights, concepts, actionable items (OpenAI)
- **Concept graph** — Toggle to see how concepts connect chapters across books
- **Concept filter** — Click a concept (in mindmap or reader) to highlight related chapters
- **Search** — Fuzzy search over notes, summaries, and concepts
- **Reader panel** — Prev/Next chapter navigation, chapter list in sidebar
- **Keyboard shortcuts** — `j`/`k` or arrows for chapter nav, `/` to search, `Esc` to close
- **Mobile responsive** — Collapsible sidebar, tap-to-open panels
- **Reduced motion** — Respects `prefers-reduced-motion` for accessibility

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
4. Push — the GitHub Action enriches and deploys to GitHub Pages.
