const DATA_ELEMENT_ID = "rna-sequences-data";
const TARGET_SELECTOR = "[data-rna-sequence]";
const ROOT_SELECTOR = "[data-rna-root]";
const PHRASE_SELECTOR = "[data-rna-phrase]";
const SPEED_PX_PER_SECOND = 90;
const MIN_DURATION_SECONDS = 6;
const HOLD_DURATION_MS = 1000;
const ALIGNMENT_THRESHOLD_PX = 1;
const MIN_TRAVEL_SECONDS = 0.25;
const MIN_SEPARATOR_PX = 8;
const VISIBLE_MIN_SECONDS = 3.5;
const VISIBLE_MAX_SECONDS = 6;
const VISIBLE_BASE_SECONDS = 0.9;
const VISIBLE_SLOPE_SECONDS = 0.28;
const HOLD_INTERVAL_MS = 4000;
const MAX_FILLER_ATTEMPTS = 240;
const FILLER_TOLERANCE_PX = 1;
const MAX_ITEM_NUDGE_PX = 6;
const RESERVE_NUCLEOTIDE = "A";
const NUCLEOTIDE_BASES = ["A", "U", "G", "C"];
const FILLER_CODONS = (() => {
  const codons = [];
  NUCLEOTIDE_BASES.forEach((first) => {
    NUCLEOTIDE_BASES.forEach((second) => {
      NUCLEOTIDE_BASES.forEach((third) => {
        codons.push(`${first}${second}${third}`);
      });
    });
  });
  return codons;
})();

const releaseSeparatorSizing = (separator) => {
  separator.style.removeProperty("--rna-separator-width");
  separator.style.width = "auto";
  separator.style.minWidth = "0";
};

const getNormalizedOffset = () => {
  if (!state.segmentWidth) return 0;
  const raw = state.offsetPx % state.segmentWidth;
  return raw < 0 ? raw + state.segmentWidth : raw;
};

const motionQuery =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

const prefersReducedMotion = () => motionQuery?.matches ?? false;

const computeVisibleSeconds = (tailWords) => {
  const estimate = VISIBLE_SLOPE_SECONDS * tailWords + VISIBLE_BASE_SECONDS;
  return Math.max(VISIBLE_MIN_SECONDS, Math.min(VISIBLE_MAX_SECONDS, estimate));
};

const state = {
  target: null,
  rootTarget: null,
  phraseTarget: null,
  initialRootText: "",
  initialPhraseText: "",
  phraseEntry: null,
  order: [],
  track: null,
  segment: null,
  resizeTimer: null,
  items: [],
  separatorMetrics: [],
  itemNudges: new Map(),
  segmentWidth: 0,
  containerLeft: 0,
  containerRight: 0,
  phraseMidX: null,
  offsetPx: 0,
  speed: SPEED_PX_PER_SECOND,
  holdDurationMs: HOLD_DURATION_MS,
  holdIntervalMs: HOLD_INTERVAL_MS,
  isHolding: false,
  holdUntil: 0,
  lastHoldTimestamp: null,
  holdReady: true,
  triggeredCycle: new Map(),
  deltaCache: new Map(),
  rafId: null,
  lastTimestamp: null,
  lastNormalizedOffset: null,
  cycleIndex: 0,
};

const readSequences = () => {
  const dataElement = document.getElementById(DATA_ELEMENT_ID);
  if (!dataElement) return [];

  try {
    const parsed = JSON.parse(dataElement.textContent || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        const phrase = typeof entry?.phrase === "string" ? entry.phrase.trim() : "";
        const tailWords = phrase.length
          ? phrase.split(/\s+/).filter(Boolean).length
          : 0;
        return {
          id: entry?.id ?? null,
          sequence: typeof entry?.sequence === "string" ? entry.sequence.trim() : "",
          root: typeof entry?.root === "string" ? entry.root.trim() : "",
          phrase,
          tailWords,
          visibleSeconds: computeVisibleSeconds(tailWords),
          separatorText: typeof entry?.separatorText === "string" ? entry.separatorText : "",
        };
      })
      .filter((entry) => entry.sequence.length > 0);
  } catch {
    return [];
  }
};

const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const pickRandomCodon = () => {
  const index = Math.floor(Math.random() * FILLER_CODONS.length);
  return FILLER_CODONS[index] ?? "A";
};

const pickRandomBase = () => {
  const index = Math.floor(Math.random() * NUCLEOTIDE_BASES.length);
  return NUCLEOTIDE_BASES[index] ?? "A";
};

const buildSegment = (order) => {
  const segment = document.createElement("span");
  segment.setAttribute("data-rna-sequence-segment", "true");

  order.forEach((entry, index) => {
    const item = document.createElement("span");
    item.setAttribute("data-rna-sequence-item", "true");
    item.textContent = entry.sequence;
    if (entry.id) {
      item.dataset.rnaId = String(entry.id);
    }
    if (entry.phrase) {
      item.dataset.rnaPhrase = entry.phrase;
    }
    if (entry.root) {
      item.dataset.rnaRoot = entry.root;
    }
    item.dataset.rnaIndex = String(index);
    segment.appendChild(item);

    const separator = document.createElement("span");
    separator.setAttribute("data-rna-separator", "true");
    separator.dataset.rnaIndex = String(index);
    separator.dataset.rnaFollowerIndex = String((index + 1) % order.length);
    separator.dataset.gapSeconds = String(entry.visibleSeconds ?? VISIBLE_MIN_SECONDS);
    separator.dataset.separatorText = entry.separatorText ?? "";
    segment.appendChild(separator);
  });

  return segment;
};

const buildTrack = (order) => {
  const track = document.createElement("span");
  track.setAttribute("data-rna-sequence-track", "true");
  track.setAttribute("aria-hidden", "true");

  const segment = buildSegment(order);
  const clone = segment.cloneNode(true);
  track.append(clone, segment);

  return { track, segment };
};

const resetItemNudges = () => {
  state.itemNudges = new Map();
  if (!state.track) return;
  const nodes = state.track.querySelectorAll("[data-rna-sequence-item]");
  nodes.forEach((node) => {
    node.style.removeProperty("--rna-item-gap-nudge");
  });
};

const applyItemNudge = (index, amountPx) => {
  if (!state.track || !Number.isFinite(index)) return;
  const clamped = (() => {
    if (!Number.isFinite(amountPx)) return 0;
    if (amountPx > 0) {
      return Math.min(MAX_ITEM_NUDGE_PX, amountPx);
    }
    if (amountPx < 0) {
      return Math.max(-MAX_ITEM_NUDGE_PX, amountPx);
    }
    return 0;
  })();
  const current = state.itemNudges.get(index);
  if (current === clamped) return;
  state.itemNudges.set(index, clamped);
  const nodes = state.track.querySelectorAll(
    `[data-rna-sequence-item][data-rna-index="${index}"]`
  );
  nodes.forEach((node) => {
    if (clamped === 0) {
      node.style.removeProperty("--rna-item-gap-nudge");
    } else {
      node.style.setProperty("--rna-item-gap-nudge", `${clamped}px`);
    }
  });
};

const setDisplayedPhrase = (entry) => {
  const rootText =
    entry?.root && entry.root.length ? entry.root : state.initialRootText || "";
  if (state.rootTarget) {
    state.rootTarget.textContent = rootText;
  }

  if (!state.phraseTarget) return;

  const phraseText =
    entry?.phrase && entry.phrase.length ? entry.phrase : state.initialPhraseText || "";
  state.phraseTarget.textContent = phraseText;

  if (entry?.id) {
    state.phraseTarget.dataset.rnaPhraseId = String(entry.id);
  } else {
    state.phraseTarget.removeAttribute("data-rna-phrase-id");
  }
};

const applyMetadata = () => {
  if (!state.target || !state.order.length) return;
  state.target.setAttribute("data-rna-count", String(state.order.length));
  state.target.setAttribute(
    "data-rna-order",
    state.order.map((entry) => entry.id ?? entry.sequence).join(",")
  );
};

const fitSeparatorFiller = (separator, baseGapPx) => {
  const targetWidth = Math.max(baseGapPx - FILLER_TOLERANCE_PX, 0);
  const maxWidth = baseGapPx + MAX_ITEM_NUDGE_PX;
  let filler = "";
  let measuredWidth = 0;
  let reserveAdded = false;
  separator.textContent = "";

  const tryAppend = (chunk) => {
    const candidate = filler ? `${filler}${chunk}` : chunk;
    separator.textContent = candidate;
    const width = separator.scrollWidth;
    if (width <= maxWidth) {
      filler = candidate;
      measuredWidth = width;
      return true;
    }
    separator.textContent = filler;
    return false;
  };

  const ensureReserveBase = () => {
    if (!RESERVE_NUCLEOTIDE || reserveAdded) return;
    const candidate = filler ? `${filler}${RESERVE_NUCLEOTIDE}` : RESERVE_NUCLEOTIDE;
    separator.textContent = candidate;
    const width = separator.scrollWidth;
    if (width <= maxWidth) {
      filler = candidate;
      measuredWidth = width;
      reserveAdded = true;
    } else {
      separator.textContent = filler;
    }
  };

  let iterations = 0;
  while (
    iterations < MAX_FILLER_ATTEMPTS &&
    measuredWidth < targetWidth
  ) {
    if (!tryAppend(pickRandomCodon())) {
      break;
    }
    iterations += 1;
  }

  iterations = 0;
  while (
    iterations < MAX_FILLER_ATTEMPTS &&
    measuredWidth < targetWidth
  ) {
    if (!tryAppend(pickRandomBase())) {
      break;
    }
    iterations += 1;
  }

  ensureReserveBase();

  if (!filler.length) {
    const base = pickRandomBase();
    filler = base;
    separator.textContent = base;
    measuredWidth = separator.scrollWidth;
  }

  const appliedWidth = measuredWidth || baseGapPx;
  const overflowPx = Math.max(0, appliedWidth - baseGapPx);
  const deficitPx = reserveAdded ? Math.min(0, measuredWidth - baseGapPx) : 0;

  return {
    filler,
    fillerWidth: measuredWidth,
    overflowPx,
    appliedWidth: Math.min(appliedWidth, maxWidth),
    reserveAdded,
    deficitPx,
  };
};

const applyTransform = () => {
  if (!state.track) return;
  const offset = getNormalizedOffset();
  const translateX = -state.segmentWidth + offset;
  state.track.style.transform = `translateX(${translateX}px)`;
};

const updatePhraseMidpoint = () => {
  if (!state.phraseTarget) {
    state.phraseMidX = null;
    return;
  }
  const rect = state.phraseTarget.getBoundingClientRect();
  state.phraseMidX = rect.left + rect.width / 2;
};

const updateContainerBounds = () => {
  if (!state.target) {
    state.containerLeft = 0;
    state.containerRight = 0;
    return;
  }
  const rect = state.target.getBoundingClientRect();
  state.containerLeft = rect.left;
  state.containerRight = rect.right;
};

const measureItems = () => {
  if (!state.segment) {
    state.items = [];
    return;
  }
  const segmentRect = state.segment.getBoundingClientRect();
  const nodes = state.segment.querySelectorAll("[data-rna-sequence-item]");
  const items = [];
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const center = rect.left - segmentRect.left + rect.width / 2;
    items.push({
      id: node.dataset.rnaId ?? null,
      index: Number(node.dataset.rnaIndex ?? 0),
      center,
      width: rect.width,
    });
  });
  state.items = items;
};

const cacheSeparatorMetrics = () => {
  if (!state.segment) {
    state.separatorMetrics = [];
    return;
  }
  const segmentRect = state.segment.getBoundingClientRect();
  const separators = state.segment.querySelectorAll("[data-rna-separator]");
  const metrics = [];
  separators.forEach((separator) => {
    const followerIndex = Number(separator.dataset.rnaFollowerIndex ?? NaN);
    const follower =
      Number.isFinite(followerIndex) && followerIndex >= 0
        ? state.segment.querySelector(
            `[data-rna-sequence-item][data-rna-index="${followerIndex}"]`
          )
        : null;
    const followerRect = follower?.getBoundingClientRect();
    metrics.push({
      index: Number(separator.dataset.rnaIndex ?? -1),
      appliedWidthPx: Number(separator.dataset.appliedWidthPx ?? separator.offsetWidth),
      fillerWidthPx: separator.scrollWidth,
      followerIndex: Number.isFinite(followerIndex) ? followerIndex : null,
      followerWidthPx: followerRect?.width ?? null,
      followerLeftPx:
        typeof followerRect?.left === "number"
          ? followerRect.left - segmentRect.left
          : null,
      nudgePx: state.itemNudges.get(followerIndex) ?? 0,
    });
  });
  state.separatorMetrics = metrics;
};

const refreshGeometry = ({ preserveProgress = false } = {}) => {
  if (!state.track || !state.segment) return;
  const previousWidth = state.segmentWidth || 1;
  const normalizedBefore = preserveProgress ? getNormalizedOffset() : 0;
  const normalizedRatio =
    preserveProgress && previousWidth ? normalizedBefore / previousWidth : 0;

  resetItemNudges();
  state.separatorMetrics = [];
  const baseSpeed = SPEED_PX_PER_SECOND;
  updateSeparatorWidths(baseSpeed);
  let segmentRect = state.segment.getBoundingClientRect();
  let segmentWidth = segmentRect.width;

  let duration = Math.max(segmentWidth / baseSpeed, MIN_DURATION_SECONDS);
  let resolvedSpeed = segmentWidth / duration;

  if (Math.abs(resolvedSpeed - baseSpeed) > 0.1) {
    updateSeparatorWidths(resolvedSpeed);
    segmentRect = state.segment.getBoundingClientRect();
    segmentWidth = segmentRect.width;
    duration = Math.max(segmentWidth / baseSpeed, MIN_DURATION_SECONDS);
    resolvedSpeed = segmentWidth / duration;
  }

  state.segmentWidth = segmentWidth;
  state.speed = resolvedSpeed;
  state.track.style.setProperty("--rna-distance", `${segmentWidth}px`);
  state.track.style.setProperty("--rna-duration", `${duration}s`);

  state.offsetPx = preserveProgress ? normalizedRatio * segmentWidth : 0;
  state.lastNormalizedOffset = preserveProgress ? getNormalizedOffset() : 0;
  state.deltaCache = new Map();
  if (!preserveProgress) {
    state.triggeredCycle = new Map();
    state.cycleIndex = 0;
  }
  measureItems();
  cacheSeparatorMetrics();
  updatePhraseMidpoint();
  updateContainerBounds();
  applyTransform();
};

const beginHold = (timestamp) => {
  state.isHolding = true;
  const now =
    typeof timestamp === "number" ? timestamp : state.lastTimestamp ?? performance.now();
  state.holdUntil = now + state.holdDurationMs;
  state.lastHoldTimestamp = now;
  state.holdReady = false;
};

const resetHoldSchedule = () => {
  state.lastHoldTimestamp = performance.now();
  state.holdReady = false;
};

const updateHoldReadiness = (timestamp) => {
  if (state.holdReady || state.isHolding) return;
  const last = state.lastHoldTimestamp;
  if (!Number.isFinite(last)) {
    state.holdReady = true;
    return;
  }
  if (timestamp - last >= state.holdIntervalMs) {
    state.holdReady = true;
  }
};

const isVisible = (centerX) =>
  typeof centerX === "number" &&
  centerX >= state.containerLeft &&
  centerX <= state.containerRight;

const checkAlignment = (timestamp) => {
  if (!state.items.length || typeof state.phraseMidX !== "number") return;
  const containerLeft = state.containerLeft;
  const offset = getNormalizedOffset();
  let alignedItem = null;

  state.items.forEach((item) => {
    const primaryCenter = containerLeft + offset + item.center;
    const cloneCenter = primaryCenter - state.segmentWidth;
    const visibleCenter = isVisible(primaryCenter)
      ? primaryCenter
      : isVisible(cloneCenter)
      ? cloneCenter
      : null;
    if (visibleCenter === null) return;

    const delta = visibleCenter - state.phraseMidX;
    const prevDelta = state.deltaCache.get(item.index);
    state.deltaCache.set(item.index, delta);
    const crossed =
      typeof prevDelta === "number" &&
      ((prevDelta <= 0 && delta >= 0) || (prevDelta >= 0 && delta <= 0));
    const withinThreshold = Math.abs(delta) <= ALIGNMENT_THRESHOLD_PX;
    if (
      (crossed || withinThreshold) &&
      state.triggeredCycle.get(item.index) !== state.cycleIndex &&
      !alignedItem
    ) {
      alignedItem = item;
    }
  });

  if (alignedItem && state.holdReady && !state.isHolding) {
    state.triggeredCycle.set(alignedItem.index, state.cycleIndex);
    beginHold(timestamp);
  }
};

const stepAnimation = (timestamp) => {
  if (!state.track || !state.segment || prefersReducedMotion()) return;

  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
    state.rafId = requestAnimationFrame(stepAnimation);
    return;
  }

  if (state.isHolding) {
    if (timestamp < state.holdUntil) {
      state.lastTimestamp = timestamp;
      state.rafId = requestAnimationFrame(stepAnimation);
      return;
    }
    state.isHolding = false;
    state.lastTimestamp = timestamp;
  }

  const deltaMs = timestamp - state.lastTimestamp;
  state.lastTimestamp = timestamp;

  const deltaPx = state.speed * (deltaMs / 1000);
  state.offsetPx += deltaPx;
  if (state.segmentWidth) {
    const normalized = getNormalizedOffset();
    const lastNormalized = state.lastNormalizedOffset ?? normalized;
    if (normalized < lastNormalized) {
      state.cycleIndex += 1;
      state.deltaCache = new Map();
    }
    state.lastNormalizedOffset = normalized;
  }

  updateHoldReadiness(timestamp);
  applyTransform();
  checkAlignment(timestamp);

  state.rafId = requestAnimationFrame(stepAnimation);
};

const startAnimationLoop = () => {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  state.lastTimestamp = null;
  if (!state.segmentWidth || !state.items.length) return;
  resetHoldSchedule();
  state.rafId = requestAnimationFrame(stepAnimation);
};

const stopAnimationLoop = () => {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
  }
  state.rafId = null;
  state.lastTimestamp = null;
  state.isHolding = false;
  state.holdUntil = 0;
  state.lastHoldTimestamp = null;
  state.holdReady = true;
};

const handleResize = () => {
  if (state.resizeTimer) {
    clearTimeout(state.resizeTimer);
  }
  state.resizeTimer = setTimeout(() => {
    state.resizeTimer = null;
    refreshGeometry({ preserveProgress: true });
  }, 150);
};

const teardownTrack = () => {
  stopAnimationLoop();
  if (state.track) {
    state.track.remove();
  }
  state.track = null;
  state.segment = null;
  state.items = [];
  state.segmentWidth = 0;
  state.offsetPx = 0;
  state.lastNormalizedOffset = null;
  state.triggeredCycle = new Map();
  state.cycleIndex = 0;
  state.deltaCache = new Map();
  state.separatorMetrics = [];
  state.itemNudges = new Map();
};

const renderStatic = () => {
  if (!state.target || !state.order.length) return;
  teardownTrack();
  state.target.textContent = state.order[0]?.sequence ?? "";
};

const setupAnimation = () => {
  if (!state.target || !state.order.length) return;
  teardownTrack();

  const { track, segment } = buildTrack(state.order);
  state.track = track;
  state.segment = segment;
  state.target.textContent = "";
  state.target.appendChild(track);

  requestAnimationFrame(() => {
    refreshGeometry();
    startAnimationLoop();
    // Recalculate after fonts settle.
    setTimeout(() => {
      refreshGeometry({ preserveProgress: true });
      startAnimationLoop();
    }, 500);
  });
};

const handleMotionChange = (event) => {
  if (!state.target || !state.order.length) return;
  const isReduced = typeof event?.matches === "boolean" ? event.matches : prefersReducedMotion();
  if (isReduced) {
    renderStatic();
  } else {
    applyMetadata();
    setupAnimation();
  }
};

const subscribeMotionPreference = () => {
  if (!motionQuery) return;
  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", handleMotionChange);
  } else if (typeof motionQuery.addListener === "function") {
    motionQuery.addListener(handleMotionChange);
  }
};

const init = () => {
  const target = document.querySelector(TARGET_SELECTOR);
  if (!target) return;
  const rootTarget = document.querySelector(ROOT_SELECTOR);
  const phraseTarget = document.querySelector(PHRASE_SELECTOR);

  const sequences = shuffle(readSequences());
  if (!sequences.length) return;

  state.target = target;
  state.rootTarget = rootTarget;
  state.phraseTarget = phraseTarget;
  state.holdDurationMs = (() => {
    const attr = target.dataset.rnaHoldMs;
    const parsed = Number(attr);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : HOLD_DURATION_MS;
  })();
  state.holdIntervalMs = (() => {
    const attr = target.dataset.rnaHoldIntervalMs;
    const parsed = Number(attr);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : HOLD_INTERVAL_MS;
  })();
  state.initialRootText = rootTarget?.textContent?.trim() ?? "";
  state.initialPhraseText = phraseTarget?.textContent?.trim() ?? "";
  const [phraseEntry, ...marqueeOrder] = sequences;
  state.phraseEntry = phraseEntry ?? null;
  state.order = [...marqueeOrder];
  if (state.phraseEntry) {
    state.order.push(state.phraseEntry);
  }
  setDisplayedPhrase(state.phraseEntry ?? state.order[0]);
  applyMetadata();

  subscribeMotionPreference();

  if (prefersReducedMotion()) {
    renderStatic();
  } else {
    setupAnimation();
  }

  window.addEventListener("resize", handleResize, { passive: true });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
const updateSeparatorWidths = (speed) => {
  if (!state.track) return;
  const holdSeconds = state.holdDurationMs / 1000;
  const separators = state.track.querySelectorAll("[data-rna-separator]");
  separators.forEach((separator) => {
    releaseSeparatorSizing(separator);
    const gapSeconds = Number(separator.dataset.gapSeconds || VISIBLE_MIN_SECONDS);
    const travelSeconds = Math.max(gapSeconds - holdSeconds, MIN_TRAVEL_SECONDS);
    const baseGapPx = Math.max(travelSeconds * speed, MIN_SEPARATOR_PX);
    const customText = separator.dataset.separatorText ?? "";
    let appliedWidth = baseGapPx;

    if (customText) {
      separator.textContent = customText;
      appliedWidth = Math.max(baseGapPx, separator.scrollWidth);
    } else {
      const {
        appliedWidth: resolvedWidth,
        overflowPx,
        reserveAdded,
        deficitPx,
      } = fitSeparatorFiller(
        separator,
        baseGapPx
      );
      appliedWidth = resolvedWidth;
      const followerIndex = Number(separator.dataset.rnaFollowerIndex ?? NaN);
      if (Number.isFinite(followerIndex)) {
        if (overflowPx > 0) {
          applyItemNudge(followerIndex, overflowPx);
        } else if (reserveAdded && deficitPx < -FILLER_TOLERANCE_PX) {
          applyItemNudge(followerIndex, deficitPx);
        }
      }
    }

    separator.style.setProperty("--rna-separator-width", `${appliedWidth}px`);
    separator.style.width = `${appliedWidth}px`;
    separator.style.minWidth = `${appliedWidth}px`;
    separator.dataset.appliedWidthPx = String(appliedWidth);
  });
};
