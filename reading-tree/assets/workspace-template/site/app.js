const SOURCE = globalThis.LINKED_READING_SOURCE;
const treeData = globalThis.LINKED_READING_TREE_DATA;
const PAGE_TITLE = globalThis.LINKED_READING_PAGE_TITLE;
const PAGE_SUBTITLE = globalThis.LINKED_READING_PAGE_SUBTITLE;
const PAGE_DESC = globalThis.LINKED_READING_PAGE_DESC;
const PAGE_FOOTER = globalThis.LINKED_READING_PAGE_FOOTER;

if (!Array.isArray(SOURCE) || !treeData) {
  throw new Error("Missing generated site data. Load site/data/source.js and site/data/tree-data.js before app.js.");
}

const ROLE_PALETTE = [
  "#be7558",
  "#7d9850",
  "#4f8f96",
  "#916db2",
  "#b9853f",
  "#6d7f9b",
  "#a05f85",
  "#63846f"
];

const WEIGHT_LEGEND_ITEMS = [
  { w: 0.2, label: "Brief Mention" },
  { w: 0.5, label: "Medium Coverage" },
  { w: 0.8, label: "Dense Coverage" },
  { w: 1.0, label: "Core Theme" }
];

const ZOOM_LIMITS = { min: 0.65, max: 1.8 };
const ZOOM_BUTTON_STEP = 0.12;
const ZOOM_WHEEL_STEP = 0.08;
const TREE_PAN_THRESHOLD = 6;
const TOOLTIP_SHOW_DELAY_MS = 1000;
const TOOLTIP_HIDE_DELAY_MS = 180;

function getRequiredElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required element: #${id}`);
  }
  return el;
}

function getRequiredSelector(selector) {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return el;
}

function createElement(tag, className = "") {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  return el;
}

function getOrCreateList(map, key) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  return map.get(key);
}

function setStyles(el, styles) {
  Object.assign(el.style, styles);
  return el;
}

function applyLineClamp(el, lines) {
  el.style.overflow = "hidden";
  el.style.textOverflow = "ellipsis";
  el.style.display = "-webkit-box";
  el.style.webkitBoxOrient = "vertical";
  el.style.webkitLineClamp = String(lines);
  return el;
}

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRole(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function formatRoleLabel(role) {
  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roleColorAt(index) {
  if (index < ROLE_PALETTE.length) {
    return ROLE_PALETTE[index];
  }
  return `hsl(${(index * 67) % 360} 52% 58%)`;
}

function connectorColorFromVisual(v) {
  return `hsl(31 ${32 + v * 48}% ${69 - v * 20}%)`;
}

function isValidRange(range) {
  return (
    Array.isArray(range) &&
    range.length === 2 &&
    Number.isInteger(range[0]) &&
    Number.isInteger(range[1]) &&
    range[0] <= range[1]
  );
}

function rangeSpan(range) {
  return isValidRange(range) ? range[1] - range[0] + 1 : 0;
}

function rangeIncludes(range, index) {
  return isValidRange(range) && index >= range[0] && index <= range[1];
}

function visualWeight(weight, depth) {
  if (depth === 0) return 1;
  const [min, max] = weightDomain(depth);
  const span = Math.max(0.001, max - min);
  const normalized = clamp((weight - min) / span, 0, 1);
  const stepped = Math.round(normalized * (depth >= 3 ? 5 : 6)) / (depth >= 3 ? 5 : 6);
  return clamp(normalized * 0.72 + stepped * 0.28, 0, 1);
}

function wTextFromVisual(v, depth) {
  const sat = 30 + v * 42;
  const base = depth === 0 ? 34 : depth === 1 ? 27 : depth === 2 ? 24 : 22;
  const light = base - v * (depth === 0 ? 9 : 11);
  return `hsl(24 ${sat}% ${light}%)`;
}

function wText(weight, depth) {
  const v = depth == null ? clamp(weight, 0, 1) : visualWeight(weight, depth);
  return wTextFromVisual(v, depth);
}

function wBorderFromVisual(v) {
  return `hsl(30 ${28 + v * 58}% ${72 - v * 36}%)`;
}

function wBorder(weight, depth) {
  const v = depth == null ? clamp(weight, 0, 1) : visualWeight(weight, depth);
  return wBorderFromVisual(v);
}

function wBgFromVisual(v, depth) {
  const sat = 40 + v * 38;
  const base = depth === 0 ? 94 : depth === 1 ? 95 : 97;
  const light = base - v * (depth === 0 ? 23 : 21);
  return `hsl(36 ${sat}% ${light}%)`;
}

function wBg(weight, depth) {
  const v = depth == null ? clamp(weight, 0, 1) : visualWeight(weight, depth);
  return wBgFromVisual(v, depth);
}

function nodePaddingFromVisual(v, depth) {
  if (depth === 0) return [14 + v * 3, 24 + v * 8];
  return [8 + v * 3, 11 + v * 12];
}

function nodePadding(weight, depth) {
  return nodePaddingFromVisual(visualWeight(weight, depth), depth);
}

function nodeFontFromVisual(v, depth) {
  const base = depth === 0 ? 18.4 : depth === 1 ? 13.6 : depth === 2 ? 12.1 : 11.5;
  return base + v * (depth === 0 ? 5.6 : depth === 1 ? 3.0 : depth === 2 ? 1.8 : 1.4);
}

function nodeFont(weight, depth) {
  return nodeFontFromVisual(visualWeight(weight, depth), depth);
}

function nodeHeightFromVisual(v, depth) {
  const emphasis = Math.pow(v, 0.82);
  const base = depth === 0 ? 96 : depth === 1 ? 54 : depth === 2 ? 44 : 34;
  const gain = depth === 0 ? 80 : depth === 1 ? 76 : depth === 2 ? 68 : 58;
  return Math.round(base + emphasis * gain);
}

function nodeHeight(weight, depth) {
  return nodeHeightFromVisual(visualWeight(weight, depth), depth);
}

function nodeLabelLines(depth) {
  if (depth === 0) return 4;
  if (depth === 1) return 3;
  return 2;
}

function nodeWidthFromVisual(v, depth) {
  if (depth === 0) return Math.round(372 + v * 52);
  if (depth === 1) return Math.round(300 + v * 54);
  return Math.round(276 + v * 58);
}

function nodeWidth(weight, depth) {
  return nodeWidthFromVisual(visualWeight(weight, depth), depth);
}

function buildTreeMeta(rootNode, paragraphCount) {
  const nodes = new Map();
  const levelOrder = new Map();
  const pathLabels = new Map();
  const paragraphWinners = Array.from({ length: paragraphCount }, () => null);

  function registerParagraphCandidate(id, depth, range) {
    if (!isValidRange(range) || paragraphCount === 0) return;

    const candidate = { id, depth, span: rangeSpan(range) };
    const start = Math.max(0, range[0]);
    const end = Math.min(paragraphCount - 1, range[1]);

    for (let idx = start; idx <= end; idx += 1) {
      const current = paragraphWinners[idx];
      if (
        !current ||
        candidate.depth > current.depth ||
        (candidate.depth === current.depth && candidate.span < current.span)
      ) {
        paragraphWinners[idx] = candidate;
      }
    }
  }

  function walk(node, parentId, depth, siblingIndex, parentPathParts) {
    const id = parentId === null ? "0" : `${parentId}.${siblingIndex}`;
    const children = Array.isArray(node.children) ? node.children : [];
    const idsAtDepth = getOrCreateList(levelOrder, depth);
    const explicitRole = normalizeRole(node?.role);
    const meta = {
      id,
      node,
      parentId,
      depth,
      orderIndex: idsAtDepth.length,
      childrenIds: [],
      explicitRole
    };

    idsAtDepth.push(id);
    nodes.set(id, meta);

    const pathParts = [node?.label || id, ...parentPathParts];
    pathLabels.set(id, pathParts.join(" < "));
    registerParagraphCandidate(id, depth, node?.range);

    children.forEach((child, index) => {
      const childId = walk(child, id, depth + 1, index, pathParts);
      meta.childrenIds.push(childId);
    });

    return id;
  }

  const rootId = walk(rootNode, null, 0, 0, []);
  const paragraphToNode = new Map();

  paragraphWinners.forEach((winner, index) => {
    if (winner) {
      paragraphToNode.set(index, winner.id);
    }
  });

  return { nodes, rootId, levelOrder, pathLabels, paragraphToNode };
}

function buildRoleMeta(nodes) {
  const roles = [...new Set(
    [...nodes.values()]
      .map((meta) => meta.explicitRole)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const roleMeta = new Map();
  roles.forEach((role, index) => {
    roleMeta.set(role, {
      key: role,
      label: formatRoleLabel(role),
      color: roleColorAt(index)
    });
  });
  return roleMeta;
}

function buildWeightDomains(nodes) {
  const byDepth = new Map();

  nodes.forEach((meta) => {
    if (meta.depth <= 0) return;
    const weight = clamp(meta?.node?.weight ?? 0.5, 0, 1);
    getOrCreateList(byDepth, meta.depth).push(weight);
  });

  const domains = new Map();
  byDepth.forEach((weights, depth) => {
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const span = max - min;

    if (span < 0.001) {
      domains.set(depth, [0, 1]);
      return;
    }

    const padding = Math.min(0.08, span * 0.18);
    domains.set(depth, [clamp(min - padding, 0, 1), clamp(max + padding, 0, 1)]);
  });

  return domains;
}

function weightDomain(depth) {
  return WEIGHT_DOMAINS.get(depth) || [0, 1];
}

function childVisualBand(parentVisual) {
  const upper = Math.max(0, parentVisual - Math.min(0.04, parentVisual * 0.12));
  const band = clamp(upper * 0.6, 0.04, 0.18);
  const lower = Math.max(0, upper - band);
  return [lower, upper];
}

function buildNodeVisualWeights(nodes, rootId) {
  const visuals = new Map();

  function walk(nodeId) {
    const meta = nodes.get(nodeId);
    if (!meta) return 0.5;

    const raw = visualWeight(meta?.node?.weight ?? 0.5, meta.depth);
    const parentVisual = meta.parentId === null ? null : visuals.get(meta.parentId);
    const visual =
      visuals.get(nodeId) ??
      (parentVisual == null ? raw : Math.min(raw, Math.max(0, parentVisual - Math.min(0.04, parentVisual * 0.12))));

    visuals.set(nodeId, visual);

    if (meta.childrenIds.length > 0 && meta.depth > 0) {
      const childRawWeights = meta.childrenIds.map((childId) => {
        const childMeta = nodes.get(childId);
        const childRaw = visualWeight(childMeta?.node?.weight ?? 0.5, childMeta.depth);
        return [childId, childRaw];
      });

      const [lower, upper] = childVisualBand(visual);
      const rawValues = childRawWeights.map(([, childRaw]) => childRaw);
      const rawMin = Math.min(...rawValues);
      const rawMax = Math.max(...rawValues);
      const rawSpan = rawMax - rawMin;

      childRawWeights.forEach(([childId, childRaw]) => {
        const normalized =
          childRawWeights.length === 1
            ? clamp(childRaw, 0, 1)
            : rawSpan < 0.001
              ? 0.5
              : clamp((childRaw - rawMin) / rawSpan, 0, 1);
        const spread = lower + normalized * (upper - lower);
        visuals.set(childId, spread);
      });
    }

    meta.childrenIds.forEach(walk);
    return visual;
  }

  walk(rootId);
  return visuals;
}

function nodeVisualWeight(nodeId, weight, depth) {
  return NODE_VISUAL_WEIGHTS.get(nodeId) ?? (depth == null ? clamp(weight, 0, 1) : visualWeight(weight, depth));
}

function buildSiblingVisualProfiles(nodes) {
  const profiles = new Map();

  nodes.forEach((meta) => {
    if (!meta.childrenIds || meta.childrenIds.length === 0) return;

    const weights = meta.childrenIds.map((childId) => clamp(nodes.get(childId)?.node?.weight ?? 0.5, 0, 1));
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const span = max - min;
    const strength = meta.childrenIds.length <= 1 ? 0 : clamp((span - 0.02) / 0.18, 0, 1);

    meta.childrenIds.forEach((childId, index) => {
      const normalized = span < 0.001 ? 0.5 : clamp((weights[index] - min) / span, 0, 1);
      profiles.set(childId, {
        normalized,
        strength,
        span,
        count: meta.childrenIds.length
      });
    });
  });

  return profiles;
}

function nodeSiblingVisual(nodeId) {
  return NODE_SIBLING_VISUALS.get(nodeId) || { normalized: 0.5, strength: 0, span: 0, count: 1 };
}

function createTreePanState(overrides = {}) {
  return {
    active: false,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    ...overrides
  };
}

const dom = {
  appRoot: getRequiredElement("app"),
  tooltip: getRequiredElement("tooltip"),
  treeViewport: getRequiredSelector(".tree-scroll"),
  treeCanvas: getRequiredElement("tree-canvas"),
  treeZoomOutBtn: getRequiredElement("tree-zoom-out"),
  treeZoomInBtn: getRequiredElement("tree-zoom-in"),
  treeZoomResetBtn: getRequiredElement("tree-zoom-reset"),
  treeZoomReadout: getRequiredElement("tree-zoom-readout"),
  pageTitle: getRequiredElement("title"),
  pageSubtitle: getRequiredElement("subtitle"),
  pageDesc: getRequiredElement("desc"),
  pageFooter: getRequiredElement("footer"),
  legend: getRequiredElement("legend"),
  roleFilters: getRequiredElement("role-filters"),
  detailTitle: getRequiredElement("detail-title"),
  detailMeta: getRequiredElement("detail-meta"),
  detailBody: getRequiredElement("detail-body")
};

const treeMeta = buildTreeMeta(treeData, SOURCE.length);
const NODE_INDEX = treeMeta.nodes;
const ROOT_NODE_ID = treeMeta.rootId;
const LEVEL_ORDER = treeMeta.levelOrder;
const NODE_PATH_LABEL = treeMeta.pathLabels;
const PARAGRAPH_TO_NODE = treeMeta.paragraphToNode;
const ROLE_META = buildRoleMeta(NODE_INDEX);
const WEIGHT_DOMAINS = buildWeightDomains(NODE_INDEX);
const NODE_VISUAL_WEIGHTS = buildNodeVisualWeights(NODE_INDEX, ROOT_NODE_ID);
const NODE_SIBLING_VISUALS = buildSiblingVisualProfiles(NODE_INDEX);

const state = {
  selectedNodeId: "",
  nodeDomMap: new Map(),
  nodeRoleMarkerMap: new Map(),
  connectorDomMap: new Map(),
  highlightedConnectorEls: [],
  highlightedPathNodeEls: [],
  detailParagraphEls: [],
  activeRoleFilters: new Set(),
  tooltip: {
    hideTimer: null,
    showTimer: null,
    pending: null,
    pinned: false,
    rangeKey: ""
  },
  treeZoom: 1,
  treePan: createTreePanState(),
  suppressTreeClick: false,
  suppressTreeClickTimer: null
};

function initPageChrome() {
  setStyles(dom.appRoot, {
    display: "inline-block",
    width: "max-content",
    minWidth: "100%",
    transformOrigin: "top left"
  });

  setStyles(dom.treeCanvas, {
    display: "inline-block",
    minWidth: "100%"
  });

  dom.pageTitle.textContent = PAGE_TITLE;
  dom.pageSubtitle.textContent = PAGE_SUBTITLE;
  dom.pageDesc.textContent = PAGE_DESC;
  dom.pageFooter.textContent = PAGE_FOOTER;
  document.title = PAGE_TITLE;
}

function getRoleInfo(meta) {
  if (!meta?.explicitRole) return null;
  const role = ROLE_META.get(meta.explicitRole);
  if (!role) return null;
  return role;
}

function roleBadgeHTML(roleInfo) {
  if (!roleInfo) return "";
  return `<span class="role-badge" style="--role-color: ${roleInfo.color}">${escapeHTML(roleInfo.label)}</span>`;
}

function updateTreeZoomReadout() {
  dom.treeZoomReadout.textContent = `${Math.round(state.treeZoom * 100)}%`;
}

function syncTreeCanvasSize() {
  const width = dom.appRoot.offsetWidth;
  const height = dom.appRoot.offsetHeight;
  dom.treeCanvas.style.width = width ? `${width * state.treeZoom}px` : "max-content";
  dom.treeCanvas.style.height = height ? `${height * state.treeZoom}px` : "auto";
}

function clearTooltipHideTimer() {
  clearTimeout(state.tooltip.hideTimer);
  state.tooltip.hideTimer = null;
}

function clearTooltipShowTimer() {
  clearTimeout(state.tooltip.showTimer);
  state.tooltip.showTimer = null;
  state.tooltip.pending = null;
}

function hideTooltip() {
  clearTooltipShowTimer();
  dom.tooltip.style.display = "none";
  state.tooltip.rangeKey = "";
}

function scheduleHideTooltip() {
  clearTooltipShowTimer();
  clearTooltipHideTimer();
  state.tooltip.hideTimer = setTimeout(() => {
    if (!state.tooltip.pinned) {
      hideTooltip();
    }
  }, TOOLTIP_HIDE_DELAY_MS);
}

function keepTooltipAlive() {
  state.tooltip.pinned = true;
  clearTooltipHideTimer();
}

function releaseTooltip() {
  state.tooltip.pinned = false;
  scheduleHideTooltip();
}

function writeTooltipContent(nodeId, range) {
  const [start, end] = range;
  const textList = SOURCE.slice(start, end + 1);
  const meta = NODE_INDEX.get(nodeId);
  const title = meta?.node?.label || "Node Reference";
  const roleInfo = getRoleInfo(meta);
  const childCount = meta?.childrenIds?.length ?? 0;
  const paragraphs = textList.map((text) => `<p>${escapeHTML(text)}</p>`).join("");

  dom.tooltip.innerHTML =
    `<div class="meta node-meta">` +
      `<div class="node-copy">` +
        `<div class="node-kicker">Node</div>` +
        `<div class="node-title">${escapeHTML(title)}</div>` +
        (roleInfo ? `<div class="node-role">${roleBadgeHTML(roleInfo)}</div>` : "") +
      `</div>` +
      `<div class="range-meta">Paragraphs ${start}–${end}` +
        (childCount > 0 ? ` | ${childCount} children` : ` | Leaf`) +
      `</div>` +
    `</div>` +
    paragraphs;
}

function placeTooltip(x, y) {
  const nextX = x + 16;
  const nextY = y + 16;
  const maxX = window.innerWidth - dom.tooltip.offsetWidth - 8;
  const maxY = window.innerHeight - dom.tooltip.offsetHeight - 8;

  dom.tooltip.style.left = `${clamp(nextX, 8, Math.max(8, maxX))}px`;
  dom.tooltip.style.top = `${clamp(nextY, 8, Math.max(8, maxY))}px`;
}

function getTooltipPayload(event, range) {
  if (!isValidRange(range)) return null;

  const [start, end] = range;
  const nodeId = event.currentTarget?.dataset?.nodeId || "";
  return {
    nodeId,
    range: [start, end],
    rangeKey: `${nodeId}:${start}:${end}`,
    x: event.clientX,
    y: event.clientY
  };
}

function showTooltip(payload) {
  if (!payload) return;

  clearTooltipHideTimer();

  if (payload.rangeKey !== state.tooltip.rangeKey) {
    writeTooltipContent(payload.nodeId, payload.range);
    state.tooltip.rangeKey = payload.rangeKey;
    dom.tooltip.scrollTop = 0;
  }

  dom.tooltip.style.display = "block";
  if (!state.tooltip.pinned) {
    placeTooltip(payload.x, payload.y);
  }
}

function scheduleShowTooltip(event, range) {
  const payload = getTooltipPayload(event, range);
  if (!payload) return;

  clearTooltipHideTimer();

  if (dom.tooltip.style.display === "block" && state.tooltip.rangeKey === payload.rangeKey) {
    if (!state.tooltip.pinned) {
      placeTooltip(payload.x, payload.y);
    }
    return;
  }

  clearTooltipShowTimer();
  state.tooltip.pending = payload;
  state.tooltip.showTimer = setTimeout(() => {
    const pending = state.tooltip.pending;
    state.tooltip.showTimer = null;
    if (!pending || pending.rangeKey !== payload.rangeKey || state.tooltip.pinned) {
      return;
    }
    state.tooltip.pending = null;
    showTooltip(pending);
  }, TOOLTIP_SHOW_DELAY_MS);
}

function updateTooltipHover(event, range) {
  const payload = getTooltipPayload(event, range);
  if (!payload) return;

  clearTooltipHideTimer();

  if (state.tooltip.pending?.rangeKey === payload.rangeKey) {
    state.tooltip.pending = payload;
  }

  if (dom.tooltip.style.display === "block" && state.tooltip.rangeKey === payload.rangeKey && !state.tooltip.pinned) {
    placeTooltip(payload.x, payload.y);
  }
}

function initTooltip() {
  dom.tooltip.addEventListener("mouseenter", keepTooltipAlive);
  dom.tooltip.addEventListener("mouseleave", releaseTooltip);
}

function setTreeZoom(nextZoom) {
  const bounded = clamp(nextZoom, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
  if (Math.abs(bounded - state.treeZoom) < 0.001) return;

  scheduleHideTooltip();

  const anchorX = (dom.treeViewport.scrollLeft + dom.treeViewport.clientWidth / 2) / state.treeZoom;
  const anchorY = (dom.treeViewport.scrollTop + dom.treeViewport.clientHeight / 2) / state.treeZoom;

  state.treeZoom = bounded;
  dom.appRoot.style.transform = `scale(${state.treeZoom})`;
  syncTreeCanvasSize();
  updateTreeZoomReadout();

  requestAnimationFrame(() => {
    dom.treeViewport.scrollLeft = Math.max(0, anchorX * state.treeZoom - dom.treeViewport.clientWidth / 2);
    dom.treeViewport.scrollTop = Math.max(0, anchorY * state.treeZoom - dom.treeViewport.clientHeight / 2);
  });
}

function clearSuppressTreeClick() {
  state.suppressTreeClick = false;
  clearTimeout(state.suppressTreeClickTimer);
  state.suppressTreeClickTimer = null;
}

function markSuppressTreeClick() {
  state.suppressTreeClick = true;
  clearTimeout(state.suppressTreeClickTimer);
  state.suppressTreeClickTimer = setTimeout(() => {
    state.suppressTreeClick = false;
    state.suppressTreeClickTimer = null;
  }, 0);
}

function stopTreePan(pointerId) {
  if (!state.treePan.active) return;

  const dragged = state.treePan.dragging;
  state.treePan.active = false;
  state.treePan.dragging = false;
  dom.treeViewport.style.cursor = "grab";
  dom.treeViewport.style.userSelect = "";

  if (
    pointerId !== null &&
    typeof dom.treeViewport.hasPointerCapture === "function" &&
    dom.treeViewport.hasPointerCapture(pointerId)
  ) {
    dom.treeViewport.releasePointerCapture(pointerId);
  }

  if (dragged) {
    markSuppressTreeClick();
  }
}

function initTreeViewport() {
  dom.treeViewport.addEventListener("click", (event) => {
    if (!state.suppressTreeClick) return;
    clearSuppressTreeClick();
    event.preventDefault();
    event.stopPropagation();
  }, true);

  dom.treeViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    state.treePan = createTreePanState({
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: dom.treeViewport.scrollLeft,
      scrollTop: dom.treeViewport.scrollTop
    });
  });

  dom.treeViewport.addEventListener("pointermove", (event) => {
    if (!state.treePan.active || state.treePan.pointerId !== event.pointerId) return;

    const dx = event.clientX - state.treePan.startX;
    const dy = event.clientY - state.treePan.startY;

    if (!state.treePan.dragging) {
      if (Math.abs(dx) + Math.abs(dy) < TREE_PAN_THRESHOLD) return;
      state.treePan.dragging = true;
      dom.treeViewport.style.cursor = "grabbing";
      dom.treeViewport.style.userSelect = "none";
      if (typeof dom.treeViewport.setPointerCapture === "function") {
        dom.treeViewport.setPointerCapture(event.pointerId);
      }
      scheduleHideTooltip();
    }

    dom.treeViewport.scrollLeft = state.treePan.scrollLeft - dx;
    dom.treeViewport.scrollTop = state.treePan.scrollTop - dy;
    event.preventDefault();
  });

  dom.treeViewport.addEventListener("pointerup", (event) => {
    if (!state.treePan.active || state.treePan.pointerId !== event.pointerId) return;
    stopTreePan(event.pointerId);
  });

  dom.treeViewport.addEventListener("pointercancel", (event) => {
    if (!state.treePan.active || state.treePan.pointerId !== event.pointerId) return;
    stopTreePan(event.pointerId);
  });

  dom.treeViewport.addEventListener("lostpointercapture", () => {
    stopTreePan(null);
  });

  dom.treeViewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setTreeZoom(state.treeZoom + (event.deltaY < 0 ? ZOOM_WHEEL_STEP : -ZOOM_WHEEL_STEP));
  }, { passive: false });

  dom.treeZoomOutBtn.addEventListener("click", () => setTreeZoom(state.treeZoom - ZOOM_BUTTON_STEP));
  dom.treeZoomInBtn.addEventListener("click", () => setTreeZoom(state.treeZoom + ZOOM_BUTTON_STEP));
  dom.treeZoomResetBtn.addEventListener("click", () => setTreeZoom(1));
}

function createNodeCard(nodeId) {
  const meta = NODE_INDEX.get(nodeId);
  const node = meta.node;
  const depth = meta.depth;
  const weight = node.weight ?? 0.5;
  const roleInfo = getRoleInfo(meta);
  const vWeight = nodeVisualWeight(nodeId, weight, depth);
  const siblingVisual = nodeSiblingVisual(nodeId);
  const localStrength = depth === 0 ? 0 : siblingVisual.strength;
  const localRank = siblingVisual.normalized;
  const toneVisual = clamp(
    vWeight + localStrength * localRank * 0.18 - localStrength * (1 - localRank) * 0.05,
    0,
    1
  );
  const [py, px] = nodePaddingFromVisual(vWeight, depth);
  const boxWidth = nodeWidthFromVisual(vWeight, depth);
  const boxHeight = nodeHeightFromVisual(vWeight, depth);
  const bodyBg = wBgFromVisual(toneVisual, depth);
  const accentColor = `hsl(31 ${30 + toneVisual * 56 + localStrength * 10}% ${67 - toneVisual * 30 - localStrength * (4 + localRank * 6)}%)`;
  const accentWidth = 3 + vWeight * 11 + localStrength * (2 + localRank * 10);
  const tintBg = `hsl(37 ${38 + toneVisual * 38}% ${96 - toneVisual * 21}%)`;

  const card = createElement("div", "node");
  card.dataset.nodeId = nodeId;

  setStyles(card, {
    background: `linear-gradient(90deg, ${accentColor} 0, ${accentColor} ${accentWidth}px, ${bodyBg} ${accentWidth}px, ${bodyBg} 100%), linear-gradient(150deg, ${tintBg} 0%, rgba(255,255,255,0) 62%)`,
    border: `${1.2 + vWeight * 4.6 + localStrength * (0.3 + localRank * 1.4)}px solid ${wBorderFromVisual(toneVisual)}`,
    color: wTextFromVisual(clamp(vWeight + localStrength * localRank * 0.08, 0, 1), depth),
    boxShadow: `0 4px ${8 + vWeight * 22}px rgba(166, 112, 51, ${0.1 + vWeight * 0.3})`,
    padding: `${py}px ${px}px`,
    fontSize: `${nodeFontFromVisual(vWeight, depth)}px`,
    fontWeight: vWeight > 0.78 ? "700" : vWeight > 0.38 ? "600" : "500",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "0",
    width: `${boxWidth}px`,
    minWidth: `${boxWidth}px`,
    minHeight: `${boxHeight}px`
  });

  if (roleInfo) {
    const marker = createElement("div", "role-marker");
    marker.style.background = roleInfo.color;
    marker.title = `Role: ${roleInfo.label}`;
    card.appendChild(marker);
    state.nodeRoleMarkerMap.set(nodeId, marker);
  }

  const label = createElement("div");
  label.textContent = node.label;
  label.style.lineHeight = "1.45";
  applyLineClamp(label, nodeLabelLines(depth));
  card.appendChild(label);

  card.addEventListener("mouseenter", (event) => scheduleShowTooltip(event, node.range));
  card.addEventListener("mousemove", (event) => updateTooltipHover(event, node.range));
  card.addEventListener("mouseleave", scheduleHideTooltip);
  card.addEventListener("click", () => setSelectedNode(nodeId, true));

  state.nodeDomMap.set(nodeId, card);
  return card;
}

function clearSelectedPathHighlight() {
  state.highlightedConnectorEls.forEach((el) => {
    el.classList.remove("is-on-selected-path");
    if (el.classList.contains("children-rail-path")) {
      el.style.display = "none";
    }
  });
  state.highlightedConnectorEls.length = 0;
  state.highlightedPathNodeEls.forEach((el) => el.classList.remove("is-on-selected-path-node"));
  state.highlightedPathNodeEls.length = 0;
}

function markSelectedPathEl(el) {
  if (!el) return;
  el.classList.add("is-on-selected-path");
  state.highlightedConnectorEls.push(el);
}

function markSelectedPathNode(el) {
  if (!el) return;
  el.classList.add("is-on-selected-path-node");
  state.highlightedPathNodeEls.push(el);
}

function getCenterYWithin(containerEl, targetEl) {
  if (!containerEl || !targetEl) return null;
  const containerRect = containerEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  return (targetRect.top - containerRect.top + targetRect.height / 2) / state.treeZoom;
}

function positionSelectedPathSegment(parentConnectors, childId) {
  if (!parentConnectors) return;

  const children = parentConnectors.children;
  const pathRail = parentConnectors.pathRail;
  const childNodeEl = state.nodeDomMap.get(childId);
  if (!children || !pathRail || !childNodeEl) return;

  const pivotY = parentConnectors.anchorY ?? getCenterYWithin(children, childNodeEl);
  const childCenterY = getCenterYWithin(children, childNodeEl);
  if (pivotY == null || childCenterY == null) return;
  const top = Math.min(pivotY, childCenterY);
  const height = Math.abs(childCenterY - pivotY);

  pathRail.style.top = `${top}px`;
  pathRail.style.height = `${height}px`;
  pathRail.style.display = height > 1 ? "block" : "none";
  markSelectedPathEl(pathRail);
}

function highlightSelectedPath(nodeId) {
  clearSelectedPathHighlight();

  let cursor = NODE_INDEX.get(nodeId) || null;
  while (cursor) {
    markSelectedPathNode(state.nodeDomMap.get(cursor.id));

    if (cursor.parentId === null) {
      break;
    }

    const parentConnectors = state.connectorDomMap.get(cursor.parentId);
    if (parentConnectors) {
      markSelectedPathEl(parentConnectors.stem);
      markSelectedPathEl(parentConnectors.childRows.get(cursor.id));
      positionSelectedPathSegment(parentConnectors, cursor.id);
    }

    cursor = NODE_INDEX.get(cursor.parentId) || null;
  }
}

function syncBranchAnchors() {
  state.connectorDomMap.forEach((connectors, nodeId) => {
    const nodeEl = state.nodeDomMap.get(nodeId);
    const stem = connectors.stem;
    const children = connectors.children;
    const firstChildId = connectors.childRows.keys().next().value || null;

    if (!nodeEl || !stem || !children || !firstChildId) {
      return;
    }

    const firstChildNodeEl = state.nodeDomMap.get(firstChildId);
    const anchorY = getCenterYWithin(children, firstChildNodeEl);
    if (anchorY == null) {
      return;
    }
    const nodeCenterY = nodeEl.offsetHeight / 2;
    const offsetDelta = anchorY - nodeCenterY;
    const nodeOffset = Math.max(0, Math.round(offsetDelta));
    const childrenOffset = Math.max(0, Math.round(-offsetDelta));

    nodeEl.style.marginTop = `${nodeOffset}px`;
    children.style.marginTop = `${childrenOffset}px`;
    stem.style.marginTop = `${Math.round(nodeOffset + nodeCenterY)}px`;
    connectors.anchorY = anchorY;

    connectors.elbows.forEach((elbow, childId) => {
      const row = connectors.childRows.get(childId);
      const childNodeEl = state.nodeDomMap.get(childId);
      const elbowY = row && childNodeEl ? getCenterYWithin(row, childNodeEl) : null;
      if (elbowY != null) {
        elbow.style.top = `${Math.round(elbowY)}px`;
      }
    });
  });
}

function triggerSelectedNodeEnter(el) {
  if (!el) return;
  el.classList.remove("is-selected-entering");
  void el.offsetWidth;
  el.classList.add("is-selected-entering");
  window.setTimeout(() => {
    el.classList.remove("is-selected-entering");
  }, 240);
}

function createLegend() {
  dom.legend.textContent = "";

  const weightLabel = createElement("span", "legend-label");
  weightLabel.textContent = "Weight";
  dom.legend.appendChild(weightLabel);

  WEIGHT_LEGEND_ITEMS.forEach((item) => {
    const unit = createElement("span");
    const dot = createElement("span", "weight-dot");
    dot.style.width = `${8 + Math.pow(item.w, 0.75) * 22}px`;
    dot.style.height = `${8 + Math.pow(item.w, 0.75) * 14}px`;
    dot.style.border = `1px solid ${wBorder(item.w)}`;
    dot.style.background = wBg(item.w);
    unit.appendChild(dot);
    unit.appendChild(document.createTextNode(item.label));
    dom.legend.appendChild(unit);
  });
}

function updateRoleVisualMarks() {
  const hasActiveFilters = state.activeRoleFilters.size > 0;

  state.nodeRoleMarkerMap.forEach((marker, nodeId) => {
    const meta = NODE_INDEX.get(nodeId);
    const visible =
      hasActiveFilters &&
      Boolean(meta?.explicitRole) &&
      state.activeRoleFilters.has(meta.explicitRole);

    marker.classList.toggle("is-visible", visible);
  });
}

function setRoleFilter(role, enabled) {
  if (enabled) {
    state.activeRoleFilters.add(role);
  } else {
    state.activeRoleFilters.delete(role);
  }
  updateRoleVisualMarks();
}

function createRoleFilter(role, roleInfo) {
  const label = createElement("label", "role-filter");

  const checkbox = createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", () => setRoleFilter(role, checkbox.checked));

  const swatch = createElement("span", "role-filter-swatch");
  swatch.style.background = roleInfo.color;

  const text = createElement("span");
  text.textContent = roleInfo.label;

  label.appendChild(checkbox);
  label.appendChild(swatch);
  label.appendChild(text);
  return label;
}

function initRoleFilters() {
  dom.roleFilters.textContent = "";

  if (ROLE_META.size === 0) {
    dom.roleFilters.hidden = true;
    return;
  }

  dom.roleFilters.hidden = false;

  const label = createElement("span", "role-filter-label");
  label.textContent = "Role Visual Marks";
  dom.roleFilters.appendChild(label);

  ROLE_META.forEach((roleInfo, role) => {
    dom.roleFilters.appendChild(createRoleFilter(role, roleInfo));
  });
}

function createDetailParagraph(text, index) {
  const targetNodeId = PARAGRAPH_TO_NODE.get(index) || null;

  const item = createElement("div", "detail-paragraph");
  item.dataset.index = String(index);

  if (targetNodeId) {
    item.classList.add("is-clickable");
    item.addEventListener("click", () => setSelectedNode(targetNodeId, true));
  }

  const paragraph = createElement("p");
  paragraph.textContent = text;
  item.appendChild(paragraph);

  return item;
}

function initDetailBodyWithSource() {
  dom.detailBody.innerHTML = "";
  state.detailParagraphEls.length = 0;

  SOURCE.forEach((text, index) => {
    const item = createDetailParagraph(text, index);
    dom.detailBody.appendChild(item);
    state.detailParagraphEls.push(item);
  });
}

function updateDetailRangeHighlight(range, shouldFocus) {
  state.detailParagraphEls.forEach((el) => el.classList.remove("is-active"));

  if (!isValidRange(range) || state.detailParagraphEls.length === 0) {
    return;
  }

  const start = clamp(range[0], 0, state.detailParagraphEls.length - 1);
  const end = clamp(range[1], 0, state.detailParagraphEls.length - 1);

  for (let index = start; index <= end; index += 1) {
    state.detailParagraphEls[index].classList.add("is-active");
  }

  if (shouldFocus) {
    const target = state.detailParagraphEls[start];
    const top = Math.max(0, target.offsetTop - dom.detailBody.clientHeight * 0.22);
    dom.detailBody.scrollTo({ top, behavior: "smooth" });
  }
}

function renderBranch(nodeId) {
  const meta = NODE_INDEX.get(nodeId);
  const node = meta.node;

  const wrap = createElement("div", "branch");
  wrap.appendChild(createNodeCard(nodeId));

  if (meta.childrenIds.length === 0) {
    return wrap;
  }

  const weight = node.weight ?? 0.5;
  const vWeight = nodeVisualWeight(nodeId, weight, meta.depth);
  const connectorColor = connectorColorFromVisual(vWeight);
  const connectorDom = {
    stem: null,
    rail: null,
    pathRail: null,
    children: null,
    childRows: new Map(),
    elbows: new Map(),
    anchorY: 0
  };

  const stem = createElement("div", "stem");
  stem.style.width = `${18 + vWeight * 16}px`;
  stem.style.borderTop = `${1 + vWeight * 2.7}px solid ${connectorColor}`;
  stem.style.opacity = String(0.42 + vWeight * 0.22);
  connectorDom.stem = stem;
  wrap.appendChild(stem);

  const children = createElement("div", "children");
  connectorDom.children = children;

  const rail = createElement("div", "children-rail children-rail-base");
  rail.style.borderLeft = `${1.2 + vWeight * 3.4}px solid ${connectorColor}`;
  rail.style.opacity = String(0.38 + vWeight * 0.24);
  connectorDom.rail = rail;
  children.appendChild(rail);

  const pathRail = createElement("div", "children-rail children-rail-path");
  pathRail.style.borderLeft = `${1.2 + vWeight * 3.4}px solid ${connectorColor}`;
  connectorDom.pathRail = pathRail;
  children.appendChild(pathRail);

  meta.childrenIds.forEach((childId) => {
    const siblingVisual = nodeSiblingVisual(childId);
    const row = createElement("div", "child-row");
    row.dataset.childId = childId;
    connectorDom.childRows.set(childId, row);
    const elbow = createElement("div", "elbow");
    connectorDom.elbows.set(childId, elbow);
    elbow.style.borderTop = `${1 + siblingVisual.strength * (0.4 + siblingVisual.normalized * 1.4)}px solid ${connectorColor}`;
    elbow.style.opacity = String(0.5 + siblingVisual.strength * 0.35 + siblingVisual.normalized * 0.12);

    row.appendChild(elbow);
    row.appendChild(renderBranch(childId));
    children.appendChild(row);
  });

  state.connectorDomMap.set(nodeId, connectorDom);
  wrap.appendChild(children);
  return wrap;
}

function syncConnectorRails() {
  dom.appRoot.querySelectorAll(".children").forEach((children) => {
    const rail = children.querySelector(":scope > .children-rail-base");
    const rows = children.querySelectorAll(":scope > .child-row");

    if (!rail || rows.length < 2) {
      if (rail) {
        rail.style.display = "none";
      }
      return;
    }

    const firstChildId = rows[0].dataset.childId;
    const lastChildId = rows[rows.length - 1].dataset.childId;
    const firstNodeEl = state.nodeDomMap.get(firstChildId);
    const lastNodeEl = state.nodeDomMap.get(lastChildId);
    const top = getCenterYWithin(children, firstNodeEl);
    const bottom = getCenterYWithin(children, lastNodeEl);
    if (top == null || bottom == null) {
      return;
    }

    rail.style.display = "block";
    rail.style.top = `${top}px`;
    rail.style.height = `${Math.max(0, bottom - top)}px`;
  });
}

function renderSelectedNodeDetail(nodeId, shouldFocus) {
  const meta = NODE_INDEX.get(nodeId);
  if (!meta) return;

  const node = meta.node;
  const range = isValidRange(node.range) ? node.range : [0, 0];
  const [start, end] = range;
  const roleInfo = getRoleInfo(meta);

  dom.detailTitle.textContent = node.label;
  const metaParts = [
    `Depth: ${meta.depth}`,
    `Paragraphs: ${start}–${end}`,
    `Covers: ${rangeSpan(range)} paras`,
    `Weight: ${(node.weight ?? 0).toFixed(2)}`,
    meta.childrenIds.length > 0 ? `Children: ${meta.childrenIds.length}` : "Leaf"
  ];

  if (roleInfo) {
    metaParts.push(`Role: ${roleInfo.label}`);
  }

  dom.detailMeta.innerHTML =
    (roleInfo ? `${roleBadgeHTML(roleInfo)} ` : "") +
    escapeHTML(metaParts.join(" | "));

  updateDetailRangeHighlight(range, shouldFocus);
}

function setSelectedNode(nodeId, shouldScrollIntoView) {
  if (!NODE_INDEX.has(nodeId)) return;
  dom.treeCanvas.classList.toggle("has-selection", nodeId !== ROOT_NODE_ID);

  if (state.selectedNodeId) {
    const previous = state.nodeDomMap.get(state.selectedNodeId);
    if (previous) {
      previous.classList.remove("is-selected");
    }
  }

  state.selectedNodeId = nodeId;

  const selectedEl = state.nodeDomMap.get(nodeId);
  if (selectedEl) {
    selectedEl.classList.add("is-selected");
    triggerSelectedNodeEnter(selectedEl);
    if (shouldScrollIntoView) {
      selectedEl.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }
  }

  highlightSelectedPath(nodeId);
  renderSelectedNodeDetail(nodeId, shouldScrollIntoView);
}

function pickContinuousLevelNode(offset) {
  const current = NODE_INDEX.get(state.selectedNodeId);
  if (!current || !isValidRange(current.node.range)) return null;

  const boundary = offset > 0 ? current.node.range[1] + 1 : current.node.range[0] - 1;
  if (boundary < 0 || boundary >= SOURCE.length) return null;

  let cursor = current;

  while (cursor) {
    const sameLevelNodes = LEVEL_ORDER.get(cursor.depth) || [];
    const nextId = sameLevelNodes[cursor.orderIndex + offset];

    if (nextId) {
      const candidate = NODE_INDEX.get(nextId);
      if (candidate && rangeIncludes(candidate.node.range, boundary)) {
        return nextId;
      }
    }

    if (cursor.parentId === null) break;
    cursor = NODE_INDEX.get(cursor.parentId) || null;
  }

  return null;
}

function handleKeyNavigation(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const activeTag = document.activeElement?.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;

  const key = event.key.toLowerCase();
  if (!["a", "w", "s", "d"].includes(key)) return;

  const current = NODE_INDEX.get(state.selectedNodeId);
  if (!current) return;

  event.preventDefault();

  if (key === "a" && current.parentId !== null) {
    setSelectedNode(current.parentId, true);
    return;
  }

  if (key === "d" && current.childrenIds.length > 0) {
    setSelectedNode(current.childrenIds[0], true);
    return;
  }

  if (key === "w") {
    const previous = pickContinuousLevelNode(-1);
    if (previous) {
      setSelectedNode(previous, true);
    }
    return;
  }

  if (key === "s") {
    const next = pickContinuousLevelNode(1);
    if (next) {
      setSelectedNode(next, true);
    }
  }
}

function handleWindowResize() {
  syncBranchAnchors();
  syncTreeCanvasSize();
  syncConnectorRails();
  if (state.selectedNodeId) {
    highlightSelectedPath(state.selectedNodeId);
  }
}

function initApp() {
  initPageChrome();
  initTooltip();
  createLegend();
  initRoleFilters();
  initDetailBodyWithSource();
  dom.appRoot.appendChild(renderBranch(ROOT_NODE_ID));
  updateRoleVisualMarks();
  syncBranchAnchors();
  syncConnectorRails();
  syncTreeCanvasSize();
  updateTreeZoomReadout();
  setSelectedNode(ROOT_NODE_ID, false);

  window.addEventListener("keydown", handleKeyNavigation);
  window.addEventListener("resize", handleWindowResize);

  initTreeViewport();
}

initApp();
