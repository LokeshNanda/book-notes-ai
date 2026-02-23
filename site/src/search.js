/**
 * Fuse.js fuzzy search over chapters.
 */
export function initSearch(graphData, onChapterSelect) {
  const input = document.getElementById("searchInput");
  const dropdown = document.getElementById("searchResults");
  if (!input || !dropdown || !graphData) return;

  const chapters = [];
  (graphData.books || []).forEach((book) => {
    (book.chapters || []).forEach((ch) => {
      chapters.push({
        ...ch,
        bookTitle: book.title,
        bookId: book.id,
      });
    });
  });

  const fuse = new Fuse(chapters, {
    keys: ["title", "rawNotes", "summary", "keyThemes", "concepts"],
    threshold: 0.4,
  });

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (!q) {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
      return;
    }
    const results = fuse.search(q).slice(0, 10);
    if (!results.length) {
      dropdown.innerHTML = "<div class='search-result-item'>No matches</div>";
    } else {
      dropdown.innerHTML = results
        .map(
          (r) => `
        <div class="search-result-item" data-chapter-id="${r.item.id}">
          <div class="search-result-book">${escapeHtml(r.item.bookTitle)}</div>
          <div class="search-result-title">${escapeHtml(r.item.title)}</div>
        </div>
      `
        )
        .join("");
      dropdown.querySelectorAll(".search-result-item[data-chapter-id]").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.dataset.chapterId;
          if (id && onChapterSelect) onChapterSelect(id);
          dropdown.classList.add("hidden");
          input.value = "";
        });
      });
    }
    dropdown.classList.remove("hidden");
  });

  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.add("hidden"), 150);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dropdown.classList.add("hidden");
  });
}

function escapeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
