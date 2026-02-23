/**
 * ReadBrain — main entry point.
 * Fetches graph data, orchestrates sidebar, mindmap, search, and notes panel.
 */

const API_GRAPH = "public/graph-data.json";
const FALLBACK_GRAPH = "public/graph-data.json";

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

/** Tracks which books are expanded in sidebar */
const expandedSidebarBooks = new Set();

/**
 * Render sidebar book list with expandable chapters.
 */
function renderSidebar(books) {
  if (expandedSidebarBooks.size === 0 && books?.length > 0) {
    expandedSidebarBooks.add(books[0].id);
  }
  const el = document.getElementById("bookList");
  if (!el || !books?.length) {
    if (el) el.innerHTML = "<p style='padding:1rem;color:var(--text-dim)'>No books yet.</p>";
    return;
  }

  el.innerHTML = books
    .map(
      (book, i) => {
        const isExpanded = expandedSidebarBooks.has(book.id);
        const chapters = book.chapters || [];
        return `
    <article class="book-card${isExpanded ? " expanded" : ""}" data-book-id="${book.id}" data-color="${book.color || "#8B949E"}" style="border-left-color: ${book.color || "#8B949E"}; animation-delay: ${i * 50}ms">
      <div class="book-card-header" role="button" tabindex="0" aria-expanded="${isExpanded}" aria-label="${isExpanded ? "Collapse" : "Expand"} chapters">
        <div class="book-card-title-row">
          <span class="book-expand-icon" aria-hidden="true">▸</span>
          <div class="book-info">
            <div class="book-title">${escapeHtml(book.title)}</div>
            <div class="book-author">${escapeHtml(book.author)}</div>
          </div>
        </div>
        <div class="book-meta">
          ${book.rating ? `<span class="book-rating">${"★".repeat(book.rating)}</span>` : ""}
          ${chapters.length ? `<span>${chapters.length} ch</span>` : ""}
        </div>
      </div>
      ${chapters.length ? `
      <div class="book-chapters${isExpanded ? "" : " hidden"}">
        ${chapters.map((ch) => `<button type="button" class="chapter-item" data-chapter-id="${ch.id}">Ch ${ch.chapter}: ${escapeHtml(ch.title || `Chapter ${ch.chapter}`)}</button>`).join("")}
      </div>` : ""}
      ${book.tags?.length ? `<div class="book-tags">${book.tags.map((t) => `<span class="book-tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    </article>
  `;
      }
    )
    .join("");

  el.querySelectorAll(".book-card").forEach((card) => {
    const bookId = card.dataset.bookId;
    const header = card.querySelector(".book-card-header");
    const chaptersDiv = card.querySelector(".book-chapters");

    header?.addEventListener("click", (e) => {
      if (e.target.closest(".chapter-item")) return;
      const isExpanded = expandedSidebarBooks.has(bookId);
      if (isExpanded) {
        expandedSidebarBooks.delete(bookId);
        card.classList.remove("expanded");
        chaptersDiv?.classList.add("hidden");
        header?.setAttribute("aria-expanded", "false");
      } else {
        expandedSidebarBooks.add(bookId);
        card.classList.add("expanded");
        chaptersDiv?.classList.remove("hidden");
        header?.setAttribute("aria-expanded", "true");
      }
    });

    header?.addEventListener("keydown", (e) => {
      if (e.target.closest(".chapter-item")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        header.click();
      }
    });

    card.querySelectorAll(".chapter-item").forEach((chBtn) => {
      chBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const chId = chBtn.dataset.chapterId;
        if (chId && onChapterSelect) onChapterSelect(chId);
      });
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

  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const toggleSidebar = () => {
    sidebar?.classList.toggle("open");
    sidebarOverlay?.classList.toggle("visible", sidebar?.classList.contains("open"));
  };
  document.getElementById("sidebarToggle")?.addEventListener("click", toggleSidebar);
  sidebarOverlay?.addEventListener("click", toggleSidebar);

  // Wire up panel close
  if (panelClose) {
    panelClose.addEventListener("click", () => {
      notesPanel?.classList.remove("open");
    });
  }

  let conceptFilter = null;
  let currentChapterId = null;

  const onBookFocus = (bookId) => {
    if (typeof window.focusBookInMindmap === "function") {
      window.focusBookInMindmap(bookId);
    }
  };

  const onConceptFilter = (concept) => {
    conceptFilter = conceptFilter === concept ? null : concept;
    renderMindmap();
  };

  onChapterSelect = (chapterId) => {
    currentChapterId = chapterId;
    notesPanel?.classList.add("open");
    window.onChapterSelect = onChapterSelect;
    if (typeof window.renderNotesPanel === "function") {
      window.renderNotesPanel(chapterId, graphData, { onBookFocus, onConceptFilter });
    }
  };
  window.onChapterSelect = onChapterSelect;

  const getPrevNextChapter = () => {
    if (!currentChapterId || !graphData?.books) return { prev: null, next: null };
    for (const book of graphData.books) {
      const chs = book.chapters || [];
      const idx = chs.findIndex((c) => c.id === currentChapterId);
      if (idx >= 0) {
        return {
          prev: idx > 0 ? chs[idx - 1].id : null,
          next: idx < chs.length - 1 ? chs[idx + 1].id : null,
        };
      }
    }
    return { prev: null, next: null };
  };

  const searchInput = document.getElementById("searchInput");
  if (typeof window.initShortcuts === "function") {
    window.initShortcuts(
      () => {
        const { prev } = getPrevNextChapter();
        if (prev && onChapterSelect) onChapterSelect(prev);
      },
      () => {
        const { next } = getPrevNextChapter();
        if (next && onChapterSelect) onChapterSelect(next);
      },
      () => searchInput?.focus(),
      () => notesPanel?.classList.remove("open")
    );
  }

  // Initialize mindmap (loaded as module or global)
  const conceptsToggle = document.getElementById("conceptsToggle");
  let conceptsVisible = false;
  const renderMindmap = () => {
    if (typeof window.initMindmap === "function") {
      window.initMindmap(graphData, onChapterSelect, conceptsVisible, {
        conceptFilter,
        onConceptFilter: (concept) => onConceptFilter(concept),
      });
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

// Load mindmap, search, reader, shortcuts as modules
Promise.all([
  import("./mindmap.js").then((m) => {
    window.initMindmap = m.initMindmap;
    window.focusBookInMindmap = m.focusBookInMindmap;
  }),
  import("./search.js").then((m) => {
    window.initSearch = m.initSearch;
  }),
  import("./reader.js").then((m) => {
    window.renderNotesPanel = m.renderChapter;
  }),
  import("./shortcuts.js").then((m) => {
    window.initShortcuts = m.initShortcuts;
  }),
])
  .then(() => init())
  .catch((err) => {
    console.error("ReadBrain init error:", err);
    document.getElementById("bookList").innerHTML =
      "<p style='padding:1rem;color:#e74c3c'>Failed to load. Check console.</p>";
  });
