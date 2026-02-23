#!/usr/bin/env python3
"""Rebuild graph-data.json from /books. Usage: python scripts/build_graph.py"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.build_graph import build_graph


async def main():
    print("🔨 Building graph...")
    data = await build_graph()
    stats = data["stats"]
    print(
        f"✅ Done! Books: {stats['totalBooks']} | Chapters: {stats['totalChapters']} | "
        f"Concepts: {stats['totalConcepts']} | Enriched: {stats['enrichedChapters']}"
    )


if __name__ == "__main__":
    asyncio.run(main())
