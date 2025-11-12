const DATA_ELEMENT_ID = "rna-sequences-data";
const ROOT_SELECTOR = "[data-rna-root]";
const PHRASE_SELECTOR = "[data-rna-phrase]";
const SEQUENCE_SELECTOR = "[data-rna-sequence]";
const DEFAULT_TARGET_LENGTH = 90;
const MIDPOINT_CADENCE_SECONDS = 4;
const BOX_MIDPOINT_INDEX = 46;

const CLEANUP_SYMBOL = Symbol("rna-marquee-cleanup");

const DEFAULT_BAG3 = [
  "AUC",
  "AUU",
  "GCU",
  "GCC",
  "GCA",
  "CAG",
  "GAA",
  "GAC",
  "UGU",
  "UGC",
  "ACC",
  "ACA",
  "GUG",
  "GUU",
  "CUA",
  "CUG",
  "UAC",
  "GAU",
  "UCC",
  "UCA",
  "CGU",
  "AGA",
  "GUA",
  "CAA",
  "CCG",
  "ACU",
  "CAU",
];
const DEFAULT_BAG2 = ["AU", "UA", "GC", "CG", "GU", "UG", "CA", "AC"];
const DEFAULT_BAG1 = ["A", "C", "G", "U"];

export function padRnaStrands(strands, opts = {}) {
  return padRnaStrandsDetailed(strands, opts).map((entry) => entry.padded);
}

export function buildCompositeRnaStrand(entries, opts = {}) {
  if (!Array.isArray(entries) || !entries.length) {
    return { order: [], sequence: "" };
  }

  const { excludeId = null, seed } = opts;
  const rng = createRng(seed);

  const available = entries.slice();
  let excluded = null;

  if (excludeId !== null && excludeId !== undefined) {
    const index = available.findIndex(
      (entry) => entry?.id !== null && entry?.id === excludeId
    );
    if (index >= 0) {
      [excluded] = available.splice(index, 1);
    }
  }

  const ordered = shuffle(available, rng);
  if (excluded) {
    ordered.push(excluded);
  }

  return {
    order: ordered,
    sequence: ordered.map((entry) => entry.paddedSequence || "").join(""),
  };
}

const init = () => {
  const dataset = readSequenceDataset();
  if (!dataset.length || typeof document === "undefined") return;

  const rootNode = document.querySelector(ROOT_SELECTOR);
  const phraseNode = document.querySelector(PHRASE_SELECTOR);
  const sequenceNode = document.querySelector(SEQUENCE_SELECTOR);
  if (!sequenceNode) return;

  const paddedEntries = attachPadding(dataset, {
    targetLength: DEFAULT_TARGET_LENGTH,
  });
  if (!paddedEntries.length) return;

  let activeEntry = findActiveEntry(dataset, rootNode, phraseNode);
  if (!activeEntry) {
    activeEntry = pickRandomEntry(dataset);
  }
  if (activeEntry) {
    applyHeadline(activeEntry, rootNode, phraseNode);
  }

  const composite = buildCompositeRnaStrand(paddedEntries, {
    excludeId: activeEntry?.id ?? null,
  });
  renderComposite(composite.order, sequenceNode, {
    rootNode,
    phraseNode,
  });
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}

function attachPadding(entries, opts) {
  const strands = entries.map((entry) => entry.sequence || "");
  const detailed = padRnaStrandsDetailed(strands, opts);
  return entries.map((entry, index) => {
    const pad = detailed[index];
    return {
      ...entry,
      sanitizedSequence: pad?.core ?? "",
      paddedSequence: pad?.padded ?? "",
      fillerLeft: pad?.leftPad ?? "",
      fillerRight: pad?.rightPad ?? "",
      targetLength: pad?.targetLength ?? opts?.targetLength ?? DEFAULT_TARGET_LENGTH,
    };
  });
}

function renderComposite(entries, targetNode, opts = {}) {
  if (!targetNode) return;
  if (typeof targetNode[CLEANUP_SYMBOL] === "function") {
    targetNode[CLEANUP_SYMBOL]();
  }

  const track = document.createElement("span");
  track.setAttribute("data-rna-sequence-track", "true");
  const segment = document.createElement("span");
  segment.setAttribute("data-rna-sequence-segment", "true");

  entries.forEach((entry) => {
    if (!entry?.paddedSequence) return;
    const box = document.createElement("span");
    box.setAttribute("data-rna-box", "true");
    if (entry.id) {
      box.dataset.rnaId = String(entry.id);
    }
    if (entry.phrase) {
      box.dataset.rnaPhrase = entry.phrase;
    }

    let cursor = 1;
    cursor = appendFragment(box, entry.fillerLeft, "filler", "left", cursor);
    cursor = appendFragment(
      box,
      entry.sanitizedSequence,
      "core",
      "center",
      cursor
    );
    cursor = appendFragment(box, entry.fillerRight, "filler", "right", cursor);
    segment.appendChild(box);
  });

  if (!segment.childNodes.length) {
    targetNode.textContent = "";
    targetNode[CLEANUP_SYMBOL] = null;
    return;
  }

  const clone = segment.cloneNode(true);
  track.append(clone, segment);

  track.style.visibility = "hidden";
  targetNode.removeAttribute("data-rna-ready");
  targetNode.textContent = "";
  targetNode.appendChild(track);
  targetNode.dataset.rnaBoxCount = String(entries.length);

  const marqueeCleanup = setupMarquee(track, segment, {
    boxCount: entries.length,
    targetNode,
  });
  const highlightCleanup = setupHighlightController({
    entries,
    segment,
    cloneSegment: clone,
    targetNode,
    rootNode: opts?.rootNode ?? null,
    phraseNode: opts?.phraseNode ?? null,
  });

  targetNode[CLEANUP_SYMBOL] = () => {
    if (typeof highlightCleanup === "function") {
      highlightCleanup();
    }
    if (typeof marqueeCleanup === "function") {
      marqueeCleanup();
    }
  };
}

function appendFragment(parent, text, type, side, cursor) {
  if (!text || !parent) return cursor;
  const span = document.createElement("span");
  span.dataset.rnaFragment = type;
  if (side) {
    span.dataset.rnaFragmentSide = side;
  }
  const nextCursor = cursor + text.length;
  if (
    cursor <= BOX_MIDPOINT_INDEX &&
    BOX_MIDPOINT_INDEX < nextCursor
  ) {
    const offset = BOX_MIDPOINT_INDEX - cursor;
    const before = text.slice(0, offset);
    const midpointChar = text.charAt(offset);
    const after = text.slice(offset + 1);
    if (before.length) {
      span.appendChild(document.createTextNode(before));
    }
    const marker = document.createElement("span");
    marker.dataset.rnaMidpoint = "true";
    marker.textContent = midpointChar;
    span.appendChild(marker);
    if (after.length) {
      span.appendChild(document.createTextNode(after));
    }
  } else {
    span.textContent = text;
  }
  parent.appendChild(span);
  return nextCursor;
}

function setupMarquee(track, segment, opts = {}) {
  if (!track || !segment) return () => {};

  let rafId = null;
  const resizeObserverSupported = typeof ResizeObserver === "function";
  let resizeObserver = null;
  const targetNode =
    opts && opts.targetNode && opts.targetNode.nodeType === 1
      ? opts.targetNode
      : null;
  const providedBoxCount =
    typeof opts.boxCount === "number" && opts.boxCount > 0
      ? opts.boxCount
      : null;

  const resolveBoxCount = () => {
    if (providedBoxCount !== null) {
      return providedBoxCount;
    }
    if (typeof segment.querySelectorAll === "function") {
      return segment.querySelectorAll("[data-rna-box]").length;
    }
    return 0;
  };

  const measure = () => {
    const rect = segment.getBoundingClientRect();
    const distance = rect.width || 0;
    const boxCount = resolveBoxCount();
    const duration =
      distance > 0 && boxCount > 0
        ? boxCount * MIDPOINT_CADENCE_SECONDS
        : 0;

    track.style.setProperty("--rna-distance", `${distance}px`);
    track.style.setProperty("--rna-duration", `${duration}s`);
    track.style.animationDuration = `${duration}s`;
    track.style.animationPlayState =
      distance > 0 && duration > 0 ? "running" : "paused";
    track.style.visibility = "visible";
    if (targetNode && distance > 0 && duration > 0) {
      targetNode.dataset.rnaReady = "true";
    }
  };

  const requestMeasure = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      measure();
    });
  };

  requestMeasure();

  const onResize = () => requestMeasure();
  window.addEventListener("resize", onResize, { passive: true });

  if (resizeObserverSupported) {
    resizeObserver = new ResizeObserver(() => requestMeasure());
    resizeObserver.observe(segment);
  }

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    track.style.removeProperty("--rna-distance");
    track.style.removeProperty("--rna-duration");
    track.style.removeProperty("animationDuration");
    track.style.removeProperty("visibility");
    track.style.animationPlayState = "paused";
    if (targetNode) {
      targetNode.removeAttribute("data-rna-ready");
    }
  };
}

function padRnaStrandsDetailed(strands, opts = {}) {
  if (!Array.isArray(strands)) return [];

  const targetLength = opts.targetLength ?? DEFAULT_TARGET_LENGTH;
  const bag3 = normalizeCodonBag(opts.bag3 ?? DEFAULT_BAG3);
  const bag2 = normalizeCodonBag(opts.bag2 ?? DEFAULT_BAG2);
  const bag1 = normalizeCodonBag(opts.bag1 ?? DEFAULT_BAG1);
  const rng = createRng(opts.seed);

  return strands.map((raw) => {
    const sanitized = sanitizeStrand(raw);
    if (sanitized.length === targetLength) {
      return {
        padded: sanitized,
        core: sanitized,
        leftPad: "",
        rightPad: "",
        targetLength,
      };
    }
    if (sanitized.length > targetLength) {
      const cropped = centerCrop(sanitized, targetLength);
      return {
        padded: cropped,
        core: cropped,
        leftPad: "",
        rightPad: "",
        targetLength,
      };
    }

    const deficit = targetLength - sanitized.length;
    const leftLength = Math.ceil(deficit / 2);
    const rightLength = Math.floor(deficit / 2);

    const leftPad = buildPadSegment(leftLength, rng, bag3, bag2, bag1);
    const rightPad = buildPadSegment(rightLength, rng, bag3, bag2, bag1);
    const padded = `${leftPad}${sanitized}${rightPad}`;

    return {
      padded,
      core: sanitized,
      leftPad,
      rightPad,
      targetLength,
    };
  });
}

function buildPadSegment(length, rng, bag3, bag2, bag1) {
  if (!length) return "";
  let remaining = length;
  let output = "";
  while (remaining > 0) {
    if (remaining >= 3 && bag3.length) {
      output += pick(bag3, rng);
      remaining -= 3;
      continue;
    }
    if (remaining >= 2 && bag2.length) {
      output += pick(bag2, rng);
      remaining -= 2;
      continue;
    }
    if (bag1.length) {
      output += pick(bag1, rng);
      remaining -= 1;
      continue;
    }
    if (bag3.length) {
      const codon = pick(bag3, rng);
      const take = Math.min(remaining, codon.length);
      output += codon.slice(0, take);
      remaining -= take;
      continue;
    }
    if (bag2.length) {
      const codon = pick(bag2, rng);
      const take = Math.min(remaining, codon.length);
      output += codon.slice(0, take);
      remaining -= take;
      continue;
    }
    throw new Error("Codon bags are empty; cannot pad strand.");
  }
  return output;
}

function normalizeCodonBag(bag) {
  if (!Array.isArray(bag)) return [];
  return bag
    .map((entry) =>
      typeof entry === "string" ? entry.trim().toUpperCase() : ""
    )
    .filter(Boolean);
}

function pick(bag, rng) {
  if (!bag.length) return "";
  const index = Math.floor(rng() * bag.length);
  return bag[index] ?? "";
}

function sanitizeStrand(strand) {
  if (typeof strand !== "string") return "";
  return strand.toUpperCase().replace(/[^ACGU]/g, "");
}

function centerCrop(strand, targetLength) {
  if (!strand.length) return strand;
  if (strand.length <= targetLength) return strand;
  const excess = strand.length - targetLength;
  const leftCut = Math.floor(excess / 2);
  const rightCut = excess - leftCut;
  return strand.slice(leftCut, strand.length - rightCut);
}

function createRng(seed) {
  if (seed === undefined || seed === null) {
    return Math.random;
  }
  const seedValue = hashStringToUint32(String(seed));
  return mulberry32(seedValue);
}

function mulberry32(a) {
  let t = a >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), t | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToUint32(value) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffle(items, rng) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function readSequenceDataset() {
  if (typeof document === "undefined") return [];
  const node = document.getElementById(DATA_ELEMENT_ID);
  if (!node) return [];
  try {
    const parsed = JSON.parse(node.textContent || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: entry?.id ?? null,
        root: typeof entry?.root === "string" ? entry.root.trim() : "",
        phrase: typeof entry?.phrase === "string" ? entry.phrase.trim() : "",
        sequence:
          typeof entry?.sequence === "string" ? entry.sequence.trim() : "",
        weight: typeof entry?.weight === "number" ? entry.weight : null,
      }))
      .filter((entry) => entry.sequence.length > 0);
  } catch {
    return [];
  }
}

function pickRandomEntry(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const index = Math.floor(Math.random() * entries.length);
  return entries[index] ?? null;
}

function findActiveEntry(entries, rootNode, phraseNode) {
  if (!entries.length) return null;
  const phraseText = phraseNode?.textContent?.trim() ?? "";
  if (!phraseText || /^n+$/i.test(phraseText)) {
    return null;
  }
  const rootText = rootNode?.textContent?.trim() ?? "";
  const normalizedPhrase = phraseText.toLowerCase();
  const normalizedRoot = rootText.toLowerCase();
  return (
    entries.find((entry) => {
      const phraseMatch = entry.phrase?.toLowerCase() === normalizedPhrase;
      const rootMatch = !rootText
        ? true
        : entry.root?.toLowerCase() === normalizedRoot;
      return phraseMatch && rootMatch;
    }) ?? null
  );
}

function applyHeadline(entry, rootNode, phraseNode) {
  if (!entry) return;
  if (rootNode) {
    rootNode.textContent = entry.root ?? "";
  }
  if (phraseNode) {
    phraseNode.textContent = entry.phrase ?? "";
    if (entry.id) {
      phraseNode.dataset.rnaPhraseId = String(entry.id);
    }
  }
}

function setupHighlightController(opts = {}) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => {};
  }
  const {
    entries,
    segment,
    cloneSegment = null,
    targetNode,
    rootNode = null,
    phraseNode = null,
  } = opts;
  if (
    !Array.isArray(entries) ||
    !entries.length ||
    !segment ||
    !targetNode ||
    !phraseNode
  ) {
    return () => {};
  }

  const highlightNodes = ensurePhraseHighlightNodes(phraseNode);
  if (!highlightNodes) return () => {};

  const lookup = buildEntryLookup(entries);
  const sourceSegments = [segment];
  if (cloneSegment) {
    sourceSegments.push(cloneSegment);
  }
  const boxes = collectBoxMidpoints(sourceSegments, lookup);
  if (!boxes.length) return () => {};

  const durationSeconds = entries.length * MIDPOINT_CADENCE_SECONDS;
  if (!durationSeconds) return () => {};

  let segmentWidth = 0;
  const updateSegmentWidth = () => {
    const rect = segment.getBoundingClientRect();
    if (rect && rect.width) {
      segmentWidth = rect.width;
    }
  };
  updateSegmentWidth();

  let movementDirection = 1;
  const stopDirectionProbe = probeMovementDirection(
    boxes[0]?.midpoint ?? null,
    (dir) => {
      if (typeof dir === "number" && dir !== 0) {
        movementDirection = dir;
      }
    }
  );

  let rafId = null;
  let destroyed = false;
  let activeKey = null;

  const handleResize = () => {
    updateSegmentWidth();
  };

  window.addEventListener("resize", handleResize, { passive: true });
  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(segment);
  }

  const loop = () => {
    if (destroyed) return;
    evaluateHighlight();
    rafId = window.requestAnimationFrame(loop);
  };
  rafId = window.requestAnimationFrame(loop);

  function evaluateHighlight() {
    if (!segmentWidth || !durationSeconds) return;
    const speed = segmentWidth / durationSeconds;
    if (!speed) return;
    const centerX = getSequenceCenter(targetNode);
    if (!Number.isFinite(centerX)) return;
    const candidate = findUpcomingCandidate(
      boxes,
      centerX,
      speed,
      movementDirection
    );
    if (!candidate) return;
    const timeToCenter = candidate.timeToCenter;
    const leadSeconds = resolveLeadSeconds(phraseNode);
    if (timeToCenter > leadSeconds) return;
    const key = getEntryKey(candidate.entry, candidate.index);
    if (activeKey === key) return;
    activateHighlight(candidate, key);
  }

  function activateHighlight(candidate, key) {
    activeKey = key;
    applyHighlightOverlay(candidate.entry, highlightNodes, rootNode);
  }

  return () => {
    destroyed = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", handleResize);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (typeof stopDirectionProbe === "function") {
      stopDirectionProbe();
    }
    clearHighlightVisuals(highlightNodes, rootNode);
    activeKey = null;
  };
}

function ensurePhraseHighlightNodes(phraseNode) {
  if (!phraseNode || phraseNode.nodeType !== 1) return null;
  if (!phraseNode.dataset.rnaPhraseInitial) {
    phraseNode.dataset.rnaPhraseInitial = phraseNode.textContent ?? "";
  }
  let wrapper = phraseNode.parentElement;
  if (wrapper?.dataset?.rnaPhraseWrapper !== "true") {
    wrapper = document.createElement("span");
    wrapper.dataset.rnaPhraseWrapper = "true";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline";
    wrapper.style.whiteSpace = "inherit";
    wrapper.style.verticalAlign = "baseline";
    wrapper.style.isolation = "isolate";
    const parent = phraseNode.parentNode;
    if (parent) {
      parent.insertBefore(wrapper, phraseNode);
    }
    wrapper.appendChild(phraseNode);
  }

  let overlay = wrapper.querySelector("[data-rna-phrase-highlight]");
  if (!overlay) {
    overlay = document.createElement("span");
    overlay.dataset.rnaPhraseHighlight = "true";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.whiteSpace = "pre";
    overlay.style.pointerEvents = "none";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 220ms ease";
    overlay.style.willChange = "opacity";
    overlay.style.zIndex = "2";
    overlay.style.background = "transparent";
    overlay.style.boxShadow = "0 0 0 1px currentColor";
    overlay.style.borderRadius = "0.15em";
    overlay.style.color = "inherit";
    wrapper.insertBefore(overlay, phraseNode);
  }

  let ghost = wrapper.querySelector("[data-rna-phrase-ghost]");
  if (!ghost) {
    ghost = document.createElement("span");
    ghost.dataset.rnaPhraseGhost = "true";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.display = "none";
    ghost.style.visibility = "hidden";
    ghost.style.pointerEvents = "none";
    ghost.style.whiteSpace = "pre";
    ghost.style.font = "inherit";
    ghost.textContent = phraseNode.textContent ?? "";
    wrapper.appendChild(ghost);
  }

  return { wrapper, overlay, source: phraseNode, ghost };
}

function buildEntryLookup(entries) {
  const byId = new Map();
  const byPhrase = new Map();
  entries.forEach((entry) => {
    if (entry?.id) {
      byId.set(String(entry.id), entry);
    }
    if (entry?.phrase) {
      byPhrase.set(entry.phrase, entry);
    }
  });
  return {
    byId,
    byPhrase,
    byIndex: entries.slice(),
  };
}

function collectBoxMidpoints(segments, lookup) {
  if (!Array.isArray(segments) || !segments.length) return [];
  const output = [];
  segments.forEach((seg) => {
    if (!seg || typeof seg.querySelectorAll !== "function") return;
    const nodeList = seg.querySelectorAll("[data-rna-box]");
    nodeList.forEach((box, index) => {
      const midpoint = box.querySelector("[data-rna-midpoint]");
      if (!midpoint) return;
      const entry = resolveEntryForBox(box, lookup, index);
      if (!entry) return;
      output.push({ midpoint, entry, index });
    });
  });
  return output;
}

function resolveEntryForBox(box, lookup, fallbackIndex) {
  if (!box || !lookup) return null;
  const id = box.dataset?.rnaId;
  if (id && lookup.byId.has(id)) {
    return lookup.byId.get(id);
  }
  const phrase = box.dataset?.rnaPhrase;
  if (phrase && lookup.byPhrase.has(phrase)) {
    return lookup.byPhrase.get(phrase);
  }
  return lookup.byIndex[fallbackIndex % lookup.byIndex.length] ?? null;
}

function getEntryKey(entry, fallbackIndex) {
  if (!entry) return `idx-${fallbackIndex}`;
  if (entry.id) return `id:${entry.id}`;
  if (entry.phrase) return `phrase:${entry.phrase}`;
  return `idx-${fallbackIndex}`;
}

function getSequenceCenter(node) {
  if (!node) return NaN;
  const rect = node.getBoundingClientRect();
  if (!rect || !rect.width) return NaN;
  return rect.left + rect.width / 2;
}

function findUpcomingCandidate(boxes, centerX, speed, direction = 1) {
  if (!Array.isArray(boxes) || !boxes.length || !speed) return null;
  const forward = direction >= 0 ? 1 : -1;
  let best = null;
  boxes.forEach((item) => {
    if (!item?.midpoint?.isConnected) return;
    const rect = item.midpoint.getBoundingClientRect();
    const midpointX = rect.left + rect.width / 2;
    const rawDistance = centerX - midpointX;
    const distance = forward > 0 ? rawDistance : -rawDistance;
    if (distance < 0) return;
    const timeToCenter = distance / speed;
    if (!Number.isFinite(timeToCenter)) return;
    if (!best || timeToCenter < best.timeToCenter) {
      best = {
        entry: item.entry,
        index: item.index,
        timeToCenter,
      };
    }
  });
  return best;
}

function resolveLeadSeconds(phraseNode) {
  if (typeof window === "undefined" || !phraseNode) return 1;
  let fontSize = 32;
  try {
    const computed = window.getComputedStyle(phraseNode);
    if (computed && computed.fontSize) {
      const parsed = parseFloat(computed.fontSize);
      if (Number.isFinite(parsed)) {
        fontSize = parsed;
      }
    }
  } catch {
    fontSize = 32;
  }
  const relativeLead = fontSize / 32;
  return clamp(relativeLead, 0.75, 1.25);
}

function applyHighlightOverlay(entry, nodes, rootNode) {
  if (!nodes?.overlay) return;
  const lineNode = getLineNode(rootNode);
  const firstRect = captureLineRect(lineNode);
  const phrase = entry?.phrase ?? "";
  nodes.overlay.textContent = phrase;
  nodes.overlay.style.opacity = "1";
  removeSourcePhrase(nodes);
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => animateLineFlip(lineNode, firstRect));
  } else {
    animateLineFlip(lineNode, firstRect);
  }
}

function captureLineRect(node) {
  if (!node || typeof node.getBoundingClientRect !== "function") return null;
  return node.getBoundingClientRect();
}

function animateLineFlip(node, firstRect) {
  if (!node || !firstRect || typeof node.getBoundingClientRect !== "function") {
    return;
  }
  const lastRect = node.getBoundingClientRect();
  const dx = firstRect.left - lastRect.left;
  if (Math.abs(dx) < 0.5) return;
  const duration = resolveLineShiftDuration(node);
  const easing = resolveLineShiftEasing(node);
  node.style.transition = "none";
  node.style.transform = `translateX(${dx}px)`;
  node.offsetWidth; // force reflow
  node.style.transition = `transform ${duration}ms ${easing}`;
  node.style.transform = "translateX(0)";
}

function resolveLineShiftDuration(node) {
  if (typeof window === "undefined" || !node) return 900;
  const computed = window.getComputedStyle(node);
  const custom =
    computed?.getPropertyValue("--rna-line-shift-duration")?.trim() ?? "";
  const parsed = parseTimeToMs(custom);
  if (parsed !== null) return parsed;
  return 900;
}

function resolveLineShiftEasing(node) {
  if (typeof window === "undefined" || !node) {
    return "cubic-bezier(.22,1,.36,1)";
  }
  const computed = window.getComputedStyle(node);
  const custom =
    computed?.getPropertyValue("--rna-line-shift-ease")?.trim() ?? "";
  return custom || "cubic-bezier(.22,1,.36,1)";
}

function clearHighlightVisuals(nodes, rootNode) {
  restoreSourcePhrase(nodes);
  if (nodes?.overlay) {
    nodes.overlay.style.opacity = "0";
    nodes.overlay.textContent = "";
    nodes.overlay.setAttribute("aria-hidden", "true");
    if (nodes.overlay.dataset) {
      delete nodes.overlay.dataset.rnaPhraseMidpoint;
    }
  }
  resetLineTransform(rootNode);
}

function probeMovementDirection(node, callback) {
  if (!node || typeof window === "undefined") return () => {};
  let prevX = null;
  let rafId = null;
  let attempts = 0;
  const maxAttempts = 120;
  const sample = () => {
    if (!node.isConnected) return;
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    if (prevX === null) {
      prevX = x;
      attempts += 1;
      rafId = window.requestAnimationFrame(sample);
      return;
    }
    const delta = x - prevX;
    if (Math.abs(delta) < 0.4 && attempts < maxAttempts) {
      prevX = x;
      attempts += 1;
      rafId = window.requestAnimationFrame(sample);
      return;
    }
    if (Math.abs(delta) >= 0.4) {
      callback(delta >= 0 ? 1 : -1);
      return;
    }
    callback(1);
  };
  rafId = window.requestAnimationFrame(sample);
  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
  };
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function removeSourcePhrase(nodes) {
  const source = nodes?.source;
  if (!source) return;
  if (!source.dataset.rnaPhraseInitial) {
    source.dataset.rnaPhraseInitial = source.textContent ?? "";
  }
  if (source.textContent) {
    source.textContent = "";
  }
  const overlayText = nodes.overlay?.textContent ?? "";
  updateGhostText(nodes, overlayText);
  toggleGhost(nodes, true);
  source.setAttribute("aria-hidden", "true");
  if (nodes?.overlay) {
    nodes.overlay.removeAttribute("aria-hidden");
  }
}

function restoreSourcePhrase(nodes) {
  const source = nodes?.source;
  if (!source) return;
  const initial =
    source.dataset?.rnaPhraseInitial ??
    nodes.ghost?.textContent ??
    nodes.overlay?.textContent ??
    "";
  source.textContent = initial;
  source.removeAttribute("aria-hidden");
  toggleGhost(nodes, false);
  updateGhostText(nodes, initial);
  if (nodes?.overlay) {
    nodes.overlay.setAttribute("aria-hidden", "true");
  }
}

function updateGhostText(nodes, text) {
  if (!nodes?.ghost) return;
  nodes.ghost.textContent = text ?? "";
}

function toggleGhost(nodes, forceVisible) {
  if (!nodes?.ghost) return;
  if (forceVisible) {
    nodes.ghost.style.display = "inline-block";
  } else {
    nodes.ghost.style.display = "none";
  }
}

function measureElementWidth(node) {
  if (!node || typeof node.getBoundingClientRect !== "function") return 0;
  const rect = node.getBoundingClientRect();
  if (rect && rect.width) {
    return rect.width;
  }
  return 0;
}

function getLineNode(rootNode) {
  if (!rootNode) return null;
  if (typeof rootNode.closest === "function") {
    const line = rootNode.closest(".main-line");
    if (line) return line;
  }
  return rootNode.parentElement || null;
}

function resetLineTransform(rootNode) {
  const line = getLineNode(rootNode);
  if (!line) return;
  line.style.transition = "";
  line.style.transform = "";
}

function parseTimeToMs(value) {
  if (!value) return null;
  if (value.endsWith("ms")) {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : null;
  }
  if (value.endsWith("s")) {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num * 1000 : null;
  }
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}
