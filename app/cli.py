"""ReadBrain CLI — single entry point for common commands."""
import argparse
import asyncio
import os
import sys
from pathlib import Path

# Ensure project root is on path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def _load_dotenv():
    try:
        from dotenv import load_dotenv

        load_dotenv(PROJECT_ROOT / ".env")
    except ImportError:
        pass


async def cmd_enrich(force: bool, chapter: str | None) -> int:
    from app.services.enrich import enrich_new_chapters

    _load_dotenv()
    if chapter:
        print(f"🤖 Enriching chapter: {chapter}")
    else:
        print("🤖 Enriching chapters..." + (" (force re-enrich)" if force else ""))
    results = await enrich_new_chapters(force=force, chapter_id=chapter)
    print(f"✅ Enriched: {results['enriched']} | Skipped: {results['skipped']} | Failed: {results['failed']}")
    print(f"   Estimated cost: ${results['cost_estimate']:.4f}")
    return 0 if results["failed"] == 0 else 1


async def cmd_build() -> int:
    from app.services.build_graph import build_graph

    print("🔨 Building graph...")
    data = await build_graph()
    stats = data["stats"]
    print(
        f"✅ Books: {stats['totalBooks']} | Chapters: {stats['totalChapters']} | "
        f"Concepts: {stats['totalConcepts']} | Enriched: {stats['enrichedChapters']}"
    )
    return 0


def cmd_serve(port: int) -> int:
    import uvicorn

    os.chdir(PROJECT_ROOT)
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
    return 0


async def cmd_scaffold(book: str, author: str | None) -> int:
    from app.services.scaffold import scaffold_book

    _load_dotenv()
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  OPENAI_API_KEY not set — required for scaffold")
        return 1
    print(f"📚 Scaffolding: {book}" + (f" by {author}" if author else ""))
    try:
        result = await scaffold_book(query=book, author=author)
        path = PROJECT_ROOT / "books" / result["book_id"]
        print(f"✅ Created: {path}")
        print(f"   Title: {result['title']} by {result['author']}")
        print(f"   Chapters: {result['chapters_created']}")
        return 0
    except FileExistsError as e:
        print(f"Error: {e}")
        return 2
    except ValueError as e:
        print(f"Error: {e}")
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="readbrain",
        description="ReadBrain — AI-powered personal reading knowledge base",
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # enrich
    p_enrich = subparsers.add_parser("enrich", help="Enrich chapter notes with AI")
    p_enrich.add_argument("--force", action="store_true", help="Re-enrich all chapters")
    p_enrich.add_argument("--chapter", metavar="ID", help="Enrich only this chapter (e.g. atomic-habits-ch1)")
    p_enrich.set_defaults(func=lambda ns: asyncio.run(cmd_enrich(ns.force, ns.chapter)))

    # build
    p_build = subparsers.add_parser("build", help="Build graph-data.json from books")
    p_build.set_defaults(func=lambda ns: asyncio.run(cmd_build()))

    # serve
    p_serve = subparsers.add_parser("serve", help="Start the web server")
    p_serve.add_argument("-p", "--port", type=int, default=8000, help="Port (default: 8000)")
    p_serve.set_defaults(func=lambda ns: cmd_serve(ns.port))

    # scaffold
    p_scaffold = subparsers.add_parser("scaffold", help="Scaffold a new book from search")
    p_scaffold.add_argument("book", help='Book title, e.g. "Atomic Habits"')
    p_scaffold.add_argument("author", nargs="?", help="Author name (optional)")
    p_scaffold.set_defaults(func=lambda ns: asyncio.run(cmd_scaffold(ns.book, ns.author)))

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 0
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
