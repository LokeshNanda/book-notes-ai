/**
 * Notes panel / reader. Renders chapter content when selected.
 * Uses global `marked` from CDN script.
 */

export function renderChapter(chapterId, graphData) {
  const el = document.getElementById("notesContent");
  if (!el || !graphData) return;

  const chapter = findChapter(chapterId, graphData);
  if (!chapter) {
    el.innerHTML = "<p>Chapter not found.</p>";
    return;
  }

  const book = graphData.books.find((b) => b.id === chapter.bookId);
  const bookTitle = book?.title || chapter.bookId;

  let html = `
    <div class="notes-breadcrumb">
      <span class="book-title">${escapeHtml(bookTitle)}</span> → Chapter ${chapter.chapter}
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
  if (tags.length) {
    html += `
      <div class="notes-tags">
        <span style="color:var(--text-dim);font-size:0.75rem">Tags</span>
        <div class="book-tags">${tags.map((t) => `<span class="book-tag">${escapeHtml(t)}</span>`).join("")}</div>
      </div>
    `;
  }

  el.innerHTML = html;
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
