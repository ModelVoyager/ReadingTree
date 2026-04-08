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
const TREE_VIEWPORT_MIN_HEIGHT = 240;
const DETAIL_PANEL_MIN_HEIGHT = 260;
const TREE_VIEWPORT_BOTTOM_GUTTER = 20;
const STACKED_LAYOUT_BREAKPOINT = 980;
const TOOLTIP_SHOW_DELAY_MS = 1000;
const TOOLTIP_HIDE_DELAY_MS = 180;
const SEARCH_INPUT_DEBOUNCE_MS = 90;
const SUGGESTION_LIMIT = 8;
const ROLE_LABEL_OVERRIDES = {
  qa: "Q&A"
};

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

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeRoleSlug(value) {
  return normalizeWhitespace(value)
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDisplayText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ");
}

function foldForMatch(value) {
  return normalizeDisplayText(value).toLocaleLowerCase();
}

function formatRoleLabel(roleSlug) {
  if (ROLE_LABEL_OVERRIDES[roleSlug]) {
    return ROLE_LABEL_OVERRIDES[roleSlug];
  }
  return roleSlug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeRolesFromNode(node) {
  const rawRoles = Array.isArray(node?.roles) ? node.roles : [];
  const seen = new Set();
  const roles = [];
  rawRoles.forEach((rawRole) => {
    if (typeof rawRole !== "string") return;
    const slug = normalizeRoleSlug(rawRole);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    roles.push(slug);
  });
  return roles;
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

function compareOrderKey(a, b) {
  const limit = Math.max(a.length, b.length);
  for (let index = 0; index < limit; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

function mergeSpans(spans) {
  if (!Array.isArray(spans) || spans.length === 0) return [];
  const sorted = spans
    .filter((span) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.end > span.start)
    .sort((a, b) => (a.start - b.start) || (b.end - a.end));
  if (sorted.length === 0) return [];

  const merged = [{ ...sorted[0] }];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current.start <= previous.end && current.className === previous.className) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }
    if (current.start < previous.end) {
      const clipped = { ...current, start: previous.end };
      if (clipped.end > clipped.start) {
        merged.push(clipped);
      }
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
}

function renderMarkedHTML(text, spans) {
  if (!Array.isArray(spans) || spans.length === 0) {
    return escapeHTML(text);
  }

  const merged = mergeSpans(spans);
  let cursor = 0;
  let html = "";

  merged.forEach((span) => {
    const start = clamp(span.start, 0, text.length);
    const end = clamp(span.end, start, text.length);
    if (start > cursor) {
      html += escapeHTML(text.slice(cursor, start));
    }
    html += `<mark class="${escapeHTML(span.className || "search-inline")}">${escapeHTML(text.slice(start, end))}</mark>`;
    cursor = end;
  });

  if (cursor < text.length) {
    html += escapeHTML(text.slice(cursor));
  }

  return html;
}

function findLiteralSpans(text, query) {
  const needle = foldForMatch(query).trim();
  if (!needle) return [];

  const haystack = foldForMatch(text);
  const spans = [];
  let cursor = 0;

  while (cursor < haystack.length) {
    const foundAt = haystack.indexOf(needle, cursor);
    if (foundAt === -1) break;
    spans.push({ start: foundAt, end: foundAt + needle.length, className: "search-inline" });
    cursor = foundAt + Math.max(1, needle.length);
  }

  return spans;
}

function buildSnippet(text, query, radius = 44) {
  const spans = findLiteralSpans(text, query);
  if (spans.length === 0) {
    return { text: text.slice(0, radius * 2), spans: [] };
  }
  const first = spans[0];
  const start = Math.max(0, first.start - radius);
  const end = Math.min(text.length, first.end + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return {
    text: `${prefix}${text.slice(start, end)}${suffix}`,
    spans: spans.map((span) => ({
      start: span.start - start + prefix.length,
      end: span.end - start + prefix.length,
      className: span.className
    }))
  };
}

function buildSnippetFromSpans(text, rawSpans, radius = 44) {
  const spans = mergeSpans(rawSpans);
  if (spans.length === 0) {
    return { text: text.slice(0, radius * 2), spans: [] };
  }

  const first = spans[0];
  const start = Math.max(0, first.start - radius);
  const end = Math.min(text.length, first.end + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return {
    text: `${prefix}${text.slice(start, end)}${suffix}`,
    spans: spans
      .filter((span) => span.end > start && span.start < end)
      .map((span) => ({
        start: Math.max(span.start, start) - start + prefix.length,
        end: Math.min(span.end, end) - start + prefix.length,
        className: span.className
      }))
  };
}

const SEARCH_REGEX_LITERAL_RE = /^\/(?:\\.|[^/])+\/[a-z]*$/;
const SEARCH_REGEX_META_RE = /[\\^$.*+?()[\]{}|]/;
const SEARCH_REGEX_FLAG_CHARS = new Set(["i", "m", "s", "u", "g", "y"]);

function normalizeSearchRegexFlags(rawFlags, options = {}) {
  const { global = false } = options;
  const seen = new Set();
  let normalized = "";

  for (const flag of String(rawFlags || "")) {
    if (!SEARCH_REGEX_FLAG_CHARS.has(flag)) {
      throw new Error(`unsupported regex flag '${flag}'`);
    }
    if (flag === "g" || flag === "y") {
      continue;
    }
    if (seen.has(flag)) {
      continue;
    }
    seen.add(flag);
    normalized += flag;
  }

  if (global) {
    normalized += "g";
  }

  return normalized;
}

function parseSearchPattern(patternText) {
  const raw = String(patternText || "");
  const usesRegexSyntax = SEARCH_REGEX_META_RE.test(raw);

  if (!raw) {
    return {
      source: raw,
      flags: "",
      usesRegexSyntax,
      error: "empty regex pattern"
    };
  }

  if (SEARCH_REGEX_LITERAL_RE.test(raw)) {
    return {
      source: raw,
      flags: "",
      usesRegexSyntax: true,
      error: "slash-delimited regex literals are not supported; enter the regex directly and quote multi-word search"
    };
  }

  try {
    const flags = normalizeSearchRegexFlags("iu");
    new RegExp(raw, flags);
    return {
      source: raw,
      flags,
      usesRegexSyntax,
      error: null
    };
  } catch (error) {
    return {
      source: raw,
      flags: "",
      usesRegexSyntax: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function findRegexSpans(text, patternSpec) {
  if (!patternSpec || patternSpec.error || !patternSpec.source) return [];

  const haystack = normalizeDisplayText(text);
  let regex;
  try {
    regex = new RegExp(patternSpec.source, normalizeSearchRegexFlags(patternSpec.flags, { global: true }));
  } catch {
    return [];
  }

  const spans = [];
  let match;
  while ((match = regex.exec(haystack))) {
    const matchedText = String(match[0] || "");
    if (!matchedText) {
      regex.lastIndex += 1;
      continue;
    }
    spans.push({
      start: match.index,
      end: match.index + matchedText.length,
      className: "search-inline"
    });
  }
  return spans;
}

function findClauseSpans(text, clause) {
  if (!clause || clause.kind === "role") return [];
  return findRegexSpans(text, clause.pattern);
}

function getTokenRanges(text) {
  const tokens = [];
  const regex = /[A-Za-z]+:"[^"]*"|"[^"]*"|\S+/g;
  let match;
  while ((match = regex.exec(text))) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      value: match[0]
    });
  }
  return tokens;
}

function getActiveTokenRange(text, cursor) {
  const tokens = getTokenRanges(text);
  for (const token of tokens) {
    if (cursor >= token.start && cursor <= token.end) {
      return token;
    }
  }
  return { start: cursor, end: cursor, value: "" };
}

function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function buildFieldQueryToken(fieldName, rawValue) {
  const value = normalizeWhitespace(rawValue);
  if (!value) return `${fieldName}:`;
  return `${fieldName}:${quoteIfNeeded(value)}`;
}

function stripOuterQuotes(value) {
  return value.replace(/^"|"$/g, "");
}

function splitFieldPrefix(rawToken) {
  const match = String(rawToken || "").match(/^([A-Za-z]+):(.*)$/i);
  if (!match) return { field: null, value: rawToken };
  const field = match[1].toLocaleLowerCase();
  if (field !== "role") {
    return { field: null, value: match[2] };
  }
  return {
    field,
    value: match[2]
  };
}

function formatClauseText(clause) {
  const base = quoteIfNeeded(clause.text);
  return clause.field ? `${clause.field}:${base}` : base;
}

function parseQueryGroups(rawInput) {
  const groups = [];
  let currentGroup = [];

  getTokenRanges(rawInput).forEach((token, index) => {
    const rawToken = token.value;
    if (rawToken === "OR") {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      return;
    }
    if (rawToken === "AND") {
      return;
    }

    const { field, value } = splitFieldPrefix(rawToken);
    const text = normalizeWhitespace(stripOuterQuotes(value));
    if (!text) return;
    const pattern = field === "role" ? null : parseSearchPattern(text);
    currentGroup.push({
      id: `${index}:${text}`,
      kind: field || "pattern",
      field,
      text,
      normalized: field === "role" ? foldForMatch(text) : text,
      pattern
    });
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function flattenQueryGroups(groups) {
  return groups.flat();
}

function invalidSearchClauses() {
  return flattenQueryGroups(state.search.queryGroups).filter((clause) => clause?.pattern?.error);
}

function reasonLabel(reason) {
  if (reason === "role") return "Role match";
  if (reason === "outline") return "Outline match";
  if (reason === "text") return "Text match";
  return "Match";
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

function wBorderFromVisual(v) {
  return `hsl(30 ${28 + v * 58}% ${72 - v * 36}%)`;
}

function wBgFromVisual(v, depth) {
  const sat = 40 + v * 38;
  const base = depth === 0 ? 94 : depth === 1 ? 95 : 97;
  const light = base - v * (depth === 0 ? 23 : 21);
  return `hsl(36 ${sat}% ${light}%)`;
}

function nodePaddingFromVisual(v, depth) {
  if (depth === 0) return [14 + v * 3, 24 + v * 8];
  return [8 + v * 3, 11 + v * 12];
}

function nodeFontFromVisual(v, depth) {
  const base = depth === 0 ? 18.4 : depth === 1 ? 13.6 : depth === 2 ? 12.1 : 11.5;
  return base + v * (depth === 0 ? 5.6 : depth === 1 ? 3.0 : depth === 2 ? 1.8 : 1.4);
}

function nodeHeightFromVisual(v, depth) {
  const emphasis = Math.pow(v, 0.82);
  const base = depth === 0 ? 96 : depth === 1 ? 54 : depth === 2 ? 44 : 34;
  const gain = depth === 0 ? 80 : depth === 1 ? 76 : depth === 2 ? 68 : 58;
  return Math.round(base + emphasis * gain);
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

function buildTreeMeta(rootNode, paragraphCount) {
  const nodes = new Map();
  const levelOrder = new Map();
  const pathLabels = new Map();
  const paragraphCandidates = Array.from({ length: paragraphCount }, () => []);

  function registerParagraphCandidate(id, depth, range) {
    if (!isValidRange(range) || paragraphCount === 0) return;

    const candidate = { id, depth, span: rangeSpan(range) };
    const start = Math.max(0, range[0]);
    const end = Math.min(paragraphCount - 1, range[1]);

    for (let idx = start; idx <= end; idx += 1) {
      paragraphCandidates[idx].push(candidate);
    }
  }

  function walk(node, parentId, depth, siblingIndex, parentPathParts) {
    const id = parentId === null ? "0" : `${parentId}.${siblingIndex}`;
    const children = Array.isArray(node.children) ? node.children : [];
    const idsAtDepth = getOrCreateList(levelOrder, depth);
    const roles = normalizeRolesFromNode(node);
    const meta = {
      id,
      node,
      parentId,
      depth,
      orderIndex: idsAtDepth.length,
      childrenIds: [],
      roles,
      primaryRole: roles[0] || ""
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
  const paragraphCandidatesByIndex = new Map();

  paragraphCandidates.forEach((candidates, index) => {
    candidates.sort((a, b) => {
      if (b.depth !== a.depth) return b.depth - a.depth;
      if (a.span !== b.span) return a.span - b.span;
      return a.id.localeCompare(b.id);
    });
    paragraphCandidatesByIndex.set(index, candidates.map((candidate) => candidate.id));
    if (candidates[0]) {
      paragraphToNode.set(index, candidates[0].id);
    }
  });

  return { nodes, rootId, levelOrder, pathLabels, paragraphToNode, paragraphCandidatesByIndex };
}

function buildRoleMeta(nodes) {
  const roles = [...new Set(
    [...nodes.values()]
      .flatMap((meta) => meta.roles)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const roleMeta = new Map();
  roles.forEach((role, index) => {
    const nodeCount = [...nodes.values()].filter((meta) => meta.roles.includes(role)).length;
    roleMeta.set(role, {
      key: role,
      label: formatRoleLabel(role),
      color: roleColorAt(index),
      nodeCount
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
  searchShell: getRequiredElement("search-shell"),
  searchInput: getRequiredElement("search-input"),
  searchSuggestions: getRequiredElement("search-suggestions"),
  searchCount: getRequiredElement("search-count"),
  searchSummary: getRequiredElement("search-summary"),
  searchPrevBtn: getRequiredElement("search-prev"),
  searchNextBtn: getRequiredElement("search-next"),
  searchClearBtn: getRequiredElement("search-clear"),
  detailPanel: getRequiredElement("detail-panel"),
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
const PARAGRAPH_CANDIDATES = treeMeta.paragraphCandidatesByIndex;
const ROLE_META = buildRoleMeta(NODE_INDEX);
const WEIGHT_DOMAINS = buildWeightDomains(NODE_INDEX);
const NODE_VISUAL_WEIGHTS = buildNodeVisualWeights(NODE_INDEX, ROOT_NODE_ID);
const NODE_SIBLING_VISUALS = buildSiblingVisualProfiles(NODE_INDEX);
const NODE_LIST = [...NODE_INDEX.values()].sort((a, b) => {
  const left = a.node?.range?.[0] ?? 0;
  const right = b.node?.range?.[0] ?? 0;
  return left - right || a.depth - b.depth || a.id.localeCompare(b.id);
});

const state = {
  selectedNodeId: "",
  nodeDomMap: new Map(),
  nodeLabelDomMap: new Map(),
  connectorDomMap: new Map(),
  highlightedConnectorEls: [],
  highlightedPathNodeEls: [],
  detailParagraphEls: [],
  detailParagraphTextEls: [],
  detailParagraphReasonEls: [],
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
  suppressTreeClickTimer: null,
  searchDebounceTimer: null,
  search: {
    rawInput: "",
    queryGroups: [],
    suggestions: [],
    suggestionsOpen: false,
    activeSuggestionIndex: -1,
    results: [],
    focusedResultIndex: -1,
    nodeMatches: new Map(),
    paragraphMatches: new Map()
  }
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

function getRoleInfo(roleKey) {
  return ROLE_META.get(roleKey) || null;
}

function roleMatchesClause(roleKey, clause) {
  const roleInfo = getRoleInfo(roleKey);
  const haystacks = [roleKey, roleInfo?.label || ""].map((value) => foldForMatch(value));
  return haystacks.some((haystack) => haystack.includes(clause.normalized));
}

function getRoleInfos(meta) {
  return (meta?.roles || [])
    .map((roleKey) => getRoleInfo(roleKey))
    .filter(Boolean);
}

function isRoleActive(roleKey) {
  const roleInfo = getRoleInfo(roleKey);
  const haystacks = [roleKey, roleInfo?.label || ""].map((value) => foldForMatch(value)).filter(Boolean);
  return flattenQueryGroups(state.search.queryGroups).some((clause) => {
    if (clause.kind === "role") {
      return roleMatchesClause(roleKey, clause);
    }
    return haystacks.includes(clause.normalized);
  });
}

function roleBadgeHTML(roleKey, interactive = true) {
  const roleInfo = getRoleInfo(roleKey);
  if (!roleInfo) return "";
  const className = [
    "role-badge",
    interactive ? "is-clickable" : "",
    isRoleActive(roleKey) ? "is-active" : ""
  ].filter(Boolean).join(" ");
  if (interactive) {
    return `<button type="button" class="${className}" data-role="${escapeHTML(roleKey)}" style="--role-color: ${roleInfo.color}">${escapeHTML(roleInfo.label)}</button>`;
  }
  return `<span class="${className}" style="--role-color: ${roleInfo.color}">${escapeHTML(roleInfo.label)}</span>`;
}

function roleBadgeGroupHTML(roleKeys, interactive = true, extraClassName = "") {
  if (!Array.isArray(roleKeys) || roleKeys.length === 0) return "";
  const className = ["role-badge-row", extraClassName].filter(Boolean).join(" ");
  return `<div class="${className}">${roleKeys.map((roleKey) => roleBadgeHTML(roleKey, interactive)).join("")}</div>`;
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

function syncTreeViewportHeight() {
  if (window.innerWidth <= STACKED_LAYOUT_BREAKPOINT) {
    dom.treeViewport.style.maxHeight = "";
    dom.detailPanel.style.maxHeight = "";
    return;
  }

  const syncPanelHeight = (panelEl, minHeight) => {
    const rect = panelEl.getBoundingClientRect();
    const available = clamp(
      Math.floor(window.innerHeight - Math.max(rect.top, 0) - TREE_VIEWPORT_BOTTOM_GUTTER),
      minHeight,
      Math.max(minHeight, window.innerHeight - TREE_VIEWPORT_BOTTOM_GUTTER)
    );
    panelEl.style.maxHeight = `${available}px`;
  };

  syncPanelHeight(dom.treeViewport, TREE_VIEWPORT_MIN_HEIGHT);
  syncPanelHeight(dom.detailPanel, DETAIL_PANEL_MIN_HEIGHT);
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
  const childCount = meta?.childrenIds?.length ?? 0;
  const paragraphs = textList.map((text) => `<p>${escapeHTML(text)}</p>`).join("");

  dom.tooltip.innerHTML =
    `<div class="meta node-meta">` +
      `<div class="node-copy">` +
        `<div class="node-kicker">Node</div>` +
        `<div class="node-title">${escapeHTML(title)}</div>` +
        roleBadgeGroupHTML(meta?.roles || []) +
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
  dom.tooltip.addEventListener("click", (event) => {
    const roleBadge = event.target.closest("[data-role]");
    if (!roleBadge) return;
    event.preventDefault();
    const roleInfo = getRoleInfo(roleBadge.dataset.role);
    appendSearchTerm(roleInfo?.label || formatRoleLabel(roleBadge.dataset.role), { prefix: "role" });
  });
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

  const label = createElement("div", "node-label");
  label.dataset.nodeId = nodeId;
  label.textContent = node.label;
  label.style.lineHeight = "1.45";
  applyLineClamp(label, nodeLabelLines(depth));
  card.appendChild(label);

  card.addEventListener("mouseenter", (event) => scheduleShowTooltip(event, node.range));
  card.addEventListener("mousemove", (event) => updateTooltipHover(event, node.range));
  card.addEventListener("mouseleave", scheduleHideTooltip);
  card.addEventListener("click", () => setSelectedNode(nodeId, true));

  state.nodeDomMap.set(nodeId, card);
  state.nodeLabelDomMap.set(nodeId, label);
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

function centerElementInScrollContainer(containerEl, targetEl, behavior = "smooth") {
  if (!containerEl || !targetEl) return;

  const contentRootEl = dom.appRoot;
  if (!contentRootEl) return;

  const rootRect = contentRootEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const targetLeft = (targetRect.left - rootRect.left) + targetRect.width / 2 - containerEl.clientWidth / 2;
  const targetTop = (targetRect.top - rootRect.top) + targetRect.height / 2 - containerEl.clientHeight / 2;
  const maxLeft = Math.max(0, containerEl.scrollWidth - containerEl.clientWidth);
  const maxTop = Math.max(0, containerEl.scrollHeight - containerEl.clientHeight);

  containerEl.scrollTo({
    left: clamp(targetLeft, 0, maxLeft),
    top: clamp(targetTop, 0, maxTop),
    behavior
  });
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
    dot.style.border = `1px solid ${wBorderFromVisual(item.w)}`;
    dot.style.background = wBgFromVisual(item.w, 1);
    unit.appendChild(dot);
    unit.appendChild(document.createTextNode(item.label));
    dom.legend.appendChild(unit);
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

  const reasons = createElement("div", "detail-paragraph-reasons");
  const paragraph = createElement("p", "detail-paragraph-text");
  paragraph.textContent = text;

  item.appendChild(reasons);
  item.appendChild(paragraph);

  return { item, reasons, paragraph };
}

function initDetailBodyWithSource() {
  dom.detailBody.innerHTML = "";
  state.detailParagraphEls.length = 0;
  state.detailParagraphTextEls.length = 0;
  state.detailParagraphReasonEls.length = 0;

  SOURCE.forEach((text, index) => {
    const detail = createDetailParagraph(text, index);
    dom.detailBody.appendChild(detail.item);
    state.detailParagraphEls.push(detail.item);
    state.detailParagraphTextEls.push(detail.paragraph);
    state.detailParagraphReasonEls.push(detail.reasons);
  });
}

function scrollDetailParagraphIntoView(paragraphEl, behavior = "smooth") {
  if (!paragraphEl) return;

  const maxTop = Math.max(0, dom.detailBody.scrollHeight - dom.detailBody.clientHeight);
  const bodyRect = dom.detailBody.getBoundingClientRect();
  const paragraphRect = paragraphEl.getBoundingClientRect();
  const topWithinBody = dom.detailBody.scrollTop + (paragraphRect.top - bodyRect.top);
  const top = clamp(topWithinBody, 0, maxTop);
  dom.detailBody.scrollTo({ top, behavior });
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
    scrollDetailParagraphIntoView(target);
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

  dom.detailTitle.textContent = node.label;
  const metaParts = [
    `Depth: ${meta.depth}`,
    `Paragraphs: ${start}–${end}`,
    `Covers: ${rangeSpan(range)} paras`,
    `Weight: ${(node.weight ?? 0).toFixed(2)}`,
    meta.childrenIds.length > 0 ? `Children: ${meta.childrenIds.length}` : "Leaf"
  ];

  dom.detailMeta.innerHTML =
    roleBadgeGroupHTML(meta.roles) +
    `<div class="detail-meta-copy">${escapeHTML(metaParts.join(" | "))}</div>`;

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
      centerElementInScrollContainer(dom.treeViewport, selectedEl, "smooth");
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

function pickSupportingNodeForParagraph(paragraphIndex) {
  const candidateIds = PARAGRAPH_CANDIDATES.get(paragraphIndex) || [];
  return candidateIds[0] || null;
}

function ensureParagraphMatch(index) {
  const existing = state.search.paragraphMatches.get(index);
  if (existing) return existing;
  const created = {
    spans: [],
    reasons: new Set(),
    nodeIds: new Set()
  };
  state.search.paragraphMatches.set(index, created);
  return created;
}

function ensureNodeMatch(nodeId) {
  const existing = state.search.nodeMatches.get(nodeId);
  if (existing) return existing;
  const created = {
    labelSpans: [],
    reasons: new Set(),
    supportParagraphs: new Set()
  };
  state.search.nodeMatches.set(nodeId, created);
  return created;
}

function applyNodeRangeReason(nodeId, reason) {
  const meta = NODE_INDEX.get(nodeId);
  if (!meta || !isValidRange(meta.node.range)) return;
  for (let index = meta.node.range[0]; index <= meta.node.range[1]; index += 1) {
    const paragraphMatch = ensureParagraphMatch(index);
    paragraphMatch.reasons.add(reason);
    paragraphMatch.nodeIds.add(nodeId);
  }
}

function applyExactSearch() {
  const { queryGroups } = state.search;
  if (queryGroups.length === 0) return;

  NODE_LIST.forEach((meta) => {
    const labelSpans = [];
    const reasons = new Set();
    let isDirectMatch = false;

    queryGroups.forEach((group) => {
      const groupLabelSpans = [];
      const groupReasons = new Set();
      const groupSatisfied = group.every((clause) => {
        const clauseAllowsOutline = clause.kind !== "role";
        const clauseLabelSpans = clauseAllowsOutline ? findClauseSpans(meta.node.label, clause) : [];
        const clauseRoleMatched = meta.roles.some((roleKey) => roleMatchesClause(roleKey, clause));
        if (clauseLabelSpans.length > 0) {
          groupLabelSpans.push(...clauseLabelSpans);
          groupReasons.add("outline");
        }
        if (clauseRoleMatched) {
          groupReasons.add("role");
        }
        return clauseLabelSpans.length > 0 || clauseRoleMatched;
      });

      if (!groupSatisfied) return;
      isDirectMatch = true;
      labelSpans.push(...groupLabelSpans);
      groupReasons.forEach((reason) => reasons.add(reason));
    });

    if (!isDirectMatch) return;

    const match = ensureNodeMatch(meta.id);
    reasons.forEach((reason) => match.reasons.add(reason));
    match.labelSpans.push(...labelSpans);

    if (reasons.has("outline")) {
      applyNodeRangeReason(meta.id, "outline");
    } else if (reasons.has("role")) {
      applyNodeRangeReason(meta.id, "role");
    }

    state.search.results.push({
      id: `node:${meta.id}`,
      kind: "node",
      nodeId: meta.id,
      paragraphIndex: isValidRange(meta.node.range) ? meta.node.range[0] : null,
      orderKey: [meta.node.range?.[0] ?? 10 ** 6, 1, meta.depth],
      reason: reasons.has("outline") ? "outline" : "role"
    });
  });

  SOURCE.forEach((text, index) => {
    const supportingNodeId = pickSupportingNodeForParagraph(index);
    if (!supportingNodeId) return;
    const supportingMeta = NODE_INDEX.get(supportingNodeId);
    const allSpans = [];
    const paragraphReasons = new Set();
    let matchedAnyGroup = false;

    queryGroups.forEach((group) => {
      const groupSpans = [];
      const groupReasons = new Set();
      const groupSatisfied = group.every((clause) => {
        const clauseAllowsText = clause.kind !== "role";
        const clauseTextSpans = clauseAllowsText ? findClauseSpans(text, clause) : [];
        const clauseRoleMatched = (supportingMeta?.roles || []).some((roleKey) => roleMatchesClause(roleKey, clause));

        if (clauseTextSpans.length > 0) {
          groupSpans.push(...clauseTextSpans);
          groupReasons.add("text");
        }
        if (clauseRoleMatched) {
          groupReasons.add("role");
        }

        return clauseTextSpans.length > 0 || clauseRoleMatched;
      });

      if (!groupSatisfied) return;
      matchedAnyGroup = true;
      allSpans.push(...groupSpans);
      groupReasons.forEach((reason) => paragraphReasons.add(reason));
    });

    if (!matchedAnyGroup) return;

    const paragraphMatch = ensureParagraphMatch(index);
    paragraphMatch.spans.push(...allSpans);
    paragraphReasons.forEach((reason) => paragraphMatch.reasons.add(reason));
    paragraphMatch.nodeIds.add(supportingNodeId);

    const nodeMatch = ensureNodeMatch(supportingNodeId);
    if (paragraphReasons.has("text")) {
      nodeMatch.reasons.add("text");
    }
    if (paragraphReasons.has("role") && !paragraphReasons.has("text")) {
      nodeMatch.reasons.add("role");
    }
    nodeMatch.supportParagraphs.add(index);

    state.search.results.push({
      id: `paragraph:${index}`,
      kind: "paragraph",
      nodeId: supportingNodeId,
      paragraphIndex: index,
      orderKey: [index, 0, 0],
      reason: paragraphReasons.has("text") ? "text" : "role"
    });
  });
}

function searchReasonRank(reason) {
  if (reason === "text") return 0;
  if (reason === "outline") return 1;
  if (reason === "role") return 2;
  return 9;
}

function collapseSearchResultsByNode() {
  const grouped = new Map();

  state.search.results.forEach((result) => {
    const key = result.nodeId || result.id;
    const existing = grouped.get(key) || {
      id: result.nodeId ? `node:${result.nodeId}` : result.id,
      nodeId: result.nodeId,
      paragraphIndices: [],
      reasons: new Set()
    };

    if (Number.isInteger(result.paragraphIndex)) {
      existing.paragraphIndices.push(result.paragraphIndex);
    }
    if (result.reason) {
      existing.reasons.add(result.reason);
    }
    grouped.set(key, existing);
  });

  state.search.results = [...grouped.values()].map((group) => {
    const meta = group.nodeId ? NODE_INDEX.get(group.nodeId) : null;
    const nodeMatch = group.nodeId ? state.search.nodeMatches.get(group.nodeId) : null;
    const supportParagraphs = nodeMatch ? [...nodeMatch.supportParagraphs].sort((a, b) => a - b) : [];
    const paragraphIndices = [...new Set(group.paragraphIndices)].sort((a, b) => a - b);
    const paragraphIndex =
      supportParagraphs[0] ??
      paragraphIndices[0] ??
      (isValidRange(meta?.node?.range) ? meta.node.range[0] : null);
    const reasons = [...group.reasons].sort((left, right) => searchReasonRank(left) - searchReasonRank(right));

    return {
      id: group.id,
      kind: "node",
      nodeId: group.nodeId,
      paragraphIndex,
      orderKey: [
        paragraphIndex ?? meta?.node?.range?.[0] ?? 10 ** 6,
        meta?.depth ?? 0,
        meta?.orderIndex ?? 0
      ],
      reason: reasons[0] || "text"
    };
  });
}

function computeSearchResults() {
  state.search.nodeMatches = new Map();
  state.search.paragraphMatches = new Map();
  state.search.results = [];
  state.search.focusedResultIndex = -1;

  const hasSearch = state.search.queryGroups.length > 0;
  if (!hasSearch) {
    renderSearchState();
    return;
  }

  if (invalidSearchClauses().length > 0) {
    renderSearchState();
    return;
  }

  applyExactSearch();
  collapseSearchResultsByNode();
  state.search.results.sort((a, b) => compareOrderKey(a.orderKey, b.orderKey) || a.id.localeCompare(b.id));
  renderSearchState();
}

function renderParagraphMatch(index, paragraphMatch, isFocused) {
  const item = state.detailParagraphEls[index];
  const paragraphEl = state.detailParagraphTextEls[index];
  const reasonEl = state.detailParagraphReasonEls[index];
  const text = SOURCE[index];
  const spans = mergeSpans(paragraphMatch ? paragraphMatch.spans : []);
  const reasons = paragraphMatch ? [...paragraphMatch.reasons] : [];

  item.classList.toggle("is-search-match", Boolean(paragraphMatch));
  item.classList.toggle("is-search-focused", isFocused);
  item.classList.toggle("has-search-spans", spans.length > 0);
  item.classList.toggle("has-search-reasons", reasons.length > 0);

  paragraphEl.innerHTML = spans.length > 0 ? renderMarkedHTML(text, spans) : escapeHTML(text);
  reasonEl.innerHTML = reasons.map((reason) => `<span class="reason-pill">${escapeHTML(reasonLabel(reason))}</span>`).join("");
}

function renderNodeMatch(nodeId, nodeMatch, isFocused) {
  const meta = NODE_INDEX.get(nodeId);
  const card = state.nodeDomMap.get(nodeId);
  const label = state.nodeLabelDomMap.get(nodeId);
  if (!meta || !card || !label) return;

  const reasons = nodeMatch ? [...nodeMatch.reasons] : [];
  const mergedSpans = mergeSpans(nodeMatch ? nodeMatch.labelSpans : []);

  card.classList.toggle("is-search-match", Boolean(nodeMatch));
  card.classList.toggle("is-search-direct", reasons.some((reason) => ["outline", "role"].includes(reason)));
  card.classList.toggle("is-search-support", reasons.includes("text"));
  card.classList.toggle("is-search-focused", isFocused);
  card.classList.toggle("is-search-role-only", reasons.length > 0 && reasons.every((reason) => reason === "role"));
  label.innerHTML = mergedSpans.length > 0 ? renderMarkedHTML(meta.node.label, mergedSpans) : escapeHTML(meta.node.label);
}

function renderSearchSummary() {
  if (state.search.queryGroups.length === 0) {
    dom.searchSummary.hidden = false;
    dom.searchSummary.textContent = 'Examples: ^Introduction, "public speaking", truth|attention, role:example AND freedom';
    return;
  }

  const invalidClause = invalidSearchClauses()[0];
  if (invalidClause) {
    dom.searchSummary.hidden = false;
    dom.searchSummary.textContent = `Invalid regex in ${formatClauseText(invalidClause)}: ${invalidClause.pattern.error}.`;
    return;
  }

  dom.searchSummary.hidden = true;
  dom.searchSummary.textContent = "";
}

function updateSearchCount() {
  if (invalidSearchClauses().length > 0) {
    dom.searchCount.textContent = "Invalid regex";
    return;
  }
  const total = state.search.results.length;
  if (state.search.focusedResultIndex >= 0 && total > 0) {
    dom.searchCount.textContent = `${state.search.focusedResultIndex + 1} / ${total} matches`;
    return;
  }
  dom.searchCount.textContent = `${total} match${total === 1 ? "" : "es"}`;
}

function renderSearchState() {
  state.detailParagraphEls.forEach((_, index) => {
    renderParagraphMatch(index, state.search.paragraphMatches.get(index), state.search.focusedResultIndex >= 0 && state.search.results[state.search.focusedResultIndex]?.paragraphIndex === index);
  });

  state.nodeDomMap.forEach((_, nodeId) => {
    renderNodeMatch(nodeId, state.search.nodeMatches.get(nodeId), state.search.focusedResultIndex >= 0 && state.search.results[state.search.focusedResultIndex]?.nodeId === nodeId);
  });

  renderSearchSummary();
  updateSearchCount();
  dom.searchPrevBtn.disabled = state.search.results.length === 0;
  dom.searchNextBtn.disabled = state.search.results.length === 0;
}

function setFocusedSearchResult(index) {
  state.search.focusedResultIndex = index;
  renderSearchState();
}

function focusSearchResult(index, shouldScroll = true) {
  if (!state.search.results[index]) return;
  state.search.focusedResultIndex = index;
  const result = state.search.results[index];

  if (result.nodeId) {
    setSelectedNode(result.nodeId, shouldScroll);
  }

  if (shouldScroll && Number.isInteger(result.paragraphIndex)) {
    const paragraphEl = state.detailParagraphEls[result.paragraphIndex];
    if (paragraphEl) {
      scrollDetailParagraphIntoView(paragraphEl);
    }
  }

  renderSearchState();
}

function focusRelativeSearchResult(offset) {
  if (state.search.results.length === 0) return;
  if (state.search.focusedResultIndex < 0) {
    focusSearchResult(offset > 0 ? 0 : state.search.results.length - 1);
    return;
  }
  const nextIndex = (state.search.focusedResultIndex + offset + state.search.results.length) % state.search.results.length;
  focusSearchResult(nextIndex);
}

function appendSearchTerm(rawValue, options = {}) {
  const { prefix = null } = options;
  const value = normalizeWhitespace(rawValue);
  if (!value) return;

  const existingClauses = flattenQueryGroups(parseQueryGroups(dom.searchInput.value));
  const valueNormalized = foldForMatch(value);
  const alreadyPresent = existingClauses.some((clause) => clause.normalized === valueNormalized && (clause.field || null) === prefix);
  const renderedTerm = prefix ? `${prefix}:${quoteIfNeeded(value)}` : quoteIfNeeded(value);
  const nextValue = alreadyPresent
    ? dom.searchInput.value
    : normalizeWhitespace(dom.searchInput.value)
      ? `${normalizeWhitespace(dom.searchInput.value)} AND ${renderedTerm}`
      : renderedTerm;

  dom.searchInput.value = nextValue;
  state.search.rawInput = nextValue;
  dom.searchInput.focus();
  const cursor = dom.searchInput.value.length;
  dom.searchInput.setSelectionRange(cursor, cursor);
  runSearchFromInput(true);
}

function replaceActiveToken(value, options = {}) {
  const { raw = false } = options;
  const cursor = dom.searchInput.selectionStart ?? dom.searchInput.value.length;
  const range = getActiveTokenRange(dom.searchInput.value, cursor);
  const prefix = dom.searchInput.value.slice(0, range.start);
  const suffix = dom.searchInput.value.slice(range.end);
  const replacementValue = raw ? value : quoteIfNeeded(value);
  const replacement = value ? `${replacementValue} ` : "";
  dom.searchInput.value = `${prefix}${replacement}${suffix}`.replace(/\s{2,}/g, " ").trimStart();
  const nextCursor = Math.min(dom.searchInput.value.length, prefix.length + replacement.length);
  dom.searchInput.focus();
  dom.searchInput.setSelectionRange(nextCursor, nextCursor);
}

function renderSuggestions() {
  dom.searchSuggestions.innerHTML = "";

  if (!state.search.suggestionsOpen || state.search.suggestions.length === 0) {
    dom.searchSuggestions.hidden = true;
    return;
  }

  dom.searchSuggestions.hidden = false;
  let currentGroup = "";

  state.search.suggestions.forEach((suggestion, index) => {
    if (suggestion.group !== currentGroup) {
      currentGroup = suggestion.group;
      const header = createElement("div", "search-suggestion-group");
      header.textContent = currentGroup;
      dom.searchSuggestions.appendChild(header);
    }

    const button = createElement("button", "search-suggestion");
    button.type = "button";
    button.classList.toggle("is-active", index === state.search.activeSuggestionIndex);
    button.innerHTML =
      `<div class="search-suggestion-main">${suggestion.labelHTML}</div>` +
      (suggestion.subLabelHTML ? `<div class="search-suggestion-sub">${suggestion.subLabelHTML}</div>` : "") +
      (suggestion.previewHTML ? `<div class="search-suggestion-preview">${suggestion.previewHTML}</div>` : "");
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => applySuggestion(suggestion));
    dom.searchSuggestions.appendChild(button);
  });
}

function showSuggestions(suggestions) {
  state.search.suggestions = suggestions;
  state.search.suggestionsOpen = suggestions.length > 0;
  state.search.activeSuggestionIndex = -1;
  renderSuggestions();
}

function hideSuggestions() {
  state.search.suggestions = [];
  state.search.suggestionsOpen = false;
  state.search.activeSuggestionIndex = -1;
  renderSuggestions();
}

function scoreSuggestion(label, fragment, weight = 0) {
  const foldedLabel = foldForMatch(label);
  const foldedFragment = foldForMatch(fragment);
  if (!foldedFragment) return weight;
  const starts = foldedLabel.startsWith(foldedFragment) ? 100 : foldedLabel.includes(foldedFragment) ? 60 : 0;
  return starts + weight - Math.min(24, Math.max(0, foldedLabel.length - foldedFragment.length));
}

function scoreSuggestionFromSpans(spans, weight = 0) {
  if (!Array.isArray(spans) || spans.length === 0) return -(10 ** 6);
  const first = spans[0];
  const starts = first.start === 0 ? 100 : Math.max(36, 72 - Math.min(36, first.start));
  const matchLength = Math.max(1, first.end - first.start);
  return starts + weight - Math.min(18, Math.max(0, matchLength - 1));
}

function buildSuggestions() {
  const text = dom.searchInput.value;
  const cursor = dom.searchInput.selectionStart ?? text.length;
  const activeToken = getActiveTokenRange(text, cursor).value;
  const { field, value } = splitFieldPrefix(activeToken);
  const activeTokenValue = normalizeWhitespace(stripOuterQuotes(value));
  const allowsEmptyFieldSuggestions = field === "role";
  const fragment = activeTokenValue;
  const suggestions = [];
  const fragmentPattern = !field ? parseSearchPattern(fragment) : null;
  const regexStyleInput = !field && Boolean(fragmentPattern?.usesRegexSyntax) && !fragmentPattern?.error;
  const invalidRegexInput = !field && Boolean(fragmentPattern?.usesRegexSyntax) && Boolean(fragmentPattern?.error);

  if (activeTokenValue === "AND" || activeTokenValue === "OR") {
    hideSuggestions();
    return;
  }

  if (invalidRegexInput) {
    hideSuggestions();
    return;
  }

  if (!allowsEmptyFieldSuggestions && !regexStyleInput && activeTokenValue.length < 2) {
    hideSuggestions();
    return;
  }

  if ((field === "role") || (!field && !regexStyleInput)) {
    ROLE_META.forEach((roleInfo, roleKey) => {
      const label = roleInfo.label;
      if (!foldForMatch(label).includes(foldForMatch(fragment)) && !roleKey.includes(normalizeRoleSlug(fragment))) {
        return;
      }
      const queryToken = buildFieldQueryToken("role", roleKey);
      suggestions.push({
        group: "Roles",
        score: scoreSuggestion(queryToken, fragment, 40 + (roleInfo.nodeCount || 0)),
        labelHTML: renderMarkedHTML(queryToken, findLiteralSpans(queryToken, fragment)),
        subLabelHTML: roleInfo.label !== roleKey ? `${roleInfo.label} · ${roleInfo.nodeCount || 0} nodes` : `${roleInfo.nodeCount || 0} nodes`,
        previewHTML: "",
        apply() {
          replaceActiveToken(queryToken, { raw: true });
          hideSuggestions();
          scheduleSearchCompute(true);
        }
      });
    });
  }

  if (!field && !regexStyleInput) {
    NODE_LIST.forEach((meta) => {
      if (!foldForMatch(meta.node.label).includes(foldForMatch(fragment))) {
        return;
      }
      const snippet = buildSnippet(meta.node.label, fragment, 34);
      suggestions.push({
        group: "Outline",
        score: scoreSuggestion(meta.node.label, fragment, meta.node.weight || 0),
        labelHTML: renderMarkedHTML(meta.node.label, findLiteralSpans(meta.node.label, fragment)),
        subLabelHTML: `Paragraphs ${meta.node.range?.[0] ?? 0}–${meta.node.range?.[1] ?? 0}`,
        previewHTML: renderMarkedHTML(snippet.text, snippet.spans),
        apply() {
          replaceActiveToken(meta.node.label);
          hideSuggestions();
          scheduleSearchCompute(true);
        }
      });
    });

    SOURCE.forEach((paragraph, index) => {
      if (!foldForMatch(paragraph).includes(foldForMatch(fragment))) return;
      const snippet = buildSnippet(paragraph, fragment, 42);
      suggestions.push({
        group: "Text",
        score: scoreSuggestion(paragraph, fragment, 20 - index / 1000),
        labelHTML: `Paragraph ${index}`,
        subLabelHTML: "",
        previewHTML: renderMarkedHTML(snippet.text, snippet.spans),
        apply() {
          replaceActiveToken(fragment);
          hideSuggestions();
          scheduleSearchCompute(true);
        }
      });
    });
  }

  if (!field && regexStyleInput) {
    NODE_LIST.forEach((meta) => {
      const labelSpans = findRegexSpans(meta.node.label, fragmentPattern);
      if (labelSpans.length === 0) return;
      const snippet = buildSnippetFromSpans(meta.node.label, labelSpans, 34);
      suggestions.push({
        group: "Outline",
        score: scoreSuggestionFromSpans(labelSpans, meta.node.weight || 0),
        labelHTML: renderMarkedHTML(meta.node.label, labelSpans),
        subLabelHTML: `Paragraphs ${meta.node.range?.[0] ?? 0}–${meta.node.range?.[1] ?? 0}`,
        previewHTML: renderMarkedHTML(snippet.text, snippet.spans),
        apply() {
          replaceActiveToken(meta.node.label);
          hideSuggestions();
          scheduleSearchCompute(true);
        }
      });
    });

    SOURCE.forEach((paragraph, index) => {
      const paragraphSpans = findRegexSpans(paragraph, fragmentPattern);
      if (paragraphSpans.length === 0) return;
      const snippet = buildSnippetFromSpans(paragraph, paragraphSpans, 42);
      suggestions.push({
        group: "Text",
        score: scoreSuggestionFromSpans(paragraphSpans, 20 - index / 1000),
        labelHTML: `Paragraph ${index}`,
        subLabelHTML: "",
        previewHTML: renderMarkedHTML(snippet.text, snippet.spans),
        apply() {
          replaceActiveToken(fragment);
          hideSuggestions();
          scheduleSearchCompute(true);
        }
      });
    });
  }

  const groupedOrder = { Roles: 0, Outline: 1, Text: 2 };
  suggestions.sort((a, b) => {
    const groupOrder = (groupedOrder[a.group] ?? 9) - (groupedOrder[b.group] ?? 9);
    if (groupOrder !== 0) return groupOrder;
    return b.score - a.score;
  });

  const limited = suggestions.slice(0, SUGGESTION_LIMIT);
  showSuggestions(limited);
}

function applySuggestion(suggestion) {
  suggestion.apply();
}

function runSearchFromInput(focusFirstResult = true) {
  clearTimeout(state.searchDebounceTimer);
  state.search.rawInput = dom.searchInput.value;
  state.search.queryGroups = parseQueryGroups(state.search.rawInput);
  computeSearchResults();
  hideSuggestions();
  if (focusFirstResult && state.search.results.length > 0) {
    focusSearchResult(0);
  } else {
    buildSuggestions();
  }
}

function scheduleSearchCompute(focusFirstResult = false) {
  clearTimeout(state.searchDebounceTimer);
  state.searchDebounceTimer = setTimeout(() => {
    state.search.rawInput = dom.searchInput.value;
    state.search.queryGroups = parseQueryGroups(state.search.rawInput);
    computeSearchResults();
    buildSuggestions();
    if (focusFirstResult && state.search.results.length > 0) {
      focusSearchResult(0);
    }
  }, SEARCH_INPUT_DEBOUNCE_MS);
}

function clearSearch() {
  state.search.rawInput = "";
  state.search.queryGroups = [];
  state.search.results = [];
  state.search.focusedResultIndex = -1;
  state.search.nodeMatches = new Map();
  state.search.paragraphMatches = new Map();
  dom.searchInput.value = "";
  hideSuggestions();
  renderSearchState();
}

function initSearch() {
  renderSearchSummary();
  updateSearchCount();

  dom.searchInput.addEventListener("input", () => {
    scheduleSearchCompute();
  });

  dom.searchInput.addEventListener("focus", () => {
    buildSuggestions();
  });

  dom.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && state.search.suggestionsOpen) {
      event.preventDefault();
      if (state.search.activeSuggestionIndex < 0) {
        state.search.activeSuggestionIndex = 0;
      } else {
        state.search.activeSuggestionIndex = (state.search.activeSuggestionIndex + 1) % state.search.suggestions.length;
      }
      renderSuggestions();
      return;
    }

    if (event.key === "ArrowUp" && state.search.suggestionsOpen) {
      event.preventDefault();
      if (state.search.activeSuggestionIndex < 0) {
        state.search.activeSuggestionIndex = state.search.suggestions.length - 1;
      } else {
        state.search.activeSuggestionIndex = (state.search.activeSuggestionIndex - 1 + state.search.suggestions.length) % state.search.suggestions.length;
      }
      renderSuggestions();
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && state.search.suggestionsOpen && state.search.suggestions.length > 0) {
      event.preventDefault();
      const suggestionIndex = state.search.activeSuggestionIndex >= 0 ? state.search.activeSuggestionIndex : 0;
      applySuggestion(state.search.suggestions[suggestionIndex]);
      return;
    }

    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (state.search.suggestionsOpen && state.search.activeSuggestionIndex >= 0) {
        applySuggestion(state.search.suggestions[state.search.activeSuggestionIndex]);
      } else {
        runSearchFromInput(true);
      }
    }
  });

  [dom.searchPrevBtn, dom.searchNextBtn].forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
  });
  dom.searchPrevBtn.addEventListener("click", () => focusRelativeSearchResult(-1));
  dom.searchNextBtn.addEventListener("click", () => focusRelativeSearchResult(1));
  dom.searchClearBtn.addEventListener("click", clearSearch);

  dom.detailMeta.addEventListener("click", (event) => {
    const roleBadge = event.target.closest("[data-role]");
    if (!roleBadge) return;
    event.preventDefault();
    const roleInfo = getRoleInfo(roleBadge.dataset.role);
    appendSearchTerm(roleInfo?.label || formatRoleLabel(roleBadge.dataset.role), { prefix: "role" });
  });

  document.addEventListener("click", (event) => {
    if (!dom.searchShell.contains(event.target)) {
      hideSuggestions();
    }
  });
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
  syncTreeViewportHeight();
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
  initDetailBodyWithSource();
  dom.appRoot.appendChild(renderBranch(ROOT_NODE_ID));
  syncBranchAnchors();
  syncConnectorRails();
  syncTreeViewportHeight();
  syncTreeCanvasSize();
  updateTreeZoomReadout();
  setSelectedNode(ROOT_NODE_ID, false);
  initSearch();

  window.addEventListener("keydown", handleKeyNavigation);
  window.addEventListener("resize", handleWindowResize);
  window.addEventListener("load", handleWindowResize);

  initTreeViewport();
}

initApp();
