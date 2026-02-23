#!/usr/bin/env python3
"""
Scaffold a new book from a search query.
Usage: python scripts/scaffold.py "Atomic Habits"
       python scripts/scaffold.py "Deep Work" "Cal Newport"
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()
from app.services.scaffold import scaffold_book

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS_DIR = os.path.join(PROJECT_ROOT, "books")


async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/scaffold.py \"Book Title\" [author]")
        sys.exit(1)
    query = sys.argv[1]
    author = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Scaffolding book: {query}" + (f" by {author}" if author else ""))
    try:
        result = await scaffold_book(query=query, author=author)
        path = os.path.join(BOOKS_DIR, result["book_id"])
        print(f"Created: {path}")
        print(f"  Title: {result['title']} by {result['author']}")
        print(f"  Chapters: {result['chapters_created']}")
    except FileExistsError as e:
        print(f"Error: {e}")
        sys.exit(2)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
