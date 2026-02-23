"""Build graph-data.json from /books. Walks markdown notes, merges enrichment, outputs graph."""
import json
import re
import yaml
import frontmatter
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BOOKS_DIR = PROJECT_ROOT / "books"
OUTPUT_FILE = PROJECT_ROOT / "site" / "public" / "graph-data.json"


def _chapter_sort_key(md_file: Path) -> tuple:
    """Sort key: numeric chapter number from filename (ch1, ch2, ch10, ...)."""
    m = re.match(r"ch(\d+)", md_file.name, re.I)
    return (int(m.group(1)),) if m else (9999,)


def _build_concept_graph(concept_index: dict) -> dict:
    nodes, edges = [], []
    for concept, chapter_ids in concept_index.items():
        if len(chapter_ids) > 1:
            nodes.append({
                "id": concept,
                "label": concept.replace("-", " ").title(),
                "chapters": chapter_ids,
                "weight": len(chapter_ids),
            })
            for i in range(len(chapter_ids)):
                for j in range(i + 1, len(chapter_ids)):
                    edges.append({
                        "source": chapter_ids[i],
                        "target": chapter_ids[j],
                        "concept": concept,
                    })
    return {"nodes": nodes, "edges": edges}


async def build_graph() -> dict:
    books = []
    concept_index: dict[str, list[str]] = {}

    for book_dir in sorted(BOOKS_DIR.iterdir()):
        if not book_dir.is_dir() or book_dir.name.startswith("_"):
            continue
        meta_file = book_dir / "meta.yaml"
        if not meta_file.exists():
            continue

        with open(meta_file) as f:
            meta = yaml.safe_load(f) or {}

        book_id = book_dir.name
        chapters = []

        md_files = sorted(book_dir.glob("ch*.md"), key=_chapter_sort_key)
        for md_file in md_files:
            post = frontmatter.load(md_file)
            enriched = {}
            enriched_file = md_file.parent / f"{md_file.stem}_enriched.json"
            if enriched_file.exists():
                with open(enriched_file) as f:
                    enriched = json.load(f)

            chapter_num = post.metadata.get("chapter", 0)
            chapter_id = f"{book_id}-ch{chapter_num}"
            concepts = enriched.get("concepts", post.metadata.get("keyThemes", []))

            for concept in concepts:
                concept_index.setdefault(concept, []).append(chapter_id)

            chapters.append({
                "id": chapter_id,
                "bookId": book_id,
                "chapter": chapter_num,
                "title": post.metadata.get("title", md_file.stem),
                "dateNoted": str(post.metadata.get("dateNoted", "")),
                "keyThemes": post.metadata.get("keyThemes", []),
                "rating": post.metadata.get("rating"),
                "isEnriched": bool(enriched),
                "summary": enriched.get("summary"),
                "keyInsights": enriched.get("keyInsights", []),
                "quotableIdeas": enriched.get("quotableIdeas", []),
                "concepts": concepts,
                "actionableItems": enriched.get("actionableItems", []),
                "connectedIdeas": enriched.get("connectedIdeas", []),
                "emotionalResonance": enriched.get("emotionalResonance"),
                "rawNotes": post.content,
            })

        books.append({
            "id": book_id,
            "title": meta.get("title", book_id),
            "author": meta.get("author", "Unknown"),
            "cover": meta.get("cover"),
            "color": meta.get("color", "#8B949E"),
            "rating": meta.get("rating"),
            "status": meta.get("status", "reading"),
            "tags": meta.get("tags", []),
            "dateFinished": str(meta.get("dateFinished", "")),
            "totalChapters": meta.get("totalChapters", len(chapters)),
            "chapters": chapters,
        })

    graph_data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "totalBooks": len(books),
            "totalChapters": sum(len(b["chapters"]) for b in books),
            "totalConcepts": len(concept_index),
            "enrichedChapters": sum(
                1 for b in books for c in b["chapters"] if c["isEnriched"]
            ),
        },
        "books": books,
        "conceptGraph": _build_concept_graph(concept_index),
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(graph_data, f, indent=2)

    return graph_data
