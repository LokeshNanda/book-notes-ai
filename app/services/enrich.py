"""OpenAI enrichment for chapter notes. Writes _enriched.json sibling files."""
import json
import os
import re
from pathlib import Path
import frontmatter
import yaml
from openai import AsyncOpenAI
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BOOKS_DIR = PROJECT_ROOT / "books"


def _chapter_sort_key(md_file: Path) -> tuple:
    """Sort key: numeric chapter number from filename (ch1, ch2, ch10, ...)."""
    m = re.match(r"ch(\d+)", md_file.name, re.I)
    return (int(m.group(1)),) if m else (9999,)


SYSTEM_PROMPT = """You are a knowledge curator helping build a personal reading knowledge base.
Extract structured insights from raw book chapter notes.
Notes may be rough or personal — interpret them charitably.
Return ONLY valid JSON. No markdown, no code blocks, no explanation."""


async def _call_openai(client, title, author, chapter_num, chapter_title, content) -> dict:
    user_prompt = f"""Book: "{title}" by {author}
Chapter {chapter_num}: "{chapter_title}"

Raw notes:
---
{content[:4000]}
---

Extract as JSON:
{{
  "summary": "2-3 sentence synthesis of key ideas",
  "keyInsights": ["3-5 important ideas stated clearly"],
  "quotableIdeas": ["memorable framings worth remembering"],
  "concepts": ["reusable concept tags that connect across books"],
  "actionableItems": ["concrete things a reader could try"],
  "connectedIdeas": ["topics this relates to in other books or fields"],
  "emotionalResonance": "one sentence on why this chapter matters"
}}"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)
    result["enrichedAt"] = datetime.now(timezone.utc).isoformat()
    result["model"] = "gpt-4o-mini"
    return result


async def enrich_new_chapters(force: bool = False) -> dict:
    results = {"enriched": 0, "skipped": 0, "failed": 0, "cost_estimate": 0.0}

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("⚠️  OPENAI_API_KEY not set — skipping enrichment")
        return results

    client = AsyncOpenAI(api_key=api_key)

    for book_dir in sorted(BOOKS_DIR.iterdir()):
        if not book_dir.is_dir() or book_dir.name.startswith("_"):
            continue
        meta_file = book_dir / "meta.yaml"
        if not meta_file.exists():
            continue

        with open(meta_file) as f:
            meta = yaml.safe_load(f) or {}

        md_files = list(book_dir.glob("ch*.md"))
        md_files.sort(key=_chapter_sort_key)

        for md_file in md_files:
            enriched_file = md_file.parent / f"{md_file.stem}_enriched.json"
            if enriched_file.exists() and not force:
                results["skipped"] += 1
                continue

            try:
                post = frontmatter.load(md_file)
                content = post.content.strip()
                if not content:
                    content = f"[No notes yet. Chapter: {post.metadata.get('title', md_file.stem)}]"

                enriched = await _call_openai(
                    client=client,
                    title=meta.get("title", book_dir.name),
                    author=meta.get("author", "Unknown"),
                    chapter_num=post.metadata.get("chapter", "?"),
                    chapter_title=post.metadata.get("title", md_file.stem),
                    content=content,
                )

                with open(enriched_file, "w") as f:
                    json.dump(enriched, f, indent=2)

                results["enriched"] += 1
                results["cost_estimate"] += 0.002
                print(f"  ✅ Enriched: {book_dir.name}/{md_file.name}")

            except Exception as e:
                print(f"  ⚠️  Failed {md_file.name}: {e}")
                results["failed"] += 1

    return results
