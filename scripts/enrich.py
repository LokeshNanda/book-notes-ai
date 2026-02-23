#!/usr/bin/env python3
"""
Enrich new chapter notes with OpenAI.
Usage:
  python scripts/enrich.py                    # enrich un-enriched chapters only
  python scripts/enrich.py --force             # re-enrich everything
  python scripts/enrich.py --chapter BOOK-ch1  # enrich only one chapter
"""
import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()
from app.services.enrich import enrich_new_chapters


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-enrich all chapters")
    parser.add_argument("--chapter", metavar="ID", help="Enrich only this chapter (e.g. atomic-habits-ch1)")
    args = parser.parse_args()
    chapter = args.chapter
    force = args.force
    if chapter:
        print(f"🤖 Starting enrichment for chapter: {chapter}...")
    else:
        print(f"🤖 Starting enrichment (force={force})...")
    results = await enrich_new_chapters(force=force, chapter_id=chapter)
    print(
        f"\n✅ Done! Enriched: {results['enriched']} | Skipped: {results['skipped']} | "
        f"Failed: {results['failed']}"
    )
    print(f"   Estimated cost: ${results['cost_estimate']:.4f}")


if __name__ == "__main__":
    asyncio.run(main())
