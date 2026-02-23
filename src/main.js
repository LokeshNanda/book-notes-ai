/**
 * ReadBrain — main entry point.
 * Fetches graph data, orchestrates sidebar, mindmap, search, and notes panel.
 */

const API_GRAPH = "/api/graph";
const FALLBACK_GRAPH = "/public/graph-data.json";

let graphData = null;
let onChapterSelect = null;

/**
 * Fetch graph data. Tries API first, falls back to static JSON.
 */
async function fetchGraph() {
  try {
    const res = await fetch(API_GRAPH);
    if (res.ok) return await res.json();
  } catch (_) {
    /* API unavailable, try static */
  }
  const res = await fetch(FALLBACK_GRAPH);
  if (!res.ok) throw new Error("Failed to load graph data");
  return res.json();
}

/**
 * Render header stats.
 */
function renderHeaderStats(stats) {
  const el = document.getElementById("headerStats");
  if (!el || !stats) return;
  el.textContent = `${stats.totalBooks} books · ${stats.totalChapters} chapters · ${stats.enrichedChapters} enriched`;
}

/**
 * Render sidebar book list.
 */
function renderSidebar(books) {
  const el = document.getElementById("bookList");
  if (!el || !books?.length) {
    if (el) el.innerHTML = "<p style='padding:1rem;color:var(--text-dim)'>No books yet.</p>";
    return;
  }

  el.innerHTML = books
    .map(
      (book, i) => `
    <article class="book-card" data-book-id="${book.id}" data-color="${book.color || "#8B949E"}" style="border-left-color: ${book.color || "#8B949E"}; animation-delay: ${i * 50}ms">
      <div class="book-title">${escapeHtml(book.title)}</div>
      <div class="book-author">${escapeHtml(book.author)}</div>
      <div class="book-meta">
        ${book.rating ? `<span class="book-rating">${"★".repeat(book.rating)}</span>` : ""}
        ${book.chapters?.length ? `<span>${book.chapters.length} ch</span>` : ""}
      </div>
      ${book.tags?.length ? `<div class="book-tags">${book.tags.map((t) => `<span class="book-tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    </article>
  `
    )
    .join("");

  el.querySelectorAll(".book-card").forEach((card) => {
    card.addEventListener("click", () => {
      const bookId = card.dataset.bookId;
      const book = books.find((b) => b.id === bookId);
      if (book?.chapters?.length && onChapterSelect) {
        onChapterSelect(book.chapters[0].id);
      }
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Initialize app.
 */
async function init() {
  const graphEl = document.getElementById("mindmapCanvas");
  const notesPanel = document.getElementById("notesPanel");
  const panelClose = document.getElementById("panelClose");

  graphData = await fetchGraph();
  renderHeaderStats(graphData.stats);
  renderSidebar(graphData.books);

  // Wire up panel close
  if (panelClose) {
    panelClose.addEventListener("click", () => {
      notesPanel?.classList.remove("open");
    });
  }

  // Wire chapter selection callback for mindmap
  onChapterSelect = (chapterId) => {
    notesPanel?.classList.add("open");
    if (typeof window.renderNotesPanel === "function") {
      window.renderNotesPanel(chapterId, graphData);
    }
  };

  // Initialize mindmap (loaded as module or global)
  const conceptsToggle = document.getElementById("conceptsToggle");
  let conceptsVisible = false;
  const renderMindmap = () => {
    if (typeof window.initMindmap === "function") {
      window.initMindmap(graphData, onChapterSelect, conceptsVisible);
    }
  };
  renderMindmap();
  if (conceptsToggle) {
    conceptsToggle.addEventListener("click", () => {
      conceptsVisible = !conceptsVisible;
      conceptsToggle.classList.toggle("active", conceptsVisible);
      renderMindmap();
    });
  }

  // Initialize search
  if (typeof window.initSearch === "function") {
    window.initSearch(graphData, onChapterSelect);
  }
}

// Load mindmap, search, reader as modules
Promise.all([
  import("./mindmap.js").then((m) => {
    window.initMindmap = m.initMindmap;
  }),
  import("./search.js").then((m) => {
    window.initSearch = m.initSearch;
  }),
  import("./reader.js").then((m) => {
    window.renderNotesPanel = m.renderChapter;
  }),
])
  .then(() => init())
  .catch((err) => {
    console.error("ReadBrain init error:", err);
    document.getElementById("bookList").innerHTML =
      "<p style='padding:1rem;color:#e74c3c'>Failed to load. Check console.</p>";
  });
