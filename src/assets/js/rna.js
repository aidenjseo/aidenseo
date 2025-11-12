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
  renderComposite(composite.order, sequenceNode);
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

function renderComposite(entries, targetNode) {
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

  targetNode[CLEANUP_SYMBOL] = setupMarquee(track, segment, {
    boxCount: entries.length,
    targetNode,
  });
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
