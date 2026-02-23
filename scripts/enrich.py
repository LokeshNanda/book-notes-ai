#!/usr/bin/env python3
"""
Enrich new chapter notes with OpenAI.
Usage:
  python scripts/enrich.py           # enrich un-enriched chapters only
  python scripts/enrich.py --force   # re-enrich everything
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()
from app.services.enrich import enrich_new_chapters


async def main():
    force = "--force" in sys.argv
    print(f"🤖 Starting enrichment (force={force})...")
    results = await enrich_new_chapters(force=force)
    print(
        f"\n✅ Done! Enriched: {results['enriched']} | Skipped: {results['skipped']} | "
        f"Failed: {results['failed']}"
    )
    print(f"   Estimated cost: ${results['cost_estimate']:.4f}")


if __name__ == "__main__":
    asyncio.run(main())
