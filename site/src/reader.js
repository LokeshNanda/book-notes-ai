/**
 * Notes panel / reader. Renders chapter content when selected.
 * Uses global `marked` from CDN script.
 */

export function renderChapter(chapterId, graphData, callbacks = {}) {
  const { onBookFocus, onConceptFilter } = callbacks;
  const el = document.getElementById("notesContent");
  if (!el || !graphData) return;

  const chapter = findChapter(chapterId, graphData);
  if (!chapter) {
    el.innerHTML = "<p>Chapter not found.</p>";
    return;
  }

  const book = graphData.books.find((b) => b.id === chapter.bookId);
  const bookTitle = book?.title || chapter.bookId;
  const chapters = book?.chapters || [];
  const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex >= 0 && chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  const breadcrumbLinkClass = onBookFocus ? " book-title-link" : "";
  const breadcrumbDataAttr = onBookFocus ? ` data-book-id="${escapeHtml(chapter.bookId)}"` : "";

  let html = `
    <div class="notes-breadcrumb">
      <span class="book-title${breadcrumbLinkClass}"${breadcrumbDataAttr}>${escapeHtml(bookTitle)}</span> → Chapter ${chapter.chapter}
    </div>
    <div class="chapter-nav">
      ${prevChapter ? `<button type="button" class="chapter-nav-btn" data-chapter-id="${prevChapter.id}" aria-label="Previous chapter">← Prev</button>` : `<span class="chapter-nav-placeholder"></span>`}
      <span class="chapter-nav-indicator">${chapterIndex + 1} / ${chapters.length}</span>
      ${nextChapter ? `<button type="button" class="chapter-nav-btn" data-chapter-id="${nextChapter.id}" aria-label="Next chapter">Next →</button>` : `<span class="chapter-nav-placeholder"></span>`}
    </div>
    <h1 class="notes-chapter-title">${escapeHtml(chapter.title)}</h1>
    <div class="notes-meta-row">
      ${chapter.dateNoted ? `<span>${escapeHtml(chapter.dateNoted)}</span>` : ""}
      ${chapter.rating ? `<span class="book-rating">${"★".repeat(chapter.rating)}</span>` : ""}
      ${chapter.isEnriched ? `<span class="ai-badge">✦ AI</span>` : ""}
    </div>
  `;

  if (chapter.isEnriched && (chapter.summary || chapter.keyInsights?.length)) {
    html += `
      <div class="ai-card">
        <span class="ai-card-label">✦ AI</span>
        ${chapter.summary ? `<p>${escapeHtml(chapter.summary)}</p>` : ""}
        ${chapter.keyInsights?.length ? `<ul>${chapter.keyInsights.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
      </div>
    `;
  }

  if (chapter.rawNotes) {
    html += `<div class="notes-body">${typeof marked !== "undefined" ? marked.parse(chapter.rawNotes) : escapeHtml(chapter.rawNotes)}</div>`;
  }

  if (chapter.actionableItems?.length) {
    html += `
      <h3>Actionable</h3>
      <ul class="actionable-list">
        ${chapter.actionableItems.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}
      </ul>
    `;
  }

  if (chapter.connectedIdeas?.length) {
    html += `
      <h3>Connected ideas</h3>
      <div class="connected-ideas">
        ${chapter.connectedIdeas.map((i) => `<span class="idea-chip">${escapeHtml(i)}</span>`).join("")}
      </div>
    `;
  }

  const tags = [...(chapter.keyThemes || []), ...(chapter.concepts || [])].filter(Boolean);
  const conceptIds = new Set((chapter.concepts || []).map((c) => normalizeConceptForId(c)));
  if (tags.length) {
    html += `
      <div class="notes-tags">
        <span style="color:var(--text-dim);font-size:0.75rem">Tags</span>
        <div class="book-tags">${tags.map((t) => {
          const isConcept = conceptIds.has(normalizeConceptForId(t));
          const clickable = isConcept && onConceptFilter;
          return clickable
            ? `<span class="book-tag concept-chip" data-concept="${escapeHtml(t)}" title="Filter by concept">${escapeHtml(t)}</span>`
            : `<span class="book-tag">${escapeHtml(t)}</span>`;
        }).join("")}</div>
      </div>
    `;
  }

  el.innerHTML = html;

  // Wire up chapter nav buttons
  el.querySelectorAll(".chapter-nav-btn[data-chapter-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.chapterId;
      if (id && typeof window.onChapterSelect === "function") window.onChapterSelect(id);
    });
  });

  // Wire up breadcrumb link (book focus)
  const breadcrumbLink = el.querySelector(".book-title-link");
  if (breadcrumbLink && onBookFocus) {
    breadcrumbLink.setAttribute("role", "button");
    breadcrumbLink.setAttribute("tabindex", "0");
    breadcrumbLink.addEventListener("click", () => onBookFocus(breadcrumbLink.dataset.bookId));
    breadcrumbLink.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onBookFocus(breadcrumbLink.dataset.bookId);
      }
    });
  }

  // Wire up concept chips
  el.querySelectorAll(".concept-chip[data-concept]").forEach((chip) => {
    chip.addEventListener("click", () => onConceptFilter && onConceptFilter(chip.dataset.concept));
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("role", "button");
    chip.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && onConceptFilter) {
        e.preventDefault();
        onConceptFilter(chip.dataset.concept);
      }
    });
  });
}

function normalizeConceptForId(concept) {
  return String(concept || "").toLowerCase().replace(/\s+/g, "-").trim();
}

function findChapter(chapterId, graphData) {
  for (const book of graphData.books || []) {
    const ch = book.chapters?.find((c) => c.id === chapterId);
    if (ch) return ch;
  }
  return null;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
