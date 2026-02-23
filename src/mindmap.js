/**
 * D3.js force-directed mindmap.
 * Book nodes (r=32), chapter nodes (r=16), concept nodes (r=8).
 */
const expandedBooks = new Set();
let showConcepts = false;
let lastGraphData = null;
let lastMindmapOptions = {};
let lastSimulation = null;
let lastSvg = null;
let lastZoom = null;
let lastWidth = 0;
let lastHeight = 0;
let lastOnChapterSelect = null;

function normalizeConceptForMatch(str) {
  return String(str || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function conceptMatches(filter, conceptLabel) {
  if (!filter) return true;
  return normalizeConceptForMatch(filter) === normalizeConceptForMatch(conceptLabel);
}

function chapterHasConcept(chapter, filter) {
  if (!filter || !chapter) return true;
  const concepts = [...(chapter.concepts || []), ...(chapter.keyThemes || [])];
  return concepts.some((c) => conceptMatches(filter, c));
}

export function initMindmap(graphData, onChapterSelect, conceptsVisible = false, options = {}) {
  lastMindmapOptions = options;
  lastOnChapterSelect = onChapterSelect;
  const { conceptFilter, onConceptFilter, focusBookId } = options;
  lastGraphData = graphData;
  showConcepts = conceptsVisible;
  const svg = document.getElementById("mindmapSvg");
  const container = document.getElementById("mindmapCanvas");
  if (!svg || !container || !graphData?.books?.length) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  d3.select(svg).selectAll("*").remove();

  if (expandedBooks.size === 0) {
    graphData.books.forEach((b) => expandedBooks.add(b.id));
  }

  const nodes = [];
  const links = [];

  graphData.books.forEach((book) => {
    const hasMatchingChapter = conceptFilter
      ? (book.chapters || []).some((ch) => chapterHasConcept(ch, conceptFilter))
      : true;
    nodes.push({
      id: book.id,
      type: "book",
      label: book.title,
      color: book.color || "#8B949E",
      radius: 32,
      highlighted: !conceptFilter || hasMatchingChapter,
    });
    if (expandedBooks.has(book.id)) {
      (book.chapters || []).forEach((ch) => {
        const highlighted = !conceptFilter || chapterHasConcept(ch, conceptFilter);
        nodes.push({
          id: ch.id,
          type: "chapter",
          label: ch.title,
          bookId: book.id,
          color: desaturate(book.color || "#8B949E"),
          radius: 16,
          highlighted,
        });
        links.push({ source: book.id, target: ch.id });
      });
    }
  });

  if (showConcepts && graphData.conceptGraph) {
    (graphData.conceptGraph.nodes || []).forEach((c) => {
      const weight = c.weight ?? (c.chapters || []).length;
      const isFilterMatch = conceptFilter && conceptMatches(conceptFilter, c.id);
      nodes.push({
        id: `concept-${c.id}`,
        type: "concept",
        label: c.label || c.id,
        conceptId: c.id,
        weight,
        color: "#E6A817",
        radius: 8,
        highlighted: !conceptFilter || isFilterMatch,
        tooltip: `${c.label || c.id} (${weight} chapters)`,
      });
      (c.chapters || []).forEach((chId) => {
        links.push({ source: `concept-${c.id}`, target: chId, isConceptLink: true });
      });
    });
    (graphData.conceptGraph.edges || []).forEach((e) => {
      links.push({ source: e.source, target: e.target, isConceptLink: true });
    });
  }

  lastSimulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius((d) => (d.radius || 16) + 8));

  const g = d3.select(svg).append("g");

  lastZoom = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (e) => g.attr("transform", e.transform));
  d3.select(svg).call(lastZoom);

  const isConceptLink = (d) => d.isConceptLink === true;
  const linkHighlighted = (d) => {
    if (!conceptFilter) return true;
    const src = typeof d.source === "object" ? d.source : nodes.find((n) => n.id === d.source);
    const tgt = typeof d.target === "object" ? d.target : nodes.find((n) => n.id === d.target);
    return (src?.highlighted && tgt?.highlighted) !== false;
  };
  const link = g
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", (d) => (isConceptLink(d) ? "rgba(230, 168, 23, 0.4)" : "rgba(255,255,255,0.06)"))
    .attr("stroke-width", (d) => (isConceptLink(d) ? 1.5 : 1))
    .style("opacity", (d) => (linkHighlighted(d) ? 1 : 0.15));

  const node = g
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("cursor", "pointer")
    .style("opacity", 0)
    .call(
      d3
        .drag()
        .on("start", (e, d) => {
          if (!e.active) lastSimulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on("end", (e, d) => {
          if (!e.active) lastSimulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

  node
    .append("circle")
    .attr("r", (d) => d.radius)
    .attr("fill", (d) => d.color)
    .attr("stroke", (d) => (d.type === "book" ? d.color : "transparent"))
    .attr("stroke-width", 2)
    .attr("filter", (d) => (d.type === "book" ? "url(#glow)" : "none"))
    .style("opacity", (d) => (d.highlighted !== false ? 1 : 0.25));

  node
    .append("title")
    .text((d) => d.tooltip || d.label);

  const defs = d3.select(svg).append("defs");
  defs
    .append("filter")
    .attr("id", "glow")
    .append("feGaussianBlur")
    .attr("stdDeviation", 4)
    .attr("result", "coloredBlur");
  const feMerge = defs.select("filter").append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  node.on("click", (e, d) => {
    if (d.type === "chapter" && onChapterSelect) onChapterSelect(d.id);
    if (d.type === "concept" && onConceptFilter) onConceptFilter(d.conceptId ?? d.label);
    if (d.type === "book") {
      if (expandedBooks.has(d.id)) expandedBooks.delete(d.id);
      else expandedBooks.add(d.id);
      initMindmap(graphData, onChapterSelect, showConcepts, lastMindmapOptions);
    }
  });

  node.on("mouseover", function (e, d) {
    d3.select(this).raise();
  });

  lastSvg = svg;
  lastWidth = width;
  lastHeight = height;

  lastSimulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  if (focusBookId) {
    lastSimulation.on("end", function onFocusEnd() {
      lastSimulation.on("end", null);
      const n = lastSimulation.nodes().find((d) => d.id === focusBookId);
      if (n && lastWidth > 0 && lastSvg && lastZoom) {
        const scale = 1;
        const x = lastWidth / 2 - n.x * scale;
        const y = lastHeight / 2 - n.y * scale;
        d3.select(lastSvg).call(lastZoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
      }
    });
    lastSimulation.alpha(0.5).restart();
  }

  const motionDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300;
  node.transition().duration(motionDuration).delay((d, i) => (motionDuration ? i * 50 : 0)).style("opacity", 1);
}

function desaturate(hex) {
  const m = hex.slice(1).match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const s = 0.4;
  const nr = gray + (r - gray) * s;
  const ng = gray + (g - gray) * s;
  const nb = gray + (b - gray) * s;
  return `rgb(${Math.round(nr * 255)},${Math.round(ng * 255)},${Math.round(nb * 255)})`;
}

/**
 * Focus the mindmap on a book. Expands it, re-renders, and pans/zooms to center it.
 */
export function focusBookInMindmap(bookId) {
  if (!bookId || !lastGraphData || !lastOnChapterSelect) return;
  expandedBooks.add(bookId);
  const opts = { ...lastMindmapOptions, focusBookId: bookId };
  initMindmap(lastGraphData, lastOnChapterSelect, showConcepts, opts);
}
