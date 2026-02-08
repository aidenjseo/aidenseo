/**
 * DNA Transcription Hero Animation
 * 2.5D double helix on Canvas — reads RNA codons (3 nucleotides = 1 letter).
 * Continuous smooth scroll drives transcription. Stop codon triggers phrase transition.
 */

const COMPLEMENT = { A: "U", U: "A", G: "C", C: "G" };

const COLOR = {
  activeFront: "rgba(214, 138, 156, 0.95)",
  activeBack: "rgba(214, 138, 156, 0.3)",
  activeGlow: "rgba(214, 138, 156, 0.5)",
  // Stop codon uses a red-ish tint
  stopFront: "rgba(180, 40, 40, 0.9)",
  stopBack: "rgba(180, 40, 40, 0.3)",
  stopGlow: "rgba(180, 40, 40, 0.45)",
  beadFront: "rgba(85, 107, 47, 0.45)",
  beadBack: "rgba(85, 107, 47, 0.12)",
  basePairFront: "rgba(29, 31, 26, 0.1)",
  basePairBack: "rgba(29, 31, 26, 0.03)",
};

class HelixRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.amplitude = opts.amplitude || 30;
    this.beadSpacing = opts.beadSpacing || 18;
    this.beadRadius = opts.beadRadius || 6;
    this.angularFreq = opts.angularFreq || 0.045;

    this.offset = 0;

    this.sequence = "";
    this.complementSequence = "";

    this.activeBeadStart = null;
    this.isStopCodon = false;

    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener("resize", this._resizeHandler);
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.centerY = this.height / 2;
  }

  setSequence(seq) {
    this.sequence = seq;
    this.complementSequence = seq
      .split("")
      .map((n) => COMPLEMENT[n] || n)
      .join("");
  }

  setInitialOffset(beadIdx) {
    this.offset = (beadIdx + 1) * this.beadSpacing;
  }

  clearHighlight() {
    this.activeBeadStart = null;
    this.isStopCodon = false;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.sequence) return;

    const seqLen = this.sequence.length;
    const halfW = this.width / 2;
    const items = [];

    const visibleStart = Math.floor((this.offset - this.width) / this.beadSpacing) - 2;
    const visibleEnd = Math.ceil((this.offset + this.width) / this.beadSpacing) + 2;

    for (let i = visibleStart; i <= visibleEnd; i++) {
      const idx = ((i % seqLen) + seqLen) % seqLen;
      const x = i * this.beadSpacing - this.offset + halfW;
      if (x < -30 || x > this.width + 30) continue;

      const angle = i * this.beadSpacing * this.angularFreq;

      const yA = this.centerY + this.amplitude * Math.sin(angle);
      const zA = Math.cos(angle);
      const yB = this.centerY + this.amplitude * Math.sin(angle + Math.PI);
      const zB = -zA;

      const isActive =
        this.activeBeadStart !== null &&
        i >= this.activeBeadStart &&
        i < this.activeBeadStart + 3;

      items.push({ type: "line", x, yA, yB, z: Math.min(zA, zB), active: isActive });
      items.push({ type: "bead", x, y: yA, z: zA, nuc: this.sequence[idx], active: isActive });
      items.push({ type: "bead", x, y: yB, z: zB, nuc: this.complementSequence[idx], active: isActive });
    }

    items.sort((a, b) => a.z - b.z);

    const stopMode = this.isStopCodon;
    for (const item of items) {
      if (item.type === "line") {
        this._drawBasePair(ctx, item, stopMode);
      } else {
        this._drawBead(ctx, item, stopMode);
      }
    }
  }

  _drawBasePair(ctx, item, stopMode) {
    const isFront = item.z > -0.3;
    if (item.active) {
      const c = stopMode ? "180, 40, 40" : "214, 138, 156";
      ctx.strokeStyle = isFront ? `rgba(${c}, 0.2)` : `rgba(${c}, 0.06)`;
    } else {
      ctx.strokeStyle = isFront ? COLOR.basePairFront : COLOR.basePairBack;
    }
    ctx.lineWidth = item.active ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(item.x, item.yA);
    ctx.lineTo(item.x, item.yB);
    ctx.stroke();
  }

  _drawBead(ctx, item, stopMode) {
    const isFront = item.z > 0;
    const depthScale = 0.6 + 0.4 * ((item.z + 1) / 2);
    const r = (item.active ? this.beadRadius * 1.3 : this.beadRadius) * depthScale;

    ctx.beginPath();
    ctx.arc(item.x, item.y, r, 0, Math.PI * 2);

    if (item.active) {
      if (stopMode) {
        ctx.fillStyle = isFront ? COLOR.stopFront : COLOR.stopBack;
        if (isFront) { ctx.shadowColor = COLOR.stopGlow; ctx.shadowBlur = 10; }
      } else {
        ctx.fillStyle = isFront ? COLOR.activeFront : COLOR.activeBack;
        if (isFront) { ctx.shadowColor = COLOR.activeGlow; ctx.shadowBlur = 10; }
      }
    } else {
      ctx.fillStyle = isFront ? COLOR.beadFront : COLOR.beadBack;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    if (isFront && r > 3.5) {
      ctx.fillStyle = item.active ? "#fff" : "rgba(255,255,255,0.75)";
      ctx.font = `${item.active ? "bold " : ""}${Math.round(r * 1.3)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.nuc, item.x, item.y + 0.5);
    }
  }

  destroy() {
    window.removeEventListener("resize", this._resizeHandler);
  }
}


class DragController {
  constructor(canvas) {
    this.canvas = canvas;
    this.dragging = false;
    this.lastX = 0;
    this.dragDelta = 0; // accumulated px to apply (positive = scroll forward)

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    canvas.addEventListener("pointerdown", this._onDown);
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp);
  }

  _onDown(e) {
    this.dragging = true;
    this.lastX = e.clientX;
    this.dragDelta = 0;
    this.canvas.style.cursor = "grabbing";
  }

  _onMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    // Dragging left (dx < 0) => scroll forward (positive delta)
    this.dragDelta -= dx * 0.5;
  }

  _onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.style.cursor = "grab";
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────

const CODON_INTERVAL = 500; // ms per codon at base speed

function initDNA() {
  const dataEl = document.getElementById("rna-sequences-data");
  if (!dataEl) return;

  const sequences = JSON.parse(dataEl.textContent);
  // Shuffle once on load — order is random but fixed for the session
  for (let i = sequences.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sequences[i], sequences[j]] = [sequences[j], sequences[i]];
  }

  const canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  const rootEl = document.querySelector("[data-dna-root]");
  const phraseEl = document.querySelector("[data-dna-phrase]");

  const helix = new HelixRenderer(canvas, {
    amplitude: Math.min(40, window.innerHeight * 0.045),
    beadSpacing: 18,
    beadRadius: 6,
    angularFreq: 0.045,
  });

  const drag = new DragController(canvas);
  canvas.style.cursor = "grab";

  let currentSeqIdx = 0;
  let currentPhrase = "";
  let firstInit = true;

  // Continuous scroll state
  let baseVelocity = 0;      // px per ms (constant for current phrase)
  let lastFrameTime = 0;
  let codonBase = 0;          // absolute bead offset where current phrase starts
  let codonBaseOffset = 0;    // helix.offset value at codonBase
  let revealedCount = 0;      // number of letters currently shown
  let phase = "idle";         // "scrolling" | "decelerating" | "waiting" | "idle"
  let waitTimer = 0;          // ms remaining in wait phases

  function seqEntry(idx) {
    const len = sequences.length;
    return sequences[((idx % len) + len) % len];
  }

  function startSequence(idx) {
    const entry = seqEntry(idx);
    helix.setSequence(entry.sequence);
    helix.clearHighlight();

    if (firstInit) {
      helix.setInitialOffset(-8);
      firstInit = false;
    }

    currentPhrase = entry.phrase;

    if (rootEl) rootEl.textContent = entry.root;
    if (phraseEl) {
      phraseEl.innerHTML = "";
      phraseEl.style.opacity = "1";
    }

    // Calculate constant velocity: each char = 1 codon = 3 beads, +1 for stop codon
    const numCodons = currentPhrase.length;
    const totalBeadDistance = (numCodons + 1) * 3 * helix.beadSpacing;
    const totalTime = (numCodons + 1) * CODON_INTERVAL;
    baseVelocity = totalBeadDistance / totalTime;

    // Track where this phrase's codons start in scroll-space
    codonBase = Math.round(helix.offset / helix.beadSpacing);
    codonBaseOffset = helix.offset;
    revealedCount = 0;
    phase = "scrolling";
  }

  function restorePreviousSequence() {
    currentSeqIdx--;
    const entry = seqEntry(currentSeqIdx);
    helix.setSequence(entry.sequence);
    helix.clearHighlight();
    currentPhrase = entry.phrase;

    if (rootEl) rootEl.textContent = entry.root;
    if (phraseEl) {
      phraseEl.innerHTML = "";
      phraseEl.style.opacity = "1";
    }

    // Recalculate velocity for this phrase
    const numCodons = currentPhrase.length;
    const totalBeadDistance = (numCodons + 1) * 3 * helix.beadSpacing;
    const totalTime = (numCodons + 1) * CODON_INTERVAL;
    baseVelocity = totalBeadDistance / totalTime;

    // Position codonBaseOffset so current scroll maps into this phrase's range
    // The phrase spans (phrase.length * 3) beads, plus 3 for the stop codon gap
    const phraseBeadSpan = (currentPhrase.length + 1) * 3;
    codonBaseOffset = helix.offset - phraseBeadSpan * helix.beadSpacing;
    codonBase = Math.round(codonBaseOffset / helix.beadSpacing);
    revealedCount = 0;
    phase = "scrolling";
  }

  function revealLetter(idx) {
    if (!phraseEl) return;
    const letter = currentPhrase[idx];
    const span = document.createElement("span");
    span.className = "dna-letter-in";
    if (letter === " ") {
      span.innerHTML = "&nbsp;";
    } else {
      span.textContent = letter;
    }
    phraseEl.appendChild(span);
  }

  function syncText(targetLetters) {
    // Add letters
    while (revealedCount < targetLetters) {
      revealLetter(revealedCount);
      revealedCount++;
    }
    // Remove letters
    while (revealedCount > targetLetters && phraseEl && phraseEl.lastChild) {
      phraseEl.removeChild(phraseEl.lastChild);
      revealedCount--;
    }

    // Update highlight
    if (targetLetters > 0 && targetLetters <= currentPhrase.length) {
      helix.activeBeadStart = codonBase + (targetLetters - 1) * 3;
      helix.isStopCodon = false;
    } else {
      helix.clearHighlight();
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);

    if (!lastFrameTime) {
      lastFrameTime = now;
      helix.draw();
      return;
    }

    const dt = Math.min(now - lastFrameTime, 50);
    lastFrameTime = now;

    if (phase === "scrolling") {
      if (drag.dragging) {
        helix.offset += drag.dragDelta;
        drag.dragDelta = 0;
      } else {
        helix.offset += baseVelocity * dt;
      }

      const beadProgress = (helix.offset - codonBaseOffset) / helix.beadSpacing;

      // Scrolled backward past current phrase start — restore previous phrase
      if (beadProgress < 0) {
        restorePreviousSequence();
        helix.draw();
        return;
      }

      const targetLetters = Math.max(0, Math.min(currentPhrase.length, Math.floor(beadProgress / 3)));

      syncText(targetLetters);

      // Stop codon zone: show red highlight when scrolled past all letters
      const stopCodonBead = currentPhrase.length * 3;
      if (beadProgress >= stopCodonBead) {
        helix.activeBeadStart = codonBase + stopCodonBead;
        helix.isStopCodon = true;
      }

      // Advance to next phrase only well past the stop codon
      if (beadProgress >= stopCodonBead + 6) {
        if (drag.dragging) {
          helix.clearHighlight();
          currentSeqIdx++;
          startSequence(currentSeqIdx);
        } else {
          phase = "decelerating";
          waitTimer = 1000;
        }
      }
    } else if (phase === "decelerating" || phase === "waiting") {
      // Lock out drag during stop codon transition — discard any drag input
      drag.dragDelta = 0;

      baseVelocity *= Math.pow(0.96, dt / 16.67);
      helix.offset += baseVelocity * dt;

      waitTimer -= dt;
      if (phase === "decelerating" && waitTimer <= 0) {
        if (phraseEl) phraseEl.style.opacity = "0";
        phase = "waiting";
        waitTimer = 800;
      } else if (phase === "waiting" && waitTimer <= 0) {
        helix.clearHighlight();
        baseVelocity = 0;
        currentSeqIdx++;
        startSequence(currentSeqIdx);
      }

      // Keep stop codon highlight fixed every frame
      const stopCodonBead = currentPhrase.length * 3;
      helix.activeBeadStart = codonBase + stopCodonBead;
      helix.isStopCodon = true;
    }

    helix.draw();
  }

  startSequence(0);
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDNA);
} else {
  initDNA();
}
