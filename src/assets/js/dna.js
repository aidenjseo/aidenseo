/**
 * DNA Transcription Hero Animation
 * 2.5D double helix on Canvas — reads RNA codons (3 nucleotides = 1 letter).
 * Continuous smooth scroll drives transcription. Stop codon triggers phrase transition.
 */

const COMPLEMENT = { A: "U", U: "A", G: "C", C: "G" };

const COLOR = {
  activeFront: "rgba(133, 0, 133, 0.95)",
  activeBack: "rgba(133, 0, 133, 0.3)",
  activeGlow: "rgba(133, 0, 133, 0.5)",
  // Stop codon uses a red-ish tint
  stopFront: "rgba(180, 40, 40, 0.9)",
  stopBack: "rgba(180, 40, 40, 0.3)",
  stopGlow: "rgba(180, 40, 40, 0.45)",
  beadFront: "rgba(0, 133, 0, 0.45)",
  beadBack: "rgba(0, 133, 0, 0.12)",
  basePairFront: "rgba(17, 17, 17, 0.1)",
  basePairBack: "rgba(17, 17, 17, 0.03)",
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

    this.activeBeadStart = -1;
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
    this.activeBeadStart = -1;
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
        this.activeBeadStart >= 0 &&
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
      const c = stopMode ? "180, 40, 40" : "133, 0, 133";
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

    if (isFront && r > 5) {
      ctx.fillStyle = item.active ? "#fff" : "rgba(255,255,255,0.75)";
      ctx.font = `${item.active ? "bold " : ""}${Math.round(r * 1.3)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.nuc, item.x, item.y + 0.5);
    }
  }

  destroy() {
    window.removeEventListener("resize", this._resizeHandler);
  }
}

class TranscriptionEngine {
  constructor(sequence, phrase) {
    this.sequence = sequence;
    this.phrase = phrase;
    this.letterIndex = 0;
    this.codonIndex = 0;
    this.done = false;
  }

  next() {
    if (this.letterIndex >= this.phrase.length) {
      this.done = true;
      return null;
    }
    const letter = this.phrase[this.letterIndex];
    const codonStart = this.codonIndex;

    if (letter !== " ") {
      this.codonIndex += 3;
    }

    this.letterIndex++;
    if (this.letterIndex >= this.phrase.length) this.done = true;
    return { letter, codonStart, letterIndex: this.letterIndex - 1 };
  }

  get stopCodonStart() {
    return this.codonIndex;
  }
}

class DragController {
  constructor(canvas) {
    this.canvas = canvas;
    this.dragging = false;
    this.lastX = 0;
    this.speedMultiplier = 1;
    this._decayRaf = null;

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
    this.canvas.style.cursor = "grabbing";
    if (this._decayRaf) cancelAnimationFrame(this._decayRaf);
  }

  _onMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.speedMultiplier = Math.max(-2, Math.min(5, 1 + dx * 0.05));
  }

  _onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.style.cursor = "grab";
    this._decayToNormal();
  }

  _decayToNormal() {
    const decay = () => {
      this.speedMultiplier += (1 - this.speedMultiplier) * 0.08;
      if (Math.abs(this.speedMultiplier - 1) > 0.01) {
        this._decayRaf = requestAnimationFrame(decay);
      } else {
        this.speedMultiplier = 1;
      }
    };
    this._decayRaf = requestAnimationFrame(decay);
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    if (this._decayRaf) cancelAnimationFrame(this._decayRaf);
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────

const CODON_INTERVAL = 500; // ms per codon at base speed

function initDNA() {
  const dataEl = document.getElementById("rna-sequences-data");
  if (!dataEl) return;

  const sequences = JSON.parse(dataEl.textContent);
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
  let engine = null;

  // Continuous scroll state
  let velocity = 0;           // px per ms
  let lastFrameTime = 0;
  let nextCodonBead = 0;      // bead index of the next codon boundary to cross
  let phase = "idle";         // "scrolling" | "decelerating" | "waiting" | "idle"
  let waitTimer = 0;          // ms remaining in wait phases
  let phraseComplete = false;

  function countCodons(phrase) {
    let n = 0;
    for (const ch of phrase) {
      if (ch !== " ") n++;
    }
    return n;
  }

  function startSequence(idx) {
    const entry = sequences[idx % sequences.length];
    helix.setSequence(entry.sequence);
    helix.clearHighlight();
    helix.setInitialOffset(-8);

    engine = new TranscriptionEngine(entry.sequence, entry.phrase);

    if (rootEl) rootEl.textContent = entry.root;
    if (phraseEl) {
      phraseEl.innerHTML = "";
      phraseEl.style.opacity = "1";
    }

    // Calculate constant velocity
    const numCodons = countCodons(entry.phrase);
    // +1 for stop codon travel
    const totalBeadDistance = (numCodons + 1) * 3 * helix.beadSpacing;
    const totalTime = (numCodons + 1) * CODON_INTERVAL;
    velocity = totalBeadDistance / totalTime;

    nextCodonBead = 0;
    phraseComplete = false;
    phase = "scrolling";
  }

  function revealLetter(result) {
    if (!phraseEl) return;
    const span = document.createElement("span");
    span.className = "dna-letter-in";
    if (result.letter === " ") {
      span.innerHTML = "&nbsp;";
    } else {
      span.textContent = result.letter;
    }
    phraseEl.appendChild(span);
  }

  function loop(now) {
    requestAnimationFrame(loop);

    if (!lastFrameTime) {
      lastFrameTime = now;
      helix.draw();
      return;
    }

    // Cap dt to avoid huge jumps on tab-switch
    const dt = Math.min(now - lastFrameTime, 50);
    lastFrameTime = now;

    if (phase === "scrolling") {
      // Apply drag multiplier to velocity
      helix.offset += velocity * dt * drag.speedMultiplier;

      // Check if we crossed the next codon boundary
      const boundaryOffset = nextCodonBead * helix.beadSpacing;
      // Use helix.offset relative to initial position: initial was at (-8+1)*18 = -126
      // The offset grows as we scroll. Codon at bead 0 boundary = 0 * 18 = 0
      // We want to trigger when helix.offset reaches the point where bead nextCodonBead
      // is at center. Since setInitialOffset(-8) sets offset = -7*18 = -126,
      // and beads scroll left as offset increases, the bead at index B is at center
      // when offset = (B+1)*beadSpacing (matching old setInitialOffset logic).
      const triggerOffset = (nextCodonBead + 1) * helix.beadSpacing;

      if (helix.offset >= triggerOffset) {
        if (!engine.done) {
          const result = engine.next();
          if (result) {
            if (result.letter !== " ") {
              helix.activeBeadStart = result.codonStart;
              helix.isStopCodon = false;
              nextCodonBead = result.codonStart + 3;
            } else {
              // Space — no highlight change, just advance boundary slightly
              nextCodonBead += 1;
            }
            revealLetter(result);
          }
          // Check if engine finished after this read
          if (engine.done) {
            phraseComplete = true;
            // Set next boundary to stop codon position
            nextCodonBead = engine.stopCodonStart;
          }
        } else if (phraseComplete) {
          // We've scrolled past the stop codon boundary — show stop codon
          helix.activeBeadStart = engine.stopCodonStart;
          helix.isStopCodon = true;
          phraseComplete = false;
          phase = "decelerating";
          waitTimer = 1200; // hold stop codon visible for 1200ms before fading
        }
      }
    } else if (phase === "decelerating") {
      // Smoothly decelerate
      velocity *= Math.pow(0.96, dt / 16.67); // normalize to ~60fps
      helix.offset += velocity * dt * drag.speedMultiplier;

      waitTimer -= dt;
      if (waitTimer <= 0) {
        // Begin fade-out
        if (phraseEl) phraseEl.style.opacity = "0";
        phase = "waiting";
        waitTimer = 800; // wait for fade transition
      }
    } else if (phase === "waiting") {
      // Still drifting slowly during fade
      helix.offset += velocity * dt * drag.speedMultiplier;
      velocity *= Math.pow(0.96, dt / 16.67);

      waitTimer -= dt;
      if (waitTimer <= 0) {
        helix.clearHighlight();
        velocity = 0;
        currentSeqIdx++;
        startSequence(currentSeqIdx);
      }
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
