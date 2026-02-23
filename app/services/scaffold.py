"""Scaffold a new book from a search query. Uses Open Library API + OpenAI."""
import json
import os
import re
from pathlib import Path

import httpx
import yaml
from openai import AsyncOpenAI

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BOOKS_DIR = PROJECT_ROOT / "books"

OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json"
COVER_BASE = "https://covers.openlibrary.org/b/id"

CHAPTER_PROMPT = """Given the book "{title}" by {author}, list all chapters with their numbers and titles.
Return ONLY valid JSON: {{"chapters": [{{"chapter": 1, "title": "Chapter Title"}}, ...]}}.
If you cannot determine chapter count, provide a reasonable estimate (e.g. 10-20 for typical non-fiction).
No markdown, no code blocks, no explanation."""

OUTLINE_PROMPT = """For each chapter of "{title}" by {author}, provide a 1-2 sentence prompt to help the reader start taking notes.
Return JSON: {{"outlines": {{"1": "prompt...", "2": "prompt...", ...}}}}.
Match keys to chapter numbers. No markdown, no code blocks."""

FALLBACK_PROMPT = """The user searched for: "{query}".
Infer the most likely book title and author. Return JSON: {{"title": "...", "author": "..."}}.
No markdown, no code blocks."""


def _slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _kebab(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


async def _search_open_library(query: str, author: str | None = None) -> dict | None:
    """Search Open Library; return top result or None."""
    q = query if not author else f"{query} {author}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            OPEN_LIBRARY_SEARCH,
            params={"q": q, "limit": 1},
            headers={"User-Agent": "ReadBrain/1.0 (https://github.com/readbrain)"},
        )
        r.raise_for_status()
        data = r.json()
    docs = data.get("docs", [])
    if not docs:
        return None
    d = docs[0]
    return {
        "title": d.get("title", query),
        "author": (d.get("author_name") or ["Unknown"])[0],
        "cover_i": d.get("cover_i"),
        "first_publish_year": d.get("first_publish_year"),
    }


async def _get_chapters_openai(client: AsyncOpenAI, title: str, author: str) -> list[dict]:
    """Get chapter list from OpenAI."""
    prompt = CHAPTER_PROMPT.format(title=title, author=author)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON. No markdown, no code blocks."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = response.choices[0].message.content
    data = json.loads(content)
    chapters = data.get("chapters", [])
    if not chapters:
        return [{"chapter": i, "title": f"Chapter {i}"} for i in range(1, 11)]
    return chapters


async def _get_outlines_openai(
    client: AsyncOpenAI, title: str, author: str, chapters: list[dict]
) -> dict[str, str]:
    """Get optional outline prompts per chapter."""
    try:
        prompt = OUTLINE_PROMPT.format(title=title, author=author)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return ONLY valid JSON. No markdown, no code blocks."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        return data.get("outlines", {})
    except Exception:
        return {}


async def _fallback_title_author_openai(client: AsyncOpenAI, query: str) -> tuple[str, str]:
    """When Open Library fails, infer title/author from query."""
    prompt = FALLBACK_PROMPT.format(query=query)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON. No markdown, no code blocks."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    data = json.loads(response.choices[0].message.content)
    return data.get("title", query), data.get("author", "Unknown")


async def scaffold_book(
    query: str,
    author: str | None = None,
    include_outlines: bool = True,
) -> dict:
    """
    Scaffold a new book from a search query.
    Returns {book_id, title, author, chapters_created}.
    Raises FileExistsError if book folder exists, ValueError if no match.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set — required for scaffold")

    # 1. Search Open Library
    meta = await _search_open_library(query, author)
    if meta:
        title = meta["title"]
        author_name = meta["author"]
        cover = f"{COVER_BASE}/{meta['cover_i']}-M.jpg" if meta.get("cover_i") else ""
    else:
        # 2. Fallback: OpenAI infers title/author
        client = AsyncOpenAI(api_key=api_key)
        title, author_name = await _fallback_title_author_openai(client, query)
        cover = ""

    # 3. Get chapter structure from OpenAI
    client = AsyncOpenAI(api_key=api_key)
    chapters = await _get_chapters_openai(client, title, author_name)
    outlines: dict[str, str] = {}
    if include_outlines and chapters:
        outlines = await _get_outlines_openai(client, title, author_name, chapters)

    # 4. Slugify and check book exists
    book_id = _slugify(title)
    book_dir = BOOKS_DIR / book_id
    if book_dir.exists():
        raise FileExistsError(f"Book {book_id} already exists")

    # 5. Create book dir and meta.yaml
    book_dir.mkdir(parents=True, exist_ok=True)
    meta_yaml = {
        "title": title,
        "author": author_name,
        "cover": cover,
        "color": "#8B949E",
        "status": "reading",
        "tags": [],
        "totalChapters": len(chapters),
    }
    with open(book_dir / "meta.yaml", "w") as f:
        yaml.dump(meta_yaml, f, default_flow_style=False, allow_unicode=True)

    # 6. Create chapter files
    for ch in chapters:
        num = ch.get("chapter", 0)
        ch_title = ch.get("title", f"Chapter {num}")
        slug = _kebab(ch_title)
        if not slug:
            slug = f"chapter-{num}"
        filename = f"ch{num}-{slug}.md"
        outline = outlines.get(str(num), "")
        body = f"\n{outline}\n" if outline else ""
        frontmatter = {
            "chapter": num,
            "title": ch_title,
        }
        content = "---\n"
        content += yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
        content += "---\n"
        content += body
        (book_dir / filename).write_text(content, encoding="utf-8")

    # 7. Rebuild graph
    from app.services.build_graph import build_graph

    await build_graph()

    return {
        "book_id": book_id,
        "title": title,
        "author": author_name,
        "chapters_created": len(chapters),
    }
