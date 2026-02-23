/**
 * D3.js force-directed mindmap.
 * Book nodes (r=32), chapter nodes (r=16), concept nodes (r=8).
 */
const expandedBooks = new Set();
let showConcepts = false;

export function initMindmap(graphData, onChapterSelect, conceptsVisible = false) {
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
    nodes.push({
      id: book.id,
      type: "book",
      label: book.title,
      color: book.color || "#8B949E",
      radius: 32,
    });
    if (expandedBooks.has(book.id)) {
      (book.chapters || []).forEach((ch) => {
        nodes.push({
          id: ch.id,
          type: "chapter",
          label: ch.title,
          bookId: book.id,
          color: desaturate(book.color || "#8B949E"),
          radius: 16,
        });
        links.push({ source: book.id, target: ch.id });
      });
    }
  });

  if (showConcepts && graphData.conceptGraph) {
    (graphData.conceptGraph.nodes || []).forEach((c) => {
      nodes.push({
        id: `concept-${c.id}`,
        type: "concept",
        label: c.label || c.id,
        color: "#E6A817",
        radius: 8,
      });
      (c.chapters || []).forEach((chId) => {
        links.push({ source: `concept-${c.id}`, target: chId, isConceptLink: true });
      });
    });
    (graphData.conceptGraph.edges || []).forEach((e) => {
      links.push({ source: e.source, target: e.target, isConceptLink: true });
    });
  }

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius((d) => (d.radius || 16) + 8));

  const g = d3.select(svg).append("g");

  const zoom = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (e) => g.attr("transform", e.transform));
  d3.select(svg).call(zoom);

  const isConceptLink = (d) => d.isConceptLink === true;
  const link = g
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", (d) => (isConceptLink(d) ? "rgba(230, 168, 23, 0.4)" : "rgba(255,255,255,0.06)"))
    .attr("stroke-width", (d) => (isConceptLink(d) ? 1.5 : 1));

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
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on("end", (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
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
    .attr("filter", (d) => (d.type === "book" ? "url(#glow)" : "none"));

  node
    .append("title")
    .text((d) => d.label);

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
    if (d.type === "book") {
      if (expandedBooks.has(d.id)) expandedBooks.delete(d.id);
      else expandedBooks.add(d.id);
      initMindmap(graphData, onChapterSelect);
    }
  });

  node.on("mouseover", function (e, d) {
    d3.select(this).raise();
  });

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  node.transition().duration(300).delay((d, i) => i * 50).style("opacity", 1);
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
